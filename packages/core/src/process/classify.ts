import type { LogLevel } from "../types/process.js";

/**
 * Clasifica una línea de salida en un nivel de log.
 *
 * Port de `process.rs::classify` de V1: las líneas con marcadores del
 * sistema son `system`, stderr o contenido con "error" son `error`,
 * avisos `warn`, y el resto `info`.
 */
export function classifyLine(
  line: string,
  source: "stdout" | "stderr" | "system"
): LogLevel {
  if (source === "system") return "system";

  const lower = line.toLowerCase();
  if (
    lower.includes("[nodedesk]") ||
    line.startsWith("📦") ||
    line.startsWith("🚀")
  ) {
    return "system";
  }
  if (source === "stderr" || lower.includes("error") || lower.includes("err!")) {
    return "error";
  }
  if (lower.includes("warn") || line.includes("⚠")) {
    return "warn";
  }
  return "info";
}
