/**
 * @nodedesk/templates — gestión de templates y scaffolding de proyectos.
 *
 * Catálogo público de templates para el ecosistema NodeDesk, adaptado de
 * NodeDesk V1 (`templates.rs` / `templates.ts`): registro dinámico en lugar
 * del `match` gigante del backend Rust, y generadores como datos + funciones
 * puros que `TemplateManager` escribe en disco.
 */

/* -------------------------------- tipos -------------------------------- */
export type {
  Template,
  TemplateContext,
  TemplateFile,
  TemplateEnvVar,
  CreateOptions,
  CreateResult
} from "./types.js";

/* ------------------------------- errores ------------------------------- */
export { TemplateError, TemplateNotFoundError } from "./errors.js";

/* ----------------------------- utilidades ------------------------------ */
export { interpolate } from "./interpolate.js";

/* ------------------------------- gestión ------------------------------- */
export { TemplateManager } from "./template-manager.js";

/* ------------------------------- catálogo ------------------------------ */
export { builtinTemplates } from "./templates/index.js";
export {
  expressApiTemplate,
  fastifyApiTemplate,
  honoApiTemplate,
  minimalNodeTemplate
} from "./templates/index.js";
