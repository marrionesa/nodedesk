import type { LoggerLike } from "@nodedesk/core";
import { createPluginContext, defaultCore, NoopLogger } from "./context.js";
import { createEventBus } from "./events.js";
import { PluginActivationError } from "./errors.js";
import { createServiceRegistry } from "./service-registry.js";
import type {
  EventBus,
  NodeDeskPlugin,
  PluginContext,
  PluginInfo,
  PluginStatus,
  ServiceRegistry
} from "./types.js";

/** Estado interno que el manager mantiene por plugin registrado. */
interface PluginRecord {
  plugin: NodeDeskPlugin;
  status: PluginStatus;
  /** Mensaje del último error de activación/desactivación (si lo hubo). */
  lastError?: string;
}

/** Opciones del constructor de `PluginManager`. */
export interface PluginManagerOptions {
  /** Logger compartido con los plugins (default: `NoopLogger`). */
  logger?: LoggerLike;
  /** Bus de eventos del host (default: uno nuevo). */
  events?: EventBus;
  /** Registro de servicios compartido (default: uno nuevo). */
  services?: ServiceRegistry;
  /** Clases de core inyectadas (default: las reales de `@nodedesk/core`). */
  core?: PluginContext["core"];
}

/**
 * Orquestador del ciclo de vida de los plugins de NodeDesk.
 *
 * Responsabilidades:
 *
 * - Mantener el registro de plugins conocidos (`register`/`unregister`).
 * - Activarlos con un `PluginContext` fresco y desactivarlos en orden.
 * - Aislar los fallos: un plugin roto nunca tumba al host ni al resto de
 *   plugins, y siempre queda reflejado en `PluginInfo` y en el bus
 *   (`plugin:error`).
 */
export class PluginManager {
  private readonly records = new Map<string, PluginRecord>();
  private readonly logger: LoggerLike;
  private readonly events: EventBus;
  private readonly services: ServiceRegistry;
  private readonly core: PluginContext["core"];

  constructor(options: PluginManagerOptions = {}) {
    this.logger = options.logger ?? new NoopLogger();
    this.events = options.events ?? createEventBus();
    this.services = options.services ?? createServiceRegistry();
    this.core = options.core ?? defaultCore();
  }

  /**
   * Registra un plugin. Lanza `Error` si ya existe uno con el mismo nombre.
   * Devuelve el propio manager para permitir encadenados.
   */
  register(plugin: NodeDeskPlugin): this {
    if (this.records.has(plugin.name)) {
      throw new Error(
        `ya existe un plugin registrado con el nombre "${plugin.name}"`
      );
    }
    this.records.set(plugin.name, { plugin, status: "registered" });
    return this;
  }

  /**
   * Retira un plugin del registro. Si estaba activo, se dispara su
   * desactivación antes de retirarlo (el contrato de `unregister` es
   * síncrono, por lo que la limpieza asíncrona continúa en segundo plano
   * sin rechazar nunca: los fallos quedan en `plugin:error`).
   *
   * Devuelve `true` si el plugin existía.
   */
  unregister(name: string): boolean {
    const record = this.records.get(name);
    if (!record) return false;
    if (record.status === "active") {
      // Se invoca al plugin de inmediato (la parte síncrona de deactivate
      // corre antes de borrar el registro) y el resto completa en microtareas.
      void this.deactivate(name);
    }
    return this.records.delete(name);
  }

  /**
   * Activa un plugin con un contexto fresco.
   *
   * - Plugin desconocido → lanza `Error`.
   * - Ya activo → no-op silencioso.
   * - Si `activate()` lanza → marca estado `"error"` con `lastError`, emite
   *   `plugin:error` y **relanza** envuelto en `PluginActivationError`.
   */
  async activate(name: string): Promise<void> {
    const record = this.records.get(name);
    if (!record) {
      throw new Error(`no hay ningún plugin registrado con el nombre "${name}"`);
    }
    if (record.status === "active") return; // ya activo: no-op silencioso

    const context = createPluginContext({
      pluginName: name,
      logger: this.logger,
      events: this.events,
      services: this.services,
      core: this.core
    });

    try {
      await record.plugin.activate(context);
      record.status = "active";
      record.lastError = undefined;
      this.events.emit("plugin:activated", { name });
    } catch (cause) {
      record.status = "error";
      record.lastError = messageOf(cause);
      this.events.emit("plugin:error", { name, error: asError(cause) });
      throw new PluginActivationError(name, cause);
    }
  }

  /**
   * Desactiva un plugin activo (llama a su `deactivate` opcional).
   *
   * - No activo o desconocido → no-op silencioso.
   * - Si `deactivate()` lanza → captura, marca `"error"`, emite
   *   `plugin:error`… y **no relanza** (la desactivación es best-effort).
   */
  async deactivate(name: string): Promise<void> {
    const record = this.records.get(name);
    if (!record || record.status !== "active") return;

    try {
      await record.plugin.deactivate?.();
      record.status = "deactivated";
      record.lastError = undefined;
      this.events.emit("plugin:deactivated", { name });
    } catch (cause) {
      record.status = "error";
      record.lastError = messageOf(cause);
      this.events.emit("plugin:error", { name, error: asError(cause) });
    }
  }

  /**
   * Activa todos los plugins registrados, en orden de registro.
   *
   * Aislamiento total: si uno falla, se registra su error (estado `"error"`
   * + evento `plugin:error`) y se continúa con los siguientes.
   */
  async activateAll(): Promise<void> {
    for (const name of this.records.keys()) {
      try {
        await this.activate(name);
      } catch (cause) {
        // El error ya quedó en el estado del plugin y en el bus; el
        // arranque del resto de plugins no se ve afectado.
        this.logger.warn(
          `[plugins] "${name}" no se pudo activar: ${messageOf(cause)}`
        );
      }
    }
  }

  /** Desactiva los plugins activos (en orden de registro). */
  async deactivateAll(): Promise<void> {
    for (const [name, record] of this.records) {
      if (record.status === "active") {
        await this.deactivate(name);
      }
    }
  }

  /** Información pública de todos los plugins registrados. */
  list(): PluginInfo[] {
    const infos: PluginInfo[] = [];
    for (const record of this.records.values()) {
      const info: PluginInfo = {
        name: record.plugin.name,
        version: record.plugin.version,
        status: record.status
      };
      if (record.plugin.description !== undefined) {
        info.description = record.plugin.description;
      }
      if (record.lastError !== undefined) {
        info.lastError = record.lastError;
      }
      infos.push(info);
    }
    return infos;
  }

  /** El plugin registrado con ese nombre, o `null`. */
  get(name: string): NodeDeskPlugin | null {
    return this.records.get(name)?.plugin ?? null;
  }

  /** `true` si hay un plugin registrado con ese nombre. */
  has(name: string): boolean {
    return this.records.has(name);
  }

  /** Número de plugins registrados. */
  get size(): number {
    return this.records.size;
  }

  /** Número de plugins activos. */
  get activeCount(): number {
    let count = 0;
    for (const record of this.records.values()) {
      if (record.status === "active") count += 1;
    }
    return count;
  }
}

/** Normaliza una causa desconocida a `Error`. */
function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

/** Extrae un mensaje legible de una causa desconocida. */
function messageOf(cause: unknown): string {
  return asError(cause).message;
}
