import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { describe, beforeEach, expect, it } from "vitest";

import {
  entriesToObject,
  findFreePort,
  parseEnv,
  ProcessManager
} from "@nodedesk/core";

import {
  builtinTemplates,
  interpolate,
  TemplateError,
  TemplateManager,
  TemplateNotFoundError
} from "../src/index.js";
import type { Template } from "../src/types.js";

/* ------------------------------ helpers ------------------------------ */

/** Crea un directorio temporal único (aislado de otros tests). */
async function tempDir(prefix = "nodedesk-templates-"): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

/** Espera (sondeando) a que una condición se cumpla. */
async function waitFor(
  condition: () => boolean,
  timeoutMs = 8000
): Promise<void> {
  const step = 50;
  for (let waited = 0; waited < timeoutMs; waited += step) {
    if (condition()) return;
    await new Promise((resolve) => setTimeout(resolve, step));
  }
  throw new Error("waitFor: la condición no se cumplió dentro del plazo");
}

/** Lee y parsea el package.json de un proyecto generado. */
async function readPkg(directory: string): Promise<{
  name?: string;
  type?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
}> {
  return JSON.parse(
    await fs.readFile(path.join(directory, "package.json"), "utf8")
  );
}

/** Template custom mínima para probar register()/create() de terceros. */
function customTemplateFixture(): Template {
  return {
    id: "custom-hello",
    name: "Custom Hello",
    tagline: "template de prueba",
    description: "template custom registrada en runtime por los tests",
    category: "Test",
    stack: ["node"],
    tags: ["test"],
    minNode: "18",
    scripts: { dev: "node index.mjs", start: "node index.mjs" },
    files: (context) => [
      {
        path: "package.json",
        content: `${JSON.stringify(
          {
            name: context.slug,
            version: "0.1.0",
            type: "module",
            scripts: { dev: "node index.mjs" }
          },
          null,
          2
        )}\n`
      },
      {
        path: "index.mjs",
        content: `console.log("hola desde ${context.name}");\n`
      }
    ],
    env: (context) => [{ key: "PORT", value: String(context.port) }]
  };
}

/* -------------------------------- tests ------------------------------- */

beforeEach(() => {
  // Aisla el registro global entre tests (las built-in se mantienen).
  TemplateManager.reset();
});

describe("interpolate", () => {
  it("reemplaza tokens {{key}} por el valor de las vars", () => {
    expect(interpolate("Hola {{name}} en el puerto {{port}}", {
      name: "web",
      port: 3011
    })).toBe("Hola web en el puerto 3011");
  });

  it("deja los tokens desconocidos intactos", () => {
    expect(interpolate("texto {{desconocido}} tal cual", {})).toBe(
      "texto {{desconocido}} tal cual"
    );
  });

  it("convierte números y tolera espacios dentro del token", () => {
    expect(interpolate("{{ n }}/{{v}}", { n: 7, v: 42 })).toBe("7/42");
  });
});

describe("catálogo built-in", () => {
  it("list() incluye las 4 templates built-in", () => {
    const ids = TemplateManager.list().map((t) => t.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "minimal-node",
        "express-api",
        "fastify-api",
        "hono-api"
      ])
    );
    expect(ids).toHaveLength(4);
    expect(builtinTemplates).toHaveLength(4);
  });

  it("get() resuelve built-ins y devuelve null para ids desconocidos", () => {
    expect(TemplateManager.get("minimal-node")?.name).toBe("Node puro");
    expect(TemplateManager.get("express-api")?.category).toBe("API");
    expect(TemplateManager.get("no-existe")).toBeNull();
  });

  it("has() distingue ids conocidos de desconocidos", () => {
    expect(TemplateManager.has("fastify-api")).toBe(true);
    expect(TemplateManager.has("hono-api")).toBe(true);
    expect(TemplateManager.has("no-existe")).toBe(false);
  });

  it("create() con id desconocido lanza TemplateNotFoundError", async () => {
    const root = await tempDir();
    try {
      await TemplateManager.create("inexistente", { directory: root });
      expect.unreachable("debía lanzar TemplateNotFoundError");
    } catch (error) {
      expect(error).toBeInstanceOf(TemplateNotFoundError);
      expect((error as TemplateNotFoundError).code).toBe(
        "ND_TEMPLATE_NOT_FOUND"
      );
      expect((error as TemplateNotFoundError).message).toContain(
        "inexistente"
      );
    }
  });
});

describe("registro de templates custom", () => {
  it("register() añade la template y create() genera desde ella", async () => {
    TemplateManager.register(customTemplateFixture());

    expect(TemplateManager.has("custom-hello")).toBe(true);
    expect(TemplateManager.list()).toHaveLength(5); // 4 built-in + 1 custom

    const root = await tempDir();
    const result = await TemplateManager.create("custom-hello", {
      directory: root
    });

    expect(result.template).toBe("custom-hello");
    expect(result.count).toBe(3); // package.json + index.mjs + .env

    const pkg = await readPkg(result.directory);
    expect(pkg.name).toBe("custom-hello"); // slugify("Custom Hello")
    // El contexto llega a files(): nombre y puerto interpolados.
    const index = await fs.readFile(
      path.join(result.directory, "index.mjs"),
      "utf8"
    );
    expect(index).toContain("hola desde Custom Hello");
  });

  it("register() duplicado (custom o built-in) lanza TemplateError", () => {
    TemplateManager.register(customTemplateFixture());

    expect(() => TemplateManager.register(customTemplateFixture())).toThrow(
      TemplateError
    );

    const clonBuiltin = { ...customTemplateFixture(), id: "minimal-node" };
    expect(() => TemplateManager.register(clonBuiltin)).toThrow(TemplateError);
  });

  it("register() sin id lanza TemplateError", () => {
    const sinId = { ...customTemplateFixture(), id: "" };
    expect(() => TemplateManager.register(sinId)).toThrow(TemplateError);
  });

  it("reset() vacía las customs pero mantiene las built-in", () => {
    TemplateManager.register(customTemplateFixture());
    expect(TemplateManager.list()).toHaveLength(5);

    TemplateManager.reset();

    expect(TemplateManager.has("custom-hello")).toBe(false);
    expect(TemplateManager.list()).toHaveLength(4);
    expect(TemplateManager.has("minimal-node")).toBe(true);
  });
});

describe("create() — minimal-node", () => {
  it("escribe package.json, src/server.mjs, .gitignore, README y .env", async () => {
    const root = await tempDir();
    const result = await TemplateManager.create("minimal-node", {
      name: "Servidor Demo",
      directory: root,
      port: 3025
    });

    // Ficheros esperados (4 de la template + .env).
    expect(result.count).toBe(result.files.length);
    expect(result.files).toHaveLength(5);
    expect(result.files.every((f) => path.isAbsolute(f))).toBe(true);

    for (const rel of [
      "package.json",
      "src/server.mjs",
      ".gitignore",
      "README.md",
      ".env"
    ]) {
      await expect(
        fs.access(path.join(result.directory, rel))
      ).resolves.toBeUndefined();
    }

    // package.json parsea y lleva el slug como nombre.
    const pkg = await readPkg(result.directory);
    expect(pkg.name).toBe("servidor-demo");
    expect(pkg.type).toBe("module");
    expect(pkg.scripts?.dev).toBe("node --watch src/server.mjs");
    expect(pkg.scripts?.start).toBe("node src/server.mjs");

    // El servidor lleva el puerto del contexto como fallback y el nombre.
    const server = await fs.readFile(
      path.join(result.directory, "src/server.mjs"),
      "utf8"
    );
    expect(server).toContain("3025");
    expect(server).toContain("Servidor Demo");

    // .env con PORT y su comentario (parseado con el core de NodeDesk).
    const envContent = await fs.readFile(
      path.join(result.directory, ".env"),
      "utf8"
    );
    const entries = parseEnv(envContent);
    expect(entriesToObject(entries).PORT).toBe("3025");
    expect(entries[0]?.comment).toBe("Puerto del servidor");

    // Metadatos del resultado.
    expect(result.template).toBe("minimal-node");
    expect(result.port).toBe(3025);
    expect(result.env.map((v) => v.key)).toEqual(["PORT"]);
  });

  it("usa el nombre de la template por defecto y derive el slug", async () => {
    const root = await tempDir();
    const result = await TemplateManager.create("minimal-node", {
      directory: root
    });

    // name por defecto = "Node puro" → slug "node-puro".
    const pkg = await readPkg(result.directory);
    expect(pkg.name).toBe("node-puro");
  });

  it("con name custom produce el slug correcto", async () => {
    const root = await tempDir();
    const result = await TemplateManager.create("minimal-node", {
      name: "Mi API Cool!!",
      directory: root
    });

    expect(result.directory).toBe(root);
    const pkg = await readPkg(result.directory);
    expect(pkg.name).toBe("mi-api-cool");
  });

  it("asigna un puerto libre del pool 3011–3099 por defecto", async () => {
    const root = await tempDir();
    const result = await TemplateManager.create("minimal-node", {
      directory: root
    });
    expect(result.port).toBeGreaterThanOrEqual(3011);
    expect(result.port).toBeLessThanOrEqual(3099);
  });

  it("con packageManager pnpm, nextSteps usan pnpm", async () => {
    const root = await tempDir();
    const result = await TemplateManager.create("minimal-node", {
      directory: root,
      packageManager: "pnpm"
    });

    expect(result.nextSteps).toHaveLength(3);
    expect(result.nextSteps[0]).toBe(`cd ${root}`);
    expect(result.nextSteps[1]).toBe("pnpm install");
    expect(result.nextSteps[2]).toBe("pnpm run dev");
  });
});

describe("create() — opciones de destino y .env", () => {
  it("rechaza un directorio existente no vacío salvo con force", async () => {
    const root = await tempDir();
    const target = path.join(root, "ocupado");
    await fs.mkdir(target, { recursive: true });
    await fs.writeFile(path.join(target, "previo.txt"), "contenido");

    await expect(
      TemplateManager.create("minimal-node", { directory: target })
    ).rejects.toThrow(TemplateError);

    // Con force se permite y no se borra lo que ya había.
    const result = await TemplateManager.create("minimal-node", {
      directory: target,
      force: true
    });
    await expect(
      fs.access(path.join(target, "package.json"))
    ).resolves.toBeUndefined();
    await expect(
      fs.access(path.join(target, "previo.txt"))
    ).resolves.toBeUndefined();
    expect(result.directory).toBe(target);
  });

  it("acepta un directorio existente pero vacío", async () => {
    const target = await tempDir(); // existe, vacío
    const result = await TemplateManager.create("hono-api", {
      directory: target
    });
    expect(result.count).toBeGreaterThan(0);
  });

  it("con skipEnv: true no escribe el .env", async () => {
    const root = await tempDir();
    const result = await TemplateManager.create("express-api", {
      directory: root,
      skipEnv: true
    });

    await expect(
      fs.access(path.join(result.directory, ".env"))
    ).rejects.toThrow();
    expect(result.env).toEqual([]);
    // Solo los 4 ficheros de la template.
    expect(result.files).toHaveLength(4);
  });
});

describe("create() — dependencias de las templates", () => {
  it("express-api genera package.json con express ^4.21.2", async () => {
    const root = await tempDir();
    const result = await TemplateManager.create("express-api", {
      directory: root
    });

    const pkg = await readPkg(result.directory);
    expect(pkg.dependencies).toEqual({ express: "^4.21.2" });

    // GREETING se declara con su comentario en el .env.
    const greeting = result.env.find((v) => v.key === "GREETING");
    expect(greeting?.comment).toBe("Saludo de la API");
    const envContent = await fs.readFile(
      path.join(result.directory, ".env"),
      "utf8"
    );
    expect(envContent).toContain("# Saludo de la API");
    expect(envContent).toContain("GREETING=");
  });

  it("fastify-api genera package.json con fastify ^5.3.0", async () => {
    const root = await tempDir();
    const result = await TemplateManager.create("fastify-api", {
      directory: root
    });

    const pkg = await readPkg(result.directory);
    expect(pkg.dependencies).toEqual({ fastify: "^5.3.0" });
  });

  it("hono-api genera package.json con hono y @hono/node-server", async () => {
    const root = await tempDir();
    const result = await TemplateManager.create("hono-api", {
      directory: root
    });

    const pkg = await readPkg(result.directory);
    expect(pkg.dependencies).toEqual({
      hono: "^4.6.0",
      "@hono/node-server": "^1.13.0"
    });
  });
});

describe("integración — proyecto ejecutable", () => {
  it("minimal-node arranca de verdad con ProcessManager y responde HTTP", async () => {
    const root = await tempDir("nodedesk-templates-it-");
    const port = (await findFreePort(3011, 3099)) ?? 3011;

    const result = await TemplateManager.create("minimal-node", {
      name: "Proyecto Integration",
      directory: path.join(root, "app"),
      port
    });

    const manager = new ProcessManager(result.directory);
    const lines: string[] = [];
    manager.on("stdout", (line: string) => {
      lines.push(line);
    });

    try {
      const info = await manager.start({ command: "node src/server.mjs" });
      expect(info.status).toBe("running");
      expect(info.pid).not.toBeNull();

      // El servidor escribe su línea de arranque por stdout.
      await waitFor(() => lines.some((l) => l.includes("escuchando")));

      // Y responde el JSON prometido por la template.
      const res = await fetch(`http://127.0.0.1:${port}/`);
      expect(res.status).toBe(200);
      const body = (await res.json()) as { status: string; project: string };
      expect(body.status).toBe("ok");
      expect(body.project).toBe("Proyecto Integration");
    } finally {
      await manager.stop();
    }

    expect(manager.status).toBe("exited");
  });
});
