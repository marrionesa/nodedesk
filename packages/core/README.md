# @nodedesk/core

> Node.js project management engine behind NodeDesk.

`@nodedesk/core` es el corazón técnico del ecosistema NodeDesk: un motor
independiente de React, Tauri y de cualquier interfaz gráfica para descubrir
proyectos Node.js, gestionar sus variables de entorno y controlar el ciclo de
vida de sus procesos.

## Instalación

```bash
pnpm add @nodedesk/core
# o
npm install @nodedesk/core
```

Requiere Node.js >= 18.

## Uso rápido

### Cargar y descubrir proyectos

```ts
import { ProjectManager } from "@nodedesk/core";

const project = await ProjectManager.load("./my-project");
console.log(project.name);            // de package.json
console.log(project.scripts);          // { dev: "...", start: "..." }
console.log(project.packageManager.id); // "pnpm" | "npm" | ...

const projects = await ProjectManager.discover("./mis-proyectos");
```

### Gestión de procesos

```ts
import { ProcessManager } from "@nodedesk/core";

const manager = new ProcessManager("./my-project");

manager.on("stdout", (line) => console.log(line));
manager.on("stderr", (line) => console.error(line));

const info = await manager.start({ script: "dev" }); // npm/pnpm/yarn/bun run dev
console.log(info.pid);

await manager.stop();   // SIGTERM al grupo completo → gracia → SIGKILL
await manager.restart();
```

Cada proceso arranca en su propio grupo/sesión (POSIX), de modo que el
apagado nunca afecta al proceso padre. `stop()` envía `SIGTERM` al grupo
completo, espera un periodo de gracia y aplica `SIGKILL` solo si es
necesario.

### Variables de entorno (.env)

```ts
import { EnvManager } from "@nodedesk/core";

const env = new EnvManager("./my-project");

await env.set("PORT", "3000");
await env.set("DEBUG", "verbose");

const port = await env.get("PORT");     // "3000"
const all = await env.all();            // { PORT: "3000", DEBUG: "verbose" }

await env.delete("DEBUG");
```

Los comentarios y el orden del `.env` se preservan al escribir.

### Logging

```ts
import { MemoryLogger } from "@nodedesk/core";

const logger = new MemoryLogger(300); // buffer circular
logger.pushProcessLine("Server ready", "stdout");
logger.entries(); // LogEntry[]
```

### Detección de package manager

```ts
import { detectPackageManager } from "@nodedesk/core";

const pm = await detectPackageManager("./my-project");
// { id: "pnpm", name: "pnpm", lockFile: "pnpm-lock.yaml", detected: "lockfile" }
```

## API principal

| Exportación | Descripción |
| --- | --- |
| `ProjectManager` | `load()` / `discover()` / `isValid()` |
| `NodeProject` | metadatos, `createEnvManager()`, `createProcessManager()` |
| `ProcessManager` | `start()` / `stop()` / `restart()` / `wait()` + eventos |
| `ProcessRegistry` | registro persistente de procesos en background |
| `EnvManager` | `get/set/delete/all/has/keys` sobre `.env` |
| `detectPackageManager` | npm/pnpm/yarn/bun vía lockfiles o `packageManager` |
| `MemoryLogger` / `ConsoleLogger` / `CompositeLogger` | logging |
| `slugify`, `findFreePort`, `shortUid`, `hashId`, `nowIso` | utilidades |
| `parseEnv` / `serializeEnv` | parser/serializador de `.env` |
| `classifyLine` | clasificación de logs (info/warn/error/system) |
| `terminateProcessGroup` | apagado seguro de grupos de procesos |

## Desarrollo

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

## Licencia

MIT License.
