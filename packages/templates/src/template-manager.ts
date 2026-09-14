import { promises as fs } from "node:fs";
import path from "node:path";

import { findFreePort, slugify } from "@nodedesk/core";
import type { PackageManagerId } from "@nodedesk/core";

import { TemplateError, TemplateNotFoundError } from "./errors.js";
import { builtinTemplates } from "./templates/index.js";
import type {
  CreateOptions,
  CreateResult,
  Template,
  TemplateContext,
  TemplateEnvVar
} from "./types.js";

/**
 * Registro global de templates registradas en runtime (las "custom").
 *
 * Las built-in viven en `templates/index.ts` y no se tocan; este mapa solo
 * recoge templates de terceros añadidas con `TemplateManager.register()`.
 */
const customTemplates = new Map<string, Template>();

/** Serializa variables de entorno al formato `# comentario\nKEY=VALUE\n`. */
function envFileContent(vars: TemplateEnvVar[]): string {
  const lines: string[] = [];
  for (const v of vars) {
    if (v.comment !== undefined && v.comment.length > 0) {
      lines.push(`# ${v.comment}`);
    }
    lines.push(`${v.key}=${v.value}`);
  }
  return lines.length > 0 ? `${lines.join("\n")}\n` : "";
}

/** `true` si el directorio existe y contiene al menos una entrada. */
async function isNonEmptyDir(directory: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(directory);
    return entries.length > 0;
  } catch {
    // No existe (o inaccesible): se comporta como destino vacío.
    return false;
  }
}

/**
 * Gestor del catálogo de templates y generador de proyectos.
 *
 * Adaptación del `match` gigante de `templates.rs::generate` de V1 a un
 * registro dinámico: las templates built-in son datos + funciones, y
 * cualquiera (la CLI, NodeDesk Desktop, un tercero) puede registrar las
 * suyas con `TemplateManager.register()`.
 *
 * La clase es deliberadamente estática — así lo exige la spec del
 * ecosistema — y comparte un único registro global por proceso:
 *
 * ```ts
 * const [tpl] = TemplateManager.list();
 * const result = await TemplateManager.create(tpl.id, {
 *   name: "Mi API",
 *   directory: "./mi-api"
 * });
 * ```
 */
export class TemplateManager {
  /** La API es estática: no se puede instanciar. */
  private constructor() {}

  /**
   * Registra una template custom en el catálogo global.
   *
   * @throws {TemplateError} si falta el `id` o ya existe una template
   * (built-in o registrada) con ese id.
   */
  static register(template: Template): void {
    if (typeof template.id !== "string" || template.id.length === 0) {
      throw new TemplateError("la template a registrar debe tener un id no vacío");
    }
    if (TemplateManager.has(template.id)) {
      throw new TemplateError(
        `ya existe una template con id "${template.id}" (built-in o registrada)`
      );
    }
    customTemplates.set(template.id, template);
  }

  /** Catálogo completo: built-ins + registradas en runtime. */
  static list(): Template[] {
    return [...builtinTemplates, ...customTemplates.values()];
  }

  /** Busca una template por id (built-ins y registradas). `null` si no existe. */
  static get(id: string): Template | null {
    for (const template of builtinTemplates) {
      if (template.id === id) return template;
    }
    return customTemplates.get(id) ?? null;
  }

  /** `true` si existe una template con ese id. */
  static has(id: string): boolean {
    return TemplateManager.get(id) !== null;
  }

  /**
   * Vacia el registro de templates custom (las built-in se mantienen).
   *
   * Método de soporte para tests y aislamiento entre suites: NO forma parte
   * de la API de usuario final documentada.
   */
  static reset(): void {
    customTemplates.clear();
  }

  /**
   * Genera un proyecto a partir de una template.
   *
   * Resolución de opciones (misma semántica que `projects.rs::create` de V1):
   *
   * - `name` por defecto = `name` de la template; `slug = slugify(name)`.
   * - `directory` por defecto = `./<slug>` resuelto a ruta absoluta.
   * - `port` por defecto = primer puerto libre del pool 3011–3099
   *   (`findFreePort` de @nodedesk/core); si el pool está agotado, 3011.
   * - `packageManager` por defecto `"npm"` (solo metadatos y nextSteps).
   *
   * @throws {TemplateNotFoundError} si el id no existe.
   * @throws {TemplateError} si el directorio destino existe, no está vacío
   * y no se pasó `force: true`.
   */
  static async create(
    id: string,
    options: CreateOptions = {}
  ): Promise<CreateResult> {
    const template = TemplateManager.get(id);
    if (template === null) {
      throw new TemplateNotFoundError(id);
    }

    const name = options.name ?? template.name;
    const slug = slugify(name, template.id);
    const directory = path.resolve(options.directory ?? `./${slug}`);
    const packageManager: PackageManagerId = options.packageManager ?? "npm";

    const port =
      options.port ?? (await findFreePort(3011, 3099)) ?? 3011;

    // Destino ocupado: salvo con force, no se pisa nada (V1 mostraba el
    // mismo error al elegir carpeta destino).
    if (options.force !== true && (await isNonEmptyDir(directory))) {
      throw new TemplateError(
        `el directorio "${directory}" ya existe y no está vacío ` +
          "(usa force: true para sobrescribir)"
      );
    }

    const context: TemplateContext = {
      name,
      slug,
      port,
      directory,
      packageManager
    };

    // Ficheros de la template (package.json, src/, .gitignore, README…).
    const written: string[] = [];
    for (const file of template.files(context)) {
      const target = path.join(directory, file.path);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, file.content, "utf8");
      written.push(target);
    }

    // .env inicial con las variables de la template.
    const envVars =
      options.skipEnv === true ? [] : (template.env?.(context) ?? []);
    if (envVars.length > 0) {
      const envPath = path.join(directory, ".env");
      await fs.writeFile(envPath, envFileContent(envVars), "utf8");
      written.push(envPath);
    }

    const nextSteps = [
      `cd ${directory}`,
      `${packageManager} install`,
      `${packageManager} run dev`
    ];

    return {
      directory,
      template: template.id,
      files: written,
      count: written.length,
      env: envVars,
      port,
      nextSteps
    };
  }
}
