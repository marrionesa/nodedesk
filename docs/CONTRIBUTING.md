# Contribuir al ecosistema NodeDesk

## Reglas de oro

1. **NodeDesk Desktop es propietario**: nada de su código (V1 o futuro) puede
   entrar en este repositorio. Las ideas se reimplementan, no se copian.
2. **`core` sin dependencias runtime**: cualquier nueva funcionalidad debe
   poder hacerse con `node:*` o irá a otro paquete.
3. **Sin sobreingeniería**: no servidores, no cloud, no cuentas. Si un cambio
   añade infraestructura, probablemente no pertenece aquí.
4. **API pública = `src/index.ts`** de cada paquete: lo que no se exporta es
   interno y puede cambiar.

## Flujo de trabajo

```bash
pnpm install
pnpm --filter @nodedesk/core test --watch   # TDD en el paquete que toques
pnpm test          # TODO el workspace debe estar verde
pnpm typecheck
```

Antes de abrir un PR:

- [ ] Tests para toda la funcionalidad nueva (incluye un caso real si toca
      procesos/templates).
- [ ] `pnpm test` + `pnpm typecheck` verdes en el monorepo completo.
- [ ] Si cambia la API pública: actualizar `README.md` del paquete y el
      doc de `architecture/` correspondiente + `CHANGELOG.md`.
- [ ] Si toca procesos: revisar las guardas de `kill.ts` (pid ≤ 1, pid
      propio, verificación de pgid) — son invariantes de seguridad.
- [ ] Sin `any`, sin dependencias nuevas en core, imports relativos con
      extensión `.js` (ESM NodeNext).

## Convenciones de código

- TypeScript **strict**, `verbatimModuleSyntax` (`import type` para tipos).
- Docstrings en español, citando el origen V1 cuando exista
  (`Derivado de projects.rs de V1...`).
- Errores: extender `NodeDeskError` con código `ND_*` estable.
- Nuevos comandos CLI: función pura que devuelve exit code + registro en
  `index.ts` + `--json`.

## Añadir una template

```ts
// packages/templates/src/templates/mi-template.ts
import type { Template } from "../types.js";

export const miTemplate: Template = {
  id: "mi-template",
  name: "Mi Template",
  tagline: "Una línea",
  description: "…",
  category: "API",
  stack: ["x"],
  tags: ["x"],
  minNode: "18",
  scripts: { dev: "node src/server.mjs" },
  files: (ctx) => [
    { path: "package.json", content: `{"name":"${ctx.slug}"}` },
    // …
  ],
  env: () => [{ key: "PORT", value: "3000" }]
};
```

Añádela al array de `templates/index.ts` y escribe un test que genere el
proyecto y verifique los ficheros.

## Añadir un plugin

Implementa `NodeDeskPlugin`, registra servicios en `context.services` y
limpia en `deactivate()`. Mirá `builtins/hello-plugin.ts` como referencia.
