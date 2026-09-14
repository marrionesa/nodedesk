import { promises as fs } from "node:fs";
import path from "node:path";

import { InvalidProjectError, PathNotFoundError } from "../errors.js";
import type {
  PackageJson,
  ProjectMetadata
} from "../types/project.js";
import type { PackageManagerInfo } from "../types/project.js";
import { readPackageJson } from "./package-json.js";
import { detectPackageManager } from "./package-manager.js";
import { slugify } from "../utils/slugify.js";
import { hashId } from "../utils/id.js";
import { EnvManager } from "../env/env-manager.js";
import { ProcessManager } from "../process/process-manager.js";

/**
 * Un proyecto Node.js cargado en memoria.
 *
 * Derivado conceptualmente de `ProjectRecord`/`ProjectDTO` de V1
 * (`types.rs`), pero sin estado de UI: aquí un proyecto es solo un
 * directorio con `package.json` más los gestores que operan sobre él.
 *
 * ```ts
 * const project = await ProjectManager.load("./my-app");
 * console.log(project.name, project.scripts);
 * ```
 */
export class NodeProject {
  /** Ruta absoluta de la raíz del proyecto. */
  readonly root: string;
  /** `package.json` parseado. */
  readonly packageJson: PackageJson;
  /** Package manager detectado. */
  readonly packageManager: PackageManagerInfo;

  private constructor(
    root: string,
    packageJson: PackageJson,
    packageManager: PackageManagerInfo,
    private readonly extras: {
      hasNodeModules: boolean;
      isGitRepository: boolean;
    }
  ) {
    this.root = root;
    this.packageJson = packageJson;
    this.packageManager = packageManager;
  }

  /**
   * Carga un proyecto desde una ruta.
   * @throws PathNotFoundError si la ruta no existe.
   * @throws InvalidProjectError si no hay `package.json`.
   */
  static async load(input: string): Promise<NodeProject> {
    const root = path.resolve(input);
    let stat;
    try {
      stat = await fs.stat(root);
    } catch {
      throw new PathNotFoundError(root);
    }
    if (!stat.isDirectory()) {
      throw new PathNotFoundError(`${root} (no es un directorio)`);
    }

    const pkg = await readPackageJson(root);
    if (pkg === null) {
      throw new InvalidProjectError(root);
    }

    const pm = await detectPackageManager(root, pkg);

    let hasNodeModules = false;
    let isGitRepository = false;
    try {
      await fs.access(path.join(root, "node_modules"));
      hasNodeModules = true;
    } catch {
      hasNodeModules = false;
    }
    try {
      await fs.access(path.join(root, ".git"));
      isGitRepository = true;
    } catch {
      isGitRepository = false;
    }

    return new NodeProject(root, pkg, pm, { hasNodeModules, isGitRepository });
  }

  /** Nombre del proyecto (`package.json#name` o el del directorio). */
  get name(): string {
    return this.packageJson.name ?? path.basename(this.root);
  }

  /** Slug seguro del proyecto. */
  get slug(): string {
    return slugify(this.name);
  }

  /** Scripts declarados. */
  get scripts(): Record<string, string> {
    return this.packageJson.scripts ?? {};
  }

  /** Descripción del proyecto. */
  get description(): string | null {
    return this.packageJson.description ?? null;
  }

  /** Punto de entrada principal (`main`). */
  get main(): string | null {
    return this.packageJson.main ?? null;
  }

  /** Nombres de dependencias de producción. */
  get dependencies(): string[] {
    return Object.keys(this.packageJson.dependencies ?? {});
  }

  /** Nombres de devDependencies. */
  get devDependencies(): string[] {
    return Object.keys(this.packageJson.devDependencies ?? {});
  }

  /** Restricción `engines.node`, si existe. */
  get nodeEngine(): string | null {
    return this.packageJson.engines?.node ?? null;
  }

  /** Ruta del fichero `.env`. */
  get envPath(): string {
    return path.join(this.root, ".env");
  }

  /** `true` si existe `node_modules/`. */
  get hasNodeModules(): boolean {
    return this.extras.hasNodeModules;
  }

  /** `true` si el proyecto es un repo git. */
  get isGitRepository(): boolean {
    return this.extras.isGitRepository;
  }

  /**
   * Comando por defecto para arrancar el proyecto.
   * Derivado de `projects.rs::read_dev_command` de V1.
   */
  get devCommand(): string | null {
    const scripts = this.scripts;
    const pm = this.packageManager;
    if (typeof scripts.dev === "string") return `${pm.command} run dev`;
    if (typeof scripts.start === "string") return `${pm.command} run start`;
    if (this.main) return `node ${this.main}`;
    return null;
  }

  /** Snapshot plano de metadatos (serializable). */
  toJSON(): ProjectMetadata {
    return {
      name: this.name,
      path: this.root,
      slug: this.slug,
      packageJson: this.packageJson,
      scripts: this.scripts,
      dependencies: this.dependencies,
      devDependencies: this.devDependencies,
      nodeEngine: this.nodeEngine,
      envPath: this.envPath,
      hasNodeModules: this.hasNodeModules,
      packageManager: this.packageManager,
      isGitRepository: this.isGitRepository
    };
  }

  /** Crea un `EnvManager` para este proyecto. */
  createEnvManager(): EnvManager {
    return new EnvManager(this.root);
  }

  /**
   * Crea un `ProcessManager` para este proyecto.
   * @param script script por defecto con el que arrancar (`dev` si existe).
   */
  createProcessManager(script?: string): ProcessManager {
    return new ProcessManager(this.root, {
      script,
      packageManager: this.packageManager,
      scripts: this.scripts,
      main: this.main
    });
  }

  /** Id corto estable para el proyecto (determinista: hash de la ruta). */
  get id(): string {
    return `prj-${hashId(this.root)}`;
  }
}
