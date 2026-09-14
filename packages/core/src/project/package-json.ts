import { promises as fs } from "node:fs";
import path from "node:path";

import type { PackageJson } from "../types/project.js";

/**
 * Lectura tolerante de `package.json`.
 *
 * Derivado conceptualmente de `projects.rs::inspect_folder` /
 * `projects.rs::read_dev_command` de V1: parseo defensivo que devuelve
 * `null` en vez de lanzar cuando el fichero no existe o no es JSON válido.
 */
export async function readPackageJson(dir: string): Promise<PackageJson | null> {
  const file = path.join(dir, "package.json");
  let raw: string;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch {
    return null;
  }
  try {
    return JSON.parse(raw) as PackageJson;
  } catch {
    return null;
  }
}

/** `true` si el directorio contiene un `package.json` parseable. */
export async function hasPackageJson(dir: string): Promise<boolean> {
  return (await readPackageJson(dir)) !== null;
}
