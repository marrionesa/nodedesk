import { NodeDeskError } from "@nodedesk/core";

/**
 * Errores de @nodedesk/templates.
 *
 * Extienden `NodeDeskError` de @nodedesk/core para que los consumidores del
 * ecosistema puedan distinguirlos con `instanceof` o con `error.code`.
 */

/** Error genérico del subsistema de templates (registro, generación, escritura). */
export class TemplateError extends NodeDeskError {
  constructor(message: string) {
    super(message, "ND_TEMPLATE");
  }
}

/** La template solicitada no existe en el catálogo (built-ins + registradas). */
export class TemplateNotFoundError extends NodeDeskError {
  constructor(id: string) {
    super(`template no encontrada: "${id}"`, "ND_TEMPLATE_NOT_FOUND");
  }
}
