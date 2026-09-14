/**
 * @nodedesk/cli — utilidades de presentación para la terminal.
 *
 * Colores ANSI, tablas y banners "hechos en casa" (sin dependencias):
 * respetan `NO_COLOR` (https://no-color.org) y el flag `--no-color` de la
 * propia CLI, y todas las medidas de ancho ignoran los códigos de escape.
 */

/** Códigos ANSI de apertura/cierre para cada estilo soportado. */
const ANSI = {
  bold: ["\x1b[1m", "\x1b[22m"],
  dim: ["\x1b[2m", "\x1b[22m"],
  green: ["\x1b[32m", "\x1b[39m"],
  yellow: ["\x1b[33m", "\x1b[39m"],
  red: ["\x1b[31m", "\x1b[39m"],
  cyan: ["\x1b[36m", "\x1b[39m"]
} as const;

type Style = keyof typeof ANSI;

/**
 * Estado de los colores: `null` = decidido por el entorno (`NO_COLOR`),
 * `false` = forzado apagado (`--no-color`), `true` = forzado encendido
 * (tests de la UI).
 */
let override: boolean | null = null;

/** `true` si el entorno pide colores (variable evaluada al cargar el módulo). */
const envAllowsColor =
  process.env.NO_COLOR === undefined || process.env.NO_COLOR === "";

/** ¿Están activos los colores ANSI ahora mismo? */
export function isColorEnabled(): boolean {
  return override ?? envAllowsColor;
}

/** Desactiva los colores (flag `--no-color`). */
export function disableColor(): void {
  override = false;
}

/** Reactiva los colores (útil en tests: fuerza aunque haya `NO_COLOR`). */
export function enableColor(): void {
  override = true;
}

/** Envuelve el texto con un estilo ANSI si los colores están activos. */
function paint(style: Style, text: string): string {
  if (!isColorEnabled()) return text;
  const [open, close] = ANSI[style];
  return `${open}${text}${close}`;
}

/** Texto en negrita. */
export function bold(text: string): string {
  return paint("bold", text);
}

/** Texto atenuado (dim). */
export function dim(text: string): string {
  return paint("dim", text);
}

/** Texto en verde (éxitos). */
export function green(text: string): string {
  return paint("green", text);
}

/** Texto en amarillo (avisos). */
export function yellow(text: string): string {
  return paint("yellow", text);
}

/** Texto en rojo (errores). */
export function red(text: string): string {
  return paint("red", text);
}

/** Texto en cian (identificadores, rutas destacadas). */
export function cyan(text: string): string {
  return paint("cyan", text);
}

/** Quita los códigos de escape ANSI de una cadena. */
export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*[A-Za-z]/g, "");
}

/** Longitud visible (sin códigos ANSI) de una cadena. */
export function visibleLength(text: string): number {
  return stripAnsi(text).length;
}

/** Rellena una cadena hasta `width` columnas visibles. */
function padVisible(text: string, width: number): string {
  const missing = width - visibleLength(text);
  return missing > 0 ? text + " ".repeat(missing) : text;
}

/**
 * Renderiza una tabla alineada por columnas.
 *
 * Las celdas pueden llevar colores ANSI: el cálculo de anchos usa la
 * longitud *visible*, así que los códigos de escape no desalinean nada.
 *
 * ```ts
 * renderTable(["ID", "NOMBRE"], [[cyan("a"), "Alpha"], ["b", "Beta"]]);
 * ```
 */
export function renderTable(headers: string[], rows: string[][]): string {
  const columnCount = headers.length;
  const widths = headers.map((header, index) => {
    const cells = rows.map((row) => row[index] ?? "");
    return Math.max(visibleLength(header), ...cells.map(visibleLength));
  });

  const renderRow = (cells: string[]): string =>
    cells
      .map((cell, index) => padVisible(cell, widths[index] ?? 0))
      .join("  ");

  const separator = widths.map((width) => "─".repeat(width)).join("  ");
  const lines = [renderRow(headers), separator, ...rows.map(renderRow)];
  return lines.join("\n");
}

/**
 * Renderiza un banner tipo "caja" con título y líneas de contenido.
 *
 * ```ts
 * banner("nodedesk start", ["pid  1234", "Ctrl+C para detener"]);
 * ```
 */
export function banner(title: string, lines: string[] = []): string {
  const content = [bold(`▶ ${title}`), ...lines];
  const width = Math.max(...content.map(visibleLength)) + 2;

  const top = `╭${"─".repeat(width)}╮`;
  const bottom = `╰${"─".repeat(width)}╯`;
  const rows = content.map((line) => `│${padVisible(` ${line}`, width)}│`);
  return [top, ...rows, bottom].join("\n");
}

/* --------------------------- salida estandarizada --------------------------- */

/** Imprime una línea en stdout sin colores (normal + newline). */
export function println(text = ""): void {
  process.stdout.write(`${text}\n`);
}

/** Imprime JSON sin colores (útil para pipes y scripts). */
export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

/** Imprime un mensaje de éxito (✓ verde). */
export function printSuccess(message: string): void {
  process.stdout.write(`${green(`✓ ${message}`)}\n`);
}

/** Imprime un mensaje de aviso (⚠ amarillo). */
export function printWarning(message: string): void {
  process.stdout.write(`${yellow(`⚠ ${message}`)}\n`);
}

/** Imprime un mensaje de error (✗ rojo) en stderr. */
export function printError(message: string): void {
  process.stderr.write(`${red(`✗ ${message}`)}\n`);
}

/** Imprime una lista con viñetas atenuadas. */
export function printList(items: string[]): void {
  for (const item of items) println(`  ${dim("-")} ${item}`);
}

/* ------------------------------- env: máscara ------------------------------ */

/** Patrón de claves que contienen secretos (insensible a mayúsculas). */
const SECRET_KEY_PATTERN = /(secret|token|key|password)/i;

/** Máscara fija que se muestra en lugar del valor de un secreto. */
export const MASKED_VALUE = "****";

/** `true` si el nombre de la variable sugiere que contiene un secreto. */
export function isSecretKey(key: string): boolean {
  return SECRET_KEY_PATTERN.test(key);
}

/** Valor a mostrar: enmascarado si la clave parece un secreto. */
export function maskEnvValue(key: string, value: string): string {
  return isSecretKey(key) ? MASKED_VALUE : value;
}
