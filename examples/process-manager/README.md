# Ejemplo 2 · process-manager

> Ciclo de vida completo de un proceso con `ProcessManager` de [`@nodedesk/core`](../../packages/core/README.md).

## Qué demuestra

- Crea un **mini-proyecto real** en un directorio temporal (package.json con
  script `dev` + un `server.mjs` que imprime líneas y vive hasta recibir SIGTERM).
- Resolución del comando de arranque (`resolveCommand()` + `detectPackageManager()`).
- `start()` en modo **attached**: stdout/stderr se leen línea a línea y se
  emiten como eventos `log` clasificados en `info`/`warn`/`error`/`system`
  (el ejemplo imprime el nivel con su color ANSI propio).
- 3 segundos de vida y `stop()` limpio: SIGTERM al grupo completo del proceso
  → periodo de gracia → SIGKILL (siempre en `try/finally`).
- Resumen final con **exit code y señal** de terminación.

## Cómo ejecutarlo

Desde la raíz del monorepo:

```bash
pnpm --filter @nodedesk/example-process-manager start
```

O entrando en la carpeta:

```bash
cd examples/process-manager
pnpm start
```

No necesita argumentos: el proyecto de prueba se crea en un `tmpdir` y se
elimina al terminar. Salida ~8 s (3 s de proceso vivo + arranque/apagado).
