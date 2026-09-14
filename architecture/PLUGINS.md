# @nodedesk/plugins — Diseño

> Sistema de extensiones del ecosistema. Tercer paquete: su valor no son
> los plugins que incluye (uno de demostración), sino el **contrato limpio**
> sobre el que construir los futuros (Docker, Git, Database, Tunnels…).

## Filosofía

1. **Primero el contrato**: una interfaz pequeña y sólida antes que
   funcionalidad rellena (especificación §9: "no implementar funcionalidades
   complejas solo por rellenar").
2. **Aislamiento**: el fallo de un plugin nunca tira al host ni a los demás.
3. **DI explícita**: el contexto inyectable hace los plugins testeables sin
   tocar el sistema de ficheros.
4. **Core puro**: `@nodedesk/plugins` depende de `@nodedesk/core` solo para
   tipos y utilidades — el contrato no obliga a que los hosts usen todo core.

## Contrato

```ts
export interface NodeDeskPlugin {
  name: string;
  version: string;
  description?: string;
  activate(context: PluginContext): void | Promise<void>;
  deactivate?(): void | Promise<void>;
}

export interface PluginContext {
  apiVersion: string;      // "0.1.0" — versión del contrato
  pluginName: string;
  logger: LoggerLike;      // logger del host
  events: EventBus;        // bus tipado del host
  services: ServiceRegistry; // capacidades compartidas
  core: {                  // DI de las clases de core
    ProjectManager: typeof ProjectManager;
    ProcessManager: typeof ProcessManager;
    EnvManager: typeof EnvManager;
  };
}
```

La especificación proponía `PluginContext { projects, processes, logger }`.
El diseño final mantiene la intención y la mejora:

- `core` entrega las **clases** por inyección en vez de como campos
  estáticos, para que los hosts y los tests puedan sustituirlas.
- Se añade `events` y `services` (patrón probado de extensiones) que dan a
  los plugins una vía de comunicación sin acoplarse entre sí.

## EventBus y ServiceRegistry

- **EventBus** tipado sobre `HostEventMap`:
  `plugin:activated`, `plugin:deactivated`, `plugin:error`, `log`.
  `on()` devuelve su propio desuscriptor.
- **ServiceRegistry**: `register/get/has/unregister/list` con rechazo de
  duplicados. Un plugin publica capacidades ("git", "docker", "math") y
  otros las consumen sin importarse mutuamente.

## PluginManager — ciclo de vida y aislamiento

```
register() ──► "registered"
   │ activate()
   ├─► ok ───► "active"            (emite plugin:activated)
   └─► fallo ► "error" + lastError (emite plugin:error, relanza PluginActivationError)
                  │ activate() de nuevo permitido
deactivate() ──► "deactivated"      (emite plugin:deactivated)
   · deactivate() que lanza → status "error", NO propaga
activateAll() — aislamiento total: un fallo no detiene los siguientes
```

- `activate(name)` **relanza** (`PluginActivationError` con la causa
  original): quien pide activar un plugin concreto merece saber que falló.
- `activateAll()` nunca lanza: procesa todo y deja los fallos en
  `status: "error"` / `lastError` — consultables con `list()`.
- `unregister()` de un plugin activo lo desactiva primero.

## Plugin incluido: `hello`

Plugin de demostración y plantilla de referencia:

- `activate`: registra el servicio `hello` (con `greet()`), escucha el bus
  de eventos y loguea con el logger inyectado.
- `deactivate`: retira el servicio y se despide.

Es el ejemplo vivo de las tres vías de integración: logger, services y
events.

## Plugins futuros previstos (NO implementados a propósito)

| Plugin candidato | Qué encapsularía |
| --- | --- |
| `@nodedesk/git-plugin` | estado de repos, ramas, diffs — sobre `services`. |
| `@nodedesk/docker-plugin` | detección de contenedores/compose por proyecto. |
| `@nodedesk/database-plugin` | detección de ORM/migraciones. |
| `@nodedesk/tunnel-plugin` | el túnel cloudflared de V1 (infra propietaria: se decide aparte). |

Ninguno exige cambios en core ni en el contrato actual.

## Testing

63 tests (5 suites): ciclo de vida completo con eventos espiados, registro
duplicado, aislamiento en `activateAll` (bueno+malo+bueno), semántica de
errores en activate/deactivate, reactivación tras error, ServiceRegistry,
EventBus (on/off/desuscriptor), contexto con DI, y el plugin `hello` de
punta a punta.
