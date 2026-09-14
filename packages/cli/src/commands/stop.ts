/**
 * `nodedesk stop <path>` / `nodedesk stop --all` — detiene procesos en
 * background anotados en el `ProcessRegistry` de @nodedesk/core.
 *
 * Con `--all` termina todos los registros uno a uno; con una ruta termina
 * el proceso asociado a ese proyecto (buscado por raíz exacta).
 */

import {
  ProcessRegistry,
  terminateProcessGroup
} from "@nodedesk/core";
import type { ProcessRecord } from "@nodedesk/core";

import { bold, cyan, dim, println, printError, printSuccess } from "../ui.js";

/** Opciones del comando `stop`. */
export interface StopOptions {
  /** Termina todos los procesos registrados. */
  all: boolean;
}

/** Detiene un registro: señal al grupo completo + baja del registro. */
async function stopRecord(
  registry: ProcessRegistry,
  record: ProcessRecord
): Promise<void> {
  await terminateProcessGroup(record.pid);
  await registry.remove(record.pid);
}

/** Imprime la confirmación de un proceso detenido. */
function reportStopped(record: ProcessRecord): void {
  printSuccess(`proceso detenido (pid ${record.pid})`);
  println(`  ${bold("comando")}   ${record.command}`);
  println(`  ${bold("proyecto")}  ${cyan(record.root)}`);
}

/** Ejecuta `nodedesk stop`. Devuelve el código de salida. */
export async function stopCommand(
  target: string | undefined,
  options: StopOptions
): Promise<number> {
  const registry = new ProcessRegistry();
  await registry.prune(); // Retira primero los registros de procesos muertos.

  if (options.all) {
    const records = await registry.list();
    if (records.length === 0) {
      println(dim("no hay procesos en background registrados"));
      return 0;
    }

    for (const record of records) {
      await stopRecord(registry, record);
      reportStopped(record);
    }
    println("");
    println(dim(`${records.length} proceso(s) detenido(s)`));
    return 0;
  }

  if (target === undefined) {
    printError("indica la ruta de un proyecto o usa --all");
    return 1;
  }

  const record = await registry.findByRoot(target);
  if (record === null) {
    printError(
      "no hay proceso en background para este proyecto " +
        `(arranca con ${cyan(`nodedesk start ${target} --detached`)})`
    );
    return 1;
  }

  await stopRecord(registry, record);
  reportStopped(record);
  return 0;
}
