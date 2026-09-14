/**
 * @nodedesk/cli — lectura de versiones de los paquetes del ecosistema.
 *
 * El binario debe funcionar en dos escenarios:
 *
 * - **monorepo (desarrollo)**: los paquetes viven en `../<paquete>` al lado
 *   de `packages/cli`,
 * - **publicado en npm**: los paquetes viven como hermanos bajo
 *   `node_modules/@nodedesk/<paquete>`.
 *
 * En ambos casos los paquetes son *hermanos del directorio del CLI*, así que
 * se lee `../<paquete>/package.json` relativo al propio package.json de la
 * CLI; para `core` y `templates` (dependencias declaradas) se usa además
 * `createRequire(...).resolve()` que es más preciso cuando el CLI se instala
 * como dependencia de otra aplicación.
 */

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

import type { PackageJson } from "@nodedesk/core";

const require = createRequire(import.meta.url);

/** Directorio del paquete `@nodedesk/cli` (…/packages/cli). */
const cliPackageDir = path.dirname(
  fileURLToPath(new URL("../package.json", import.meta.url))
);

/** Versión de un paquete leída de su package.json (null si es ilegible). */
async function readVersion(file: string): Promise<string | null> {
  try {
    const raw = await readFile(file, "utf8");
    const pkg = JSON.parse(raw) as PackageJson;
    return typeof pkg.version === "string" ? pkg.version : null;
  } catch {
    return null;
  }
}

/** Versión del propio CLI (síncrona: se necesita al montar commander). */
export function cliVersion(): string {
  const pkg = require("../package.json") as PackageJson;
  return typeof pkg.version === "string" ? pkg.version : "0.0.0";
}

/** Versiones de los cuatro paquetes públicos del ecosistema. */
export interface EcosystemVersions {
  cli: string;
  core: string | null;
  templates: string | null;
  plugins: string | null;
}

/**
 * Lee las versiones de los paquetes del ecosistema.
 *
 * Los que no se encuentren (p. ej. `@nodedesk/plugins` no es dependencia de
 * la CLI y no está instalado) quedan como `null` y se muestran como
 * "no instalado".
 */
export async function ecosystemVersions(): Promise<EcosystemVersions> {
  const candidates: Record<string, string[]> = {
    core: [],
    templates: [],
    plugins: []
  };

  // Ruta precisa para las dependencias declaradas (respetaría nested installs).
  for (const name of ["@nodedesk/core", "@nodedesk/templates"]) {
    try {
      candidates[name.slice("@nodedesk/".length)] = [
        require.resolve(`${name}/package.json`)
      ];
    } catch {
      // No resolvible: probaremos la ruta de hermano en el monorepo/npm.
    }
  }

  // Ruta "hermano": válida en el monorepo (packages/*) y en un install
  // conjunto (node_modules/@nodedesk/*).
  for (const short of ["core", "templates", "plugins"]) {
    candidates[short].push(path.join(cliPackageDir, "..", short, "package.json"));
  }

  const resolve = async (short: string): Promise<string | null> => {
    for (const candidate of candidates[short]) {
      const version = await readVersion(candidate);
      if (version !== null) return version;
    }
    return null;
  };

  const [core, templates, plugins] = await Promise.all([
    resolve("core"),
    resolve("templates"),
    resolve("plugins")
  ]);

  return { cli: cliVersion(), core, templates, plugins };
}
