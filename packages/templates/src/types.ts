import type { PackageManagerId } from "@nodedesk/core";

/**
 * Contrato de tipos de @nodedesk/templates.
 *
 * VINCULANTE: la API pública de este paquete se declara aquí.
 * La implementación (`template-manager.ts`) y el resto de módulos deben
 * respetar estas formas exactas.
 */

/** Contexto que recibe una template al generar sus ficheros. */
export interface TemplateContext {
  /** Nombre legible elegido por el usuario (ej. "Mi API"). */
  name: string;
  /** Slug seguro derivado del nombre (ej. "mi-api"). */
  slug: string;
  /** Puerto TCP asignado al proyecto. */
  port: number;
  /** Directorio destino absoluto. */
  directory: string;
  /** Package manager que usará el proyecto generado. */
  packageManager: PackageManagerId;
}

/** Un fichero generado por una template (ruta relativa + contenido). */
export interface TemplateFile {
  /** Ruta relativa dentro del proyecto (ej. `src/index.mjs`). */
  path: string;
  /** Contenido completo del fichero. */
  content: string;
}

/** Variable de entorno inicial que la template quiere fijar. */
export interface TemplateEnvVar {
  key: string;
  value: string;
  /** Comentario que acompaña a la variable en el `.env`. */
  comment?: string;
}

/** Definición de una template del ecosistema NodeDesk. */
export interface Template {
  /** Id/slug único (ej. `minimal-node`). */
  id: string;
  /** Nombre legible (ej. "Node mínimo"). */
  name: string;
  /** Frase corta de una línea. */
  tagline: string;
  /** Descripción completa. */
  description: string;
  /** Categoría de catálogo (ej. `Minimal`, `API`). */
  category: string;
  /** Stack técnico que genera. */
  stack: string[];
  /** Etiquetas de búsqueda. */
  tags: string[];
  /** Versión mínima de Node requerida (ej. `18`). */
  minNode: string;
  /** Dependencias npm que añadir al package.json generado. */
  dependencies?: Record<string, string>;
  /** Scripts npm del proyecto generado. */
  scripts: Record<string, string>;
  /** Ficheros a generar en función del contexto. */
  files(context: TemplateContext): TemplateFile[];
  /** Variables de entorno iniciales (opcional). */
  env?(context: TemplateContext): TemplateEnvVar[];
}

/** Opciones para crear un proyecto desde una template. */
export interface CreateOptions {
  /** Directorio destino. Por defecto `./<slug>`. */
  directory?: string;
  /** Nombre del proyecto. Por defecto, el slug de la template. */
  name?: string;
  /** Puerto del proyecto. Por defecto, uno libre del pool 3011–3099. */
  port?: number;
  /** Package manager con el que se genera (solo metadatos). Por defecto `npm`. */
  packageManager?: PackageManagerId;
  /** Sobrescribir si el directorio existe y no está vacío. */
  force?: boolean;
  /** No escribir el `.env` inicial. */
  skipEnv?: boolean;
}

/** Resultado de crear un proyecto desde una template. */
export interface CreateResult {
  /** Directorio absoluto del proyecto creado. */
  directory: string;
  /** Plantilla usada. */
  template: string;
  /** Ficheros escritos (rutas absolutas). */
  files: string[];
  /** Número de ficheros. */
  count: number;
  /** Variables de entorno escritas. */
  env: TemplateEnvVar[];
  /** Puerto asignado. */
  port: number;
  /** Siguiente paso sugerido (mensaje humano). */
  nextSteps: string[];
}
