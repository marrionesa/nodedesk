/**
 * @nodedesk/plugins — sistema de plugins y contratos de extensión del
 * ecosistema NodeDesk.
 *
 * API pública. Todo lo que no se exporta desde aquí se considera interno
 * y puede cambiar sin aviso.
 */

/* ------------------------- contrato (vinculante) ----------------------- */
export type {
  NodeDeskPlugin,
  PluginContext,
  PluginInfo,
  PluginStatus,
  EventBus,
  ServiceRegistry,
  HostEventMap
} from "./types.js";
export { PLUGIN_API_VERSION } from "./types.js";

/* ------------------------------ orquestador ---------------------------- */
export { PluginManager } from "./plugin-manager.js";
export type { PluginManagerOptions } from "./plugin-manager.js";

/* -------------------------------- errores ------------------------------ */
export { PluginActivationError } from "./errors.js";

/* ------------------------------ infraestructura ------------------------ */
export { createPluginContext, defaultCore, NoopLogger } from "./context.js";
export type { PluginContextOptions } from "./context.js";
export { createEventBus } from "./events.js";
export { createServiceRegistry } from "./service-registry.js";

/* ------------------------------ integrados ----------------------------- */
export { builtinPlugins, helloPlugin } from "./builtins/index.js";
export type { HelloService } from "./builtins/index.js";
