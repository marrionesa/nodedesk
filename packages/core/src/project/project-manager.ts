import { promises as fs } from "node:fs";
import path from "node:path";

import { PathNotFoundError } from "../errors.js";
import type { DiscoveryOptions } from "../types/utils.js";
import { hasPackageJson } from "./package-json.js";
import { NodeProject } from "./node-project.js";

/** Directorios ignorados por defecto en el descubrimiento. */
const DEFAULT_IGNORE = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  "coverage",
  ".cache",
  ".next",
  ".turbo",
  ".pnpm-store"
]);

/**
 * Punto de entrada para cargar y descubrir proyectos Node.js.
 *
 * Derivado conceptualmente de los comandos de catálogo de V1
 * (`projects.rs::nd_list_projects`, `nd_list_folders`,
 * `nd_add_folder`), convertido en una API de librería sin UI.
 *
 * ```ts
 * const project = await ProjectManager.load("./my-project");
 * const projects = await ProjectManager.discover("./projects");
 * ```
 */
export class ProjectManager {
  /**
   * Carga un único proyecto desde una ruta.
   * @throws PathNotFoundError si la ruta no existe.
   * @throws InvalidProjectError si no contiene `package.json`.
   */
  static async load(input: string): Promise<NodeProject> {
    return NodeProject.load(input);
  }

  /**
   * Descubre proyectos Node.js bajo un directorio (búsqueda en anchura con
   * límite de profundidad). Los directorios con `package.json` se registran
   * y, por defecto, no se desciende dentro de ellos.
   */
  static async discover(
    root: string,
    options: DiscoveryOptions = {}
  ): Promise<NodeProject[]> {
    const { depth = 3, ignore = [], stopAtProject = true } = options;
    const ignoreSet = new Set(ignore.length > 0 ? ignore : DEFAULT_IGNORE);

    const absoluteRoot = path.resolve(root);
    try {
      await fs.access(absoluteRoot);
    } catch {
      throw new PathNotFoundError(absoluteRoot);
    }

    const found: string[] = [];
    const queue: Array<{ dir: string; level: number }> = [
      { dir: absoluteRoot, level: 0 }
    ];

    while (queue.length > 0) {
      const { dir, level } = queue.shift()!;
      const isProject = await hasPackageJson(dir);

      if (isProject) {
        found.push(dir);
        if (stopAtProject) continue;
      }

      if (level >= depth) continue;

      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        continue; // Sin permisos de lectura: ignorar.
      }

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith(".") && entry.name !== ".") {
          continue; // Directorios ocultos.
        }
        if (ignoreSet.has(entry.name)) continue;
        queue.push({ dir: path.join(dir, entry.name), level: level + 1 });
      }
    }

    found.sort((a, b) => a.localeCompare(b));
    return Promise.all(found.map((dir) => NodeProject.load(dir)));
  }

  /** `true` si la ruta contiene un proyecto Node.js válido. */
  static async isValid(input: string): Promise<boolean> {
    try {
      await NodeProject.load(input);
      return true;
    } catch {
      return false;
    }
  }
}
