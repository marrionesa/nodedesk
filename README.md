# NodeDesk

NodeDesk es un ecosistema open source para descubrir, crear y gestionar proyectos Node.js desde librerías reutilizables y una CLI.

Proporciona herramientas para inspeccionar proyectos, gestionar procesos, editar variables de entorno, crear proyectos desde templates, extender el sistema con plugins y trabajar con distintos package managers.

## NodeDesk Desktop

NodeDesk Desktop es la aplicación de escritorio distribuida a través de
GitHub Releases.

[Descargar NodeDesk Desktop](https://github.com/marrionesa/nodedesk/releases/latest)

El código fuente de este repositorio corresponde al ecosistema público de
NodeDesk: Core, Templates, Plugins y CLI.

## Características

- **Core**: APIs TypeScript para proyectos, procesos, entorno, logs y utilidades.
- **Templates**: scaffolding reproducible para proyectos Node.js.
- **Plugins**: contratos de extensión con eventos, servicios e inyección de dependencias.
- **CLI**: comandos de terminal para trabajar con proyectos desde un único flujo.
- **Project discovery**: descubrimiento recursivo de proyectos mediante `package.json`.
- **Process management**: arranque, parada, reinicio, espera y grupos de procesos.
- **Environment management**: lectura y escritura de `.env` preservando comentarios y orden.
- **Logs**: eventos de salida clasificados, logging en background y seguimiento de ficheros.
- **Package manager detection**: detección de npm, pnpm, Yarn y Bun mediante lockfiles o `packageManager`.

## Arquitectura

```text
NodeDesk
│
├── @nodedesk/core
├── @nodedesk/templates
├── @nodedesk/plugins
└── @nodedesk/cli
```

- `@nodedesk/core` contiene el motor de proyectos, procesos, entorno, registro y utilidades.
- `@nodedesk/templates` contiene el catálogo de templates y el generador de proyectos.
- `@nodedesk/plugins` define el contrato de plugins y su infraestructura de eventos y servicios.
- `@nodedesk/cli` ofrece el comando `nodedesk` y conecta las APIs públicas en una interfaz de terminal.

## Instalación

Requiere Node.js 18 o superior.

```bash
npm install @nodedesk/core
npm install @nodedesk/templates
npm install @nodedesk/plugins
npm install -g @nodedesk/cli
```

La instalación global de la CLI proporciona el comando `nodedesk`.

## CLI

La CLI trabaja sobre la ruta de un proyecto Node.js y ofrece estos comandos:

```bash
nodedesk projects [directorio]
nodedesk create <nombre>
nodedesk start <ruta>
nodedesk stop [ruta]
nodedesk logs <ruta>
nodedesk env <list|get|set|delete>
nodedesk doctor
nodedesk version
nodedesk templates [id]
```

Ejemplos:

```bash
nodedesk projects .
nodedesk create my-api --template express-api
nodedesk start .
nodedesk start . --install
nodedesk start . --install --detached
nodedesk logs . --lines 50
nodedesk logs . --follow
nodedesk stop .
nodedesk stop --all
nodedesk env list .
nodedesk env get . PORT
nodedesk env set . PORT 3000
nodedesk env delete . DEBUG
nodedesk doctor
nodedesk version --json
nodedesk templates
nodedesk templates express-api
```

Opciones habituales:

- `--json` produce salida estructurada en los comandos que la soportan.
- `--no-color` desactiva los colores ANSI.
- `nodedesk start` usa el script `dev`, después `start` y finalmente `main`.
- `--detached` arranca el proceso en background y conserva sus logs.
- `--install` instala dependencias si falta `node_modules`. La instalación es opt-in y no se ejecuta automáticamente por defecto.
- `--port <n>` establece la variable `PORT` para el proceso.

## Ejemplo rápido

Crear un proyecto Express, instalar sus dependencias y arrancarlo:

```bash
nodedesk create my-api --template express-api
cd my-api
nodedesk start . --install
```

Para dejarlo en background:

```bash
nodedesk start . --install --detached
nodedesk logs . --follow
nodedesk stop .
```

`nodedesk create` genera los archivos del proyecto, pero no instala dependencias automáticamente. `nodedesk start` tampoco instala dependencias salvo que se indique `--install`.

## Core

`@nodedesk/core` expone una API pública tipada desde el entrypoint del paquete y proporciona:

- **`ProjectManager`**: carga proyectos válidos y descubre proyectos dentro de un directorio.
- **`NodeProject`**: expone metadatos, scripts, dependencias, engines, package manager y estado del proyecto.
- **`ProcessManager`**: ejecuta comandos, emite eventos, reinicia procesos, espera su finalización y detiene grupos de procesos.
- **`ProcessRegistry`**: registra procesos en background para que puedan consultarse, mostrar logs y detenerse desde otra invocación.
- **`EnvManager`**: ofrece `get`, `set`, `delete`, `all`, `has`, `keys`, `entries` y `buildEnvironment`.
- **Logging**: `MemoryLogger`, `ConsoleLogger`, `CompositeLogger`, `LogEntry` y clasificación de líneas.
- **Package managers**: `detectPackageManager`, `scriptCommand`, `installCommand` y soporte para npm, pnpm, Yarn y Bun.
- **Utilidades**: `slugify`, `findFreePort`, `leaseFreePort`, `shortUid`, `hashId`, `nowIso` y apagado seguro de grupos.

Ejemplo de gestión de procesos:

```ts
import { ProcessManager } from "@nodedesk/core";

const manager = new ProcessManager("./my-project");
manager.on("log", (entry) => console.log(entry.level, entry.line));

await manager.start({ script: "dev" });
await manager.wait();
```

Para instalar dependencias desde el Core de forma explícita:

```ts
await manager.start({ script: "dev", autoInstall: true });
```

## Templates

`@nodedesk/templates` incluye cuatro templates públicos:

- `minimal-node`: servidor Node.js mínimo sin dependencias.
- `express-api`: API Express.
- `fastify-api`: API Fastify.
- `hono-api`: aplicación Hono para Node.js.

Consultar el catálogo desde la CLI:

```bash
nodedesk templates
nodedesk templates express-api
```

Crear un proyecto desde una template:

```bash
nodedesk create my-api --template express-api
```

También se puede usar `TemplateManager` directamente:

```ts
import { TemplateManager } from "@nodedesk/templates";

const result = await TemplateManager.create("minimal-node", {
  name: "my-api",
  directory: "./my-api"
});

console.log(result.directory, result.files);
```

## Plugins

`@nodedesk/plugins` proporciona un sistema de extensiones basado en contratos públicos:

- **`NodeDeskPlugin`** define `name`, `version`, `activate()` y `deactivate()`.
- **`PluginManager`** registra plugins, activa uno o todos, consulta su estado y los desactiva.
- **`EventBus`** permite escuchar y emitir eventos tipados del host.
- **`ServiceRegistry`** permite publicar y recuperar servicios compartidos.
- **Ciclo de vida**: `registered` → `active` → `deactivated`, con estado `error` cuando falla una operación.
- **Aislamiento e inyección de dependencias**: los errores de activación se encapsulan y el `PluginContext` recibe logger, eventos, servicios y las clases públicas del Core.

Ejemplo mínimo:

```ts
import { PluginManager } from "@nodedesk/plugins";

const manager = new PluginManager();

manager.register({
  name: "hello",
  version: "0.1.0",
  activate(context) {
    context.logger.info("plugin activo");
  },
  deactivate() {
    // Liberar recursos del plugin.
  }
});

await manager.activateAll();
await manager.deactivateAll();
```

## Desarrollo

Desde la raíz del monorepo:

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

Comandos adicionales disponibles:

```bash
pnpm clean
pnpm --filter @nodedesk/example-basic-project-manager start -- --dir packages
pnpm --filter @nodedesk/example-process-manager start
pnpm --filter @nodedesk/example-env-manager start
pnpm --filter @nodedesk/example-template-example start
pnpm --filter @nodedesk/example-plugin-example start
```

## Monorepo

```text
packages/
├── core/       Motor público de proyectos y procesos.
├── templates/  Templates y scaffolding.
├── plugins/    Contratos e infraestructura de plugins.
└── cli/        CLI `nodedesk`.

examples/       Ejemplos ejecutables de las APIs públicas.
docs/           Guías de inicio, contribución y publicación.
```

Cada paquete tiene su propio `package.json`, README, tests y configuración de build. Los paquetes publicables generan `dist` y declaraciones TypeScript mediante ESM NodeNext.

## Compatibilidad

- Node.js: `>=18.0.0`.
- Módulos: ESM.
- TypeScript: configuración strict y NodeNext.
- Package managers soportados por el Core: npm, pnpm, Yarn y Bun.

## Licencia

MIT. Los paquetes públicos de NodeDesk forman parte de un ecosistema open source y pueden utilizarse según los términos incluidos en sus archivos `LICENSE`.

## Contribución

```bash
git clone https://github.com/marrionesa/nodedesk.git
cd ecosystem
pnpm install
pnpm test
pnpm build
pnpm typecheck
```

Para proponer cambios:

1. Crea una rama de trabajo.
2. Añade o actualiza tests para el comportamiento modificado.
3. Ejecuta `pnpm test`, `pnpm build` y `pnpm typecheck`.
4. Actualiza la documentación pública correspondiente.
5. Abre un issue o pull request con el contexto del cambio.

## Roadmap

El roadmap público contempla:

- Publicación inicial y mantenimiento de los paquetes en npm.
- CI multiplataforma para build, tests y typecheck.
- Compatibilidad ESM/CJS para más consumidores.
- `NodeProject.watch()` para recargar metadatos.
- Verificación y soporte completo de `ProcessManager` en Windows.
- Más cobertura para registry, procesos y archivos `.env`.
- Nuevas templates TypeScript.
- Plugins oficiales de referencia.
- Gestión de procesos multi-proyecto desde la CLI.
- Detección de frameworks en metadatos.
- Internacionalización opcional de la CLI.
- Validación de schemas de entorno.
- Estabilización progresiva de las APIs hasta una versión 1.0.

## Links

- **GitHub**: https://github.com/marrionesa/nodedesk
- **npm**:
  - https://www.npmjs.com/package/@nodedesk/core
  - https://www.npmjs.com/package/@nodedesk/templates
  - https://www.npmjs.com/package/@nodedesk/plugins
  - https://www.npmjs.com/package/@nodedesk/cli
- **Issues**: https://github.com/marrionesa/nodedesk/issues
- **Documentation**: https://github.com/marrionesa/nodedesk/tree/main/docs
