/**
 * Tipos de proceso y logs de @nodedesk/core.
 *
 * Modelos públicos para la ejecución y supervisión de procesos Node.js.
 */

/** Nivel de una línea de log. */
export type LogLevel = "info" | "warn" | "error" | "system";

/** Una línea de log clasificada. */
export interface LogEntry {
  /** Línea de texto tal cual la emitió el proceso (sin salto de línea). */
  line: string;
  /** Nivel clasificado. */
  level: LogLevel;
  /** Origen del texto. */
  source: "stdout" | "stderr" | "system";
  /** Marca temporal ISO-8601. */
  timestamp: string;
}

/** Estados del ciclo de vida de un proceso gestionado. */
export type ProcessStatus =
  | "idle"
  | "starting"
  | "running"
  | "stopping"
  | "exited"
  | "error";

/** Información viva de un proceso. */
export interface ProcessInfo {
  /** Id estable del gestor de proceso. */
  id: string;
  /** PID del hijo (null si no está vivo). */
  pid: number | null;
  /** Estado actual. */
  status: ProcessStatus;
  /** Comando que se ejecutó. */
  command: string;
  /** ISO-8601 del arranque. */
  startedAt: string | null;
  /** Código de salida del último ciclo (null si sigue vivo). */
  exitCode: number | null;
  /** Señal que terminó el proceso (si la hubo). */
  signal: string | null;
}

/** Resultado de esperar a que el proceso termine. */
export interface ProcessExit {
  code: number | null;
  signal: string | null;
}

/** Opciones para arrancar un proceso. */
export interface ProcessStartOptions {
  /**
   * Script de `package.json` a ejecutar. Por defecto se prueba `dev`,
   * luego `start` y por último `main` con `node`.
   */
  script?: string;
  /** Comando completo a ejecutar (tiene prioridad sobre `script`). */
  command?: string;
  /** Variables de entorno extra (se aplican al final, ganan siempre). */
  env?: Record<string, string>;
  /** CWD del hijo (por defecto, la raíz del proyecto). */
  cwd?: string;
  /**
   * Arranca el proceso en background (grupo propio, stdio a `logFile`).
   * Por defecto `false`: el proceso vive ligado al gestor.
   */
  detached?: boolean;
  /** Fichero de log al que redirigir stdout/stderr en modo detached. */
  logFile?: string;
  /**
   * Registro persistente donde anotar/retirar el proceso. Solo se usa si
   * está definido. En modo detached se puede pasar `true` para usar el
   * registro por defecto (`~/.nodedesk-v2/processes.json`).
   */
  registry?: ProcessRegistryLike | true;
  /**
   * Instala dependencias automáticamente si falta `node_modules/`
   * (usa el package manager detectado del proyecto).
   */
  autoInstall?: boolean;
  /** Logger para eventos de sistema (arranque, instalación…). */
  logger?: LoggerLike;
  /** Milisegundos de gracia en `stop()` antes de SIGKILL. Por defecto 2000. */
  graceMs?: number;
}

/**
 * Contrato mínimo de logger aceptado por el core (evita acoplar el core a
 * una implementación concreta).
 */
export interface LoggerLike {
  debug?(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

/** Registro persistente de procesos en background (contrato). */
export interface ProcessRegistryLike {
  add(record: {
    pid: number;
    root: string;
    command: string;
    startedAt: string;
    logFile?: string;
  }): Promise<void>;
  remove(pid: number): Promise<void>;
}
