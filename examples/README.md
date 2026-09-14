# Ejemplos del ecosistema NodeDesk V2

Cinco demos **ejecutables** (TypeScript ESM, sin `any`) sobre los paquetes
del monorepo. Cada uno vive en su carpeta con `package.json`, `index.ts` y
`README.md`, y se arranca con tsx:

```bash
# desde la raíz de NODEDESK-V2
pnpm install   # una sola vez

pnpm --filter @nodedesk/example-basic-project-manager start -- --dir packages
pnpm --filter @nodedesk/example-process-manager start
pnpm --filter @nodedesk/example-env-manager start
pnpm --filter @nodedesk/example-template-example start
pnpm --filter @nodedesk/example-plugin-example start
```

| # | Ejemplo | Demuestra | Paquetes |
| --- | --- | --- | --- |
| 1 | [`basic-project-manager`](./basic-project-manager/) | `ProjectManager.discover()` + `toJSON()`: tabla/JSON con nombre, PM, scripts, deps, `engines.node` y `.env` | `@nodedesk/core` |
| 2 | [`process-manager`](./process-manager/) | Ciclo completo de `ProcessManager`: mini-proyecto en tmpdir, eventos `log` clasificados con ANSI, `stop()` limpio y resumen de exit code/signal | `@nodedesk/core` |
| 3 | [`env-manager`](./env-manager/) | `EnvManager`: `set`/`all`/`delete`/`entries` preservando comentarios, y `buildEnvironment()` | `@nodedesk/core` |
| 4 | [`template-example`](./template-example/) | `TemplateManager.list()`/`create()`: scaffolding de `minimal-node` y arranque real del resultado con `ProcessManager` | `@nodedesk/templates` + `@nodedesk/core` |
| 5 | [`plugin-example`](./plugin-example/) | `PluginManager`: 2 plugins custom (logger + servicio `"math"`), builtin `hello`, bus de eventos y `deactivateAll()` | `@nodedesk/plugins` + `@nodedesk/core` |

Con `cd examples/<nombre> && pnpm start` también funciona (los args van tras
`--`). Para verificar tipos: `pnpm -r --filter @nodedesk/example-* typecheck`.
