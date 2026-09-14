# @nodedesk/cli

[![npm](https://img.shields.io/badge/npm-@nodedesk/cli-blue)](https://www.npmjs.com/package/@nodedesk/cli)
[![licencia](https://img.shields.io/badge/licencia-MIT-green)](./LICENSE)
[![node](https://img.shields.io/badge/node-%3E%3D18-green)](./package.json)

**Interfaz de terminal del ecosistema NodeDesk.** Descubre proyectos Node.js,
crea proyectos desde templates, arranca y detiene procesos (attached o en
background con logs), y gestiona las variables `.env` — todo desde la línea
de comandos y en español.

Es una capa fina y sin lógica duplicada sobre los paquetes del ecosistema:
[`@nodedesk/core`](../core) (proyectos, procesos, registro, `.env`) y
[`@nodedesk/templates`](../templates) (catálogo y scaffolding).

## Instalación

Cuando el ecosistema se publique en npm:

```bash
npm i -g @nodedesk/cli
```

Durante el desarrollo, desde el monorepo:

```bash
pnpm --filter @nodedesk/cli build
pnpm link --global   # deja el binario `nodedesk` en el PATH
```

Requiere **Node.js ≥ 18**.

## Comandos

| Comando | Descripción | Opciones |
| --- | --- | --- |
| `nodedesk projects [dir]` | Descubre proyectos Node.js (BFS con `package.json`) | `--json`, `--depth <n>` (3) |
| `nodedesk create <name>` | Crea un proyecto desde una template en `<dir>/<slug>` | `-t, --template <id>` (`minimal-node`), `-d, --dir <directorio>`, `--force`, `--json` |
| `nodedesk start <path>` | Arranca el proceso del proyecto (`dev` → `start` → `main`) | `-s, --script <script>`, `--install`, `--detached`, `--port <n>`, `--json` |
| `nodedesk stop [path]` | Detiene un proceso en background | `--all` |
| `nodedesk logs <path>` | Últimas líneas del log de un proceso en background | `--lines <n>` (50), `-f, --follow` |
| `nodedesk env list <path>` | Lista las variables del `.env` (secretos enmascarados) | `--json`, `--raw` |
| `nodedesk env get <path> KEY` | Imprime el valor pelado (para scripts) | — |
| `nodedesk env set <path> KEY VALUE` | Fija una variable y persiste el `.env` | — |
| `nodedesk env delete <path> KEY` | Elimina una variable del `.env` | — |
| `nodedesk doctor` | Diagnóstico del entorno (node, package managers, registro) | `--json` |
| `nodedesk version` | Versiones del CLI y del resto del ecosistema | `--json` |
| `nodedesk templates [id]` | Catálogo de templates (detalle completo con `id`) | `--json` |

Opciones globales: `--no-color` (o la variable `NO_COLOR`) desactiva los
colores ANSI; `-h, --help` muestra la ayuda de cada comando.

## Ejemplos de sesión

### Descubrir proyectos

```console
$ nodedesk projects ./packages

NOMBRE               PACKAGE MANAGER  SCRIPTS                                DEPS  RUTA
───────────────────  ───────────────  ─────────────────────────────────────  ────  ────────────
@nodedesk/cli        npm              build,typecheck,test,test:watch,clean  6     .
@nodedesk/core       npm              build,typecheck,test,test:watch,clean  3     ../core
@nodedesk/plugins    npm              build,typecheck,test,test:watch,clean  4     ../plugins
@nodedesk/templates  npm              build,typecheck,test,test:watch,clean  4     ../templates

4 proyecto(s) encontrado(s)
```

### Crear un proyecto

```console
$ nodedesk create blog-api -t express-api

✓ proyecto "blog-api" creado desde la template express-api

  directorio  /proyectos/blog-api (5 ficheros)
  puerto      3013

ficheros:
  - blog-api/package.json
  - blog-api/src/server.mjs
  - blog-api/.gitignore
  - blog-api/README.md
  - blog-api/.env

variables .env:
  PORT=3013  # Puerto del servidor
  GREETING=hola desde NodeDesk  # Saludo de la API

siguientes pasos:
  1. cd /proyectos/blog-api
  2. npm install
  3. npm run dev
```

### Arrancar en primer plano (Ctrl+C para parar)

```console
$ nodedesk start ./blog-api

╭──────────────────────────────╮
│ ▶ nodedesk start             │
│ proyecto   blog-api          │
│ comando    npm run dev       │
│ pid        8033              │
│ ruta       ./blog-api        │
│                              │
│ Ctrl+C para detener          │
╰──────────────────────────────╯

> blog-api@0.1.0 dev
> node --watch src/server.mjs

blog-api escuchando en http://localhost:3013
^C
↯ interrupción recibida, apagando…
[nodedesk] apagando (SIGTERM al grupo 8033)…
[nodedesk] proceso terminado

proceso terminado por señal SIGTERM
```

La salida se re-emite línea a línea coloreada por clasificación: los errores
en rojo, los avisos en amarillo y las líneas del sistema en cian atenuado.
Al pulsar Ctrl+C el CLI apaga el **grupo completo** del proceso (SIGTERM →
gracia → SIGKILL, igual que NodeDesk V1) y propaga el código de salida del
hijo: si el proceso muere solo con exit 3, el CLI termina con exit 3.

### Arrancar en background

Si el proyecto todavía no tiene `node_modules`, se puede pedir la instalación
explícitamente antes de arrancar:

```console
$ nodedesk start ./blog-api --install
$ nodedesk start ./blog-api --install --detached
```

Sin `--install`, `start` no instala dependencias automáticamente.

```console
$ nodedesk start ./blog-api --detached

✓ proceso arrancado en background (pid 8146)
  comando   npm run dev
  logs      /home/usuario/.nodedesk-v2/logs/blog-api.log
  parar     nodedesk stop ./blog-api

$ nodedesk logs ./blog-api --lines 5

> blog-api@0.1.0 dev
> node --watch src/server.mjs

blog-api escuchando en http://localhost:3013

$ nodedesk stop ./blog-api

✓ proceso detenido (pid 8146)
  comando   npm run dev
  proyecto  /proyectos/blog-api
```

### Gestionar el `.env`

```console
$ nodedesk env set ./blog-api API_TOKEN s3cr3t-xyz
✓ API_TOKEN=**** guardada en /proyectos/blog-api/.env

$ nodedesk env list ./blog-api

KEY        VALUE
─────────  ───────────────
PORT       3013
API_TOKEN  ****
GREETING   hola desde NodeDesk

$ nodedesk env get ./blog-api PORT
3013
```

Las claves que contienen `SECRET`, `TOKEN`, `KEY` o `PASSWORD` se muestran
enmascaradas (`****`); usa `--raw` para verlas o `--json` para consumirlas
desde scripts.

### Diagnosticar el entorno

```console
$ nodedesk doctor

diagnóstico de nodedesk

CHECK                   ESTADO  DETALLE
──────────────────────  ──────  ───────────────────────────────
Node.js                 ✅      v22.11.0 (≥ 18)
npm                     ✅      10.9.0
pnpm                    ✅      9.15.9
yarn                    ⚠️      no disponible en el PATH
bun                     ✅      1.1.34
~/.nodedesk-v2          ✅      /home/usuario/.nodedesk-v2 (existe y es escribible)
Procesos en background  ✅      1 vivo(s)
Templates               ✅      4 disponibles
```

## Diseño

- **Capa fina, cero lógica duplicada.** Cada comando delega en las APIs
  públicas de `@nodedesk/core` (`ProjectManager`, `ProcessManager`,
  `ProcessRegistry`, `EnvManager`, `terminateProcessGroup`) y
  `@nodedesk/templates` (`TemplateManager`). La CLI solo parsea argumentos,
  formatea la salida y traduce códigos de salida.
- **Comandos puros y programables.** `src/commands/*.ts` exporta funciones
  `async (…): Promise<number>` sin tocar `process.exit`; `run(argv)` (en
  `src/index.ts`) monta commander, captura los errores top-level (mensaje en
  rojo + exit 1) y devuelve el código. `src/bin.ts` es mínimo.
- **Salida dual.** Toda salida `--json` se escribe sin colores para ser
  consumible por pipes; la salida humana usa colores ANSI propios
  (`src/ui.ts`, sin dependencias) que respetan `NO_COLOR` y `--no-color`, con
  tablas cuyo cálculo de ancho ignora los códigos de escape.
- **Seguridad de procesos heredada de V1.** El apagado nunca señala pid ≤ 1
  ni al propio CLI, verifica el grupo en `/proc` y usa SIGTERM → gracia →
  SIGKILL (`terminateProcessGroup` de core).
- **Registro compartido.** Los procesos en background viven en
  `~/.nodedesk-v2/processes.json` (logs en `~/.nodedesk-v2/logs/`), la misma
  carpeta que usa el core, para que CLI y futura app de escritorio vean los
  mismos procesos.
- **Versiones reales, no constantes.** `nodedesk version` lee los
  `package.json` de `@nodedesk/core`, `@nodedesk/templates` y
  `@nodedesk/plugins` (resueltos como hermanos del CLI: funciona igual en el
  monorepo y en `node_modules/@nodedesk/*`).

## Desarrollo

```bash
cd packages/cli

pnpm typecheck     # TypeScript strict, sin emitir
pnpm test          # reconstruye dist y lanza vitest (34 tests)
pnpm build         # tsc → dist/ (con .d.ts y sourcemaps)

node dist/bin.js --help   # prueba manual del binario
```

Los tests de integración (`tests/cli.integration.test.ts`) lanzan el binario
construido con `spawn` y verifican códigos de salida y salidas reales,
incluido el apagado limpio por SIGINT y la propagación de códigos de salida;
usan un `HOME` temporal para no tocar el registro del usuario.

## Licencia

MIT — ver [LICENSE](./LICENSE).
