/**
 * `nodedesk doctor` — diagnóstico del entorno.
 *
 * Comprueba: versión de Node (≥ 18), package managers disponibles en PATH,
 * estado de `~/.nodedesk-v2`, procesos vivos en el registro (tras prune) y
 * templates disponibles. Siempre termina con exit 0 salvo que la versión de
 * Node no llegue a 18 (exit 1).
 */

import { execFile } from "node:child_process";
import { access, constants, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { ProcessRegistry } from "@nodedesk/core";
import { TemplateManager } from "@nodedesk/templates";

import {
  bold,
  dim,
  println,
  printJson,
  printWarning,
  renderTable
} from "../ui.js";

const execFileAsync = promisify(execFile);

/** Opciones del comando `doctor`. */
export interface DoctorOptions {
  /** Salida JSON. */
  json: boolean;
}

/** Íconos de estado por fila. */
const OK = "✅";
const WARN = "⚠️ ";
const FAIL = "❌";

/** Versión mínima de Node exigida por el ecosistema. */
const MIN_NODE_MAJOR = 18;

/** Package managers que se buscan en el PATH. */
const PACKAGE_MANAGERS = ["npm", "pnpm", "yarn", "bun"] as const;

/** Ejecuta `<cmd> --version` con timeout corto; null si no está disponible. */
async function commandVersion(cmd: string): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync(cmd, ["--version"], {
      timeout: 2500
    });
    const first = stdout.trim().split("\n")[0];
    return first.length > 0 ? first : null;
  } catch {
    return null;
  }
}

/** Diagnóstico completo (reutilizable por la salida humana y la JSON). */
export interface DoctorReport {
  node: { version: string; ok: boolean };
  packageManagers: Record<string, string | null>;
  home: { path: string; exists: boolean; writable: boolean; created: boolean };
  registry: { count: number };
  templates: { count: number };
  ok: boolean;
}

/** Ejecuta `nodedesk doctor`. Devuelve el código de salida. */
export async function doctorCommand(
  options: DoctorOptions
): Promise<number> {
  const nodeVersion = process.versions.node;
  const nodeMajor = Number.parseInt(nodeVersion.split(".")[0] ?? "0", 10);
  const nodeOk = Number.isFinite(nodeMajor) && nodeMajor >= MIN_NODE_MAJOR;

  const packageManagers: Record<string, string | null> = {};
  for (const cmd of PACKAGE_MANAGERS) {
    packageManagers[cmd] = await commandVersion(cmd);
  }

  const home = path.join(os.homedir(), ".nodedesk-v2");
  let homeExists = false;
  let homeWritable = false;
  let homeCreated = false;
  try {
    await access(home);
    homeExists = true;
  } catch {
    homeExists = false;
  }
  if (!homeExists) {
    try {
      await mkdir(home, { recursive: true });
      homeExists = true;
      homeCreated = true;
    } catch {
      homeExists = false;
    }
  }
  if (homeExists) {
    try {
      await access(home, constants.W_OK);
      homeWritable = true;
    } catch {
      homeWritable = false;
    }
  }

  const registry = new ProcessRegistry();
  await registry.prune();
  const processes = await registry.list();

  const templates = TemplateManager.list();

  const report: DoctorReport = {
    node: { version: nodeVersion, ok: nodeOk },
    packageManagers,
    home: { path: home, exists: homeExists, writable: homeWritable, created: homeCreated },
    registry: { count: processes.length },
    templates: { count: templates.length },
    ok: nodeOk && homeExists && homeWritable
  };

  if (options.json) {
    printJson(report);
    return nodeOk ? 0 : 1;
  }

  const rows: string[][] = [
    [
      "Node.js",
      nodeOk ? OK : FAIL,
      nodeOk
        ? `v${nodeVersion} ${dim(`(≥ ${MIN_NODE_MAJOR})`)}`
        : `v${nodeVersion} — se requiere ≥ ${MIN_NODE_MAJOR}`
    ]
  ];

  for (const cmd of PACKAGE_MANAGERS) {
    const version = packageManagers[cmd];
    rows.push([
      cmd,
      version !== null ? OK : WARN,
      version !== null ? version : dim("no disponible en el PATH")
    ]);
  }

  rows.push([
    `${dim("~")}/.nodedesk-v2`,
    homeExists && homeWritable ? OK : FAIL,
    !homeExists
      ? "no se pudo crear"
      : homeWritable
        ? homeCreated
          ? `${home} ${dim("(creado ahora)")}`
          : `${home} ${dim("(existe y es escribible)")}`
        : `${home} ${dim("(sin permisos de escritura)")}`
  ]);

  rows.push([
    "Procesos en background",
    OK,
    processes.length === 0
      ? dim("ninguno registrado")
      : `${processes.length} vivo(s)`
  ]);

  rows.push(["Templates", OK, `${templates.length} disponibles`]);

  println(bold("diagnóstico de nodedesk"));
  println("");
  println(renderTable(["CHECK", "ESTADO", "DETALLE"], rows));
  println("");

  if (!nodeOk) {
    printWarning(
      `la versión de Node (${nodeVersion}) es inferior a la mínima ` +
        `requerida (${MIN_NODE_MAJOR}): actualiza Node.js`
    );
    return 1;
  }
  if (!homeExists || !homeWritable) {
    printWarning("no se puede escribir en ~/.nodedesk-v2 (procesos en background no funcionarán)");
    return 0;
  }
  return 0;
}
