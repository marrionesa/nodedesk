/**
 * `nodedesk logs <path>` — lee el log de un proceso en background.
 *
 * Busca el proyecto en el `ProcessRegistry` y muestra las últimas líneas del
 * fichero de log del proceso (`--lines <n>`, 50 por defecto). Con
 * `--follow`/`-f` hace tail siguiendo el fichero (sondeo cada 400 ms,
 * tolerante a rotación, Ctrl+C limpio).
 */

import { open, readFile, stat } from "node:fs/promises";

import { ProcessRegistry } from "@nodedesk/core";

import { dim, println, printError } from "../ui.js";

/** Opciones del comando `logs`. */
export interface LogsOptions {
  /** Número de líneas finales a mostrar. */
  lines: number;
  /** Seguir el fichero de log (tail -f). */
  follow: boolean;
}

/** Intervalo de sondeo del modo --follow. */
const FOLLOW_POLL_MS = 400;

/** Divide un texto en líneas descartando el separador final. */
function splitLines(content: string): string[] {
  return content.split("\n");
}

/** Sigue un fichero por sondeo hasta que llegue SIGINT. */
function followFile(file: string): Promise<number> {
  return new Promise<number>((resolve) => {
    let offset = 0;
    let pending = "";

    const stop = (): void => {
      clearInterval(timer);
      process.removeListener("SIGINT", stop);
      println("");
      println(dim("seguimiento detenido"));
      resolve(0);
    };

    const timer = setInterval(() => {
      void (async () => {
        try {
          const current = await stat(file);
          if (current.size < offset) {
            // Fichero truncado o rotado: empezar de nuevo.
            offset = 0;
            pending = "";
          }
          if (current.size === offset) return;

          const handle = await open(file, "r");
          try {
            const length = current.size - offset;
            const buffer = Buffer.alloc(length);
            const { bytesRead } = await handle.read(
              buffer,
              0,
              length,
              offset
            );
            offset += bytesRead;
            pending += buffer.subarray(0, bytesRead).toString("utf8");

            const lines = splitLines(pending);
            pending = lines.pop() ?? "";
            for (const line of lines) println(line);
          } finally {
            await handle.close();
          }
        } catch {
          // Fichero borrado o inaccesible en este tick: seguir sondeando.
        }
      })();
    }, FOLLOW_POLL_MS);

    process.once("SIGINT", stop);
  });
}

/** Ejecuta `nodedesk logs`. Devuelve el código de salida. */
export async function logsCommand(
  target: string,
  options: LogsOptions
): Promise<number> {
  const registry = new ProcessRegistry();
  await registry.prune();

  const record = await registry.findByRoot(target);
  if (record === null) {
    printError(
      "no hay proceso en background para este proyecto " +
        `(arranca con ${dim(`nodedesk start ${target} --detached`)})`
    );
    return 1;
  }

  const logFile = record.logFile;
  if (logFile === undefined) {
    printError(
      "el proceso no tiene fichero de log " +
        "(solo los procesos arrancados con --detached guardan log)"
    );
    return 1;
  }

  let content: string;
  try {
    content = await readFile(logFile, "utf8");
  } catch {
    printError(`no se pudo leer el fichero de log ${logFile}`);
    return 1;
  }

  const lines = splitLines(content);
  if (lines[lines.length - 1] === "") lines.pop();
  const tail = lines.slice(-options.lines);
  if (tail.length === 0) {
    println(dim(`(log vacío: ${logFile})`));
  } else {
    for (const line of tail) println(line);
  }

  if (!options.follow) return 0;

  println("");
  println(dim(`— siguiendo ${logFile} (Ctrl+C para salir) —`));
  return followFile(logFile);
}
