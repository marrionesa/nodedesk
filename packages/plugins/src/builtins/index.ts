import type { NodeDeskPlugin } from "../types.js";
import { helloPlugin } from "./hello-plugin.js";

export { helloPlugin };
export type { HelloService } from "./hello-plugin.js";

/**
 * Plugins integrados que se distribuyen con `@nodedesk/plugins`.
 *
 * Cargarlos es opcional: el host decide cuáles registra en su
 * `PluginManager`.
 */
export const builtinPlugins: NodeDeskPlugin[] = [helloPlugin];
