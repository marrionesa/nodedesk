/**
 * `nodedesk projects [dir]` — descubre proyectos Node.js bajo un directorio.
 *
 * Capa fina sobre `ProjectManager.discover()` de @nodedesk/core: la CLI solo
 * formatea el resultado (tabla o JSON) y traduce el código de salida.
 */

import path from "node:path";

import { ProjectManager } from "@nodedesk/core";

import {
  cyan,
  dim,
  println,
  printJson,
  renderTable
} from "../ui.js";

/** Opciones del comando `projects`. */
export interface ProjectsOptions {
  /** Salida JSON (array de `project.toJSON()`). */
  json: boolean;
  /** Profundidad máxima de búsqueda. */
  depth: number;
}

/** Ejecuta `nodedesk projects`. Devuelve el código de salida. */
export async function projectsCommand(
  dir: string,
  options: ProjectsOptions
): Promise<number> {
  const projects = await ProjectManager.discover(dir, {
    depth: options.depth
  });

  if (options.json) {
    printJson(projects.map((project) => project.toJSON()));
    return 0;
  }

  if (projects.length === 0) {
    println(dim(`no se encontraron proyectos Node.js bajo ${dir}`));
    println(dim("un proyecto es un directorio con package.json"));
    return 0;
  }

  const rows = projects.map((project) => {
    const scripts = Object.keys(project.scripts).join(",") || dim("—");
    const deps = project.dependencies.length + project.devDependencies.length;
    const route = path.relative(process.cwd(), project.root) || ".";
    return [
      cyan(project.name),
      project.packageManager.id,
      scripts,
      String(deps),
      dim(route)
    ];
  });

  println(
    renderTable(
      ["NOMBRE", "PACKAGE MANAGER", "SCRIPTS", "DEPS", "RUTA"],
      rows
    )
  );
  println(dim(`\n${projects.length} proyecto(s) encontrado(s)`));
  return 0;
}
