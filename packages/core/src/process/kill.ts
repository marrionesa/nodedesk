import { promises as fs } from "node:fs";

import { sleep } from "../utils/id.js";

/**
 * Apagado seguro de procesos por grupo.
 *
 * Port de `process.rs::kill_process_group` de V1 con sus guardas de
 * seguridad históricas (evitar matar la propia sesión del SO):
 *
 * - Nunca señalar pid <= 1 ni el pid del proceso actual.
 * - En Linux, verificar en `/proc/<pid>/stat` que el pid sigue siendo
 *   líder de su grupo (pgid == pid) antes de señalar el grupo.
 * - SIGTERM al grupo completo, gracia configurable, luego SIGKILL.
 */

/** Devuelve `true` si el proceso existe (señal 0). */
export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !isMarkedDead(error);
  }
}

/** Lee el pgid de `/proc/<pid>/stat` (Linux). `null` si no existe. */
export async function processGroupId(pid: number): Promise<number | null> {
  if (process.platform !== "linux") return null;
  let raw: string;
  try {
    raw = await fs.readFile(`/proc/${pid}/stat`, "utf8");
  } catch {
    return null;
  }
  // El nombre del ejecutable (comm) puede contener espacios y paréntesis:
  // contamos campos tras el último ')' — state (3), ppid (4), pgid (5).
  const afterComm = raw.slice(raw.lastIndexOf(")") + 1).trim();
  const fields = afterComm.split(/\s+/);
  const pgid = Number.parseInt(fields[2] ?? "", 10);
  return Number.isFinite(pgid) ? pgid : null;
}

/** `true` si el pid es candidato válido a apagado por grupo. */
export function isKillableTarget(pid: number): boolean {
  return pid > 1 && pid !== process.pid;
}

/** Envía una señal al grupo completo del pid. Devuelve `false` si murió. */
export function signalGroup(pid: number, signal: NodeJS.Signals): boolean {
  if (!isKillableTarget(pid)) return false;
  try {
    // `-pid` = grupo de procesos completo (hijo + npm/bun + watchers).
    process.kill(-pid, signal);
  } catch {
    return false;
  }
  return true;
}

/** Envía una señal al pid directo (por si algún nieto cambió de grupo). */
export function signalPid(pid: number, signal: NodeJS.Signals): boolean {
  if (!isKillableTarget(pid)) return false;
  try {
    process.kill(pid, signal);
  } catch {
    return false;
  }
  return true;
}

/**
 * Termina el grupo completo de un proceso con gracia:
 * SIGTERM (grupo + pid) → esperar `graceMs` → SIGKILL si sigue vivo.
 *
 * En Linux, antes de señalar el grupo se comprueba que `pgid == pid`
 * (invariante de los hijos lanzados en sesión propia), exactamente como
 * hace V1 con `/proc`.
 */
export async function terminateProcessGroup(
  pid: number,
  graceMs = 2000
): Promise<void> {
  if (!isKillableTarget(pid)) return;

  if (process.platform === "linux") {
    const pgid = await processGroupId(pid);
    if (pgid === null || pgid !== pid) {
      return; // Murió o el pid lo recicló otro proceso: no señalar el grupo.
    }
  }

  signalGroup(pid, "SIGTERM");
  signalPid(pid, "SIGTERM");

  const step = 100;
  for (let waited = 0; waited < graceMs; waited += step) {
    await sleep(step);
    if (!isProcessAlive(pid)) return; // El líder murió: el grupo ya no existe.
  }

  // Sigue vivo → SIGKILL al grupo entero.
  signalGroup(pid, "SIGKILL");
  signalPid(pid, "SIGKILL");
}

function isMarkedDead(error: unknown): boolean {
  return (
    error !== null &&
    typeof error === "object" &&
    (error as NodeJS.ErrnoException).code === "ESRCH"
  );
}
