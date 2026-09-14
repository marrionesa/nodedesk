/**
 * `nodedesk templates [id]` — catálogo de templates del ecosistema.
 *
 * Sin argumentos lista el catálogo completo (id en cian, nombre, tagline
 * atenuada, tags); con una id muestra el detalle completo de la template
 * (descripción, stack, versión mínima de Node, scripts y dependencias).
 */

import { TemplateManager } from "@nodedesk/templates";
import type { Template } from "@nodedesk/templates";

import {
  bold,
  cyan,
  dim,
  println,
  printError,
  printJson,
  renderTable
} from "../ui.js";

/** Opciones del comando `templates`. */
export interface TemplatesOptions {
  /** Salida JSON. */
  json: boolean;
}

/** Metadatos serializables de una template (sin las funciones). */
export function templateMetadata(template: Template): {
  id: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  stack: string[];
  tags: string[];
  minNode: string;
  dependencies: Record<string, string>;
  scripts: Record<string, string>;
} {
  return {
    id: template.id,
    name: template.name,
    tagline: template.tagline,
    description: template.description,
    category: template.category,
    stack: template.stack,
    tags: template.tags,
    minNode: template.minNode,
    dependencies: template.dependencies ?? {},
    scripts: template.scripts
  };
}

/** Ejecuta `nodedesk templates`. Devuelve el código de salida. */
export async function templatesCommand(
  id: string | undefined,
  options: TemplatesOptions
): Promise<number> {
  const templates = TemplateManager.list();

  if (id === undefined) {
    if (options.json) {
      printJson(templates.map(templateMetadata));
      return 0;
    }

    const rows = templates.map((template) => [
      cyan(template.id),
      template.name,
      dim(template.tagline),
      template.tags.join(",")
    ]);
    println(renderTable(["ID", "NOMBRE", "TAGLINE", "TAGS"], rows));
    println(
      dim(`\n${templates.length} template(s) — detalle: nodedesk templates <id>`)
    );
    return 0;
  }

  const template = TemplateManager.get(id);
  if (template === null) {
    printError(`no existe la template "${id}"`);
    println("");
    println("templates disponibles:");
    for (const available of templates) {
      println(`  ${cyan(available.id)} ${dim(`— ${available.name}`)}`);
    }
    return 1;
  }

  if (options.json) {
    printJson(templateMetadata(template));
    return 0;
  }

  println(`${bold(cyan(template.id))} ${dim(`— ${template.name}`)}`);
  println("");
  println(template.description);
  println("");
  println(`  ${bold("categoría")}   ${template.category}`);
  println(`  ${bold("stack")}       ${template.stack.join(", ")}`);
  println(`  ${bold("node")}        ≥ ${template.minNode}`);
  println(`  ${bold("tags")}       ${template.tags.join(", ")}`);
  println(`  ${bold("scripts")}`);

  for (const [name, command] of Object.entries(template.scripts)) {
    println(`    ${cyan(name)}  ${dim(command)}`);
  }

  const dependencies = Object.entries(template.dependencies ?? {});
  println(`  ${bold("dependencias")}`);
  if (dependencies.length === 0) {
    println(`    ${dim("ninguna")}`);
  } else {
    for (const [name, range] of dependencies) {
      println(`    ${name} ${dim(range)}`);
    }
  }

  println(`  ${bold("crear")}       nodedesk create <nombre> -t ${template.id}`);
  return 0;
}
