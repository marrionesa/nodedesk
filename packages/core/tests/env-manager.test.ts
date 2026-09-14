import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { EnvFileError } from "../src/errors.js";
import { EnvManager } from "../src/env/env-manager.js";
import {
  entriesToObject,
  parseEnv,
  serializeEnv
} from "../src/env/dotenv.js";
import { tempDir, writeFiles } from "./helpers.js";

describe("parseEnv", () => {
  it("parsea pares KEY=VALUE", () => {
    const entries = parseEnv("A=1\nB=hola\n");
    expect(entriesToObject(entries)).toEqual({ A: "1", B: "hola" });
  });

  it("ignora comentarios y líneas vacías", () => {
    const content = "# encabezado\nA=1\n   # intermedio\nB=2\n\n# cola\n";
    const entries = parseEnv(content);
    expect(entriesToObject(entries)).toEqual({ A: "1", B: "2" });
    expect(entries[0]!.comment).toBe("encabezado");
    expect(entries[1]!.comment).toBe("intermedio");
  });

  it("una línea en blanco desvincula el comentario del bloque", () => {
    // Comportamiento documentado: el comentario debe preceder inmediatamente
    // a su variable para asociarse a ella.
    const entries = parseEnv("# título de sección\n\nA=1\n");
    expect(entriesToObject(entries)).toEqual({ A: "1" });
    expect(entries[0]!.comment).toBeUndefined();
  });

  it("recorta comillas dobles y simples", () => {
    const entries = parseEnv('A="con espacios"\nB=\'simple\'\n');
    expect(entries[0]!.value).toBe("con espacios");
    expect(entries[0]!.quoted).toBe(true);
    expect(entries[1]!.value).toBe("simple");
  });

  it("tolera export y espacios alrededor", () => {
    const entries = parseEnv("export A = 42\n");
    expect(entriesToObject(entries)).toEqual({ A: "42" });
  });

  it("ignora líneas sin forma KEY=VALUE", () => {
    const entries = parseEnv("A=1\nbasura suelta\nB=2\n");
    expect(entries.length).toBe(2);
  });
});

describe("serializeEnv", () => {
  it("round-trip preserva claves, valores y comentarios", () => {
    const original = "# Puerto del servidor\nPORT=3000\n\n# Modo\nDEBUG=verbose\n";
    const entries = parseEnv(original);
    const serialized = serializeEnv(entries);
    const reparsed = parseEnv(serialized);

    expect(entriesToObject(reparsed)).toEqual({
      PORT: "3000",
      DEBUG: "verbose"
    });
    expect(reparsed[0]!.comment).toBe("Puerto del servidor");
    expect(reparsed[1]!.comment).toBe("Modo");
  });

  it("entrecomilla valores con # o espacios al borde", () => {
    const serialized = serializeEnv([
      { key: "A", value: "color #fff" },
      { key: "B", value: " texto " },
      { key: "C", value: "" }
    ]);
    const reparsed = parseEnv(serialized);
    expect(entriesToObject(reparsed)).toEqual({
      A: "color #fff",
      B: " texto ",
      C: ""
    });
  });
});

describe("EnvManager", () => {
  it("get/set/all/delete sobre un .env real", async () => {
    const dir = await tempDir();
    await writeFiles(dir, {
      ".env": "# principal\nPORT=3000\nHOST=localhost\n"
    });

    const env = new EnvManager(dir);

    expect(await env.exists()).toBe(true);
    expect(await env.get("PORT")).toBe("3000");
    expect(await env.get("NO_EXISTE")).toBeUndefined();
    expect(await env.has("HOST")).toBe(true);
    expect(await env.all()).toEqual({ PORT: "3000", HOST: "localhost" });
    expect(await env.keys()).toEqual(["PORT", "HOST"]);

    await env.set("PORT", "4000");
    await env.set("NEW_VAR", "hola");
    expect(await env.get("PORT")).toBe("4000");
    expect(await env.get("NEW_VAR")).toBe("hola");

    expect(await env.delete("HOST")).toBe(true);
    expect(await env.delete("HOST")).toBe(false);
    expect(await env.keys()).toEqual(["PORT", "NEW_VAR"]);

    // Persistido en disco con comentarios preservados.
    const raw = await fs.readFile(path.join(dir, ".env"), "utf8");
    expect(raw).toContain("# principal");
    expect(raw).toContain("PORT=4000");
    expect(raw).not.toContain("HOST=");
  });

  it("gestiona un .env inexistente creándolo al primer set", async () => {
    const dir = await tempDir();
    const env = new EnvManager(dir);

    expect(await env.exists()).toBe(false);
    expect(await env.all()).toEqual({});

    await env.set("A", "1");
    expect(await env.exists()).toBe(true);
    expect(await env.get("A")).toBe("1");
  });

  it("con autosave=false no persiste hasta save()", async () => {
    const dir = await tempDir();
    await writeFiles(dir, { ".env": "A=1\n" });

    const env = new EnvManager(dir, { autosave: false });
    await env.set("A", "2");
    await env.set("B", "3");

    const onDisk = await fs.readFile(path.join(dir, ".env"), "utf8");
    expect(onDisk).toBe("A=1\n");

    await env.save();
    const saved = await fs.readFile(path.join(dir, ".env"), "utf8");
    expect(saved).toContain("A=2");
    expect(saved).toContain("B=3");
  });

  it("buildEnvironment mezcla process.env, .env y overrides", async () => {
    const dir = await tempDir();
    await writeFiles(dir, {
      ".env": "PORT=7777\nMY_UNIQUE_TOKEN=desde-env\n"
    });

    const env = new EnvManager(dir);
    const merged = await env.buildEnvironment({
      PORT: "8888",
      EXTRA: "si"
    });

    expect(merged.PORT).toBe("8888"); // Override gana.
    expect(merged.MY_UNIQUE_TOKEN).toBe("desde-env"); // .env sobre process.env.
    expect(merged.EXTRA).toBe("si");
    expect(merged.PATH).toBe(process.env.PATH); // process.env heredado.
  });

  it("rechaza nombres de variable inválidos", async () => {
    const dir = await tempDir();
    const env = new EnvManager(dir);
    await expect(env.set("1BAD", "x")).rejects.toThrow(EnvFileError);
    await expect(env.set("CON ESPACIO", "x")).rejects.toThrow(EnvFileError);
    await expect(env.set("", "x")).rejects.toThrow(EnvFileError);
  });

  it("permite ruta personalizada de .env", async () => {
    const dir = await tempDir();
    const custom = path.join(dir, "entorno", "produccion.env");
    const env = new EnvManager(dir, { path: custom });

    await env.set("MODE", "production");
    const raw = await fs.readFile(custom, "utf8");
    expect(raw).toContain("MODE=production");
  });
});
