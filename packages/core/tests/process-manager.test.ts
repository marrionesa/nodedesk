import path from "node:path";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { ProcessError } from "../src/errors.js";
import { ProcessManager } from "../src/process/process-manager.js";
import { ProcessRegistry } from "../src/process/process-registry.js";
import {
  isKillableTarget,
  isProcessAlive,
  terminateProcessGroup
} from "../src/process/kill.js";
import { classifyLine } from "../src/process/classify.js";
import { tempDir, writeFiles } from "./helpers.js";

/** Espera (con sondeo) a que una condición se cumpla. */
async function waitFor(
  condition: () => boolean,
  timeoutMs = 5000
): Promise<void> {
  const step = 50;
  for (let waited = 0; waited < timeoutMs; waited += step) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, step));
  }
}

describe("classifyLine", () => {
  it("clasifica stderr como error", () => {
    expect(classifyLine("todo normal", "stderr")).toBe("error");
  });

  it("clasifica contenido por palabras clave", () => {
    expect(classifyLine("Error: cannot find module", "stdout")).toBe("error");
    expect(classifyLine("warning: depreca", "stdout")).toBe("warn");
    expect(classifyLine("Server ready on 3000", "stdout")).toBe("info");
    expect(classifyLine("[nodedesk] sistema", "stdout")).toBe("system");
  });
});

describe("kill safety", () => {
  it("nunca señala pid <= 1 ni el propio pid", () => {
    expect(isKillableTarget(0)).toBe(false);
    expect(isKillableTarget(1)).toBe(false);
    expect(isKillableTarget(process.pid)).toBe(false);
    expect(isKillableTarget(12345)).toBe(true);
  });

  it("terminateProcessGroup sobre pids imposibles no hace nada", async () => {
    await expect(terminateProcessGroup(0)).resolves.toBeUndefined();
    await expect(terminateProcessGroup(1)).resolves.toBeUndefined();
  });
});

describe("ProcessManager", () => {
  it("resolveCommand prefiere dev, luego start, luego main", async () => {
    const root = await tempDir();
    await writeFiles(root, {
      "package.json": JSON.stringify({
        name: "cmd",
        scripts: { dev: "node dev.mjs", start: "node start.mjs" },
        main: "src/index.mjs"
      })
    });
    const manager = new ProcessManager(root);
    expect(await manager.resolveCommand()).toBe("npm run dev");
    expect(await manager.resolveCommand("start")).toBe("npm run start");
    expect(await manager.resolveCommand("inexistente")).toBe("node src/index.mjs");
  });

  it("lanza ProcessError si no hay forma de arrancar", async () => {
    const root = await tempDir();
    await writeFiles(root, {
      "package.json": JSON.stringify({ name: "vacio" })
    });
    const manager = new ProcessManager(root);
    await expect(manager.resolveCommand()).rejects.toThrow(ProcessError);
  });

  it("arranca un proceso, emite stdout y termina con exit 0", async () => {
    const root = await tempDir();
    await writeFiles(root, {
      "package.json": JSON.stringify({
        name: "spinner",
        type: "module",
        scripts: { dev: "node runner.mjs" }
      }),
      "runner.mjs":
        "console.log('linea-uno');\nconsole.error('linea-err');\nsetTimeout(() => { console.log('linea-final'); }, 50);\n"
    });

    const manager = new ProcessManager(root);
    const lines: string[] = [];
    const logs: string[] = [];

    manager.on("stdout", (line: string) => lines.push(line));
    manager.on("log", (entry: { line: string }) => logs.push(entry.line));

    const info = await manager.start({ script: "dev" });
    expect(info.status).toBe("running");
    expect(info.pid).not.toBeNull();

    const exit = await manager.wait();
    expect(exit.code).toBe(0);
    expect(manager.status).toBe("exited");

    expect(lines).toContain("linea-uno");
    expect(lines).toContain("linea-final");
    expect(logs.some((line) => line.includes("linea-err"))).toBe(true);
  });

  it("stop() apaga un proceso largo con SIGTERM limpio", async () => {
    const root = await tempDir();
    await writeFiles(root, {
      "package.json": JSON.stringify({
        name: "eterno",
        type: "module",
        scripts: { dev: "node eternal.mjs" }
      }),
      "eternal.mjs":
        "process.on('SIGTERM', () => { console.log('adios-limpio'); process.exit(0); });\nsetInterval(() => {}, 1000);\nconsole.log('arrancado');\n"
    });

    const manager = new ProcessManager(root);
    const lines: string[] = [];
    manager.on("stdout", (line: string) => lines.push(line));

    await manager.start({ script: "dev" });
    await waitFor(() => lines.includes("arrancado"));

    await manager.stop();
    expect(manager.status).toBe("exited");
    expect(manager.pid).toBeNull();

    // El nieto (node) puede tardar unos ms en volcar su última línea.
    await waitFor(() => lines.includes("adios-limpio"), 3000);
    expect(lines).toContain("adios-limpio");
  });

  it("stop() sin proceso corriendo no lanza error", async () => {
    const root = await tempDir();
    await writeFiles(root, {
      "package.json": JSON.stringify({ name: "parado" })
    });
    const manager = new ProcessManager(root);
    await expect(manager.stop()).resolves.toBeUndefined();
  });

  it("doble start lanza ProcessError", async () => {
    const root = await tempDir();
    await writeFiles(root, {
      "package.json": JSON.stringify({
        name: "doble",
        type: "module",
        scripts: { dev: "node eternal.mjs" }
      }),
      "eternal.mjs": "setInterval(() => {}, 1000);\n"
    });

    const manager = new ProcessManager(root);
    await manager.start({ script: "dev" });
    try {
      await expect(manager.start({ script: "dev" })).rejects.toThrow(
        ProcessError
      );
    } finally {
      await manager.stop();
    }
  });

  it("repite el ciclo con restart()", async () => {
    const root = await tempDir();
    await writeFiles(root, {
      "package.json": JSON.stringify({
        name: "reinicia",
        type: "module",
        scripts: { dev: "node runner.mjs" }
      }),
      "runner.mjs": "console.log('vivo');\n"
    });

    const manager = new ProcessManager(root);
    const starts: number[] = [];
    manager.on("start", (info: { pid: number | null }) =>
      starts.push(info.pid ?? 0)
    );

    await manager.start();
    await manager.wait();
    await manager.restart();
    await manager.wait();

    expect(starts.length).toBe(2);
    expect(manager.status).toBe("exited");
  });

  it("las variables del .env llegan al proceso", async () => {
    const root = await tempDir();
    await writeFiles(root, {
      "package.json": JSON.stringify({
        name: "envtest",
        type: "module",
        scripts: { dev: "node print.mjs" }
      }),
      ".env": "SALUDO=hola-env\n",
      "print.mjs": "console.log(`saludo=${process.env.SALUDO}`);\n"
    });

    const manager = new ProcessManager(root);
    const lines: string[] = [];
    manager.on("stdout", (line: string) => lines.push(line));

    await manager.start({ script: "dev" });
    await manager.wait();

    expect(lines).toContain("saludo=hola-env");
  });

  it("los overrides de start ganan sobre el .env", async () => {
    const root = await tempDir();
    await writeFiles(root, {
      "package.json": JSON.stringify({
        name: "override",
        type: "module",
        scripts: { dev: "node print.mjs" }
      }),
      ".env": "PORT=1111\n",
      "print.mjs": "console.log(`port=${process.env.PORT}`);\n"
    });

    const manager = new ProcessManager(root);
    const lines: string[] = [];
    manager.on("stdout", (line: string) => lines.push(line));

    await manager.start({ script: "dev", env: { PORT: "9999" } });
    await manager.wait();

    expect(lines).toContain("port=9999");
  });

  it("autoInstall instala dependencias locales antes de arrancar", async () => {
    const root = await tempDir();
    await writeFiles(root, {
      "package.json": JSON.stringify({
        name: "auto-install",
        type: "module",
        scripts: { dev: "node runner.mjs" },
        dependencies: { "fixture-dependency": "file:./dependency" }
      }),
      "dependency/package.json": JSON.stringify({
        name: "fixture-dependency",
        type: "module",
        main: "index.mjs"
      }),
      "dependency/index.mjs": "export default 'instalada';\n",
      "runner.mjs":
        "import message from 'fixture-dependency';\nconsole.log(message);\n"
    });

    const manager = new ProcessManager(root);
    const lines: string[] = [];
    manager.on("stdout", (line: string) => lines.push(line));

    await manager.start({ autoInstall: true });
    await manager.wait();

    expect(lines).toContain("instalada");
  });

  it("autoInstall también instala antes de registrar un proceso detached", async () => {
    const root = await tempDir();
    const logFile = path.join(root, "installed.log");
    await writeFiles(root, {
      "package.json": JSON.stringify({
        name: "auto-install-detached",
        type: "module",
        scripts: { dev: "node runner.mjs" },
        dependencies: { "fixture-dependency": "file:./dependency" }
      }),
      "dependency/package.json": JSON.stringify({
        name: "fixture-dependency",
        type: "module",
        main: "index.mjs"
      }),
      "dependency/index.mjs": "export default 'detached-instalada';\n",
      "runner.mjs":
        "import message from 'fixture-dependency';\nconsole.log(message);\nsetInterval(() => {}, 1000);\n"
    });

    const registry = new ProcessRegistry();
    const manager = new ProcessManager(root);
    const info = await manager.start({
      autoInstall: true,
      detached: true,
      logFile,
      registry: true
    });

    const record = await registry.findByRoot(root);
    expect(record?.pid).toBe(info.pid);
    await waitFor(() => readFileSync(logFile, "utf8").includes("detached-instalada"), 5000);

    await terminateProcessGroup(info.pid!, 1500);
    await waitFor(() => manager.status === "exited", 3000);
  });

  it("comando explícito tiene prioridad sobre scripts", async () => {
    const root = await tempDir();
    await writeFiles(root, {
      "package.json": JSON.stringify({
        name: "explicito",
        scripts: { dev: "no-deberia-ejecutarse" }
      }),
      "hola.mjs": "console.log('desde-comando-explicito');\n"
    });

    const manager = new ProcessManager(root);
    const lines: string[] = [];
    manager.on("stdout", (line: string) => lines.push(line));

    await manager.start({ command: "node hola.mjs" });
    await manager.wait();

    expect(lines).toContain("desde-comando-explicito");
  });
});

describe("ProcessManager en modo detached", () => {
  it("arranca en background, anota registro y es detenido por root", async () => {
    const root = await tempDir();
    const registryFile = path.join(root, ".tmp-registry.json");
    const logFile = path.join(root, "bg.log");

    await writeFiles(root, {
      "package.json": JSON.stringify({
        name: "background",
        type: "module",
        scripts: { dev: "node bg.mjs" }
      }),
      "bg.mjs":
        "console.log('bg-arrancado');\nsetInterval(() => console.log('tick'), 40);\n"
    });

    const registry = new ProcessRegistry(registryFile);
    const manager = new ProcessManager(root);

    const info = await manager.start({
      script: "dev",
      detached: true,
      logFile,
      registry
    });

    expect(info.status).toBe("running");
    expect(info.pid).not.toBeNull();

    const record = await registry.findByRoot(root);
    expect(record).not.toBeNull();
    expect(record!.pid).toBe(info.pid);
    expect(record!.logFile).toBe(logFile);

    // El wrapper del package manager puede tardar más bajo carga de la suite.
    let log = "";
    await waitFor(() => {
      try {
        log = readFileSync(logFile, "utf8");
        return log.includes("bg-arrancado");
      } catch {
        return false;
      }
    }, 3000);
    expect(log).toContain("bg-arrancado");

    // Detener por registro (como haría `nodedesk stop`).
    await terminateProcessGroup(record!.pid, 1500);
    // El gestor (que conserva el handle) observa la muerte del proceso.
    await waitFor(() => manager.status === "exited", 3000);
    expect(manager.status).toBe("exited");

    // El proceso ya no vive.
    expect(isProcessAlive(record!.pid)).toBe(false);
  });
});
