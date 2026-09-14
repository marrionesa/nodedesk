import { interpolate } from "../interpolate.js";
import type { Template } from "../types.js";
import { buildPackageJson, buildReadme, GITIGNORE } from "./shared.js";

/**
 * Template `minimal-node` — servidor HTTP con Node puro, sin dependencias.
 *
 * Adaptación pública de la template «Node puro» de NodeDesk V1
 * (`templates.rs`, slug `node-puro`): el módulo `http` nativo, cero
 * dependencias npm y respuesta JSON con el estado del proyecto.
 */

/** Scripts comunes de servidor: watch en desarrollo, directo en producción. */
const scripts: Record<string, string> = {
  dev: "node --watch src/server.mjs",
  start: "node src/server.mjs"
};

/**
 * Fuente del servidor con tokens `{{clave}}` que `interpolate()` rellena con
 * el contexto. Se evitan template literals de JS dentro de la fuente para
 * que la interpolación no colisione con `${...}`.
 */
const SERVER_SOURCE = `// Servidor HTTP con Node puro — generado por @nodedesk/templates.
// Template: minimal-node (adaptación de "Node puro" de NodeDesk V1).

import http from "node:http";

const PORT = Number(process.env.PORT) || {{port}};
const NAME = {{name}};

const server = http.createServer((_req, res) => {
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ status: "ok", project: NAME }));
});

server.listen(PORT, () => {
  console.log(NAME + " escuchando en http://localhost:" + PORT);
});
`;

/** Template «Node puro»: http nativo, cero dependencias. */
export const minimalNodeTemplate: Template = {
  id: "minimal-node",
  name: "Node puro",
  tagline: "Cero dependencias, http nativo",
  description:
    "Servidor con el módulo http de Node, sin dependencias ni configuración. " +
    "Perfecto para aprender, prototipar o cuando quieres control total. " +
    "Port público de la template «Node puro» de NodeDesk V1 (id normalizado " +
    "a minimal-node).",
  category: "Minimal",
  stack: ["node", "http"],
  tags: ["sin deps", "nativo", "minimal"],
  minNode: "18",
  scripts,

  files(context) {
    return [
      {
        path: "package.json",
        content: buildPackageJson(context, { scripts })
      },
      {
        path: "src/server.mjs",
        content: interpolate(SERVER_SOURCE, {
          port: context.port,
          name: JSON.stringify(context.name)
        })
      },
      { path: ".gitignore", content: GITIGNORE },
      {
        path: "README.md",
        content: buildReadme(context, {
          templateId: "minimal-node",
          stack: "node (http nativo), sin dependencias"
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
