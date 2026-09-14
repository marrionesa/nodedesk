# @nodedesk/plugins

> Sistema de plugins y contratos de extensión del ecosistema NodeDesk.

`@nodedesk/plugins` define el contrato público con el que cualquier
componente (CLI, escritorio, terceros) puede extender NodeDesk sin tocar
`@nodedesk/core`: un `PluginManager` que orquesta el ciclo de vida, un
`PluginContext` inyectable con toda la infraestructura del host, un bus de
eventos tipado y un registro de servicios compartido.

## Instalación

```bash
pnpm add @nodedesk/plugins
# o
npm install @nodedesk/plugins
```

Requiere Node.js >= 18. El paquete es ESM (`"type": "module"`).

## Un plugin completo

Un plugin es un objeto plano que implementa `NodeDeskPlugin`. En `activate`
recibe un `PluginContext` con todo lo que el host pone a su disposición; en
`deactivate` (que **no** recibe argumentos) limpia sus recursos capturando
en un cierre lo que registró durante la activación:

```ts
import type { NodeDeskPlugin } from "@nodedesk/plugins";

interface StatService {
  projectsTracked(): number;
}

// Estado de limpieza del plugin (su `deactivate` no recibe argumentos,
// así que captura en un cierre lo que haya que deshacer).
let teardown: (() => void) | undefined;

export const statsPlugin: NodeDeskPlugin = {
  name: "stats",
  version: "1.0.0",
  description: "Cuenta los proyectos conocidos y expone un servicio.",

  async activate(context) {
    // 1. Estado local del plugin.
    const roots = new Set<string>();

    // 2. Usa las clases de @nodedesk/core inyectadas en el contexto.
    const projects = await context.core.ProjectManager.discover("./projects");
    for (const project of projects) roots.add(project.root);

    // 3. Escucha eventos del host (y guarda la función de baja).
    const offLog = context.events.on("log", (entry) => {
      context.logger.debug?.(`[stats] (${entry.level}) ${entry.message}`);
    });

    // 4. Publica un servicio para otros plugins o para el host.
    context.services.register<StatService>("stats", {
      projectsTracked: () => roots.size
    });

    context.logger.info(`[stats] ${roots.size} proyectos en seguimiento`);

    // 5. Guarda la limpieza para `deactivate`.
    teardown = () => {
      context.services.unregister("stats");
      offLog();
    };
  },

  deactivate() {
    teardown?.();
    teardown = undefined;
  }
};
```

> `activate` puede ser `async` o devolver una promesa; el manager la espera.

## Uso del PluginManager

```ts
import { ConsoleLogger } from "@nodedesk/core";
import {
  builtinPlugins,
  createEventBus,
  PluginActivationError,
  PluginManager
} from "@nodedesk/plugins";

// El host crea la infraestructura que comparte con los plugins y se
// queda su referencia para espiarla o emitir sus propios eventos.
const events = createEventBus();
events.on("plugin:error", ({ name, error }) => {
  console.error(`el plugin "${name}" falló:`, error.message);
});

const manager = new PluginManager({
  logger: new ConsoleLogger("[nodedesk]"), // opcional (default: silencioso)
  events                                  // opcional (default: un bus nuevo)
});

// Registro (los plugins integrados son opcionales).
for (const plugin of builtinPlugins) manager.register(plugin);
manager.register(statsPlugin);

// Activación masiva con aislamiento de errores: un plugin roto
// no impide que el resto arranque.
await manager.activateAll();

// El estado siempre está disponible.
console.log(manager.list());
// [{ name: "hello", version: "0.1.0", status: "active" }, ...]
console.log(manager.activeCount);

// Activación individual: los fallos se relanzan envueltos.
try {
  await manager.activate("stats");
} catch (error) {
  if (error instanceof PluginActivationError) {
    console.error(error.pluginName, error.code); // "stats" "ND_PLUGIN_ACTIVATION"
  }
}

// Ciclo de apagado (best-effort: nunca lanza).
await manager.deactivateAll();
```

## El `PluginContext`

| Propiedad       | Tipo                              | Descripción                                                                       |
| --------------- | --------------------------------- | --------------------------------------------------------------------------------- |
| `apiVersion`    | `string`                          | Versión del contrato de plugins (`PLUGIN_API_VERSION`) que está usando el host.    |
| `pluginName`    | `string`                          | Nombre del plugin destinatario del contexto.                                       |
| `logger`        | `LoggerLike`                      | Logger del host (compartido por todos los plugins).                               |
| `events`        | `EventBus`                       | Bus de eventos tipado (`plugin:*`, `log`), con `on`/`off`/`emit`.                   |
| `services`      | `ServiceRegistry`                 | Registro de servicios compartido: `register`/`get`/`has`/`unregister`/`list`.       |
| `core`          | `{ ProjectManager, ProcessManager, EnvManager }` | Clases reales de `@nodedesk/core`, inyectadas explícitamente para facilitar pruebas. |

Eventos del bus (`HostEventMap`):

| Evento               | Payload                              | Cuándo                                          |
| -------------------- | ------------------------------------ | ----------------------------------------------- |
| `plugin:activated`   | `{ name }`                           | Un plugin terminó de activarse con éxito.       |
| `plugin:deactivated`  | `{ name }`                           | Un plugin se desactivó limpiamente.            |
| `plugin:error`        | `{ name, error }`                   | Activación o desactivación fallidas.           |
| `log`                 | `{ level, message }`                | Mensajes de log difundidos por el host.         |

## Diseño

- **Aislamiento de errores.** La activación de un plugin es "atómica" para
  el resto del sistema: si `activate()` lanza, el manager marca el plugin
  como `"error"` (con `lastError`), emite `plugin:error` y relanza un
  `PluginActivationError` (`ND_PLUGIN_ACTIVATION`, extiende `NodeDeskError`
  de core). `activateAll()` nunca se detiene por un fallo, y `deactivate` /
  `deactivateAll` son best-effort: nunca propagan excepciones.
- **Inyección de dependencias.** Todo el contexto (logger, bus, registro de
  servicios e incluso las clases de core) es inyectable en
  `createPluginContext` y en el constructor de `PluginManager`. Los defaults
  son silenciosos y seguros (`NoopLogger`, buses y registros nuevos), y el
  `core` se inyecta como valores de clase para que las pruebas puedan
  sustituirlos sin tocar módulos.
- **Versión de contrato.** `PLUGIN_API_VERSION` viaja en cada contexto para
  que un plugin pueda comprobar compatibilidad en tiempo de ejecución. Un
  cambio en `NodeDeskPlugin`/`PluginContext` exige bump de la versión.
- **Ciclo de vida observable.** `PluginInfo.status` (`registered` →
  `active` → `deactivated`, con `error` como estado de fallo) más los
  eventos del bus dan una visión completa del estado sin acoplar al
  consumidor a las interioridades del manager.
- **Sin acoplamiento con core.** El paquete solo depende de la API pública
  estable de `@nodedesk/core`; los plugins futuros previstos (docker, git,
  database, tunnels) se construirán sobre este contrato sin modificar core.

## Plugins integrados

- **`hello`** (`builtinPlugins`): plugin de demostración. Registra un
  servicio `hello` con `greet(): string`, escucha los eventos `log` del bus
  y muestra el patrón completo de activación/limpieza.

## Desarrollo

```bash
cd packages/plugins

pnpm build      # compila a dist/ (tsc, ESM NodeNext + .d.ts)
pnpm typecheck  # TypeScript strict sin emitir
pnpm test        # suite de vitest
pnpm test:watch  # vitest en modo watch
pnpm clean       # borra dist/
```

Convenciones del monorepo: ESM con `moduleResolution: NodeNext` (los imports
relativos llevan extensión `.js`), TypeScript `strict` sin `any`,
`verbatimModuleSyntax` (tipos con `import type`) y documentación en español.

## Licencia

MIT — ver [LICENSE](./LICENSE).
