/**
 * @nodedesk/example-template-example — Ejemplo 4 del ecosistema.
 *
 * Demuestra `@nodedesk/templates` + `ProcessManager` de `@nodedesk/core`:
 *
 * 1. Catálogo completo con `TemplateManager.list()` (id + name + tagline).
 * 2. Crea un proyecto `minimal-node` en `./.demo-output/` relativo a este
 *    ejemplo (o el directorio pasado con `--dir`).
 * 3. Imprime los ficheros escritos, las variables del `.env` y los nextSteps.
 * 4. Arranca el proyecto generado con `ProcessManager` durante ~2,5 s:
 *    comprueba su stdout (la línea «escuchando…»), le hace un GET / y lo
 *    apaga limpio (stop() en try/finally).
 *
 * Uso:
 *   pnpm --filter @nodedesk/example-template-example start -- [--template <id>] [--dir <ruta>]
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { ProcessManager, sleep } from "@nodedesk/core";
import type { LogEntry, LogLevel, ProcessExit } from "@nodedesk/core";
import { TemplateManager } from "@nodedesk/templates";
import type { Template } from "@nodedesk/templates";

/* ------------------------------- constantes ------------------------------ */

/** Carpeta de este ejemplo (para resolver la salida por defecto). */
const EXAMPLE_DIR = path.dirname(fileURLToPath(import.meta.url));

/** Salida por defecto del demo: ./.demo-output relativo al ejemplo. */
const DEFAULT_OUTPUT = path.join(EXAMPLE_DIR, ".demo-output");

/** Template por defecto: cero dependencias, arranca al instante. */
const DEFAULT_TEMPLATE = "minimal-node";

/** Tiempo total que el proyecto generado permanece arrancado. */
const RUN_MS = 2500;

/* ------------------------------- consola -------------------------------- */

/** Los colores ANSI se desactivan si la variable NO_COLOR está presente. */
const color = process.env.NO_COLOR === undefined;

const paint = (code: string, text: string): string =>
  color ? `\u001b[${code}m${text}\u001b[0m` : text;

const bold = (text: string): string => paint("1", text);
const dim = (text: string): string => paint("2", text);
const cyan = (text: string): string => paint("36", text);
const green = (text: string): string => paint("32", text);
const yellow = (text: string): string => paint("33", text);
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

/** Color por nivel de log (los cuatro niveles de classifyLine). */
function levelTag(level: LogLevel): string {
  const tag = `[${level}]`.padEnd(9);
  switch (level) {
    case "warn":
      return yellow(tag);
    case "error":
      return red(tag);
    case "system":
      return cyan(tag);
    default:
      return dim(tag);
  }
}

/* --------------------------------- args ---------------------------------- */

interface Options {
  template: string;
  dir: string;
  help: boolean;
}

class UsageError extends Error {}

function readOptions(argv: string[]): Options {
  const options: Options = {
    template: DEFAULT_TEMPLATE,
    dir: DEFAULT_OUTPUT,
    help: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];

    // Separador "todo lo que sigue es para el programa" (pnpm start -- …).
    if (token === "--") continue;

    if (token === "-h" || token === "--help") {
      options.help = true;
    } else if (token === "--template" || token.startsWith("--template=")) {
      const value = token.startsWith("--template=")
        ? token.slice("--template=".length)
        : next;
      if (value === undefined || value.startsWith("--")) {
        throw new UsageError("--template necesita un id");
      }
      options.template = value;
      if (!token.startsWith("--template=")) i += 1;
    } else if (token === "--dir" || token.startsWith("--dir=")) {
      const value = token.startsWith("--dir=")
        ? token.slice("--dir=".length)
        : next;
      if (value === undefined || value.startsWith("--")) {
        throw new UsageError("--dir necesita una ruta");
      }
      options.dir = value;
      if (!token.startsWith("--dir=")) i += 1;
    } else {
      throw new UsageError(`opción desconocida: "${token}"`);
    }
  }

  return options;
}

function printUsage(): void {
  console.log("Uso: pnpm start -- [--template <id>] [--dir <ruta>]");
  console.log();
  console.log(`  --template <id>  id de la template (por defecto ${DEFAULT_TEMPLATE})`);
  console.log("  --dir <ruta>     carpeta donde generar el proyecto");
  console.log(`                   (por defecto ./.demo-output del ejemplo)`);
}

/* --------------------------------- flujo --------------------------------- */

/** `true` si la ruta existe y contiene al menos una entrada. */
async function isNonEmptyDir(target: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(target);
    return entries.length > 0;
  } catch {
    return false;
  }
}

/** Espera (sondeando) a que una condición se cumpla, con tope de tiempo. */
async function waitFor(
  predicate: () => boolean,
  timeoutMs: number
): Promise<boolean> {
  const stepMs = 50;
  for (let waited = 0; waited < timeoutMs; waited += stepMs) {
    if (predicate()) return true;
    await sleep(stepMs);
  }
  return predicate();
}

async function main(): Promise<void> {
  const options = readOptions(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  header("Ejemplo 4 · TemplateManager — catálogo, scaffolding y arranque");

  /* 1. Catálogo. */
  step("1 · Catálogo de templates — TemplateManager.list()");
  const catalog: Template[] = TemplateManager.list();
  console.log(`  ${catalog.length} template(s) disponibles:`);
  for (const template of catalog) {
    const marker = template.id === options.template ? green("●") : dim("○");
    console.log(
      `  ${marker} ${cyan(template.id.padEnd(14))} ${bold(template.name)} — ${dim(template.tagline)}`
    );
  }

  /* 2. Validar la template pedida. */
  step("2 · Template elegida");
  const template = TemplateManager.get(options.template);
  if (template === null) {
    const ids = catalog.map((item) => item.id).join(", ");
    throw new UsageError(`template desconocida: "${options.template}" (ids: ${ids})`);
  }
  console.log(`  id: ${bold(template.id)} · nombre por defecto: ${bold(template.name)}`);
  const deps = Object.keys(template.dependencies ?? {});
  if (deps.length === 0) {
    console.log(green("  sin dependencias → el proyecto generado arranca sin instalar nada"));
  } else {
    console.log(
      yellow(`  ⚠ dependencias: ${deps.join(", ")} — el demo NO las instala;`)
    );
    console.log(
      yellow('    si el proceso no arranca, ejecuta "npm install" en el proyecto generado')
    );
  }

  /* 3. Preparar el destino (se limpia la salida de una ejecución anterior). */
  step("3 · Destino");
  const target = path.resolve(options.dir);
  if (await isNonEmptyDir(target)) {
    console.log(dim(`  limpiando la salida de una ejecución anterior: ${target}`));
    await fs.rm(target, { recursive: true, force: true });
  }
  console.log(`  proyecto en: ${bold(target)}`);

  /* 4. Generar. */
  step("4 · TemplateManager.create() — scaffolding");
  const result = await TemplateManager.create(options.template, {
    directory: target
  });
  console.log(
    `  ${green(`${result.count} ficheros escritos`)} · puerto ${bold(String(result.port))}`
  );
  for (const file of result.files) {
    console.log(`    ${green("✓")} ${path.relative(EXAMPLE_DIR, file)}`);
  }
  console.log("  .env generado:");
  for (const variable of result.env) {
    const comment =
      variable.comment === undefined ? "" : dim(`   # ${variable.comment}`);
    console.log(`    ${cyan(variable.key)}=${variable.value}${comment}`);
  }
  console.log("  nextSteps sugeridos:");
  for (const [index, next] of result.nextSteps.entries()) {
    console.log(`    ${bold(String(index + 1))}. ${next}`);
  }

  /* 5. Arrancar el proyecto generado con ProcessManager. */
  step(`5 · Arrancar el proyecto generado (${RUN_MS} ms)`);
  const manager = new ProcessManager(result.directory);
  // Estado compartido con los listeners. Va en un objeto para que el
  // control de flujo de TS no estreche el tipo asignado en las closures.
  const runtime: {
    readyLine: string | null;
    exited: boolean;
    exitInfo: ProcessExit | null;
  } = { readyLine: null, exited: false, exitInfo: null };

  manager.on("log", (entry: LogEntry) => {
    console.log(`    ${levelTag(entry.level)} ${entry.line}`);
    if (entry.source === "stdout" && runtime.readyLine === null) {
      runtime.readyLine = entry.line;
    }
  });
  manager.on("exit", (exitResult: ProcessExit) => {
    runtime.exited = true;
    runtime.exitInfo = exitResult;
  });

  const startedAt = Date.now();
  try {
    const info = await manager.start({ command: "node src/server.mjs" });
    console.log(dim(`    pid ${info.pid} · comando "${info.command}"`));

    // Comprobar stdout: esperamos la primera línea (la de «escuchando…»).
    await waitFor(() => runtime.readyLine !== null || runtime.exited, 6000);
    const readyLine: string | null = runtime.readyLine;
    if (readyLine !== null) {
      console.log(green(`  ✓ stdout del proyecto: "${readyLine}"`));
      if (readyLine.includes("escuchando")) {
        console.log(green("  ✓ contiene «escuchando» — el servidor está vivo"));
      }
      // Bonus: una petición HTTP real al proyecto recién generado.
      try {
        const response = await fetch(`http://127.0.0.1:${result.port}/`, {
          signal: AbortSignal.timeout(2000)
        });
        const body = await response.text();
        console.log(
          green(`  ✓ GET / → HTTP ${response.status} ${body.slice(0, 80)}`)
        );
      } catch (error) {
        console.log(
          yellow(`  ⚠ GET / no contestó: ${error instanceof Error ? error.message : String(error)}`)
        );
      }
    } else {
      const exitInfo: ProcessExit | null = runtime.exitInfo;
      const detail =
        exitInfo === null
          ? "(sin salida)"
          : `(exit ${exitInfo.code}/${exitInfo.signal})`;
      console.log(
        yellow(`  ⚠ el proceso terminó antes de imprimir nada ${detail}`)
      );
      console.log(yellow('    ¿dependencias sin instalar? prueba "npm install" en el proyecto'));
    }

    // Mantenerlo vivo hasta completar los 2,5 s de demo.
    const remaining = RUN_MS - (Date.now() - startedAt);
    if (remaining > 0) await sleep(remaining);
  } finally {
    // stop() SIEMPRE: no dejamos procesos colgando.
    if (manager.running) {
      console.log(dim("\n  stop() — SIGTERM al grupo del proceso…"));
      await manager.stop();
    }
  }

  const exitSummary: ProcessExit | null = runtime.exitInfo;
  if (exitSummary !== null) {
    console.log(
      `  proceso terminado: exit ${bold(String(exitSummary.code))} · señal ${bold(String(exitSummary.signal))}`
    );
  }
  console.log(`\n  ${bold("listo ✔")} — el proyecto generado queda en ${dim(result.directory)}`);
  console.log(
    dim(`    pruébalo a mano:  cd ${result.directory} && npm install && npm run dev`)
  );
}

/* Ejecución con gestión de errores y código de salida. */
main()
  .then(() => {
    process.exitCode = 0;
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
