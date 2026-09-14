import type { NodeDeskPlugin } from "../types.js";

/**
 * Servicio publicado por el plugin `hello` en el registro del host.
 *
 * Sirve como referencia de cómo un plugin expone funcionalidad a otros
 * plugins o al propio host mediante `context.services`.
 */
export interface HelloService {
  /** Devuelve el saludo del plugin. */
  greet(): string;
}

/** Limpieza pendiente de la activación actual (estado del singleton). */
let teardown: (() => void) | undefined;

/**
 * Plugin de demostración incluido con `@nodedesk/plugins`.
 *
 * Muestra el patrón recomendado de un plugin real:
 *
 * 1. En `activate` recibe el `PluginContext` y captura lo que necesite
 *    para limpiar después (su `deactivate` no recibe argumentos).
 * 2. Publica un servicio en el registro compartido.
 * 3. Se suscribe a eventos del bus (y guarda la función de baja).
 * 4. En `deactivate` deshace todo lo anterior.
 */
export const helloPlugin: NodeDeskPlugin = {
  name: "hello",
  version: "0.1.0",
  description: "Plugin de demostración del contrato de plugins de NodeDesk.",

  activate(context) {
    // Activación defensiva: si quedó una activación previa sin desactivar,
    // la desmontamos antes de volver a registrar (los nombres son únicos).
    teardown?.();
    teardown = undefined;

    const service: HelloService = {
      greet(): string {
        return "¡Hola desde el plugin hello!";
      }
    };

    const offLog = context.events.on("log", (entry) => {
      // Eco de ejemplo: los plugins pueden reaccionar a los eventos del host.
      // `debug` es opcional en `LoggerLike`, por eso la llamada segura.
      context.logger.debug?.(
        `[hello] eco de log (${entry.level}): ${entry.message}`
      );
    });

    context.services.register("hello", service);
    context.logger.info(`[hello] plugin activado (api ${context.apiVersion})`);

    teardown = () => {
      context.services.unregister("hello");
      offLog();
      context.logger.info("[hello] plugin desactivado. ¡Hasta luego!");
    };
  },

  deactivate() {
    teardown?.();
    teardown = undefined;
  }
};
