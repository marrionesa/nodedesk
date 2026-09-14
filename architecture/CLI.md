# @nodedesk/cli — Diseño

> Interfaz de terminal del ecosistema. Cuarto paquete: una capa fina sobre
> `@nodedesk/core` y `@nodedesk/templates` — **cero lógica duplicada**.

## Arquitectura

```
nodedesk (bin) ──► commander ──► commands/*.ts (funciones puras → exit code)
                                   │
                                   ├── @nodedesk/core      (projects, process, env)
                                   └── @nodedesk/templates  (create)
```

- Cada comando es una función pura `async (options) => Promise<number>`
  (código de salida), registrada en `index.ts`. `bin.ts` es mínimo.
- Los errores top-level se capturan una sola vez en `run()`.
- UI propia (`ui.ts`): colores ANSI que respetan `NO_COLOR` y `--no-color`,
  tablas de ancho fijo, banner y máscara de secretos (claves con
  `SECRET|TOKEN|KEY|PASSWORD` se muestran `****` salvo `--raw`).
- Idioma de usuario: español (herencia de V1). Los nombres de comandos y
  flags son ingleses/estándar.

## Comandos

| Comando | Qué hace | Extras |
| --- | --- | --- |
| `nodedesk projects [dir]` | Descubre proyectos (core `discover`) y los tabula. | `--json`, `--depth` |
| `nodedesk create <name>` | Crea desde template (`TemplateManager.create`). | `-t/--template` (default `minimal-node`), `-d/--dir`, `--force`, `--json` |
| `nodedesk start <path>` | Arranca el proyecto. **Attached**: re-emite logs coloreados por nivel, Ctrl+C = apagado limpio del grupo. | `-s/--script`, `--detached`, `--port`, `--json` |
| `nodedesk stop <path>` o `--all` | Detiene procesos en background por registro (`prune()` antes). | — |
| `nodedesk logs <path>` | Últimas líneas del log del proceso detached; `--follow` con tail por polling. | `--lines` (50), `-f` |
| `nodedesk env <list\|get\|set\|delete>` | CRUD de `.env` con `EnvManager`, secretos enmascarados. | `--json`, `--raw` |
| `nodedesk templates [id]` | Catálogo / detalle de templates. | `--json` |
| `nodedesk doctor` | Diagnóstico: node ≥ 18, gestores en PATH, `~/.nodedesk-v2` escribible, procesos registrados, templates. | `--json` |
| `nodedesk version` | Versiones de los 4 paquetes. | `--json` |

## El modelo "detached" (cómo se para algo que ya no corre en tu terminal)

`start --detached` resuelve el problema de estado entre invocaciones que V1
resolvía con su app siempre viva:

1. El proceso arranca en grupo propio con stdio a
   `~/.nodedesk-v2/logs/<slug>.log`.
2. Se anota en `ProcessRegistry` (`~/.nodedesk-v2/processes.json`): pid,
   root, command, logFile.
3. `stop` y `logs` buscan ahí; `prune()` limpia pids muertos de forma
   perezosa (misma técnica de expiración lazy que los túneles de V1).

## Códigos de salida

- 0: éxito (incluye "no hay proyectos" en `projects`).
- 1: errores funcionales (proyecto inválido, template desconocida, nada que
  parar, doctor con node < 18…).
- Código del hijo: si el proceso attached muere solo, el CLI sale con **su**
  exit code (composición con scripts/CI). Apagado por el usuario (Ctrl+C) → 0.

## Comportamientos notables

- `start --json`: logs a stderr; stdout = línea 1 con pid/comando y línea
  final `{"event":"exit",…}` — 100 % parseable.
- `--no-color` se pre-escanea en `run()` y se acepta en cualquier posición.
- `env list` enmascara secretos; `env get` devuelve el valor pelado (para
  composición: `$(nodedesk env get . PORT)`).

## Testing

34 tests: 12 unit (colores/NO_COLOR, tablas, máscaras) + 22 de integración
real (spawn del binario construido): version/exit codes, discovery con
`--json`, `create` real, ciclo `start --detached` → `logs` → `stop` (con
verificación de muerte del hijo con `isProcessAlive` de core), SIGINT real
con apagado limpio, y propagación de exit codes.

## Desarrollo

```bash
cd packages/cli
pnpm test        # hace build primero y luego lanza vitest
node dist/bin.js --help
```
