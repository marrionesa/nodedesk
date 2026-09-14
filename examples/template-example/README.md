# Ejemplo 4 · template-example

> Catálogo, scaffolding y arranque real con [`@nodedesk/templates`](../../packages/templates/README.md) + `ProcessManager`.

## Qué demuestra

- `TemplateManager.list()` — el catálogo completo (id + nombre + tagline).
- `TemplateManager.create()` — genera un proyecto `minimal-node` (Node puro,
  http nativo, **sin dependencias**) en `./.demo-output/` relativo al ejemplo,
  con `package.json`, `src/server.mjs`, `.gitignore`, `README.md` y `.env`.
- Los **ficheros escritos**, las **variables del `.env`** y los **nextSteps**.
- El proyecto generado se **arranca de verdad** con `ProcessManager` durante
  ~2,5 s: se comprueba su stdout (la línea «escuchando…»), se le hace un
  `GET /` y se apaga con `stop()` (siempre en `try/finally`).

## Cómo ejecutarlo

Desde la raíz del monorepo:

```bash
pnpm --filter @nodedesk/example-template-example start
```

Otra template u otra carpeta de salida:

```bash
pnpm --filter @nodedesk/example-template-example start -- --template express-api
pnpm --filter @nodedesk/example-template-example start -- --dir /tmp/mi-demo
```

O entrando en la carpeta:

```bash
cd examples/template-example
pnpm start
```

## Opciones

| Opción | Descripción |
| --- | --- |
| `--template <id>` | Id de la template (por defecto `minimal-node`) |
| `--dir <ruta>` | Carpeta donde generar el proyecto (por defecto `./.demo-output`) |

Notas: la carpeta destino se **limpia** antes de generar (es la salida del
demo); con otra template que tenga dependencias (`express-api`, `fastify-api`,
`hono-api`) el proyecto se genera igual, pero para arrancarlo hay que instalar
sus dependencias (`npm install`) — el demo avisa en ese caso.
