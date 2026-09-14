/**
 * @nodedesk/example-env-manager — Ejemplo 3 del ecosistema.
 *
 * Demuestra `EnvManager` (@nodedesk/core) sobre un proyecto dado con `--dir`
 * (o, por defecto, sobre un fixture creado en un directorio temporal que se
 * elimina al terminar, en try/finally):
 *
 * 1. Muestra el `.env` original.
 * 2. `set("EXAMPLE_DATE", …)` y `set("EXAMPLE_MODE", "demo")` (con autosave).
 * 3. Lista todo con `all()` y verifica con `get()`.
 * 4. `delete("EXAMPLE_MODE")`.
 * 5. Muestra el fichero final: los comentarios y el orden se preservan.
 * 6. `entries()` — cada variable con su comentario asociado.
 * 7. `buildEnvironment({ DEMO: "1" })` — el entorno combinado que se le pasa
 *    a un proceso (`process.env` + `.env` + overrides), mostrando solo unas
 *    claves para no volcar todo `process.env`.
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { EnvManager } from "@nodedesk/core";
import type { EnvEntry } from "@nodedesk/core";

/* ------------------------------- constantes ------------------------------ */

/** Contenido del .env del fixture (con comentarios, para demostrar que se preservan). */
const FIXTURE_ENV = [
  "# Configuración de la app de demo",
  "APP_NAME=demo-env",
  "",
  "# Puerto de escucha del servidor HTTP",
  "PORT=4020",
  ""
].join("\n");

/* ------------------------------- consola -------------------------------- */

/** Los colores ANSI se desactivan si la variable NO_COLOR está presente. */
const color = process.env.NO_COLOR === undefined;

const paint = (code: string, text: string): string =>
  color ? `\u001b[${code}m${text}\u001b[0m` : text;

const bold = (text: string): string => paint("1", text);
const dim = (text: string): string => paint("2", text);
const cyan = (text: string): string => paint("36", text);
const green = (text: string): string => paint("32", text);
const red = (text: string): string => paint("31", text);

const LINE = "─".repeat(74);

function header(title: string): void {
  console.log(`\n${dim(LINE)}`);
  console.log(bold(`  ${title}`));
  console.log(dim(LINE));
}

function step(title: string): void {
  console.log(`\n${bold(`  ${title}`)}`);
}

/** Imprime el contenido de un fichero (o aviso si no existe). */
async function showFile(file: string, title: string): Promise<void> {
  console.log(`\n  ${bold(title)}  ${dim(file)}`);
  const content = await fs.readFile(file, "utf8").catch(() => null);
  if (content === null) {
    console.log(dim("    (el fichero no existe todavía — se creará al escribir)"));
    return;
  }
  const trimmed = content.trimEnd();
  if (trimmed.length === 0) {
    console.log(dim("    (vacío)"));
    return;
  }
  for (const line of trimmed.split("\n")) {
    console.log(`    ${line}`);
  }
}

/* --------------------------------- args --------------------------------- */

function readDir(argv: string[]): string | undefined {
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--dir") {
      const value = argv[i + 1];
      if (value !== undefined && !value.startsWith("--")) return value;
    }
    if (token.startsWith("--dir=")) return token.slice("--dir=".length);
  }
  return undefined;
}

/** `true` si la ruta existe y es un directorio. */
async function isDirectory(target: string): Promise<boolean> {
  const stat = await fs.stat(target).catch(() => null);
  return stat !== null && stat.isDirectory();
}

/** Raíz del workspace (la carpeta con pnpm-workspace.yaml), buscando hacia arriba. */
async function findWorkspaceRoot(start: string): Promise<string | null> {
  let current = path.resolve(start);
  for (;;) {
    const marker = path.join(current, "pnpm-workspace.yaml");
    const exists = await fs
      .access(marker)
      .then(() => true)
      .catch(() => false);
    if (exists) return current;

    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

/**
 * Resuelve `--dir`: pnpm ejecuta los scripts desde la carpeta del ejemplo,
 * así que si la ruta relativa no existe ahí, se reintenta desde la raíz del
 * monorepo (así "--dir packages/core" funciona lanzado desde la raíz).
 */
async function resolveProjectDir(input: string): Promise<string> {
  const fromCwd = path.resolve(input);
  if (await isDirectory(fromCwd)) return fromCwd;

  const root = await findWorkspaceRoot(process.cwd());
  if (root !== null) {
    const fromRoot = path.resolve(root, input);
    if (await isDirectory(fromRoot)) {
      console.log(dim(`  (ruta relativa resuelta contra la raíz del workspace: ${root})`));
      return fromRoot;
    }
  }
  throw new Error(`--dir no es un directorio: ${fromCwd}`);
}

/* --------------------------------- flujo -------------------------------- */

/** Pasos 2–8 de la demo sobre el EnvManager ya construido. */
async function demo(env: EnvManager): Promise<void> {
  console.log(`  EnvManager listo → ${dim(env.path)}`);

  /* 2. Contenido original. */
  step("2 · Contenido original del .env");
  await showFile(env.path, "original:");

  /* 3. set() con autosave. */
  step("3 · set() — fija variables y persiste (autosave)");
  const now = new Date().toISOString();
  await env.set("EXAMPLE_DATE", now);
  console.log(`  set("EXAMPLE_DATE", "${now}")`);
  await env.set("EXAMPLE_MODE", "demo");
  console.log('  set("EXAMPLE_MODE", "demo")');
  const got = await env.get("EXAMPLE_DATE");
  console.log(`  get("EXAMPLE_DATE") → ${green(String(got))}`);

  /* 4. all(). */
  step("4 · all() — todas las variables como objeto plano");
  const all = await env.all();
  console.log(`  ${Object.keys(all).length} variable(s), en orden de aparición:`);
  for (const [key, value] of Object.entries(all)) {
    console.log(`    ${cyan(key)}=${value}`);
  }

  /* 5. delete(). */
  step("5 · delete() — elimina una variable");
  const deleted = await env.delete("EXAMPLE_MODE");
  console.log(`  delete("EXAMPLE_MODE") → ${deleted ? green("true") : "false"}`);

  /* 6. Fichero final: comentarios y orden preservados. */
  step("6 · Fichero final — comentarios y orden preservados");
  await showFile(env.path, "final:");
  console.log(
    dim("  ↑ cada comentario sigue pegado a su variable y el orden se mantiene;")
  );
  console.log(
    dim("    solo cambió lo que se pidió (las líneas en blanco se normalizan al reescribir)")
  );

  /* 7. entries() con el comentario asociado a cada variable. */
  step("7 · entries() — variables con su comentario asociado");
  const entries: EnvEntry[] = await env.entries();
  console.log(`  ${entries.length} entrada(s):`);
  for (const entry of entries) {
    const comment =
      entry.comment === undefined ? "" : dim(`   # ${entry.comment}`);
    console.log(`    ${cyan(entry.key)}=${entry.value}${comment}`);
  }

  /* 8. buildEnvironment(). */
  step('8 · buildEnvironment({ DEMO: "1" }) — entorno para lanzar procesos');
  const built = await env.buildEnvironment({ DEMO: "1" });
  const ownKeys = (await env.keys())
    .filter((key) => !key.startsWith("EXAMPLE_") && key !== "DEMO")
    .slice(0, 2);
  const sample = [...ownKeys, "EXAMPLE_DATE", "DEMO"];
  console.log(
    dim("  = process.env + variables del .env (ganan) + overrides (ganan sobre todo)")
  );
  console.log(
    dim("  (solo se muestran unas claves; el entorno combinado es enorme)")
  );
  for (const key of sample) {
    const value = built[key];
    if (value !== undefined) console.log(`    ${cyan(key)}=${value}`);
  }
}

async function main(): Promise<void> {
  header("Ejemplo 3 · EnvManager — .env sin perder comentarios");

  /* 1. Proyecto destino: argumento o fixture en tmpdir. */
  step("1 · Proyecto destino (--dir <ruta> o fixture temporal)");
  const argDir = readDir(process.argv.slice(2));

  if (argDir !== undefined) {
    // Proyecto real del usuario: la demo modifica su .env (documentado).
    const projectDir = await resolveProjectDir(argDir);
    console.log(`  proyecto: ${bold(projectDir)} (argumento --dir)`);
    await demo(new EnvManager(projectDir));
    console.log(`\n  ${green("✔ demo completada")}`);
    return;
  }

  // Fixture propio en tmpdir: se elimina SIEMPRE al terminar (try/finally).
  const fixture = await fs.mkdtemp(path.join(os.tmpdir(), "nodedesk-env-"));
  await fs.writeFile(
    path.join(fixture, "package.json"),
    JSON.stringify({ name: "demo-env", private: true, type: "module" }, null, 2),
    "utf8"
  );
  await fs.writeFile(path.join(fixture, ".env"), FIXTURE_ENV, "utf8");
  console.log(`  fixture creado en: ${dim(fixture)}`);

  try {
    await demo(new EnvManager(fixture));
  } finally {
    await fs.rm(fixture, { recursive: true, force: true });
    console.log(dim(`  fixture temporal eliminado: ${fixture}`));
  }
  console.log(`\n  ${green("✔ demo completada")}`);
}

/* Ejecución con gestión de errores y código de salida. */
main()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((error: unknown) => {
    console.error(
      red(`\n✗ ${error instanceof Error ? error.message : String(error)}`)
    );
    process.exitCode = 1;
  });
