import type { Template } from "../types.js";
import { buildPackageJson, buildReadme, GITIGNORE } from "./shared.js";

/**
 * Template `fastify-api` — API Fastify en JavaScript plano (ESM).
 *
 * Adaptación pública de «Fastify API» de NodeDesk V1 (`templates.rs`,
 * slug `fastify-api`): rutas JSON, arranque instantáneo y logging integrado.
 */

const scripts: Record<string, string> = {
  dev: "node --watch src/server.mjs",
  start: "node src/server.mjs"
};

const dependencies: Record<string, string> = {
  fastify: "^5.3.0"
};

/** Template «Fastify API»: API ultrarrápida, baja latencia. */
export const fastifyApiTemplate: Template = {
  id: "fastify-api",
  name: "Fastify API",
  tagline: "API ultrarrápida, baja latencia",
  description:
    "Servidor Fastify con rutas JSON y arranque instantáneo. Cuando el " +
    "rendimiento es el requisito número uno. Adaptación pública de la " +
    "template «Fastify API» de NodeDesk V1.",
  category: "API",
  stack: ["fastify", "node"],
  tags: ["api", "rápido", "rest"],
  minNode: "18",
  dependencies,
  scripts,

  files(context) {
    const server = `import Fastify from "fastify";

const app = Fastify({ logger: true });
const PORT = Number(process.env.PORT) || ${context.port};

app.get("/", async () => ({ hello: "NodeDesk", project: ${JSON.stringify(context.name)} }));
app.get("/api/health", async () => ({ status: "ok", ts: new Date().toISOString() }));

await app.listen({ port: PORT, host: "0.0.0.0" });
`;

    return [
      {
        path: "package.json",
        content: buildPackageJson(context, { scripts, dependencies })
      },
      { path: "src/server.mjs", content: server },
      { path: ".gitignore", content: GITIGNORE },
      {
        path: "README.md",
        content: buildReadme(context, {
          templateId: "fastify-api",
          stack: "fastify + node"
        })
      }
    ];
  },

  env(context) {
    return [
      { key: "PORT", value: String(context.port), comment: "Puerto del servidor" }
    ];
  }
};
