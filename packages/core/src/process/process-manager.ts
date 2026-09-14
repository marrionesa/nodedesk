import { EventEmitter } from "node:events";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { spawn } from "node:child_process";

import { PathNotFoundError } from "../errors.js";
import { ProcessError } from "../errors.js";
import type {
  LoggerLike,
  LogEntry,
  ProcessExit,
  ProcessInfo,
  ProcessStartOptions,
  ProcessStatus
} from "../types/process.js";
import type {
  PackageManagerInfo,
  PackageJson
} from "../types/project.js";
import { readPackageJson } from "../project/package-json.js";
import {
  detectPackageManager,
  installCommand,
  scriptCommand
} from "../project/package-manager.js";
import { EnvManager } from "../env/env-manager.js";
import { classifyLine } from "./classify.js";
import { terminateProcessGroup } from "./kill.js";
import { ProcessRegistry } from "./process-registry.js";
import { nowIso, shortUid } from "../utils/id.js";
import { promises as fsp } from "node:fs";

/**
 * Gestor del ciclo de vida de procesos de un proyecto.
 *
 * Port de `process.rs` de V1 (`power_on` / `power_off` / `restart`) a
 * Node.js puro:
 *
 * - el hijo arranca en grupo/sesión propia (`detached: true`) para que el
 *   apagado nunca toque al proceso padre,
 * - stdout/stderr se leen línea a línea y se emiten como eventos
 *   clasificados (`log`, `stdout`, `stderr`),
 * - el apagado es SIGTERM al grupo completo → gracia → SIGKILL.
 *
 * ```ts
 * const manager = new ProcessManager("./my-project");
 * manager.on("stdout", (line) => console.log(line));
 * const info = await manager.start({ script: "dev" });
 * await manager.stop();
 * ```
 */
export class ProcessManager extends EventEmitter {
  /** Id estable de este gestor. */
  readonly id: string;

  private readonly root: string;
  private readonly defaults: {
    script?: string;
    packageManager?: PackageManagerInfo;
    scripts: Record<string, string>;
    main: string | null;
  };

  private _status: ProcessStatus = "idle";
  private _pid: number | null = null;
  private _command = "";
  private _startedAt: string | null = null;
  private _exitCode: number | null = null;
  private _signal: string | null = null;

  private child: ReturnType<typeof spawn> | null = null;
  private exitWaiters: Array<(result: ProcessExit) => void> = [];

  constructor(
    project: string,
    defaults: {
      script?: string;
      packageManager?: PackageManagerInfo;
      scripts?: Record<string, string>;
      main?: string | null;
    } = {}
  ) {
    super();
    this.root = path.resolve(project);
    this.defaults = {
      script: defaults.script,
      packageManager: defaults.packageManager,
      scripts: defaults.scripts ?? {},
      main: defaults.main ?? null
    };
    this.id = `proc-${shortUid("m")}`;
  }

  /** Estado actual del gestor. */
  get status(): ProcessStatus {
    return this._status;
  }

  /** PID del proceso vivo (o `null`). */
  get pid(): number | null {
    return this._pid;
  }

  /** Snapshot de información del proceso. */
  get info(): ProcessInfo {
    return {
      id: this.id,
      pid: this._pid,
      status: this._status,
      command: this._command,
      startedAt: this._startedAt,
      exitCode: this._exitCode,
      signal: this._signal
    };
  }

  /** `true` si hay un proceso vivo gestionado. */
  get running(): boolean {
    return this._status === "running" || this._status === "starting";
  }

  /**
   * Resuelve el comando a ejecutar para el proyecto.
   * Derivado de `process.rs::dev_command` + `read_dev_command` de V1.
   */
  async resolveCommand(script?: string): Promise<string> {
    const pkg: PackageJson | null = await readPackageJson(this.root);
    if (pkg === null) {
      throw new ProcessError(
        `${this.root} no contiene package.json — no hay nada que arrancar`
      );
    }

    const scripts = pkg.scripts ?? {};
    const pm: PackageManagerInfo =
      this.defaults.packageManager ??
      (await detectPackageManager(this.root, pkg));

    const wanted =
      script ??
      this.defaults.script ??
      (typeof scripts.dev === "string"
        ? "dev"
        : typeof scripts.start === "string"
          ? "start"
          : null);

    if (wanted !== null && typeof scripts[wanted] === "string") {
      return scriptCommand(pm, wanted);
    }
    if (pkg.main) return `node ${pkg.main}`;
    throw new ProcessError(
      `el proyecto no define los scripts "dev" ni "start" ni un campo "main"`
    );
  }

  /**
   * Arranca el proceso del proyecto.
   *
   * @param options.script script de package.json (por defecto `dev` → `start` → `main`).
   * @param options.command comando explícito (tiene prioridad).
   * @param options.env variables extra (ganarán sobre `.env` y `process.env`).
   * @param options.detached modo background con stdio a `logFile`.
   */
  async start(options: ProcessStartOptions = {}): Promise<ProcessInfo> {
    if (this.running) {
      throw new ProcessError(
        `el proceso ${this.id} ya está corriendo (pid ${this._pid})`
      );
    }
    if (!(await this.pathExists(this.root))) {
      throw new PathNotFoundError(this.root);
    }

    const logger = options.logger ?? null;
    const command =
      options.command ??
      (await this.resolveCommand(options.script ?? this.defaults.script));

    this._status = "starting";
    this._exitCode = null;
    this._signal = null;
    this._command = command;

    const registry =
      options.registry === true
        ? new ProcessRegistry()
        : (options.registry ?? null);

    // Instalación de dependencias si falta node_modules (V1: power_on).
    if (options.autoInstall === true) {
      await this.installIfMissing(logger);
    }

    // Entorno: process.env + .env del proyecto + overrides.
    const envManager = new EnvManager(this.root);
    const env = await envManager.buildEnvironment(options.env ?? {});

    const cwd = options.cwd ? path.resolve(options.cwd) : this.root;
    const detached = options.detached === true;

    let stdio: Array<"ignore" | "pipe" | fs.WriteStream>;
    let logStream: fs.WriteStream | null = null;
    let logFile: string | undefined;

    if (detached) {
      logFile = options.logFile;
      if (logFile) {
        await fsp.mkdir(path.dirname(logFile), { recursive: true });
        logStream = fs.createWriteStream(logFile, { flags: "a" });
        await new Promise<void>((resolve, reject) => {
          logStream!.once("open", () => resolve());
          logStream!.once("error", reject);
        });
        stdio = ["ignore", logStream, logStream];
      } else {
        stdio = ["ignore", "ignore", "ignore"];
      }
    } else {
      stdio = ["ignore", "pipe", "pipe"];
    }

    this._status = "running";
    this.emit("status", this._status);

    const child = spawn(command, {
      cwd,
      env,
      shell: true,
      detached: true, // Siempre grupo propio: el apagado nunca toca al padre.
      stdio
    });

    this.child = child;
    this._pid = child.pid ?? null;
    this._startedAt = nowIso();
    const startInfo = this.info;
    this.emit("start", startInfo);
    this.emitLog(`[nodedesk] lanzando: ${command}`, "system", logger);

    if (registry && this._pid !== null) {
      await registry.add({
        pid: this._pid,
        root: this.root,
        command,
        startedAt: this._startedAt,
        logFile
      });
      this.attachRegistry(registry, this._pid);
    }

    child.once("error", (error) => {
      this._status = "error";
      this.emit("status", this._status);
      this.emit("error", error);
      this.resolveWaiters(null, "SPAWN_ERROR");
    });

    child.once("exit", (code, signal) => {
      this._exitCode = code;
      this._signal = signal;
      this._status = "exited";
      this._pid = null;
      this.child = null;
      this.emit("status", this._status);
      this.emit("exit", { code, signal });
      this.emitLog(
        `[nodedesk] proceso terminado${code !== null ? ` (exit ${code})` : ""}`,
        "system",
        logger
      );
      logStream?.end();
      this.resolveWaiters(code, signal);
    });

    if (!detached) {
      this.pipeLines(child.stdout, "stdout", logger);
      this.pipeLines(child.stderr, "stderr", logger);
    } else {
      child.unref(); // El padre puede morir: el proceso sigue vivo.
      this.emitLog(
        logFile
          ? `[nodedesk] modo background — logs en ${logFile}`
          : "[nodedesk] modo background — sin salida capturada",
        "system",
        logger
      );
    }

    return startInfo;
  }

  /**
   * Detiene el proceso y su grupo completo (SIGTERM → gracia → SIGKILL).
   * Sin error si no estaba corriendo.
   */
  async stop(graceMs?: number): Promise<void> {
    if (this.child === null || this._pid === null) return;

    this._status = "stopping";
    this.emit("status", this._status);
    this.emitLog(
      `[nodedesk] apagando (SIGTERM al grupo ${this._pid})…`,
      "system",
      null
    );

    const grace = graceMs ?? 2000;
    const pid = this._pid;

    const exited = new Promise<ProcessExit>((resolve) => {
      this.once("exit", resolve);
    });

    await terminateProcessGroup(pid, grace);

    // Esperar el evento exit del hijo (con tope de seguridad).
    const timeout = new Promise<ProcessExit>((resolve) =>
      setTimeout(() => resolve({ code: null, signal: "TIMEOUT" }), 3000)
    );
    await Promise.race([exited, timeout]);
  }

  /** Reinicia: apaga (si corre) y arranca de nuevo con las mismas opciones. */
  async restart(options: ProcessStartOptions = {}): Promise<ProcessInfo> {
    if (this.running) {
      await this.stop(options.graceMs);
    }
    return this.start(options);
  }

  /**
   * Espera a que el proceso termine.
   * Resuelve inmediatamente si ya no está corriendo.
   */
  async wait(): Promise<ProcessExit> {
    if (!this.running && this.exitWaiters.length === 0) {
      return { code: this._exitCode, signal: this._signal };
    }
    return new Promise<ProcessExit>((resolve) => {
      this.exitWaiters.push(resolve);
    });
  }

  /* ------------------------------ internos ----------------------------- */

  private async installIfMissing(logger: LoggerLike | null): Promise<void> {
    const hasModules = await fsp
      .access(path.join(this.root, "node_modules"))
      .then(() => true)
      .catch(() => false);
    if (hasModules) return;

    const pkg = await readPackageJson(this.root);
    const pm: PackageManagerInfo =
      this.defaults.packageManager ??
      (await detectPackageManager(this.root, pkg));
    const install = installCommand(pm);
    this.emitLog(
      `[nodedesk] node_modules ausente → ${install}`,
      "system",
      logger
    );

    await new Promise<void>((resolve, reject) => {
      const child = spawn(install, {
        cwd: this.root,
        shell: true,
        stdio: "ignore"
      });
      child.once("error", reject);
      child.once("exit", (code) =>
        code === 0
          ? resolve()
          : reject(
              new ProcessError(
                `la instalación de dependencias falló (exit ${code})`
              )
            )
      );
    });

    this.emitLog("[nodedesk] ✓ dependencias instaladas", "system", logger);
  }

  private pipeLines(
    stream: NodeJS.ReadableStream | null,
    source: "stdout" | "stderr",
    logger: LoggerLike | null
  ): void {
    if (stream === null) return;
    const rl = readline.createInterface({ input: stream });
    rl.on("line", (line: string) => {
      this.emit(source, line);
      const entry = this.buildLogEntry(line, source);
      this.emit("log", entry);
      if (entry.level === "error" && logger) logger.error(line);
      else if (entry.level === "warn" && logger) logger.warn(line);
      else if (logger) logger.info(line);
    });
  }

  private buildLogEntry(
    line: string,
    source: "stdout" | "stderr" | "system"
  ): LogEntry {
    return {
      line,
      level: classifyLine(line, source),
      source,
      timestamp: nowIso()
    };
  }

  private emitLog(
    line: string,
    source: "stdout" | "stderr" | "system",
    logger: LoggerLike | null
  ): void {
    const entry = this.buildLogEntry(line, source);
    this.emit("log", entry);
    if (logger !== null) logger.info(line);
  }

  private attachRegistry(
    registry: { remove(pid: number): Promise<void> },
    pid: number
  ): void {
    this.once("exit", () => {
      void registry.remove(pid).catch(() => undefined);
    });
  }

  private resolveWaiters(code: number | null, signal: string | null): void {
    const waiters = this.exitWaiters;
    this.exitWaiters = [];
    for (const resolve of waiters) resolve({ code, signal });
  }

  private async pathExists(target: string): Promise<boolean> {
    return fsp
      .access(target)
      .then(() => true)
      .catch(() => false);
  }
}
