# @nodedesk/templates

> Gestión de templates y scaffolding de proyectos para el ecosistema NodeDesk.

![Node](https://img.shields.io/badge/node-%E2%89%A518-339933?logo=node.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)
![Módulos](https://img.shields.io/badge/ESM-only-000)
![Licencia](https://img.shields.io/badge/license-MIT-green)

`@nodedesk/templates` es el catálogo público de plantillas de NodeDesk:
definiciones **puras** (datos + funciones generadoras) que `TemplateManager`
escribe en disco para producir proyectos Node.js ejecutables desde el primer
segundo. Sustituye al `match` gigante de `templates.rs` del backend Rust de
V1 por un registro dinámico y ampliable desde JavaScript/TypeScript.

## Instalación

```bash
pnpm add @nodedesk/templates
# o
npm install @nodedesk/templates
```

Requiere Node.js >= 18. Depende de
[`@nodedesk/core`](../core/README.md) (puerto libre, `slugify`, errores).

## Uso rápido

### Listar el catálogo

```ts
import { TemplateManager } from "@nodedesk/templates";

for (const tpl of TemplateManager.list()) {
  console.log(tpl.id, "—", tpl.tagline, `(${tpl.category})`);
}
// minimal-node — Cero dependencias, http nativo (Minimal)
// express-api — La API clásica de Node, en JavaScript plano (API)
// fastify-api — API ultrarrápida, baja latencia (API)
// hono-api — Minimalista, edge-ready, ultraligera (Minimal)

TemplateManager.get("minimal-node"); // Template | null
TemplateManager.has("express-api");  // true
```

### Crear un proyecto

```ts
const result = await TemplateManager.create("express-api", {
  name: "Mi API",            // por defecto, el nombre de la template
  directory: "./mi-api",     // por defecto, ./<slug>
  packageManager: "npm"      // por defecto, "npm"
  // port: 3050,             // por defecto, puerto libre del pool 3011–3099
});

console.log(result.directory); // ruta absoluta del proyecto
console.log(result.files);    // rutas absolutas de lo escrito
console.log(result.env);      // variables escritas en el .env
console.log(result.nextSteps);
// [
//   "cd /abs/mi-api",
//   "npm install",
//   "npm run dev"
// ]
```

La generación:

- escribe los ficheros de `template.files(context)` creando los directorios
  padres necesarios (`package.json`, `src/server.mjs`, `.gitignore`,
  `README.md`…),
- escribe un `.env` inicial con `template.env(context)` en formato
  `# comentario` + `KEY=VALUE` (salvo `skipEnv: true`),
- lanza `TemplateNotFoundError` si el id no existe y `TemplateError` si el
  directorio destino ya existe y no está vacío (usa `force: true` para
  sobrescribir).

### Registrar una template propia

```ts
import { TemplateManager } from "@nodedesk/templates";
import { interpolate } from "@nodedesk/templates";

const miTemplate = {
  id: "mi-stack",
  name: "Mi Stack",
  tagline: "Mi template corporativa",
  description: "Genera un servidor con la configuración de mi equipo.",
  category: "API",
  stack: ["mi-framework"],
  tags: ["interno"],
  minNode: "18",
  scripts: { dev: "node --watch src/server.mjs", start: "node src/server.mjs" },
  files: (ctx) => [
    {
      path: "src/server.mjs",
      content: interpolate(
        "// {{name}} ({{slug}}) en el puerto {{port}}\n",
        ctx
      ),
    },
  ],
  env: (ctx) => [{ key: "PORT", value: String(ctx.port) }],
};

TemplateManager.register(miTemplate);

// A partir de aquí forma parte del catálogo del proceso:
await TemplateManager.create("mi-stack", { directory: "./demo" });
```

`register()` lanza `TemplateError` si el id choca con una built-in o con otra
template ya registrada.

## Templates built-in

| Id | Nombre | Categoría | Stack | Qué genera |
| --- | --- | --- | --- | --- |
| `minimal-node` | Node puro | Minimal | node, http | Servidor `http` nativo **sin dependencias**; responde `{"status":"ok","project":…}`. Env: `PORT`. |
| `express-api` | Express API | API | express, node | Express `^4.21.2` con `GET /` (HTML), `GET /api/health` (uptime) y `GET /api/hello?who=` (saludo configurable). Env: `PORT`, `GREETING`. |
| `fastify-api` | Fastify API | API | fastify, node | Fastify `^5.3.0` con `GET /` y `GET /api/health` (JSON con `ts`). Env: `PORT`. |
| `hono-api` | Hono edge | Minimal | hono, node | Hono `^4.6.0` + `@hono/node-server ^1.13.0` con `serve({ fetch: app.fetch, port })`, rutas `/` y `/api/health`. Env: `PORT`. |

Todas comparten la misma convención: proyecto ESM (`type: module`),
scripts `dev` (`node --watch src/server.mjs`) y `start`
(`node src/server.mjs`), `.gitignore` estándar y `README.md` con el
arranque explicado.

## Templates privadas de NodeDesk Desktop

Las templates **propietarias** del producto NodeDesk Desktop (derivado de
V1) **no se publican en este paquete**:

- `next-web` — Next.js App Router
- `nestjs-api` — NestJS modular
- `socket-chat` — Chat Socket.io
- `rest-jwt` — API REST + JWT

Viven en el repositorio privado de la aplicación de escritorio porque su
mantenimiento, versionado y roadmap van ligados al producto comercial, no al
ecosistema open source. Aquí solo se publican templates genéricas, útiles por
sí mismas y con dependencias reales mantenidas por la comunidad.

Si necesitas una de ellas, puedes registrar tu propia versión con
`TemplateManager.register()` sin tocar este paquete.

## Desarrollo

```bash
pnpm install    # dentro del workspace NODEDESK-V2
pnpm build      # tsc -p tsconfig.build.json → dist/
pnpm test       # vitest run (incluye un test de integración real:
                 #   genera un proyecto minimal-node y lo arranca con
                 #   ProcessManager de @nodedesk/core)
pnpm typecheck  # tsc --noEmit
```

Convenciones del monorepo: ESM con `NodeNext` (imports relativos con
extensión `.js`), TypeScript strict sin `any`, `verbatimModuleSyntax`,
docstrings en español.

## Licencia

MIT License.
