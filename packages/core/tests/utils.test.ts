import { describe, expect, it } from "vitest";

import {
  CompositeLogger,
  ConsoleLogger,
  MemoryLogger
} from "../src/logging/logger.js";
import { slugify } from "../src/utils/slugify.js";
import { findFreePort } from "../src/utils/ports.js";
import { hashId, nowIso, shortUid } from "../src/utils/id.js";

describe("MemoryLogger", () => {
  it("almacena entradas en orden", () => {
    const logger = new MemoryLogger();
    logger.info("uno");
    logger.warn("dos");
    logger.error("tres");

    const entries = logger.entries();
    expect(entries.length).toBe(3);
    expect(entries[0]!.line).toBe("uno");
    expect(entries[1]!.level).toBe("warn");
    expect(entries[2]!.level).toBe("error");
  });

  it("respeta la capacidad del buffer circular (como V1: 300)", () => {
    const logger = new MemoryLogger(5);
    for (let i = 0; i < 8; i++) {
      logger.info(`linea-${i}`);
    }
    const entries = logger.entries();
    expect(entries.length).toBe(5);
    expect(entries[0]!.line).toBe("linea-3");
    expect(entries[4]!.line).toBe("linea-7");
  });

  it("pushProcessLine clasifica el origen", () => {
    const logger = new MemoryLogger();
    logger.pushProcessLine("Error: algo", "stderr");
    logger.pushProcessLine("normal", "stdout");

    const entries = logger.entries();
    expect(entries[0]!.level).toBe("error");
    expect(entries[0]!.source).toBe("stderr");
    expect(entries[1]!.level).toBe("info");
  });

  it("clear vacía el buffer", () => {
    const logger = new MemoryLogger();
    logger.info("x");
    logger.clear();
    expect(logger.size).toBe(0);
  });
});

describe("CompositeLogger / ConsoleLogger", () => {
  it("multiplexa a varios loggers", () => {
    const a = new MemoryLogger();
    const b = new MemoryLogger();
    const composite = new CompositeLogger([a, b]);

    composite.info("hola");
    composite.warn("cuidado");

    expect(a.entries().length).toBe(2);
    expect(b.entries().length).toBe(2);
    expect(new ConsoleLogger()).toBeDefined();
  });
});

describe("slugify", () => {
  it("convierte nombres en slugs seguros (comportamiento V1)", () => {
    expect(slugify("Mi Proyecto Web")).toBe("mi-proyecto-web");
    expect(slugify("  Node!!  Desk  ")).toBe("node-desk");
    expect(slugify("café con leche")).toBe("caf-con-leche");
    expect(slugify("API_v2")).toBe("api-v2");
    expect(slugify("---")).toBe("project");
    expect(slugify("---", "fallback")).toBe("fallback");
  });

  it("recorta a 40 caracteres", () => {
    expect(slugify("a".repeat(80)).length).toBe(40);
  });
});

describe("findFreePort", () => {
  it("encuentra un puerto libre en el rango", async () => {
    const port = await findFreePort(3011, 3099);
    expect(port).not.toBeNull();
    expect(port!).toBeGreaterThanOrEqual(3011);
    expect(port!).toBeLessThanOrEqual(3099);
  });

  it("devuelve null si el rango está agotado", async () => {
    const port = await findFreePort(1, 0);
    expect(port).toBeNull();
  });
});

describe("ids y tiempo", () => {
  it("shortUid genera ids cortos con prefijo", () => {
    expect(shortUid("prj")).toMatch(/^prj-[0-9a-f]{7}$/);
    expect(shortUid("prj")).not.toBe(shortUid("prj"));
  });

  it("hashId es determinista", () => {
    expect(hashId("/misma/ruta")).toBe(hashId("/misma/ruta"));
    expect(hashId("/otra/ruta")).not.toBe(hashId("/misma/ruta"));
  });

  it("nowIso produce timestamps ISO parseables", () => {
    expect(Number.isNaN(Date.parse(nowIso()))).toBe(false);
  });
});
