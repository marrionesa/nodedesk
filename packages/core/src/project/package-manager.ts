import { promises as fs } from "node:fs";
import path from "node:path";

import type {
  PackageJson,
  PackageManagerId,
  PackageManagerInfo
} from "../types/project.js";

interface PackageManagerDefinition {
  id: PackageManagerId;
  name: string;
  lockFiles: string[];
  command: string;
}

/** Definiciones de los package managers soportados. */
const DEFINITIONS: PackageManagerDefinition[] = [
  { id: "npm", name: "npm", lockFiles: ["package-lock.json"], command: "npm" },
  { id: "pnpm", name: "pnpm", lockFiles: ["pnpm-lock.yaml"], command: "pnpm" },
  { id: "yarn", name: "Yarn", lockFiles: ["yarn.lock"], command: "yarn" },
  {
    id: "bun",
    name: "Bun",
    lockFiles: ["bun.lockb", "bun.lock"],
    command: "bun"
  }
];

/**
 * Detecta el package manager de un proyecto Node.js.
 *
 * Estrategia (equivalente a la deducción de `npm`/`bun` de
 * `process.rs::dev_command` en V1, generalizada y determinista):
 *
 * 1. Lockfile presente en la raíz del proyecto (máxima evidencia).
 * 2. Campo estándar `packageManager` de `package.json`.
 * 3. Valor por defecto: `npm`.
 */
export async function detectPackageManager(
  dir: string,
  packageJson: PackageJson | null = null
): Promise<PackageManagerInfo> {
  const pkg = packageJson ?? (await readLocalPackageJson(dir));

  // 1. Lockfiles.
  for (const def of DEFINITIONS) {
    for (const lock of def.lockFiles) {
      try {
        await fs.access(path.join(dir, lock));
        return {
          id: def.id,
          name: def.name,
          lockFile: lock,
          command: def.command,
          detected: "lockfile"
        };
      } catch {
        // Siguiente lockfile.
      }
    }
  }

  // 2. Campo `packageManager` (estándar corepack: "pnpm@9.1.0").
  const declared = pkg?.packageManager;
  if (typeof declared === "string" && declared.length > 0) {
    const id = declared.split("@")[0] as PackageManagerId;
    const def = DEFINITIONS.find((d) => d.id === id);
    if (def) {
      return {
        id: def.id,
        name: def.name,
        lockFile: null,
        command: def.command,
        detected: "packageJson"
      };
    }
  }

  // 3. Por defecto.
  return {
    id: "npm",
    name: "npm",
    lockFile: null,
    command: "npm",
    detected: "default"
  };
}

/** Comando para ejecutar un script con el package manager dado. */
export function scriptCommand(pm: PackageManagerInfo, script: string): string {
  // Los cuatro gestores aceptan `run` (bun/pnpm/yarn/npm).
  return `${pm.command} run ${script}`;
}

/** Comando para instalar dependencias con el package manager dado. */
export function installCommand(pm: PackageManagerInfo): string {
  switch (pm.id) {
    case "npm":
      return "npm install --no-audit --no-fund";
    case "pnpm":
      return "pnpm install";
    case "yarn":
      return "yarn install";
    case "bun":
      return "bun install";
  }
}

/** Lista de ids soportados. */
export function supportedPackageManagers(): PackageManagerId[] {
  return DEFINITIONS.map((d) => d.id);
}

async function readLocalPackageJson(dir: string): Promise<PackageJson | null> {
  try {
    const raw = await fs.readFile(path.join(dir, "package.json"), "utf8");
    return JSON.parse(raw) as PackageJson;
  } catch {
    return null;
  }
}
