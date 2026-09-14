import { EnvManager, ProcessManager, ProjectManager } from "@nodedesk/core";
import type { LoggerLike } from "@nodedesk/core";
import { createEventBus } from "./events.js";
import { createServiceRegistry } from "./service-registry.js";
import { PLUGIN_API_VERSION } from "./types.js";
import type { EventBus, PluginContext, ServiceRegistry } from "./types.js";

/**
 * Logger silencioso: descarta todos los mensajes.
 *
 * Es el logger por defecto del host, pensado para tests y para entornos
 * donde no se desea escribir en consola. Los consumidores pueden inyectar
 * cualquier `LoggerLike` (p. ej. `ConsoleLogger` de core) al crear el
 * contexto o el `PluginManager`.
 */
export class NoopLogger implements LoggerLike {
  debug(): void {
    /* silencio deliberado */
  }

  info(): void {
    /* silencio deliberado */
  }

  warn(): void {
    /* silencio deliberado */
  }

  error(): void {
    /* silencio deliberado */
  }
}

/**
 * Clases de `@nodedesk/core` expuestas por defecto a los plugins vía
 * `context.core`. Se mantiene como factoría para que cada contexto pueda
 * inyectar dobles de prueba sin mutar un objeto compartido.
 */
export function defaultCore(): PluginContext["core"] {
  return {
    ProjectManager,
    ProcessManager,
    EnvManager
  };
}

/** Opciones de `createPluginContext`. */
export interface PluginContextOptions {
  /** Nombre del plugin destinatario del contexto. */
  pluginName: string;
  /** Logger del host (por defecto, un `NoopLogger`). */
  logger?: LoggerLike;
  /** Bus de eventos (por defecto, uno nuevo). */
  events?: EventBus;
  /** Registro de servicios (por defecto, uno nuevo). */
  services?: ServiceRegistry;
  /** Clases de core inyectadas (por defecto, las reales de `@nodedesk/core`). */
  core?: PluginContext["core"];
}

/**
 * Construye el contexto que el host entrega a un plugin en `activate()`.
 *
 * Todos los componentes son inyectables; los defaults crean una
 * infraestructura mínima por contexto (logger silencioso, bus propio,
 * registro propio y las clases reales de core).
 */
export function createPluginContext(
  options: PluginContextOptions
): PluginContext {
  return {
    apiVersion: PLUGIN_API_VERSION,
    pluginName: options.pluginName,
    logger: options.logger ?? new NoopLogger(),
    events: options.events ?? createEventBus(),
    services: options.services ?? createServiceRegistry(),
    core: options.core ?? defaultCore()
  };
}
