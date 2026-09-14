/**
 * @nodedesk/core — Node.js project management engine behind NodeDesk.
 *
 * API pública. Todo lo que no se exporta desde aquí se considera interno
 * y puede cambiar sin aviso.
 */

/* -------------------------------- tipos -------------------------------- */
export type {
  PackageManagerId,
  PackageManagerInfo,
  PackageJson,
  ProjectMetadata
} from "./types/project.js";
export type {
  LogLevel,
  LogEntry,
  ProcessStatus,
  ProcessInfo,
  ProcessExit,
  ProcessStartOptions,
  LoggerLike,
  ProcessRegistryLike
} from "./types/process.js";
export type { EnvEntry, EnvManagerOptions } from "./types/env.js";
export type { DiscoveryOptions, FileWriteResult } from "./types/utils.js";

/* ------------------------------- errores ------------------------------- */
export {
  NodeDeskError,
  InvalidProjectError,
  PathNotFoundError,
  ProcessError,
  ProcessNotRunningError,
  EnvFileError
} from "./errors.js";

/* ------------------------------ proyectos ------------------------------ */
export { ProjectManager } from "./project/project-manager.js";
export { NodeProject } from "./project/node-project.js";
export { readPackageJson, hasPackageJson } from "./project/package-json.js";
export {
  detectPackageManager,
  scriptCommand,
  installCommand,
  supportedPackageManagers
} from "./project/package-manager.js";

/* ------------------------------ procesos ------------------------------- */
export { ProcessManager } from "./process/process-manager.js";
export {
  ProcessRegistry,
  defaultRegistryPath,
  defaultLogsDir
} from "./process/process-registry.js";
export type {
  ProcessRecord,
  ProcessRegistryFile
} from "./process/process-registry.js";
export {
  isProcessAlive,
  processGroupId,
  isKillableTarget,
  signalGroup,
  signalPid,
  terminateProcessGroup
} from "./process/kill.js";
export { classifyLine } from "./process/classify.js";

/* --------------------------------- env --------------------------------- */
export { EnvManager } from "./env/env-manager.js";
export { parseEnv, serializeEnv, entriesToObject } from "./env/dotenv.js";

/* ------------------------------- logging ------------------------------- */
export {
  MemoryLogger,
  ConsoleLogger,
  CompositeLogger
} from "./logging/logger.js";

/* ------------------------------ utilidades ----------------------------- */
export { slugify } from "./utils/slugify.js";
export { findFreePort, leaseFreePort } from "./utils/ports.js";
export type { PortLease } from "./utils/ports.js";
export { nowIso, shortUid, hashId, sleep } from "./utils/id.js";

/* ------------------------------- versión ------------------------------- */
export const CORE_VERSION = "0.1.0";
