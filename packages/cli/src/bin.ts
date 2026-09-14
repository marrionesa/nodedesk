#!/usr/bin/env node
/**
 * @nodedesk/cli — punto de entrada del binario `nodedesk`.
 *
 * Toda la lógica vive en `index.ts` (programa commander + comandos puros);
 * este módulo solo arranca `run()`, traduce el código de salida y captura
 * errores inesperados del arranque.
 */

import { run } from "./index.js";

run(process.argv.slice(2))
  .then((code) => {
    process.exit(code);
  })
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`✗ error inesperado: ${message}\n`);
    process.exit(1);
  });
