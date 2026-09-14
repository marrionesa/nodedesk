import type {
  EnvManager,
  LoggerLike,
  ProcessManager,
  ProjectManager
} from "@nodedesk/core";

/**
 * Contrato de tipos de @nodedesk/plugins.
 *
 * VINCULANTE: la API pública de este paquete se declara aquí.
 * La implementación (`plugin-manager.ts`, `context.ts`, `events.ts`) debe
 * respetar estas formas exactas.
 */

/** Versión del contrato de plugins de NodeDesk. */
export const PLUGIN_API_VERSION = "0.1.0";

/** Eventos estándar del bus de eventos del host. */
export interface HostEventMap {
  "plugin:activated": { name: string };
  "plugin:deactivated": { name: string };
  "plugin:error": { name: string; error: Error };
  "log": { level: "info" | "warn" | "error"; message: string };
}

/** Registro de servicios publicado por el host y los plugins. */
export interface ServiceRegistry {
  /** Publica un servicio. Lanza si el nombre ya está en uso. */
  register<T>(name: string, service: T): void;
  /** Recupera un servicio (o `undefined`). */
  get<T>(name: string): T | undefined;
  /** `true` si existe el servicio. */
  has(name: string): boolean;
  /** Retira un servicio (típicamente al desactivar su plugin). */
  unregister(name: string): boolean;
  /** Nombres de servicios registrados. */
  list(): string[];
}

/** Bus de eventos tipado del host. */
export interface EventBus {
  on<K extends keyof HostEventMap>(
    event: K,
    listener: (payload: HostEventMap[K]) => void
  ): () => void;
  off<K extends keyof HostEventMap>(
    event: K,
    listener: (payload: HostEventMap[K]) => void
  ): void;
  emit<K extends keyof HostEventMap>(event: K, payload: HostEventMap[K]): void;
}

/**
 * Contexto que el host entrega a cada plugin en `activate()`.
 *
 * Extiende la propuesta de la especificación (`projects`, `processes`,
 * `logger`) con DI explícita de las clases de core para facilitar pruebas.
 */
export interface PluginContext {
  /** Versión del contrato de plugins. */
  apiVersion: string;
  /** Nombre del plugin que recibe el contexto. */
  pluginName: string;
  /** Logger del host. */
  logger: LoggerLike;
  /** Bus de eventos del host. */
  events: EventBus;
  /** Registro de servicios compartido. */
  services: ServiceRegistry;
  /** Utilidades del ecosistema (clases de @nodedesk/core). */
  core: {
    ProjectManager: typeof ProjectManager;
    ProcessManager: typeof ProcessManager;
    EnvManager: typeof EnvManager;
  };
}

/** Contrato que implementa cada plugin de NodeDesk. */
export interface NodeDeskPlugin {
  /** Nombre único del plugin. */
  name: string;
  /** Versión semántica del plugin. */
  version: string;
  /** Descripción corta. */
  description?: string;
  /** Se llama al activar el plugin. */
  activate(context: PluginContext): void | Promise<void>;
  /** Se llama al desactivar el plugin (limpieza de recursos). */
  deactivate?(): void | Promise<void>;
}

/** Estado de un plugin conocido por el PluginManager. */
export type PluginStatus = "registered" | "active" | "deactivated" | "error";

/** Información pública de un plugin registrado. */
export interface PluginInfo {
  name: string;
  version: string;
  description?: string;
  status: PluginStatus;
  /** Mensaje del último error de activación (si lo hubo). */
  lastError?: string;
}
