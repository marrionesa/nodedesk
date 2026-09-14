import type { EnvEntry } from "../types/env.js";

/**
 * Parser/serializador de ficheros `.env`.
 *
 * Derivado de la lógica de `env.rs::nd_get_env` de V1, con dos mejoras:
 * - preserva comentarios y orden al escribir,
 * - soporta comillas simples además de dobles.
 */

/**
 * Parsea el contenido de un `.env` en entradas ordenadas.
 * - Ignora líneas vacías y comentarios sueltos.
 * - Un comentario inmediatamente anterior a una variable queda asociado
 *   a esa variable (`entry.comment`).
 * - Soporta `KEY=VALUE`, `KEY="VALUE"` y `KEY='VALUE'`.
 */
export function parseEnv(content: string): EnvEntry[] {
  const entries: EnvEntry[] = [];
  let pendingComment: string | undefined;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length === 0) {
      pendingComment = undefined; // Una línea en blanco separa bloques.
      continue;
    }

    if (line.startsWith("#")) {
      const text = line.replace(/^#+\s?/, "").trim();
      pendingComment =
        pendingComment === undefined ? text : `${pendingComment}\n${text}`;
      continue;
    }

    const eq = line.indexOf("=");
    if (eq <= 0) continue; // Línea sin forma KEY=VALUE: se ignora.

    const key = line.slice(0, eq).trim().replace(/^export\s+/, "");
    let value = line.slice(eq + 1).trim();

    let quoted = false;
    if (value.length >= 2) {
      const first = value[0];
      const last = value[value.length - 1];
      if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
        value = value.slice(1, -1);
        quoted = true;
      }
    }

    if (key.length === 0) {
      pendingComment = undefined;
      continue;
    }

    entries.push({ key, value, comment: pendingComment, quoted });
    pendingComment = undefined;
  }

  return entries;
}

/**
 * Serializa entradas de vuelta a formato `.env`.
 * - Reconstruye los comentarios asociados.
 * - Entrecomilla con comillas dobles los valores que contienen `#`, espacios
 *   al borde o están vacíos (y no estaban entrecomillados antes).
 */
export function serializeEnv(entries: EnvEntry[]): string {
  const lines: string[] = [];

  for (const entry of entries) {
    if (entry.comment !== undefined && entry.comment.length > 0) {
      for (const commentLine of entry.comment.split("\n")) {
        lines.push(commentLine.length > 0 ? `# ${commentLine}` : "#");
      }
    }
    lines.push(`${entry.key}=${formatValue(entry)}`);
  }

  return lines.length > 0 ? `${lines.join("\n")}\n` : "";
}

function formatValue(entry: EnvEntry): string {
  const { value } = entry;
  if (entry.quoted) return `"${value.replace(/"/g, '\\"')}"`;
  if (value.length === 0 || value.includes("#") || /^\s|\s$/.test(value)) {
    return `"${value}"`;
  }
  return value;
}

/** Convierte entradas a un objeto plano `KEY → VALUE`. */
export function entriesToObject(entries: EnvEntry[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const entry of entries) result[entry.key] = entry.value;
  return result;
}
