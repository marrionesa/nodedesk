/** Tipos públicos de @nodedesk/core. */
export type {
  PackageManagerId,
  PackageManagerInfo,
  PackageJson,
  ProjectMetadata
} from "./project.js";
export type {
  LogLevel,
  LogEntry,
  ProcessStatus,
  ProcessInfo,
  ProcessExit,
  ProcessStartOptions,
  LoggerLike,
  ProcessRegistryLike
} from "./process.js";
export type { EnvEntry, EnvManagerOptions } from "./env.js";
export type { DiscoveryOptions, FileWriteResult } from "./utils.js";
