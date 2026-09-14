/**
 * Tests unitarios de la UI de @nodedesk/cli (colores, tablas, banners y
 * máscaras de secretos).
 */

import { describe, expect, it } from "vitest";

import {
  MASKED_VALUE,
  banner,
  bold,
  cyan,
  dim,
  disableColor,
  enableColor,
  green,
  isColorEnabled,
  isSecretKey,
  maskEnvValue,
  red,
  renderTable,
  stripAnsi,
  visibleLength,
  yellow
} from "../src/ui.js";

describe("colores ANSI", () => {
  it("aplican los códigos de escape cuando están activos", () => {
    enableColor();
    expect(isColorEnabled()).toBe(true);
    expect(red("error")).toBe("\x1b[31merror\x1b[39m");
    expect(green("ok")).toBe("\x1b[32mok\x1b[39m");
    expect(yellow("aviso")).toBe("\x1b[33maviso\x1b[39m");
    expect(cyan("id")).toBe("\x1b[36mid\x1b[39m");
    expect(bold("x")).toBe("\x1b[1mx\x1b[22m");
    expect(dim("x")).toBe("\x1b[2mx\x1b[22m");
  });

  it("disableColor devuelve el texto plano", () => {
    disableColor();
    expect(isColorEnabled()).toBe(false);
    expect(red("error")).toBe("error");
    expect(green("ok")).toBe("ok");
    expect(bold("x")).toBe("x");
    expect(cyan("id")).toBe("id");
    enableColor();
  });
});

describe("stripAnsi / visibleLength", () => {
  it("elimina los códigos de escape", () => {
    enableColor();
    expect(stripAnsi(red("hola"))).toBe("hola");
    expect(stripAnsi(`${bold("a")}${dim("b")}`)).toBe("ab");
    expect(stripAnsi("sin-ansi")).toBe("sin-ansi");
  });

  it("mide la longitud sin contar escapes", () => {
    enableColor();
    expect(visibleLength(cyan("minimal-node"))).toBe("minimal-node".length);
    expect(visibleLength("abc")).toBe(3);
  });
});

describe("renderTable", () => {
  it("alinea columnas aunque las celdas lleven color", () => {
    enableColor();
    const table = renderTable(
      ["ID", "NOMBRE"],
      [
        [cyan("minimal-node"), "Node puro"],
        ["express-api", "Express API"]
      ]
    );
    const lines = table.split("\n");
    expect(lines).toHaveLength(4);

    // Todas las filas de datos tienen la misma longitud visible.
    expect(visibleLength(lines[2])).toBe(visibleLength(lines[3]));

    // La columna 2 de ambas filas empieza en el mismo carácter.
    const plain = lines.map(stripAnsi);
    expect(plain[2].indexOf("Node puro")).toBe(
      plain[3].indexOf("Express API")
    );
  });

  it("devuelve solo cabecera y separador cuando no hay filas", () => {
    const table = renderTable(["A", "B"], []);
    expect(table.split("\n")).toHaveLength(2);
    expect(table).toContain("A");
    expect(table.split("\n")[1]).toContain("─");
  });

  it("con los colores desactivados no genera escapes", () => {
    disableColor();
    expect(renderTable(["A"], [[red("x")]])).toBe("A\n─\nx");
    enableColor();
  });
});

describe("banner", () => {
  it("enmarca el título y las líneas", () => {
    enableColor();
    const box = banner("nodedesk start", ["pid  1234"]);
    const plain = box.split("\n").map(stripAnsi).join("\n");
    expect(plain).toContain("nodedesk start");
    expect(plain).toContain("pid  1234");
    expect(plain).toContain("╭");
    expect(plain).toContain("╰");
  });

  it("la caja queda bien cerrada (misma anchura en todas las filas)", () => {
    const box = banner("título", ["línea más larga del banner", "corta"]);
    const widths = box
      .split("\n")
      .map((line) => visibleLength(line));
    expect(new Set(widths).size).toBe(1);
  });
});

describe("máscara de secretos de .env", () => {
  it("detecta claves sensibles (insensible a mayúsculas)", () => {
    expect(isSecretKey("API_TOKEN")).toBe(true);
    expect(isSecretKey("client_secret")).toBe(true);
    expect(isSecretKey("PASSWORD")).toBe(true);
    expect(isSecretKey("apiKey")).toBe(true);
    expect(isSecretKey("DATABASE_KEY")).toBe(true);
  });

  it("no enmascara claves normales", () => {
    expect(isSecretKey("PORT")).toBe(false);
    expect(isSecretKey("GREETING")).toBe(false);
    expect(isSecretKey("NODE_ENV")).toBe(false);
  });

  it("enmascara el valor de un secreto y respeta el resto", () => {
    expect(maskEnvValue("API_TOKEN", "s3cr3t")).toBe(MASKED_VALUE);
    expect(maskEnvValue("PORT", "3011")).toBe("3011");
    expect(MASKED_VALUE).toBe("****");
  });
});
