# Ejemplo 5 · plugin-example

> Plugins, servicios compartidos y bus de eventos con [`@nodedesk/plugins`](../../packages/plugins/README.md).

## Qué demuestra

- El host construye su infraestructura (bus de eventos + registro de
  servicios) y la **inyecta** en el `PluginManager` para compartirla.
- **Dos plugins custom**:
  - `saludo` — plugin normal: usa el logger del host y escucha eventos `log`
    del bus (con limpieza en `deactivate` mediante clausuras).
  - `math` — expone un **servicio `"math"` con `add(a, b)`** en el registro
    compartido; el host lo consume con `services.get<MathService>("math")`.
- El plugin **builtin `hello`** (de `builtinPlugins`), activado y consumido
  igual que un plugin custom (`hello.greet()`).
- El bus de eventos: `plugin:activated` / `plugin:deactivated` / `plugin:error`
  y un evento `log` emitido por el host al que los plugins hacen eco.
- `manager.list()` con los **estados** (`registered` → `active` →
  `deactivated`) y `deactivateAll()` al final.

## Cómo ejecutarlo

Desde la raíz del monorepo:

```bash
pnpm --filter @nodedesk/example-plugin-example start
```

O entrando en la carpeta:

```bash
cd examples/plugin-example
pnpm start
```

No necesita argumentos.
