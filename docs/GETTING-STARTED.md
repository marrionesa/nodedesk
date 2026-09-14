# Cómo empezar con el ecosistema NodeDesk

## Requisitos

- Node.js >= 18 (recomendado 20+).
- pnpm 9 (`npm install -g pnpm` si no lo tienes).

## Clonar y arrancar el monorepo

```bash
git clone <repo-del-ecosistema> ecosystem
cd ecosystem
pnpm install     # instala los 4 paquetes + ejemplos (workspace)
pnpm build       # compila todos los dist/
pnpm test        # 193 tests
pnpm typecheck   # verificación estricta de tipos
```

## Tu primer programa con core

```ts
import { ProjectManager } from "@nodedesk/core";

// ¿Es esto un proyecto Node?
const valido = await ProjectManager.isValid("./mi-carpeta");

// Cárgalo y examínalo
const project = await ProjectManager.load("./mi-carpeta");
console.log(project.name, project.scripts, project.packageManager.id);

// Descubre todo un workspace
const projects = await ProjectManager.discover("~/code", { depth: 4 });
```

## Arrancar y parar procesos

```ts
import { ProcessManager } from "@nodedesk/core";

const manager = new ProcessManager("./mi-proyecto");

manager.on("stdout", (line) => process.stdout.write(`${line}\n`));
manager.on("log", ({ level }) => { /* info | warn | error | system */ });

const info = await manager.start({ script: "dev" }); // → { pid, status, ... }
console.log("PID:", info.pid);

// El Ctrl+C de tu app:
process.on("SIGINT", () => {
  manager.stop().then(() => process.exit(0));
});

await manager.wait(); // se resuelve cuando el proceso muere
```

Cada proceso corre en su **propio grupo/sesión**: pararlo nunca afecta a tu
app. El apagado es `SIGTERM` al grupo completo → 2 s de gracia → `SIGKILL`.

## Editar el `.env` sin destrozarlo

```ts
import { EnvManager } from "@nodedesk/core";

const env = new EnvManager("./mi-proyecto");
await env.set("PORT", "3000");     // crea o actualiza
await env.set("DEBUG", "verbose"); // y persiste
const all = await env.all();       // { PORT: "3000", ... }
await env.delete("DEBUG");
```

Los comentarios y el orden del fichero se mantienen.

## Crear un proyecto desde una template

```ts
import { TemplateManager } from "@nodedesk/templates";

const result = await TemplateManager.create("minimal-node", {
  name: "Mi Demo",
  directory: "./mi-demo"
});
console.log(result.files, result.port, result.nextSteps);
```

## Extender el ecosistema con un plugin

```ts
import { PluginManager } from "@nodedesk/plugins";

const manager = new PluginManager();
manager.register({
  name: "mi-plugin",
  version: "0.1.0",
  async activate(context) {
    context.logger.info("¡Hola desde mi plugin!");
  }
});
await manager.activate("mi-plugin");
```

## La CLI

```bash
node packages/cli/dist/bin.js --help      # o npm i -g @nodedesk/cli (cuando se publique)
nodedesk projects .
nodedesk create mi-api -t express-api
nodedesk start mi-api --detached
nodedesk logs mi-api -f
nodedesk stop mi-api
```

## Siguientes pasos

- [`architecture/OVERVIEW.md`](../architecture/OVERVIEW.md) — el mapa completo.
- Los 5 [`examples/`](../examples/) son ejecutables y comentados.
