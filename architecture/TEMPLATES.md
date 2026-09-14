# @nodedesk/templates — Diseño

> Gestión de templates y creación de proyectos. Segundo paquete del
> ecosistema, construido sobre `@nodedesk/core`.

## El refactor principal respecto a V1

En V1 (`templates.rs`) el catálogo era un array cerrado de 8 templates y la
generación era un `match` gigante de strings dentro del backend Rust, con una
**duplicación** de la misma lógica en el frontend
(`src/lib/nodedesk/template-files.ts`).

En V2:

1. **Registro abierto**: `TemplateManager.register(template)` permite
   añadir templates sin tocar el paquete — el catálogo ya no está cerrado.
2. **Una sola fuente de verdad**: los generadores viven aquí (no duplicados
   backend/frontend).
3. **Contrato tipado**: `Template.files(context)` devuelve ficheros
   declarativos (`{ path, content }`) — nada de `match` con strings.
4. **Composición con core**: `slugify` para ids, `findFreePort` para el
   pool 3011–3099, `NodeProject`/`ProcessManager` para verificar los
   proyectos generados.

## API

```ts
import { TemplateManager } from "@nodedesk/templates";

TemplateManager.list();                       // built-ins + registradas
TemplateManager.get("express-api");
TemplateManager.create("express-api", {
  name: "Mi API",
  directory: "./mi-api",     // default ./<slug>
  force: false,              // default: error si no vacío
  skipEnv: false,            // default: escribe .env inicial
});
// → CreateResult { directory, template, files, count, env, port, nextSteps }

TemplateManager.register({ /* Template */ }); // extensión
```

## Contrato `Template`

```ts
interface Template {
  id: string;            // slug único
  name: string;
  tagline: string;
  description: string;
  category: string;      // "Minimal" | "API" | …
  stack: string[];
  tags: string[];
  minNode: string;       // "18"
  dependencies?: Record<string, string>;
  scripts: Record<string, string>;
  files(context: TemplateContext): TemplateFile[];
  env?(context: TemplateContext): TemplateEnvVar[];
}
```

`TemplateContext` recibe `name`, `slug`, `port`, `directory` y
`packageManager` — las templates son funciones puras del contexto, lo que
las hace trivialemente testeables y reproducibles.

## Templates públicas (4)

| Id | Basada en (V1) | Descripción |
| --- | --- | --- |
| `minimal-node` | "Node puro" | Servidor `http` nativo, **cero dependencias**. La unit test de integración del paquete la arranca de verdad con `ProcessManager` y le hace una petición HTTP real. |
| `express-api` | "Express + TypeScript" | Express 4 con `/`, `/api/health` y `/api/hello?who=`; lee `GREETING` del `.env`. Generada en JS plano (la variante TS queda para cuando exista un pipeline de build en la template). |
| `fastify-api` | "Fastify API" | Fastify 5 con rutas JSON y arranque instantáneo. |
| `hono-api` | "Hono edge" | Hono 4 + `@hono/node-server`, portable a edge runtimes. |

Todas generan: `package.json`, fichero de servidor, `.gitignore`, `README.md`
y `.env` inicial (`PORT`, y `GREETING` en Express).

## Templates que NO se publican (decisión de separación público/privado)

Las siguientes de V1 quedan fuera del paquete público:

| Template V1 | Motivo |
| --- | --- |
| `next-web` | Posicionamiento comercial del Desktop y dependencia de versiones pinned del producto. |
| `nestjs-api` | "Heavy" (30 s de instalación), pensada para el flujo del Desktop con progreso e instalación gestionada. |
| `socket-chat` | Material de demostración del producto. |
| `rest-jwt` | Contiene decisiones de seguridad propietarias. |

Si el propietario decide publicarlas, el contrato ya las admite: basta con
`register()` o añadir sus ficheros bajo `src/templates/`.

## Flujo de `create()`

1. Resuelve la template (error tipado si no existe).
2. `name` → `slug` (core `slugify`); `directory` default `./<slug>` absoluto.
3. `port`: del argumento o el primero libre del pool 3011–3099 (core
   `findFreePort`).
4. **Seguridad de directorio**: si el destino existe y no está vacío lanza
   `TemplateError` salvo `force: true`.
5. Escribe los `files(context)` creando directorios padres.
6. Escribe el `.env` inicial (`# comentario\nKEY=VALUE\n`) salvo `skipEnv`.
7. Devuelve `CreateResult` con `nextSteps` accionables
   (`cd` + install + dev con el package manager elegido).

## Testing

23 tests: catálogo, registro/duplicados/reset, creación completa de las 4
templates (ficheros escritos, package.json parseable con deps correctas,
`.env` con PORT), opciones (`name`, `directory`, `force`, `skipEnv`),
`interpolate()`, y **integración real**: crea `minimal-node` en tmpdir, lo
arranca con `ProcessManager` de core, valida el HTTP 200/JSON y lo apaga
limpio.
