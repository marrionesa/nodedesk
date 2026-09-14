# Ejemplo 1 · basic-project-manager

> Descubrir proyectos Node.js con `ProjectManager.discover()` y `NodeProject.toJSON()` de [`@nodedesk/core`](../../packages/core/README.md).

## Qué demuestra

- Búsqueda en anchura de proyectos Node.js bajo un directorio (con límite de
  profundidad e ignora `node_modules`, `.git`, `dist`, `build`, `coverage`…).
- Detección del package manager de cada proyecto (lockfile → `packageManager` → `npm`).
- Una tabla con **nombre, package manager, nº de scripts, nº de dependencias,
  `engines.node` y si tiene fichero `.env`** — o el snapshot JSON completo con
  `project.toJSON()` (+ `hasEnvFile`).

## Cómo ejecutarlo

Desde la raíz del monorepo:

```bash
pnpm --filter @nodedesk/example-basic-project-manager start -- --dir packages
pnpm --filter @nodedesk/example-basic-project-manager start -- --dir . --depth 2
pnpm --filter @nodedesk/example-basic-project-manager start -- --dir packages --json
```

O entrando en la carpeta:

```bash
cd examples/basic-project-manager
pnpm start -- --dir ../../packages
```

## Opciones

| Opción | Descripción |
| --- | --- |
| `--dir <ruta>` | Directorio donde buscar (por defecto `.`) |
| `--depth <n>` | Profundidad máxima de búsqueda (por defecto `3`) |
| `--json` | Salida JSON (array de `project.toJSON()`) |

Notas:

- Los directorios que ya contienen `package.json` se registran como
  proyecto y no se desciende dentro de ellos (`stopAtProject`).
- `pnpm` ejecuta los scripts desde la carpeta del ejemplo; si la ruta
  relativa de `--dir` no existe ahí, se reintenta contra la raíz del
  monorepo (por eso `--dir packages` funciona lanzando desde la raíz).
