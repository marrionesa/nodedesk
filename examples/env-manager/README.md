# Ejemplo 3 · env-manager

> Gestión del fichero `.env` con `EnvManager` de [`@nodedesk/core`](../../packages/core/README.md).

## Qué demuestra

- Lectura y escritura del `.env` **preservando comentarios, orden y líneas en
  blanco** (mejora sobre el parser de V1): `set()`, `get()`, `all()`,
  `delete()` y `entries()` (cada variable con su comentario asociado).
- `buildEnvironment({ DEMO: "1" })`: el entorno combinado que usa
  `ProcessManager` para lanzar procesos (`process.env` + `.env` + overrides)
  — el ejemplo solo imprime unas claves, no todo `process.env`.

## Cómo ejecutarlo

Sin argumentos se crea un **fixture en un directorio temporal** (con un `.env`
de ejemplo con comentarios) que se elimina al terminar la demo:

```bash
pnpm --filter @nodedesk/example-env-manager start
```

Sobre un proyecto real tuyo (⚠ **modifica su `.env`**: fija `EXAMPLE_DATE` y
borra `EXAMPLE_MODE` si lo tuviera):

```bash
pnpm --filter @nodedesk/example-env-manager start -- --dir /ruta/a/tu/proyecto
```

Nota: `pnpm` ejecuta los scripts desde la carpeta del ejemplo; si la ruta
relativa de `--dir` no existe ahí, se reintenta contra la raíz del monorepo
(así `--dir packages/core` funciona lanzando desde la raíz).

O entrando en la carpeta:

```bash
cd examples/env-manager
pnpm start
```
