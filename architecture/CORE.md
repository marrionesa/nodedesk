# @nodedesk/core — Diseño del motor

> "Node.js project management engine behind NodeDesk."
> Prioridad máxima del ecosistema: una API pequeña y excelente antes que una
> enorme y mal diseñada.

## Mapa de módulos

```
packages/core/src/
├── types/            # contrato público (project, process, env, utils)
├── errors.ts         # jerarquía NodeDeskError (códigos ND_*)
├── project/
│   ├── project-manager.ts   # load / discover / isValid
│   ├── node-project.ts      # proyecto cargado + gestores
│   ├── package-json.ts      # lectura tolerante de package.json
│   └── package-manager.ts   # detección npm/pnpm/yarn/bun
├── env/
│   ├── env-manager.ts       # CRUD de .env + buildEnvironment
│   └── dotenv.ts            # parse/serialize con comentarios
├── process/
│   ├── process-manager.ts   # ciclo de vida + eventos
│   ├── process-registry.ts  # registro persistente de background
│   ├── kill.ts              # apagado seguro por grupo
│   └── classify.ts          # clasificación de líneas de log
├── logging/
│   └── logger.ts            # MemoryLogger / ConsoleLogger / Composite
├── utils/
│   ├── slugify.ts           # port del slugify de V1
│   ├── ports.ts             # findFreePort / leaseFreePort
│   └── id.ts                # shortUid / hashId / nowIso / sleep
└── index.ts          # API pública (todo lo demás es interno)
```

`index.ts` es la frontera: lo que no se exporta desde ahí es interno y puede
cambiar sin aviso.

## API esencial

```ts
import {
  ProjectManager, ProcessManager, EnvManager,
  ProcessRegistry, MemoryLogger,
  detectPackageManager, slugify, findFreePort
} from "@nodedesk/core";

// Proyectos
const project = await ProjectManager.load("./my-project");
const projects = await ProjectManager.discover("./workspaces", { depth: 3 });

// Procesos
const manager = new ProcessManager("./my-project");
manager.on("stdout" | "stderr" | "log" | "start" | "exit" | "status" | "error", ...);
await manager.start({ script: "dev", detached: true, logFile, registry: true });
await manager.stop();          // SIGTERM → gracia → SIGKILL
await manager.wait();          // { code, signal }

// Entorno
const env = new EnvManager("./my-project");
await env.get("PORT"); await env.set("PORT", "3000"); await env.all();
```

## Decisiones de diseño

### 1. Sin dependencias runtime (solo `node:*`)
Core es el corazón del ecosistema: cero deps externas significa cero riesgos
de suministro, auditoría trivial y control total del tamaño. La CLI es la
única pieza con una dependencia (`commander`).

### 2. ESM puro, NodeNext
`"type": "module"` + imports relativos con extensión `.js`. Node >= 18 es la
línea base. El dual CJS/ESM queda en el roadmap: se prefiere un runtime
impecable en 0.1.0 a una matriz de módulos duplicada.

### 3. `ProjectManager.discover()` — búsqueda en anchura con corte
- Ignora por defecto `node_modules`, `.git`, `dist`, `build`, `out`,
  `coverage`, `.cache`, `.next`, `.turbo`, `.pnpm-store` y directorios
  ocultos.
- `stopAtProject: true` (default): al encontrar un proyecto no desciende
  dentro (evita ruido de subproyectos); configurable.
- `depth: 3` por defecto, ajustable a 0 (solo el propio directorio).

### 4. `ProcessManager` — procesos en grupo propio
Port fiel de la semántica de V1 (`process.rs`) a Node:

- `spawn(command, { shell: true, detached: true })` → el hijo es **líder de
  grupo y sesión propios** (`setsid` en POSIX): el apagado nunca alcanza al
  proceso padre.
- Eventos: `stdout`/`stderr` (línea cruda), `log` (`LogEntry` clasificado
  con `classifyLine`: system/error/warn/info), `start`, `exit`, `status`,
  `error`.
- `stop()` → `terminateProcessGroup(pid)`: SIGTERM al grupo **y** al pid
  directo, espera el periodo de gracia (default 2 s) comprobando la muerte
  del líder cada 100 ms, y solo entonces SIGKILL.
- Resolución del comando (de V1 `read_dev_command`): `command` explícito →
  script indicado → `dev` → `start` → `node <main>` → error.
- `autoInstall: true` instala dependencias con el package manager detectado
  si falta `node_modules/`.
- `detached: true` + `logFile` + `registry`: modo background — stdio a
  fichero, `unref()`, anotación en `ProcessRegistry`
  (`~/.nodedesk-v2/processes.json`) para poder pararlo/leerlo después desde
  otro proceso.

### 5. Guardas de apagado (invariante de seguridad de V1)
`kill.ts` replica las protecciones anti-"masacre" de V1 (el bug histórico que
cerraba sesiones del SO):

- Nunca señalar pid ≤ 1 ni el pid propio (`isKillableTarget`).
- En Linux, verificar en `/proc/<pid>/stat` que `pgid == pid` antes de
  señalar el grupo (si el pid murió o fue reciclado, no se señala nada).
- Señales siempre vía syscall (`process.kill`), nunca binarios externos
  del PATH.

### 6. `EnvManager` — `.env` sin destrucción
Mejoras sobre `env.rs` de V1:

- **Preserva comentarios y orden** en cada `set`/`delete` (V1 reescribía el
  fichero plano desde el estado del editor).
- Soporta comillas simples y dobles, `export KEY=...`, y entrecomilla al
  serializar valores con `#` o espacios al borde.
- `autosave` (default true) o persistencia manual con `save()`.
- `buildEnvironment(overrides)`: `process.env` + `.env` (gana el fichero) +
  overrides (ganan sobre todo) — la misma precedencia que V1 usaba al
  lanzar procesos.
- Una línea en blanco desvincula el comentario del bloque siguiente
  (documentado y testeado).

### 7. `ProcessRegistry` — memoria entre invocaciones
JSON en `~/.nodedesk-v2/processes.json` (separado de `~/.nodedesk/` de V1
para no interferir con el Desktop instalado): pid, root, command, startedAt,
logFile. `prune()` hace expiración perezosa de pids muertos (misma técnica
que los túneles de V1).

### 8. Detección de package manager (determinista)
1. Lockfile en la raíz (`pnpm-lock.yaml`, `yarn.lock`, `bun.lockb|bun.lock`,
   `package-lock.json`).
2. Campo estándar `packageManager` de `package.json` (corepack).
3. Default `npm`.

Generaliza la heurística de V1 ("¿hay bun? úsalo") usando el gestor que el
proyecto realmente usa.

## Testing

69 tests (6 suites) cubriendo: carga válida/inválida de proyectos, discovery
(con depth/ignores/stopAtProject), detección de package manager (7 casos),
parse/serialize de `.env` + CRUD completo + precedencia de entorno, ciclo de
vida de procesos **reales** (stdout/stderr, exit codes, SIGTERM limpio con
handler, apagado de procesos largos, doble start, restart, detached con
registro y log en disco), registro persistente, logging (capacidad 300) y
utilidades (slugify, puertos, ids).

## Límites deliberados (0.1.0)

- Sin gestión de "proyectos registrados" permanente (el inventario es cosa
  del consumidor: Desktop o CLI con su propio registro).
- Sin resolución de versiones de Node (fnm/volta) — candidata a plugin.
- Sin soporte Windows verificado en CI (el código está preparado con
  ramas, pero no hay runners).
- Sin dual CJS.
