/**
 * `nodedesk env <subcomando>` — gestiona el fichero `.env` de un proyecto.
 *
 * Subcomandos sobre `EnvManager` de @nodedesk/core:
 *
 * - `env list <path>`: tabla KEY (cian) + VALUE con máscara para secretos
 *   (`****` salvo `--raw`; JSON siempre devuelve los valores reales).
 * - `env get <path> KEY`: valor pelado (útil para scripts).
 * - `env set <path> KEY VALUE`: fija la variable y persiste el `.env`.
 * - `env delete <path> KEY`: elimina la variable.
 */

import { stat } from "node:fs/promises";

import { EnvManager } from "@nodedesk/core";

import {
  bold,
  cyan,
  dim,
  maskEnvValue,
  println,
  printError,
  printJson,
  printSuccess,
  renderTable
} from "../ui.js";

/** Opciones compartidas por los subcomandos de env. */
export interface EnvListOptions {
  json: boolean;
  raw: boolean;
}

/** Comprueba que la ruta es un directorio existente. */
async function assertDirectory(target: string): Promise<boolean> {
  try {
    const info = await stat(target);
    if (!info.isDirectory()) {
      printError(`"${target}" no es un directorio`);
      return false;
    }
    return true;
  } catch {
    printError(`no existe la ruta: ${target}`);
    return false;
  }
}

/** `nodedesk env list <path>`. */
export async function envListCommand(
  target: string,
  options: EnvListOptions
): Promise<number> {
  if (!(await assertDirectory(target))) return 1;

  const env = new EnvManager(target);
  const values = await env.all();
  const keys = await env.keys();

  if (options.json) {
    // JSON sin máscara: es salida para máquinas (igual que `env get`).
    printJson(values);
    return 0;
  }

  if (keys.length === 0) {
    println(dim(`sin variables (${env.path} no existe o está vacío)`));
    return 0;
  }

  const rows = keys.map((key) => [
    cyan(key),
    options.raw ? values[key] ?? "" : maskEnvValue(key, values[key] ?? "")
  ]);
  println(renderTable(["KEY", "VALUE"], rows));
  return 0;
}

/** `nodedesk env get <path> KEY`. */
export async function envGetCommand(
  target: string,
  key: string
): Promise<number> {
  if (!(await assertDirectory(target))) return 1;

  const env = new EnvManager(target);
  const value = await env.get(key);
  if (value === undefined) {
    printError(`la variable ${key} no está definida en ${env.path}`);
    return 1;
  }
  println(value);
  return 0;
}

/** `nodedesk env set <path> KEY VALUE`. */
export async function envSetCommand(
  target: string,
  key: string,
  value: string
): Promise<number> {
  if (!(await assertDirectory(target))) return 1;

  const env = new EnvManager(target);
  try {
    await env.set(key, value);
  } catch (error) {
    printError(error instanceof Error ? error.message : String(error));
    return 1;
  }
  printSuccess(`${key}=${maskEnvValue(key, value)} guardada en ${dim(env.path)}`);
  return 0;
}

/** `nodedesk env delete <path> KEY`. */
export async function envDeleteCommand(
  target: string,
  key: string
): Promise<number> {
  if (!(await assertDirectory(target))) return 1;

  const env = new EnvManager(target);
  if (!(await env.has(key))) {
    printError(`la variable ${key} no está definida en ${env.path}`);
    return 1;
  }
  await env.delete(key);
  printSuccess(`variable ${bold(key)} eliminada de ${dim(env.path)}`);
  return 0;
}
