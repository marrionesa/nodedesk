import { NodeDeskError } from "@nodedesk/core";

/**
 * Error lanzado por `PluginManager.activate()` cuando la activación de un
 * plugin falla. Extiende `NodeDeskError` (código `ND_PLUGIN_ACTIVATION`)
 * para que los consumidores puedan distinguirlo con `instanceof` o `code`.
 */
export class PluginActivationError extends NodeDeskError {
  /** Nombre del plugin cuya activación falló. */
  readonly pluginName: string;

  /** Causa original del fallo, si fue un `Error`. */
  readonly originalError?: Error;

  constructor(pluginName: string, cause: unknown) {
    super(
      `no se pudo activar el plugin "${pluginName}": ${describeCause(cause)}`,
      "ND_PLUGIN_ACTIVATION"
    );
    this.pluginName = pluginName;
    this.originalError = cause instanceof Error ? cause : undefined;
  }
}

/** Traduce una causa desconocida a un mensaje legible. */
function describeCause(cause: unknown): string {
  if (cause instanceof Error) return cause.message;
  if (cause === undefined) return "error desconocido";
  return String(cause);
}
