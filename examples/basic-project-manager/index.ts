/**
 * @nodedesk/example-basic-project-manager — Ejemplo 1 del ecosistema.
 *
 * Demuestra `ProjectManager.discover()` + `NodeProject.toJSON()` de
 * @nodedesk/core: descubre proyectos Node.js bajo un directorio (búsqueda
 * en anchura con límite de profundidad) y muestra una tabla — o JSON con
 * `--json` — con: nombre, package manager, nº de scripts, nº de
 * dependencias, `engines.node` y si el proyecto tiene fichero `.env`.
 *
 * Uso:
 *   pnpm --filter @nodedesk/example-basic-project-manager start -- --dir <ruta> [--depth <n>] [--json]
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

import { ProjectManager } from "@nodedesk/core";

/* ------------------------------- consola ------------------------------- */

/** Los colores ANSI se desactivan si la variable NO_COLOR está presente. */
const color = process.env.NO_COLOR === undefined;

const bold = (text: string): string =>
  color ? `\u001b[1m${text}\u001b[0m` : text;
const dim = (text: string): string =>
  color ? `\u001b[2m${text}\u001b[0m` : text;
const cyan = (text: string): string =>
  color ? `\u001b[36m${text}\u001b[0m` : text;
const green = (text: string): string =>
  color ? `\u001b[32m${text}\u001b[0m` : text;
const red = (text: string): string =>
  color ? `\u001b[31m${text}\u001b[0m` : text;

const LINE = "─".repeat(74);

/* --------------------------------- args -------------------------------- */

interface Options {
  dir: string;
  depth: number;
  json: boolean;
  help: boolean;
}

/** Error de uso de la línea de comandos (se imprime con la ayuda). */
class UsageError extends Error {}

function readOptions(argv: string[]): Options {
  const options: Options = { dir: ".", depth: 3, json: false, help: false };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    // Separador "todo lo que sigue es para el programa" (pnpm start -- …).
    if (token === "--") continue;

    if (token === "-h" || token === "--help") {
      options.help = true;
    } else if (token === "--json") {
      options.json = true;
    } else if (token === "--dir" || token.startsWith("--dir=")) {
      const value = token.startsWith("--dir=")
        ? token.slice("--dir=".length)
        : next;
      if (value === undefined || value.startsWith("--")) {
        throw new UsageError("--dir necesita una ruta");
      }
      options.dir = value;
      if (!token.startsWith("--dir=")) i += 1;
    } else if (token === "--depth" || token.startsWith("--depth=")) {
      const raw = token.startsWith("--depth=")
        ? token.slice("--depth=".length)
        : next;
      if (raw === undefined || raw.startsWith("--")) {
        throw new UsageError("--depth necesita un número entero");
      }
      const parsed = Number.parseInt(raw, 10);
      if (Number.isNaN(parsed) || parsed < 0) {
        throw new UsageError(`--depth inválido: "${raw}"`);
      }
      options.depth = parsed;
      if (!token.startsWith("--depth=")) i += 1;
    } else {
      throw new UsageError(`opción desconocida: "${token}"`);
    }
  }

  return options;
}

function printUsage(): void {
  console.log("Uso: pnpm start -- [--dir <ruta>] [--depth <n>] [--json]");
  console.log();
  console.log("  --dir <ruta>    directorio donde buscar proyectos (por defecto .)");
  console.log("  --depth <n>     profundidad máxima de búsqueda (por defecto 3)");
  console.log("  --json          salida JSON (array de project.toJSON())");
}

/* -------------------------------- tabla -------------------------------- */

/** Formateador de columna: se aplica DESPUÉS de rellenar, para no descuadrar. */
type ColumnFormatter = (text: string) => string;

function renderTable(
  headers: string[],
  rows: string[][],
  formatters: Array<ColumnFormatter | undefined>
): string {
  const widths = headers.map((header, column) =>
    Math.max(header.length, ...rows.map((row) => row[column].length))
  );

  const headerLine = headers
    .map((header, column) => bold(header.padEnd(widths[column])))
    .join("  ");
  const separator = widths.map((width) => dim("─".repeat(width))).join("  ");
  const bodyLines = rows.map((row) =>
    row
      .map((cell, column) => {
        const padded = cell.padEnd(widths[column]);
        const formatter = formatters[column];
        return formatter === undefined ? padded : formatter(padded);
      })
      .join("  ")
  );

  return [headerLine, separator, ...bodyLines].join("\n");
}

/* -------------------------------- flujo -------------------------------- */

/** `true` si la ruta existe (se usa para detectar el `.env`). */
async function fileExists(target: string): Promise<boolean> {
  try {
    await fs.access(target);
    return true;
  } catch {
    return false;
  }
}

/** Raíz del workspace (la carpeta con pnpm-workspace.yaml), buscando hacia arriba. */
async function findWorkspaceRoot(start: string): Promise<string | null> {
  let current = path.resolve(start);
  for (;;) {
    if (await fileExists(path.join(current, "pnpm-workspace.yaml"))) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/** Resultado de resolver el destino: ruta absoluta + nota opcional. */
interface Target {
  dir: string;
  note: string | null;
}

/**
 * Resuelve `--dir`: pnpm ejecuta los scripts desde la carpeta del ejemplo,
 * así que si la ruta relativa no existe ahí, se reintenta desde la raíz del
 * monorepo (así "--dir packages" funciona lanzado desde la raíz).
 */
async function resolveTargetDir(input: string): Promise<Target> {
  const fromCwd = path.resolve(input);
  if (input === "." || (await fileExists(fromCwd))) {
    return { dir: fromCwd, note: null };
  }

  const root = await findWorkspaceRoot(process.cwd());
  if (root !== null) {
    const fromRoot = path.resolve(root, input);
    if (await fileExists(fromRoot)) {
      return {
        dir: fromRoot,
        note: `ruta relativa resuelta contra la raíz del workspace: ${root}`
      };
    }
  }
  return { dir: fromCwd, note: null };
}

async function main(): Promise<number> {
  const options = readOptions(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return 0;
  }

  const target = await resolveTargetDir(options.dir);
  const absoluteDir = target.dir;

  // Con --json, la narración va a stderr y stdout queda 100% parseable
  // (útil para pipes: pnpm -s --filter … start -- --dir packages --json | jq .).
  const say = options.json ? console.error : console.log;

  say(dim(LINE));
  say(bold("  Ejemplo 1 · ProjectManager.discover()"));
  say(dim(LINE));
  if (target.note !== null) {
    say(dim(`  (${target.note})`));
  }
  say(
    `  directorio: ${bold(absoluteDir)} · profundidad: ${options.depth}`
  );
  say(
    dim("  (ignora node_modules, .git, dist, build, coverage y carpetas ocultas)")
  );

  // 1. Descubrir proyectos bajo el directorio dado.
  const projects = await ProjectManager.discover(absoluteDir, {
    depth: options.depth
  });

  // 2. ¿Tiene cada proyecto su fichero .env? (toJSON() expone envPath).
  const hasEnv = await Promise.all(
    projects.map((project) => fileExists(project.envPath))
  );

  // 3. Salida JSON: snapshot plano con toJSON() + presencia de .env.
  if (options.json) {
    const payload = projects.map((project, index) => ({
      ...project.toJSON(),
      hasEnvFile: hasEnv[index] ?? false
    }));
    console.log(JSON.stringify(payload, null, 2));
    return 0;
  }

  if (projects.length === 0) {
    say(
      dim(`\n  no se encontraron proyectos Node.js bajo ${absoluteDir}`)
    );
    say(dim("  (un proyecto es un directorio con package.json)"));
    return 0;
  }

  // 4. Salida en tabla.
  const rows = projects.map((project, index) => [
    project.name,
    project.packageManager.id,
    String(Object.keys(project.scripts).length),
    String(project.dependencies.length + project.devDependencies.length),
    project.nodeEngine ?? "—",
    hasEnv[index] ? "sí" : "no"
  ]);
  console.log();
  console.log(
    renderTable(
      ["NOMBRE", "PM", "SCRIPTS", "DEPS", "NODE", ".ENV"],
      rows,
      [
        cyan,
        undefined,
        undefined,
        undefined,
        (text) => (text.trim() === "—" ? dim(text) : text),
        (text) => (text.trim() === "sí" ? green(text) : dim(text))
      ]
    )
  );

  console.log(
    dim(
      `\n  ${projects.length} proyecto(s) · DEPS = dependencies + devDependencies` +
        " · PM detectado por lockfile → packageManager → npm"
    )
  );
  return 0;
}

/* Ejecución con gestión de errores y código de salida. */
main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    if (error instanceof UsageError) {
      console.error(red(`\n✗ ${error.message}\n`));
      printUsage();
      process.exitCode = 2;
      return;
    }
    console.error(
      red(`\n✗ ${error instanceof Error ? error.message : String(error)}`)
    );
    process.exitCode = 1;
  });
