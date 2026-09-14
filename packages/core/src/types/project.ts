/**
 * Tipos compartidos de @nodedesk/core.
 *
 * Modelos públicos para proyectos Node.js y su configuración.
 */

/** Identificadores de package manager soportados por el ecosistema. */
export type PackageManagerId = "npm" | "pnpm" | "yarn" | "bun";

/** Información sobre el package manager de un proyecto. */
export interface PackageManagerInfo {
  /** Identificador corto (`npm`, `pnpm`, `yarn`, `bun`). */
  id: PackageManagerId;
  /** Nombre legible (`npm`, `pnpm`, `Yarn`, `Bun`). */
  name: string;
  /** Lockfile que identifica al package manager. */
  lockFile: string | null;
  /** Comando ejecutable (`npm`, `pnpm`, `yarn`, `bun`). */
  command: string;
  /** Cómo se detectó: lockfile, campo `packageManager` o valor por defecto. */
  detected: "lockfile" | "packageJson" | "default";
}

/** Subconjunto tipado de `package.json` relevante para el ecosistema. */
export interface PackageJson {
  name?: string;
  version?: string;
  type?: string;
  main?: string;
  description?: string;
  private?: boolean;
  /** Campo estándar `packageManager` (ej. `pnpm@9.1.0`). */
  packageManager?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  engines?: { node?: string; [key: string]: string | undefined };
  /** El resto de campos, sin perder información. */
  [key: string]: unknown;
}

/** Metadatos de un proyecto Node.js tal y como los expone `NodeProject`. */
export interface ProjectMetadata {
  /** Nombre (de `package.json#name` o del directorio). */
  name: string;
  /** Ruta absoluta de la raíz del proyecto. */
  path: string;
  /** Slug seguro (para dominios, carpetas, logs). */
  slug: string;
  /** `package.json` parseado (null si no se pudo leer). */
  packageJson: PackageJson | null;
  /** Scripts declarados. */
  scripts: Record<string, string>;
  /** Nombres de dependencias de producción. */
  dependencies: string[];
  /** Nombres de devDependencies. */
  devDependencies: string[];
  /** Restricción de Node declarada en `engines.node` (si existe). */
  nodeEngine: string | null;
  /** Ruta del fichero `.env` del proyecto. */
  envPath: string;
  /** `true` si existe `node_modules/`. */
  hasNodeModules: boolean;
  /** Package manager detectado. */
  packageManager: PackageManagerInfo;
  /** `true` si el proyecto es un repo git (existe `.git`). */
  isGitRepository: boolean;
}
