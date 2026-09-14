/**
 * @nodedesk/cli — interfaz de terminal del ecosistema NodeDesk.
 *
 * Aquí se monta el programa commander y se conecta cada comando con su
 * implementación pura (`commands/*.ts`, que devuelven el código de salida).
 * `run()` es el punto de entrada programable usado por `bin.ts` y por los
 * tests: parsea argv, ejecuta y devuelve el código de salida sin llamar
 * nunca a `process.exit()`.
 */

import { Command, InvalidArgumentError } from "commander";
import type { CommanderError } from "commander";

import { disableColor, red } from "./ui.js";
import { cliVersion } from "./versions.js";
import {
  projectsCommand,
  type ProjectsOptions
} from "./commands/projects.js";
import {
  createCommand,
  type CreateOptions
} from "./commands/create.js";
import {
  startCommand,
  type StartOptions
} from "./commands/start.js";
import { stopCommand, type StopOptions } from "./commands/stop.js";
import { logsCommand, type LogsOptions } from "./commands/logs.js";
import {
  envListCommand,
  envGetCommand,
  envSetCommand,
  envDeleteCommand,
  type EnvListOptions
} from "./commands/env.js";
import { doctorCommand, type DoctorOptions } from "./commands/doctor.js";
import {
  versionCommand,
  type VersionOptions
} from "./commands/version.js";
import {
  templatesCommand,
  type TemplatesOptions
} from "./commands/templates.js";

/** Parsea un entero (para opciones `--depth`, `--lines`, `--port`…). */
function toInt(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new InvalidArgumentError("debe ser un número entero");
  }
  return parsed;
}

/** Añade la opción `--no-color` (también aceptada tras el subcomando). */
function noColor(command: Command): Command {
  return command.option(
    "--no-color",
    "desactiva los colores ANSI de la salida"
  );
}

/**
 * El programa `nodedesk`.
 *
 * NOTA: `exitOverride`/`configureOutput` se configuran ANTES de registrar
 * los subcomandos para que estos hereden la configuración.
 */
export const program = new Command();

program.exitOverride(); // lanza CommanderError en vez de process.exit
program.configureOutput({
  writeOut: (text: string) => process.stdout.write(text),
  writeErr: (text: string) => process.stderr.write(red(text))
});

program
  .name("nodedesk")
  .description(
    "Gestiona proyectos Node.js desde la terminal: descubrimiento, " +
      "templates, procesos en background, logs y variables .env."
  )
  .version(cliVersion(), "-V, --version", "muestra la versión del CLI")
  .usage("[comando] [opciones]")
  .showHelpAfterError("(ejecuta 'nodedesk --help' para ver la ayuda)");

noColor(program);

/** Código de salida que dejan escrito los handlers de los comandos. */
let exitCode = 0;

/* ------------------------------- projects -------------------------------- */

noColor(
  program
    .command("projects")
    .description("descubre proyectos Node.js bajo un directorio")
    .argument("[dir]", "directorio donde buscar", ".")
    .option("--json", "salida en formato JSON")
    .option("--depth <n>", "profundidad máxima de búsqueda", toInt, 3)
    .action(async (dir: string, options: ProjectsOptions) => {
      exitCode = await projectsCommand(dir, options);
    })
);

/* -------------------------------- create --------------------------------- */

noColor(
  program
    .command("create")
    .description("crea un proyecto nuevo desde una template")
    .argument("<name>", "nombre del proyecto")
    .option("-t, --template <id>", "template desde la que crear", "minimal-node")
    .option(
      "-d, --dir <directorio>",
      "directorio padre (el destino final es <dir>/<slug>)"
    )
    .option(
      "--force",
      "sobrescribe el destino aunque el directorio no esté vacío"
    )
    .option("--json", "salida en formato JSON")
    .action(async (name: string, options: CreateOptions) => {
      exitCode = await createCommand(name, options);
    })
);

/* --------------------------------- start --------------------------------- */

noColor(
  program
    .command("start")
    .description("arranca el proceso de un proyecto (Ctrl+C para detener)")
    .argument("<path>", "ruta del proyecto")
    .option(
      "-s, --script <script>",
      "script de package.json (dev → start → main)"
    )
    .option(
      "--detached",
      "arranca en background con log persistente y registro"
    )
    .option("--install", "instala dependencias si falta node_modules")
    .option("--port <n>", "fija la variable de entorno PORT", toInt)
    .option("--json", "salida en formato JSON (info del proceso)")
    .option(
      "--exit-after <ms>",
      "interna (tests): apagado limpio tras N milisegundos",
      toInt
    )
    .action(async (path: string, options: StartOptions) => {
      exitCode = await startCommand(path, options);
    })
);

/* ---------------------------------- stop --------------------------------- */

noColor(
  program
    .command("stop")
    .description("detiene procesos en background (registro de nodedesk)")
    .argument("[path]", "ruta del proyecto")
    .option("--all", "detiene todos los procesos registrados")
    .action(async (path: string | undefined, options: StopOptions) => {
      exitCode = await stopCommand(path, options);
    })
);

/* ---------------------------------- logs --------------------------------- */

noColor(
  program
    .command("logs")
    .description("muestra el log de un proceso en background")
    .argument("<path>", "ruta del proyecto")
    .option("--lines <n>", "número de líneas finales", toInt, 50)
    .option("-f, --follow", "sigue el fichero de log (como tail -f)")
    .action(async (path: string, options: LogsOptions) => {
      exitCode = await logsCommand(path, options);
    })
);

/* ---------------------------------- env ---------------------------------- */

const env = noColor(
  program
    .command("env")
    .description("gestiona las variables .env de un proyecto")
    .action(() => {
      env.help();
    })
);

noColor(
  env
    .command("list")
    .description("lista las variables del .env")
    .argument("<path>", "ruta del proyecto")
    .option("--json", "salida en formato JSON (valores reales)")
    .option("--raw", "muestra los secretos sin máscara")
    .action(async (path: string, options: EnvListOptions) => {
      exitCode = await envListCommand(path, options);
    })
);

noColor(
  env
    .command("get")
    .description("muestra el valor de una variable (pelado)")
    .argument("<path>", "ruta del proyecto")
    .argument("<key>", "nombre de la variable")
    .action(async (path: string, key: string) => {
      exitCode = await envGetCommand(path, key);
    })
);

noColor(
  env
    .command("set")
    .description("fija una variable y persiste el .env")
    .argument("<path>", "ruta del proyecto")
    .argument("<key>", "nombre de la variable")
    .argument("<value>", "valor de la variable")
    .action(async (path: string, key: string, value: string) => {
      exitCode = await envSetCommand(path, key, value);
    })
);

noColor(
  env
    .command("delete")
    .description("elimina una variable del .env")
    .argument("<path>", "ruta del proyecto")
    .argument("<key>", "nombre de la variable")
    .action(async (path: string, key: string) => {
      exitCode = await envDeleteCommand(path, key);
    })
);

/* --------------------------------- doctor -------------------------------- */

noColor(
  program
    .command("doctor")
    .description("diagnóstico del entorno (node, package managers, registro)")
    .option("--json", "salida en formato JSON")
    .action(async (options: DoctorOptions) => {
      exitCode = await doctorCommand(options);
    })
);

/* -------------------------------- version -------------------------------- */

noColor(
  program
    .command("version")
    .description("versión del CLI y del resto del ecosistema")
    .option("--json", "salida en formato JSON")
    .action(async (options: VersionOptions) => {
      exitCode = await versionCommand(options);
    })
);

/* ------------------------------- templates -------------------------------- */

noColor(
  program
    .command("templates")
    .description("catálogo de templates disponibles")
    .argument("[id]", "id de la template (detalle completo)")
    .option("--json", "salida en formato JSON")
    .action(async (id: string | undefined, options: TemplatesOptions) => {
      exitCode = await templatesCommand(id, options);
    })
);

/** Códigos de CommanderError que representan salida limpia (no error). */
const CLEAN_EXIT_CODES = new Set([
  "commander.help",
  "commander.helpDisplayed",
  "commander.version"
]);

/** Maneja un error escapado de parseAsync. Devuelve el código de salida. */
function handleRunError(error: unknown): number {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string" &&
    "exitCode" in error
  ) {
    const commanderError = error as CommanderError;
    if (CLEAN_EXIT_CODES.has(commanderError.code)) return 0;
    // El mensaje ya lo escribió commander (configurado con writeErr en rojo).
    return commanderError.exitCode ?? 1;
  }

  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(red(`✗ ${message}\n`));
  return 1;
}

/**
 * Ejecuta la CLI con un argv dado y devuelve el código de salida.
 *
 * ```ts
 * const code = await run(["version", "--json"]);
 * ```
 */
export async function run(argv: string[]): Promise<number> {
  if (argv.includes("--no-color")) disableColor();

  exitCode = 0;
  try {
    await program.parseAsync(argv, { from: "user" });
    return exitCode;
  } catch (error) {
    return handleRunError(error);
  }
}
