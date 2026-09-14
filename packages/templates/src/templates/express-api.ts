import type { Template } from "../types.js";
import { buildPackageJson, buildReadme, GITIGNORE } from "./shared.js";

/**
 * Template `express-api` — API Express en JavaScript plano (ESM).
 *
 * Adaptación pública de «Express + TypeScript» de NodeDesk V1 (`templates.rs`,
 * slug `express-ts`) sin paso de compilación: mismas rutas (`/` HTML,
 * `/api/health`, `/api/hello?who=`), pero ejecutando `.mjs` directamente con
 * `node --watch`.
 */

const scripts: Record<string, string> = {
  dev: "node --watch src/server.mjs",
  start: "node src/server.mjs"
};

const dependencies: Record<string, string> = {
  express: "^4.21.2"
};

/** Template «Express API»: la API clásica de Node, en JavaScript plano. */
export const expressApiTemplate: Template = {
  id: "express-api",
  name: "Express API",
  tagline: "La API clásica de Node, en JavaScript plano",
  description:
    "Servidor Express con página de bienvenida, ruta de salud y saludo " +
    "configurable desde el .env (GREETING), con recarga en caliente vía " +
    "node --watch. Adaptación sin TypeScript de «Express + TypeScript» de V1.",
  category: "API",
  stack: ["express", "node"],
  tags: ["api", "rest", "express"],
  minNode: "18",
  dependencies,
  scripts,

  files(context) {
    const server = `import express from "express";

const app = express();
const PORT = Number(process.env.PORT) || ${context.port};
const NAME = ${JSON.stringify(context.name)};
const GREETING = process.env.GREETING || "hola";

app.get("/", (_req, res) => {
  res.type("html").send("<h1>" + NAME + "</h1><p>API Express generada con @nodedesk/templates.</p>");
});

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

app.get("/api/hello", (req, res) => {
  const who = req.query.who || "mundo";
  res.json({ message: GREETING + ", " + who });
});

app.listen(PORT, () => {
  console.log(NAME + " (express) escuchando en http://localhost:" + PORT);
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
          templateId: "express-api",
          stack: "express + node"
        })
      }
    ];
  },

  env(context) {
    return [
      { key: "PORT", value: String(context.port), comment: "Puerto del servidor" },
      { key: "GREETING", value: "hola desde NodeDesk", comment: "Saludo de la API" }
    ];
  }
};
