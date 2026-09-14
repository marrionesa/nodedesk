# Changelog

Todas las novedades notables de este proyecto se documentarán en este fichero.
El formato está basado en [Keep a Changelog](https://keepachangelog.com/es/1.1.0/),
y este proyecto se adhiere a [Versionado Semántico](https://semver.org/lang/es/).

## [0.1.0] — Primera fase del ecosistema

### Añadido

- Renombrado definitivo del ecosistema a NodeDesk: paquetes `@nodedesk/*` y
  CLI `nodedesk`.
- Instalación de dependencias opt-in mediante `nodedesk start --install`,
  compatible con ejecución attached y detached; `create` y `start` no instalan
  automáticamente por defecto.
- Auditoría de pre-publicación con `PASS: 136`, `FAIL: 0`, `WARN: 3` y
  validación externa de los cuatro artefactos empaquetados como `*.tgz`.
- Pruebas funcionales externas de Templates, Plugins, CLI, procesos, logs,
  registro persistente, HTTP y limpieza posterior.
- Monorepo pnpm con workspace `packages/*` y `examples/*`.
- `@nodedesk/core` 0.1.0 — motor de gestión de proyectos Node.js:
  - `ProjectManager.load()` / `ProjectManager.discover()` (descubrimiento de proyectos).
  - `NodeProject` con metadatos de `package.json`, scripts, dependencias y engines.
  - `ProcessManager` con ciclo de vida completo (start/stop/restart/wait), eventos
    `stdout`/`stderr`/`log`/`exit`, procesos en grupo propio (POSIX) y apagado seguro
    SIGTERM → gracia → SIGKILL.
  - `ProcessRegistry` persistente para procesos en background.
  - `EnvManager` para leer/escribir/borrar variables de `.env` preservando comentarios.
  - Detección de package manager (npm/pnpm/yarn/bun) vía lockfiles y campo `packageManager`.
  - `MemoryLogger` / `ConsoleLogger`, utilidades (`slugify`, `findFreePort`, `shortUid`).
- `@nodedesk/templates` 0.1.0 — `TemplateManager` con registro extensible y templates
  públicas mínimas (node mínimo, Express, Fastify, Hono).
- `@nodedesk/plugins` 0.1.0 — contrato de plugins (`NodeDeskPlugin`, `PluginContext`)
  y `PluginManager` con aislamiento de errores y ciclo de vida.
- `@nodedesk/cli` 0.1.0 — binario `nodedesk` con comandos `projects`, `create`,
  `start`, `stop`, `logs`, `env`, `version` y `doctor`.
- Ejemplos ejecutables bajo `examples/`.
- Documentación de arquitectura completa bajo `architecture/`.

[0.1.0]: https://github.com/marrionesa/nodedesk/compare/v0.0.0...v0.1.0
