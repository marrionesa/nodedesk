# Roadmap del ecosistema NodeDesk

## Estado actual: Fase 1 — completada ✅

Los cuatro paquetes compilan, pasan sus tests (189), están documentados y el
monorepo ejecuta `pnpm install / build / test / typecheck` de punta a punta.

## Principios del roadmap

- **Nada de sobreingeniería** (especificación §22): sin servidores, sin
  cloud, sin cuentas, sin API HTTP. La primera meta es y sigue siendo una
  librería local sólida.
- Cada fase deja el ecosistema publicable y usable por sí mismo.
- Versionado independiente por paquete (hoy todos en 0.1.0; pueden divergir).

## Fase 2 — Estabilización y publicación (corto plazo)

| Ítem | Paquete | Notas |
| --- | --- | --- |
| Publicación inicial en npm (`0.1.x`) | todos | Tras decidir licencia y repos reales; ver `docs/PUBLISHING.md`. |
| CI (GitHub Actions): build + test + typecheck en Linux/macOS/Windows | raíz | El código tiene ramas por plataforma pero no hay runners aún. |
| Build dual ESM/CJS | core, templates | Para consumidores CommonJS. Evaluar `tsup` o doble pasada `tsc`. |
| `NodeProject.watch()` — recarga de metadatos | core | `fs.watch` sobre `package.json` con debounce. |
| `ProcessManager` en Windows: verificación real + `taskkill /T /F` | core | La rama existe; falta validación en Windows. |
| Más coverage: registry concurrente, procesos zombi, `.env` raros | core | Tests de robustez. |
| Templates TS: `express-ts`, `api-ts` | templates | Requiere soporte de build post-install en el contrato. |

## Fase 3 — Extensión (medio plazo)

| Ítem | Paquete | Notas |
| --- | --- | --- |
| Plugins oficiales de referencia | plugins | `git-plugin` y `docker-plugin` como demostración del contrato. |
| `nodedesk ps` / gestión multi-proyecto del registry | cli | Vista de todos los background del usuario. |
| Soporte de scripts npm `pre`/`post` y `npm-run-all` | core | En `resolveCommand`. |
| Detección de frameworks en metadatos (next, nest, express…) | core | `NodeProject.framework` — heurística por dependencias. |
| i18n del CLI (inglés opcional) | cli | Catálogo de mensajes desacoplado. |
| `nodedesk env doctor` — validación de schemas de entorno | core + cli | Contratos `.env.example`. |

## Fase 4 — Ecosistema maduro (largo plazo)

| Ítem | Notas |
| --- | --- |
| Marketplace ligero de plugins | `nodedesk plugins list/install` desde npm (scope `@nodedesk-*`). |
| Estabilización de API → `1.0.0` de core | Contrato con semver estricto. |

## No-go deliberados (fuera del roadmap)

- Servidores, bases de datos, cuentas de usuario, autenticación, telemetría.
- Gestores de procesos estilo pm2 daemonizado: el modelo de V2 es explícito
  (registry local + procesos por proyecto), no un daemon global.
- Cualquier dependencia runtime nueva en core.

## Hitos de versión

- `0.1.x` — fase actual: API exploratoria, sin garantías de compat.
- `0.2.x` — publicación npm + CI + dual build.
- `0.5.x` — plugins de referencia y API congelándose.
- `1.0.0` — contrato estable (solo tras uso real por terceros).
