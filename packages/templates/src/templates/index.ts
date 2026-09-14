import type { Template } from "../types.js";
import { expressApiTemplate } from "./express-api.js";
import { fastifyApiTemplate } from "./fastify-api.js";
import { honoApiTemplate } from "./hono-api.js";
import { minimalNodeTemplate } from "./minimal-node.js";

/**
 * Catálogo de templates built-in públicas de @nodedesk/templates.
 *
 * Cuatro generadores públicos y genéricos adaptados de NodeDesk V1
 * (`templates.rs` / `templates.ts`), con dependencias reales y proyectos
 * ejecutables. Las templates propietarias de V1 (next-web, nestjs-api,
 * socket-chat, rest-jwt) viven solo en NodeDesk Desktop y no se publican
 * aquí — ver el README del paquete.
 */
export const builtinTemplates: Template[] = [
  minimalNodeTemplate,
  expressApiTemplate,
  fastifyApiTemplate,
  honoApiTemplate
];

export { expressApiTemplate } from "./express-api.js";
export { fastifyApiTemplate } from "./fastify-api.js";
export { honoApiTemplate } from "./hono-api.js";
export { minimalNodeTemplate } from "./minimal-node.js";
