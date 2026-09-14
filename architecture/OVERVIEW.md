# Visión general del ecosistema NodeDesk V2

> **NodeDesk Ecosystem** — librerías públicas, reutilizables y publicables para
> gestionar proyectos Node.js. **NodeDesk Desktop es un producto propietario
> separado.**

## De V1 a V2: por qué existe este repositorio

NodeDesk Desktop V1 es una aplicación de escritorio (React + TypeScript +
Tauri 2 + Rust) que gestiona proyectos Node.js: los descubre, arranca sus
dev servers, edita su `.env`, muestra sus logs y crea túneles públicos.

Toda esa lógica vive hoy **acoplada al shell de escritorio**: comandos
`#[tauri::command]`, eventos del event-loop, registro en `~/.nodedesk/`,
diálogos nativos, licenciamiento y bandeja del sistema en el mismo binario.

V2 extrae de esa experiencia un **ecosistema modular**:

```
                     NODEDESK ECOSYSTEM (público)
                              |
           +------------------+------------------+
           |                  |                  |
           v                  v                  v
     @nodedesk/core   @nodedesk/templates  @nodedesk/plugins
           |                  |                  |
           +------------------+------------------+
                              |
                              v
                        @nodedesk/cli
                              |
                              v
              NodeDesk Desktop V2 (futuro, propietario)
```

La filosofía es la de un *framework*: `@nodedesk/core` es un motor
reutilizable; la CLI, los ejemplos y el futuro Desktop son aplicaciones
construidas encima. Ninguno de los paquetes públicos conoce el Desktop.

## Los cuatro paquetes

| Paquete | Rol | Depende de |
| --- | --- | --- |
| `@nodedesk/core` | Motor de gestión de proyectos Node.js: descubrimiento, metadatos, procesos, `.env`, logs, detección de package manager. | — (cero dependencias runtime) |
| `@nodedesk/templates` | Registro extensible de templates y creación (scaffolding) de proyectos. | `core` |
| `@nodedesk/plugins` | Contrato de extensiones (`NodeDeskPlugin`, `PluginContext`) y gestor con aislamiento de errores. | `core` |
| `@nodedesk/cli` | Interfaz de terminal `nodedesk` sobre core y templates. | `core`, `templates` |

Reglas de dependencia (verificadas, sin ciclos):

- `core` **no depende de nada** del ecosistema: ni de `cli`, ni de Desktop,
  ni de React, ni de Tauri.
- `templates` y `plugins` solo dependen de `core`.
- `cli` depende de `core` y `templates` (y es la única pieza con una
  dependencia externa: `commander`).
- `plugins` **no** es dependencia obligatoria de nada: el contrato es
  opcional para quien quiera extender.

## Estructura del repositorio

```
NODEDESK-V2/
├── packages/
│   ├── core/         # motor (types, project, process, env, logging, utils)
│   ├── templates/    # TemplateManager + 4 templates públicas
│   ├── plugins/      # PluginManager + contrato + plugin demo
│   └── cli/          # binario `nodedesk`
├── examples/         # 5 ejemplos ejecutables (workspace)
│   ├── basic-project-manager/
│   ├── process-manager/
│   ├── env-manager/
│   ├── template-example/
│   └── plugin-example/
├── architecture/     # esta documentación
├── docs/             # guías (publicación, primeros pasos, contribución)
├── package.json      # raíz del workspace pnpm
├── pnpm-workspace.yaml
├── CHANGELOG.md
└── LICENSE           # MIT
```

## Decisiones estructurales (resumen)

1. **pnpm workspace** con `packages/*` y `examples/*`, referencias
   `workspace:*` durante desarrollo.
2. **TypeScript strict** en todos los paquetes, `verbatimModuleSyntax`,
   target ES2022.
3. **ESM puro** (`"type": "module"`, `module: NodeNext`, imports relativos
   con extensión `.js`). El soporte dual CJS queda en el roadmap (ver
   `ROADMAP.md`).
4. **Node.js >= 18** como línea base.
5. **Cero dependencias runtime en core** (solo `node:*`): el corazón del
   ecosistema es auditable de un vistazo.
6. Datos de V2 en **`~/.nodedesk-v2/`** para no colisionar con el registro
   `~/.nodedesk/` de V1.
7. Tests con **vitest** en cada paquete (193 tests en total), builds con
   `tsc`, publicación preparada pero **no ejecutada** (ver
   `docs/PUBLISHING.md`).

## Documentación

- `CORE.md` — diseño del motor.
- `TEMPLATES.md` — arquitectura de templates.
- `PLUGINS.md` — contrato de extensiones.
- `CLI.md` — diseño de la interfaz de terminal.
- `ROADMAP.md` — evolución prevista del ecosistema público.
- `docs/GETTING-STARTED.md` — primeros pasos.
- `docs/CONTRIBUTING.md` — guía de contribución.
- `docs/PUBLISHING.md` — publicación de paquetes.

## Comandos

```bash
pnpm install      # dependencias del workspace
pnpm build        # build de todos los paquetes
pnpm test         # 193 tests
pnpm typecheck    # comprobación estricta de tipos
pnpm clean        # limpiar dist/

# ejemplos
pnpm --filter @nodedesk/example-basic-project-manager start
pnpm --filter @nodedesk/example-process-manager start
pnpm --filter @nodedesk/example-env-manager start
pnpm --filter @nodedesk/example-template-example start
pnpm --filter @nodedesk/example-plugin-example start

# CLI real (tras build)
node packages/cli/dist/bin.js --help
node packages/cli/dist/bin.js doctor
```
