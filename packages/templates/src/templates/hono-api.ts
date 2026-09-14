import type { Template } from "../types.js";
import { buildPackageJson, buildReadme, GITIGNORE } from "./shared.js";

/**
 * Template `hono-api` — API Hono sobre el server de Node.
 *
 * Adaptación pública de «Hono edge» de NodeDesk V1 (`templates.rs`,
 * slug `hono-edge`): mínima, ultraligera y portable a edge runtimes
 * (Cloudflare Workers, Bun, Deno) cambiando el adaptador de `serve`.
 */

const scripts: Record<string, string> = {
  dev: "node --watch src/server.mjs",
  start: "node src/server.mjs"
};

const dependencies: Record<string, string> = {
  hono: "^4.6.0",
  "@hono/node-server": "^1.13.0"
};

/** Template «Hono edge»: minimalista, edge-ready, ultraligera. */
export const honoApiTemplate: Template = {
  id: "hono-api",
  name: "Hono edge",
  tagline: "Minimalista, edge-ready, ultraligera",
  description:
    "API con Hono corriendo sobre el server de Node: mínima y portable a " +
    "edge runtimes (Cloudflare Workers, Bun, Deno). Adaptación pública de " +
    "«Hono edge» de NodeDesk V1.",
  category: "Minimal",
  stack: ["hono", "node"],
  tags: ["edge", "minimal", "api"],
  minNode: "18",
  dependencies,
  scripts,

  files(context) {
    const server = `import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();
const PORT = Number(process.env.PORT) || ${context.port};
const NAME = ${JSON.stringify(context.name)};

app.get("/", (c) => c.json({ hello: "NodeDesk", project: NAME }));
app.get("/api/health", (c) => c.json({ status: "ok", ts: new Date().toISOString() }));

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(NAME + " (hono) escuchando en http://localhost:" + PORT);
});
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
          templateId: "hono-api",
          stack: "hono + @hono/node-server"
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
