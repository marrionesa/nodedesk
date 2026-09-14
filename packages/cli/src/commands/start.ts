/**
 * `nodedesk start <path>` — arranca el proceso de un proyecto.
 *
 * Dos modos sobre `ProcessManager` de @nodedesk/core:
 *
 * - **attached** (por defecto): banner con comando/pid, re-emisión de stdout
 *   y stderr línea a línea coloreada por clasificación (error→rojo,
 *   warn→amarillo, system→cian atenuado, info→normal). Con SIGINT/SIGTERM
 *   el CLI hace un apagado limpio (`manager.stop()`) y propaga el código de
 *   salida del hijo.
 * - **detached** (`--detached`): proceso en background con log persistente
 *   (`~/.nodedesk-v2/logs/<slug>.log`), anotado en el registro de procesos;
 *   la CLI termina inmediatamente y el proceso sigue vivo.
 *
 * La opción `--exit-after <ms>` (interna, usada por los tests) apaga el
 * proceso limpiamente tras ese tiempo.
 */

import path from "node:path";

import {
  ProjectManager,
  ProcessRegistry,
  defaultLogsDir
} from "@nodedesk/core";
import type {
  LogEntry,
  NodeProject,
  ProcessExit,
  ProcessInfo
} from "@nodedesk/core";

import {
  banner,
  bold,
  cyan,
  dim,
  println,
  printJson,
  printSuccess,
  red,
  yellow
} from "../ui.js";

/** Opciones del comando `start`. */
export interface StartOptions {
  /** Script de package.json (`dev` → `start` → `main` por defecto). */
  script?: string;
  /** Modo background con log persistente y registro. */
  detached?: boolean;
  /** Override de la variable de entorno `PORT`. */
  port?: number;
  /** Salida JSON (info del proceso). */
  json?: boolean;
  /** Instala dependencias si falta node_modules antes de arrancar. */
  install?: boolean;
  /** Interna para tests: apagado limpio tras N ms. */
  exitAfter?: number;
}

/** Colorea una línea según su clasificación (port de `classifyLine`). */
function formatLogLine(entry: LogEntry): string {
  switch (entry.level) {
    case "error":
      return red(entry.line);
    case "warn":
      return yellow(entry.line);
    case "system":
      return dim(cyan(entry.line));
    default:
      return entry.line;
  }
}

/** Variables extra para el hijo (override de `PORT`). */
function portEnv(options: StartOptions): Record<string, string> {
  return options.port !== undefined ? { PORT: String(options.port) } : {};
}

/** Ejecuta `nodedesk start` en modo detached (background). */
async function startDetached(
  target: string,
  project: NodeProject,
  options: StartOptions
): Promise<number> {
  const manager = project.createProcessManager(options.script);
  const logFile = path.join(defaultLogsDir(), `${project.slug}.log`);

  const info: ProcessInfo = await manager.start({
    detached: true,
    logFile,
    registry: true,
    autoInstall: options.install === true,
    env: portEnv(options)
  });

  if (options.json) {
    printJson({ ...info, root: project.root, slug: project.slug, logFile });
    return 0;
  }

  printSuccess(`proceso arrancado en background (pid ${info.pid})`);
  println(`  ${bold("comando")}   ${info.command}`);
  println(`  ${bold("logs")}      ${dim(logFile)}`);
  println(`  ${bold("parar")}     ${cyan(`nodedesk stop ${target}`)}`);
  return 0;
}

/** Ejecuta `nodedesk start` en modo attached (por defecto). */
async function startAttached(
  target: string,
  project: NodeProject,
  options: StartOptions
): Promise<number> {
  const manager = project.createProcessManager(options.script);

  const info: ProcessInfo = await manager.start({
    autoInstall: options.install === true,
    env: portEnv(options)
  });

  // ¿El propio CLI pidió el apagado (Ctrl+C, SIGTERM o --exit-after)?
  let stopRequested = false;

  const requestStop = async (reason: string): Promise<void> => {
    if (stopRequested) return;
    stopRequested = true;
    if (!options.json) {
      println("");
      println(yellow(`↯ ${reason}, apagando…`));
    }
    await manager.stop();
  };

  if (options.json) {
    // Primera línea de stdout = info del proceso (parseable por scripts).
    println(
      JSON.stringify({
        pid: info.pid,
        command: info.command,
        root: project.root,
        startedAt: info.startedAt
      })
    );
  } else {
    println(
      banner("nodedesk start", [
        `${bold("proyecto")}   ${project.name}`,
        `${bold("comando")}    ${info.command}`,
        `${bold("pid")}        ${info.pid ?? "—"}`,
        `${bold("ruta")}       ${dim(target)}`,
        "",
        "Ctrl+C para detener"
      ])
    );
  }

  // Re-emisión de la salida del hijo, línea a línea y coloreada.
  manager.on("log", (entry: LogEntry) => {
    if (options.json) {
      // En modo JSON stdout queda limpio para datos: los logs van a stderr.
      process.stderr.write(`${entry.line}\n`);
    } else {
      process.stdout.write(`${formatLogLine(entry)}\n`);
    }
  });

  process.once("SIGINT", () => void requestStop("interrupción recibida"));
  process.once("SIGTERM", () => void requestStop("interrupción recibida"));

  const exitAfter = options.exitAfter;
  if (exitAfter !== undefined) {
    setTimeout(() => {
      void requestStop(`--exit-after ${exitAfter}ms`);
    }, exitAfter);
  }

  const exit: ProcessExit = await manager.wait();

  if (options.json) {
    // Última línea de stdout = resultado del ciclo de vida.
    println(
      JSON.stringify({ event: "exit", code: exit.code, signal: exit.signal })
    );
  } else {
    println("");
    if (exit.code !== null) {
      println(`proceso terminado con código de salida ${exit.code}`);
    } else {
      println(`proceso terminado por señal ${exit.signal ?? "desconocida"}`);
    }
  }

  // Apagado pedido por el usuario → éxito; muerte espontánea → su código.
  return stopRequested ? 0 : (exit.code ?? 0);
}

/** Ejecuta `nodedesk start`. Devuelve el código de salida. */
export async function startCommand(
  target: string,
  options: StartOptions
): Promise<number> {
  // Limpieza perezosa del registro antes de anotar procesos nuevos.
  await new ProcessRegistry().prune();

  const project = await ProjectManager.load(target);

  if (options.detached === true) {
    return startDetached(target, project, options);
  }
  return startAttached(target, project, options);
}
