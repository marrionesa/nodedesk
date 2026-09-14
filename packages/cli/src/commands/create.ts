/**
 * `nodedesk create <name>` — crea un proyecto desde una template.
 *
 * Capa fina sobre `TemplateManager.create()` de @nodedesk/templates: valida
 * la template (listando las disponibles si no existe), calcula el destino
 * `<dir>/<slug>` y presenta el resultado (ficheros, puerto, .env, pasos
 * siguientes).
 */

import path from "node:path";

import { slugify } from "@nodedesk/core";
import { TemplateManager } from "@nodedesk/templates";
import type { CreateResult } from "@nodedesk/templates";

import {
  bold,
  cyan,
  dim,
  green,
  maskEnvValue,
  println,
  printError,
  printJson,
  printSuccess
} from "../ui.js";

/** Opciones del comando `create`. */
export interface CreateOptions {
  /** Id de la template (por defecto `minimal-node`). */
  template: string;
  /** Directorio padre: el destino final es `<dir>/<slug>`. */
  dir?: string;
  /** Sobrescribir si el destino existe y no está vacío. */
  force: boolean;
  /** Salida JSON. */
  json: boolean;
}

/** Resultado de `create` con rutas relativas al cwd (para humanos). */
function toHumanResult(result: CreateResult): CreateResult & {
  relativeFiles: string[];
} {
  return {
    ...result,
    relativeFiles: result.files.map((file) =>
      path.relative(process.cwd(), file)
    )
  };
}

/** Ejecuta `nodedesk create`. Devuelve el código de salida. */
export async function createCommand(
  name: string,
  options: CreateOptions
): Promise<number> {
  const templateId = options.template;

  if (!TemplateManager.has(templateId)) {
    printError(`no existe la template "${templateId}"`);
    println("");
    println("templates disponibles:");
    for (const template of TemplateManager.list()) {
      println(`  ${cyan(template.id)} ${dim(`— ${template.name}`)}`);
    }
    return 1;
  }

  const slug = slugify(name, templateId);
  const directory = options.dir
    ? path.resolve(options.dir, slug)
    : undefined;

  let result: CreateResult;
  try {
    result = await TemplateManager.create(templateId, {
      name,
      directory,
      force: options.force
    });
  } catch (error) {
    printError(error instanceof Error ? error.message : String(error));
    return 1;
  }

  if (options.json) {
    printJson(toHumanResult(result));
    return 0;
  }

  printSuccess(`proyecto "${name}" creado desde la template ${templateId}`);
  println("");
  println(`  ${bold("directorio")}  ${result.directory} ${dim(`(${result.count} ficheros)`)}`);
  println(`  ${bold("puerto")}      ${result.port}`);

  println("");
  println(bold("ficheros:"));
  for (const file of result.files) {
    println(`  ${dim("-")} ${path.relative(process.cwd(), file)}`);
  }

  if (result.env.length > 0) {
    println("");
    println(bold("variables .env:"));
    for (const variable of result.env) {
      const value = maskEnvValue(variable.key, variable.value);
      const comment =
        variable.comment !== undefined ? dim(`  # ${variable.comment}`) : "";
      println(`  ${cyan(variable.key)}=${value}${comment}`);
    }
  }

  println("");
  println(bold("siguientes pasos:"));
  result.nextSteps.forEach((step, index) => {
    println(`  ${green(`${index + 1}.`)} ${step}`);
  });

  return 0;
}
