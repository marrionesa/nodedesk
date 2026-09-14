/**
 * Tests de integración de @nodedesk/cli contra el binario construido.
 *
 * Se lanza `node dist/bin.js …` con `spawn` (el script `test` reconstruye
 * dist antes de correr vitest) y se comprueban códigos de salida y salidas
 * reales, con HOME aislado para no tocar el registro del usuario.
 */

import { once } from "node:events";
import { mkdir, readFile, stat as statFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { isProcessAlive } from "@nodedesk/core";
import { describe, expect, it } from "vitest";

import {
  DYING_SERVER,
  KEEP_ALIVE_SERVER,
  fixturePackageJson,
  makeProject,
  runCli,
  spawnCli,
  tempDir,
  tempHome,
  waitFor
} from "./helpers.js";

interface StartInfo {
  pid: number;
  command: string;
  root: string;
  startedAt: string;
}

/** Primera línea de stdout parseada como JSON (modo --json de start). */
function firstJsonLine(stdout: string): unknown {
  const line = stdout.split("\n", 1)[0] ?? "";
  return JSON.parse(line) as Record<string, unknown>;
}

/** Quita códigos ANSI para poder analizar la salida humana del CLI. */
function stripAnsi(text: string): string {
  return text.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

/** Ejecuta un proceso del CLI, espera a que su stdout cumpla una condición,
 * le envía una señal y devuelve código + stdout acumulado. */
async function runUntilSignal(
  args: string[],
  env: Record<string, string>,
  ready: (stdout: string) => boolean,
  signal: NodeJS.Signals
): Promise<{ code: number; stdout: string }> {
  const child = spawnCli(args, { env });
  let stdout = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  try {
    await waitFor(() => ready(stdout));
  } catch (error) {
    child.kill("SIGKILL");
    await once(child, "close");
    throw error;
  }
  child.kill(signal);
  const [code] = (await once(child, "close")) as [number | null, unknown];
  return { code: code ?? -1, stdout };
}

/** Espera a que un pid muera (con sondeo tolerante). */
async function waitDead(pid: number): Promise<void> {
  await waitFor(() => !isProcessAlive(pid));
}

/* -------------------------------- version -------------------------------- */

describe("nodedesk version", () => {
  it("termina con exit 0 y muestra la versión del CLI", async () => {
    const result = await runCli(["version"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("0.1.0");
    expect(result.stdout).toContain("@nodedesk/cli");
  });

  it("--json devuelve las versiones parseables", async () => {
    const result = await runCli(["version", "--json"]);
    expect(result.code).toBe(0);
    const versions = JSON.parse(result.stdout) as Record<string, string>;
    expect(versions.cli).toBe("0.1.0");
    expect(versions.core).toBe("0.1.0");
    expect(versions.templates).toBe("0.1.0");
  });
});

/* -------------------------------- projects ------------------------------- */

/** Crea un subdirectorio de proyecto dentro de un directorio padre. */
async function subProject(
  parent: string,
  name: string,
  packageJson: Record<string, unknown>
): Promise<string> {
  const root = path.join(parent, name);
  await mkdir(root, { recursive: true });
  await writeFile(
    path.join(root, "package.json"),
    JSON.stringify(packageJson, null, 2),
    "utf8"
  );
  return root;
}

describe("nodedesk projects", () => {
  it("lista los proyectos encontrados en un directorio", async () => {
    const parent = await tempDir();
    await subProject(parent, "alpha", {
      name: "@demo/alpha",
      private: true,
      scripts: { dev: "node .", start: "node ." },
      dependencies: { express: "^4.0.0" }
    });
    await subProject(parent, "beta", {
      name: "beta",
      private: true,
      devDependencies: { vitest: "^3.0.0" }
    });

    const result = await runCli(["projects", parent]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("@demo/alpha");
    expect(result.stdout).toContain("beta");
    expect(result.stdout).toContain("dev,start");
  });

  it("--json devuelve el array de project.toJSON()", async () => {
    const parent = await tempDir();
    await subProject(parent, "alpha", {
      name: "pkg-alpha",
      private: true
    });
    await subProject(parent, "beta", {
      name: "pkg-beta",
      private: true
    });

    const result = await runCli(["projects", parent, "--json"]);
    expect(result.code).toBe(0);
    const projects = JSON.parse(result.stdout) as Array<{
      name: string;
      slug: string;
    }>;
    expect(projects).toHaveLength(2);
    expect(projects.map((p) => p.name).sort()).toEqual(["pkg-alpha", "pkg-beta"]);
  });

  it("directorio vacío: mensaje amigable y exit 0", async () => {
    const empty = await tempDir();
    const result = await runCli(["projects", empty]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("no se encontraron proyectos");

    const json = await runCli(["projects", empty, "--json"]);
    expect(json.code).toBe(0);
    expect(JSON.parse(json.stdout)).toEqual([]);
  });
});

/* --------------------------------- create -------------------------------- */

describe("nodedesk create", () => {
  it("crea un proyecto desde la template minimal-node (--json)", async () => {
    const parent = await tempDir();
    const result = await runCli([
      "create",
      "demo",
      "-t",
      "minimal-node",
      "-d",
      parent,
      "--json"
    ]);
    expect(result.code).toBe(0);

    const created = JSON.parse(result.stdout) as {
      directory: string;
      template: string;
      files: string[];
      count: number;
      port: number;
      env: Array<{ key: string; value: string }>;
    };
    expect(created.template).toBe("minimal-node");
    expect(created.directory).toBe(path.join(parent, "demo"));
    expect(created.count).toBeGreaterThan(0);
    expect(created.files.length).toBe(created.count);
    expect(created.port).toBeGreaterThanOrEqual(3011);
    expect(created.port).toBeLessThanOrEqual(3099);
    expect(created.env.map((v) => v.key)).toContain("PORT");

    const pkg = JSON.parse(
      await readFile(path.join(created.directory, "package.json"), "utf8")
    ) as { name: string; scripts: Record<string, string> };
    expect(pkg.name).toBe("demo");
    expect(pkg.scripts.dev).toContain("server.mjs");
  });

  it("salida humana: ficheros, puerto y siguientes pasos", async () => {
    const parent = await tempDir();
    const result = await runCli(["create", "Blog API", "-d", parent]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("Blog API");
    expect(result.stdout).toContain("siguientes pasos");
    expect(result.stdout).toContain("package.json");

    const stat = await statFile(path.join(parent, "blog-api", ".env"));
    expect(stat.isFile()).toBe(true);
  });

  it("template desconocida: exit 1 y lista las disponibles", async () => {
    const result = await runCli(["create", "x", "-t", "no-existe"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("no existe la template");
    expect(result.stdout).toContain("minimal-node");
  });
});

/* ---------------------------------- env ---------------------------------- */

describe("nodedesk env", () => {
  it("ciclo set/get/list/delete con máscara de secretos", async () => {
    const root = await makeProject({
      "package.json": fixturePackageJson("env-fixture"),
      ".env": "# comentario inicial\nPORT=3000\n"
    });

    const set = await runCli(["env", "set", root, "CLAVE", "valor"]);
    expect(set.code).toBe(0);
    expect(set.stdout).toContain("CLAVE=valor");

    const setSecret = await runCli([
      "env",
      "set",
      root,
      "API_TOKEN",
      "s3cr3t-xyz"
    ]);
    expect(setSecret.code).toBe(0);
    expect(setSecret.stdout).toContain("****");
    expect(setSecret.stdout).not.toContain("s3cr3t-xyz");

    const get = await runCli(["env", "get", root, "CLAVE"]);
    expect(get.code).toBe(0);
    expect(get.stdout.trim()).toBe("valor");

    const list = await runCli(["env", "list", root]);
    expect(list.code).toBe(0);
    expect(list.stdout).toContain("CLAVE");
    expect(list.stdout).toContain("valor");
    expect(list.stdout).toContain("****");
    expect(list.stdout).not.toContain("s3cr3t-xyz");

    const raw = await runCli(["env", "list", root, "--raw"]);
    expect(raw.stdout).toContain("s3cr3t-xyz");

    const json = await runCli(["env", "list", root, "--json"]);
    expect(json.code).toBe(0);
    const values = JSON.parse(json.stdout) as Record<string, string>;
    expect(values.CLAVE).toBe("valor");
    expect(values.API_TOKEN).toBe("s3cr3t-xyz");
    expect(values.PORT).toBe("3000");

    const removed = await runCli(["env", "delete", root, "CLAVE"]);
    expect(removed.code).toBe(0);

    const missing = await runCli(["env", "get", root, "CLAVE"]);
    expect(missing.code).toBe(1);
    expect(missing.stderr).toContain("no está definida");
  });

  it("get de una variable inexistente: exit 1", async () => {
    const root = await makeProject({ "package.json": fixturePackageJson("env-vacio") });
    const result = await runCli(["env", "get", root, "NO_EXISTE"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("NO_EXISTE");
  });
});

/* ---------------------------------- stop --------------------------------- */

describe("nodedesk stop", () => {
  it("ruta sin proceso en background: exit 1 con mensaje", async () => {
    const home = await tempHome();
    const result = await runCli(["stop", "/ruta/que/no/existe"], {
      env: { HOME: home }
    });
    expect(result.code).toBe(1);
    expect(result.stderr).toContain(
      "no hay proceso en background para este proyecto"
    );
  });
});

/* ------------------------------- templates ------------------------------- */

describe("nodedesk templates", () => {
  it("--json devuelve las 4 templates built-in", async () => {
    const result = await runCli(["templates", "--json"]);
    expect(result.code).toBe(0);
    const templates = JSON.parse(result.stdout) as Array<{
      id: string;
      name: string;
    }>;
    expect(templates).toHaveLength(4);
    expect(templates.map((t) => t.id)).toContain("minimal-node");
  });

  it("detalle de una template concreta", async () => {
    const result = await runCli(["templates", "minimal-node"]);
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("minimal-node");
    expect(result.stdout).toContain("scripts");
  });

  it("template desconocida: exit 1", async () => {
    const result = await runCli(["templates", "no-existe"]);
    expect(result.code).toBe(1);
    expect(result.stderr).toContain("no existe la template");
  });
});

/* --------------------------------- doctor -------------------------------- */

describe("nodedesk doctor", () => {
  it("termina con exit 0 y diagnostica node", async () => {
    const home = await tempHome();
    const result = await runCli(["doctor"], { env: { HOME: home } });
    expect(result.code).toBe(0);
    expect(result.stdout).toMatch(/node/i);
    expect(result.stdout).toContain("Templates");
  });

  it("--json incluye el informe completo", async () => {
    const home = await tempHome();
    const result = await runCli(["doctor", "--json"], { env: { HOME: home } });
    expect(result.code).toBe(0);
    const report = JSON.parse(result.stdout) as {
      node: { version: string; ok: boolean };
      templates: { count: number };
    };
    expect(report.node.ok).toBe(true);
    expect(report.templates.count).toBe(4);
  });
});

/* --------------------------------- start --------------------------------- */

describe("nodedesk start (attached)", () => {
  it("--install instala dependencias antes de arrancar", async () => {
    const home = await tempHome();
    const root = await makeProject({
      "package.json": JSON.stringify({
        name: "start-install-fixture",
        private: true,
        type: "module",
        scripts: { dev: "node server.mjs" },
        dependencies: { "fixture-dependency": "file:./dependency" }
      }),
      "dependency/package.json": JSON.stringify({
        name: "fixture-dependency",
        type: "module",
        main: "index.mjs"
      }),
      "dependency/index.mjs": "export default 'fixture';\n",
      "server.mjs": "console.log('instalacion-cli');\n"
    });

    const result = await runCli(
      ["start", root, "--install", "--json"],
      { env: { HOME: home } }
    );

    expect(result.code).toBe(0);
    expect(result.stderr).toContain("instalacion-cli");
    await statFile(path.join(root, "node_modules"));
  });

  it("--json --exit-after: apagado limpio, exit 0 y proceso hijo muerto", async () => {
    const home = await tempHome();
    const root = await makeProject({
      "package.json": fixturePackageJson("start-json-fixture"),
      "server.mjs": KEEP_ALIVE_SERVER
    });

    const result = await runCli(
      ["start", root, "--json", "--exit-after", "1200"],
      { env: { HOME: home } }
    );
    expect(result.code).toBe(0);

    const info = firstJsonLine(result.stdout) as StartInfo;
    expect(typeof info.pid).toBe("number");
    expect(info.command).toContain("run dev");

    // El modo JSON manda los logs a stderr y el resultado a stdout.
    expect(result.stderr).toContain("listo en puerto");
    const exitLine = result.stdout.trim().split("\n").pop() ?? "";
    expect((JSON.parse(exitLine) as { event: string }).event).toBe("exit");

    await waitDead(info.pid);
  });

  it("SIGINT real: banner, Ctrl+C limpio, exit 0 y proceso hijo muerto", async () => {
    const home = await tempHome();
    const root = await makeProject({
      "package.json": fixturePackageJson("start-sigint-fixture"),
      "server.mjs": KEEP_ALIVE_SERVER
    });

    const { code, stdout } = await runUntilSignal(
      ["start", root, "--port", "4321"],
      { HOME: home },
      (out) => out.includes("listo en puerto 4321"),
      "SIGINT"
    );

    expect(code).toBe(0);
    expect(stdout).toContain("nodedesk start");
    expect(stdout).toContain("Ctrl+C para detener");
    expect(stdout).toContain("apagando");

    const pid = Number(/pid\s+(\d+)/.exec(stripAnsi(stdout))?.[1] ?? NaN);
    expect(pid).not.toBeNaN();
    await waitDead(pid);
  });

  it("propaga el código de salida cuando el proceso muere solo", async () => {
    const home = await tempHome();
    const root = await makeProject({
      "package.json": fixturePackageJson("start-dying-fixture"),
      "server.mjs": DYING_SERVER
    });

    const result = await runCli(["start", root], { env: { HOME: home } });
    expect(result.code).toBe(3);
    expect(result.stdout).toContain("código de salida 3");
  });
});

/* ------------------------- start detached + logs ------------------------- */

describe("nodedesk start --detached / logs / stop", () => {
  it("--install instala dependencias antes de arrancar en background", async () => {
    const home = await tempHome();
    const root = await makeProject({
      "package.json": JSON.stringify({
        name: "detached-install-fixture",
        private: true,
        type: "module",
        scripts: { dev: "node server.mjs" },
        dependencies: { "fixture-dependency": "file:./dependency" }
      }),
      "dependency/package.json": JSON.stringify({
        name: "fixture-dependency",
        type: "module",
        main: "index.mjs"
      }),
      "dependency/index.mjs": "export default 'fixture';\n",
      "server.mjs": KEEP_ALIVE_SERVER
    });

    const start = await runCli(["start", root, "--install", "--detached", "--json"], {
      env: { HOME: home }
    });
    expect(start.code).toBe(0);
    const info = JSON.parse(start.stdout) as { pid: number; logFile: string };
    await statFile(path.join(root, "node_modules"));
    await waitFor(async () =>
      (await readFile(info.logFile, "utf8").catch(() => "")).includes("listo en puerto")
    );

    const stop = await runCli(["stop", root], { env: { HOME: home } });
    expect(stop.code).toBe(0);
    await waitDead(info.pid);
  });

  it("ciclo completo: arranque en background, logs y parada", async () => {
    const home = await tempHome();
    const root = await makeProject({
      "package.json": fixturePackageJson("detached-fixture"),
      "server.mjs": KEEP_ALIVE_SERVER
    });

    const start = await runCli(["start", root, "--detached", "--json"], {
      env: { HOME: home }
    });
    expect(start.code).toBe(0);

    const info = JSON.parse(start.stdout) as {
      pid: number;
      logFile: string;
      root: string;
    };
    expect(typeof info.pid).toBe("number");
    expect(info.root).toBe(path.resolve(root));
    expect(info.logFile).toContain(path.join(home, ".nodedesk-v2", "logs"));

    // Esperar a que el proceso escriba en su log.
    await waitFor(async () => {
      const content = await readFile(info.logFile, "utf8").catch(() => "");
      return content.includes("listo en puerto");
    });

    const logs = await runCli(["logs", root, "--lines", "10"], {
      env: { HOME: home }
    });
    expect(logs.code).toBe(0);
    expect(logs.stdout).toContain("listo en puerto");

    const stop = await runCli(["stop", root], { env: { HOME: home } });
    expect(stop.code).toBe(0);
    expect(stop.stdout).toContain("proceso detenido");

    await waitDead(info.pid);

    const again = await runCli(["stop", root], { env: { HOME: home } });
    expect(again.code).toBe(1);

    const all = await runCli(["stop", "--all"], { env: { HOME: home } });
    expect(all.code).toBe(0);
    expect(all.stdout).toContain("no hay procesos en background registrados");
  });
});

/* -------------------------------- colores -------------------------------- */

describe("colores", () => {
  it("NO_COLOR=1 desactiva los códigos ANSI", async () => {
    const result = await runCli(["templates"], { env: { NO_COLOR: "1" } });
    expect(result.code).toBe(0);
    expect(result.stdout).not.toContain("\x1b");
  });

  it("--no-color desactiva los códigos ANSI", async () => {
    const result = await runCli(["version", "--no-color"]);
    expect(result.code).toBe(0);
    expect(result.stdout).not.toContain("\x1b");
  });
});
