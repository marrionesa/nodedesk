import { createHash, randomUUID } from "node:crypto";

/** Marca temporal ISO-8601 en UTC. */
export function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Genera un id corto y legible (`<prefix>-<7 caracteres hex>`).
 * Derivado de `state.rs::short_uid` de V1 (uuid v4 recortado).
 */
export function shortUid(prefix: string): string {
  const uuid = randomUUID().replace(/-/g, "");
  return `${prefix}-${uuid.slice(0, 7)}`;
}

/**
 * Id corto determinista a partir de un valor (hash sha1 recortado a 7
 * caracteres hex). A diferencia de `shortUid`, el mismo input produce
 * siempre el mismo id — útil para identificar proyectos por ruta.
 */
export function hashId(value: string): string {
  return createHash("sha1").update(value).digest("hex").slice(0, 7);
}

/**
 * Espera `ms` milisegundos. Utilidad async para reintentos y gracia de
 * apagado de procesos.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
