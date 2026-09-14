/**
 * `nodedesk version` — versión del CLI y de los paquetes del ecosistema.
 *
 * Las versiones se leen de los package.json reales (CLI, core, templates,
 * plugins) para que reflejen lo que hay instalado, no constantes duplicadas.
 */

import { ecosystemVersions } from "../versions.js";
import {
  cyan,
  dim,
  println,
  printJson,
  renderTable
} from "../ui.js";

/** Opciones del comando `version`. */
export interface VersionOptions {
  /** Salida JSON. */
  json: boolean;
}

/** Ejecuta `nodedesk version`. Devuelve el código de salida. */
export async function versionCommand(
  options: VersionOptions
): Promise<number> {
  const versions = await ecosystemVersions();

  if (options.json) {
    printJson(versions);
    return 0;
  }

  const rows = [
    ["@nodedesk/cli", versions.cli],
    ["@nodedesk/core", versions.core ?? dim("no instalado")],
    ["@nodedesk/templates", versions.templates ?? dim("no instalado")],
    ["@nodedesk/plugins", versions.plugins ?? dim("no instalado")]
  ].map(([name, version]) => [cyan(name), version]);

  println(renderTable(["PAQUETE", "VERSIÓN"], rows));
  return 0;
}
