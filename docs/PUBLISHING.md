# Cómo publicar los paquetes del ecosistema

> **NO publicar automáticamente** durante esta fase (especificación §13).
> Este documento describe el proceso para cuando el propietario lo decida.

## Estado actual

- Los 4 paquetes (`core`, `templates`, `plugins`, `cli`) están **preparados
  para publicación** (package.json completos: name, version, description,
  keywords, repository, homepage, bugs, license, exports, files, bin,
  scripts, README).
- **No** se ha ejecutado ningún `npm publish`.
- Las referencias internas usan `workspace:*` (pnpm las convierte a versión
  real al publicar).

## Evidencia previa a publicación

La última auditoría completa obtuvo `PASS: 136`, `FAIL: 0`, `WARN: 3`.
Los avisos correspondían a referencias arquitectónicas intencionadas entre V1
y V2, coincidencias legítimas del análisis de posibles secretos y la ausencia
de Git en el directorio aislado de auditoría; no eran fallos funcionales.

Se ejecutaron `pnpm install`, `pnpm build`, `pnpm test`, `pnpm typecheck` y
pruebas de integración externas. Además, los cuatro paquetes se empaquetaron
como `*.tgz`, se instalaron en un proyecto externo y se verificaron con
`npm ls` e imports ESM reales. Los artefactos contienen `dist`, README y
LICENSE, y no incluyen `node_modules`.

El proyecto externo permitió comprobar el flujo completo: creación desde
Templates, instalación, servidor HTTP, descubrimiento, gestor de paquetes,
`.env`, procesos attached y detached, registro persistente, logs, parada y
limpieza. Templates, Plugins y CLI también se probaron fuera del workspace.

## Instalación de dependencias

La instalación es explícita. `nodedesk create` y `nodedesk start` no instalan
dependencias automáticamente. Para instalar antes de arrancar se debe usar:

```bash
nodedesk start . --install
nodedesk start . --install --detached
```

En Core, `autoInstall: true` es una opción opt-in y está cubierta por pruebas
en ambos modos de ejecución.

## Checklist previo

1. **Licencia** — los paquetes públicos utilizan MIT.
2. **URLs** — `repository`, `homepage` y `bugs` apuntan al repositorio
   público de NodeDesk.
3. **Cuenta npm** con acceso al scope `@nodedesk`.
4. **Build limpio** — ejecutar build, tests y typecheck antes de publicar.
5. **Paquetes publicables** — comprobar que los tarballs contienen únicamente
   los archivos destinados a distribución.

## Proceso de publicación (con pnpm)

```bash
# 1. Todo verde desde la raíz
pnpm install
pnpm build
pnpm test
pnpm typecheck

# 2. Versionar (por paquete, versionado independiente)
pnpm --filter @nodedesk/core version patch   # 0.1.0 → 0.1.1
# commit + tag por paquete

# 3. Publicar (pnpm resuelve workspace:* automáticamente)
pnpm --filter @nodedesk/core publish --access public
pnpm --filter @nodedesk/templates publish --access public
pnpm --filter @nodedesk/plugins publish --access public
pnpm --filter @nodedesk/cli publish --access public
```

Alternativa monorepo (publica en orden topológico):

```bash
pnpm -r publish --access public
```

### Orden recomendado

`core` → `templates` → `plugins` → `cli` (es el orden de dependencias;
`pnpm -r` ya lo respeta).

### Publicar la CLI globalmente usable

`@nodedesk/cli` declara `"bin": { "nodedesk": "./dist/bin.js" }`: al
instalar globalmente (`npm i -g @nodedesk/cli`) queda disponible el comando
`nodedesk` con shebang ejecutable.

## Canary / pruebas previas

```bash
pnpm pack --filter @nodedesk/core   # genera el .tgz exacto que se publicaría
tar -tzf package/*.tgz              # revisar contenido (files/dist/README/LICENSE)
```

Y probarlo en un proyecto real:

```bash
cd /tmp/prueba-core
npm init -y
npm install /ruta/al/nodedesk-core-0.1.0.tgz
node -e "import('@nodedesk/core').then(m => console.log(Object.keys(m)))"
```

## Después de publicar

- Actualizar `CHANGELOG.md`.
- Etiquetar el release en git.
- En consumidores: las dependencias `workspace:*` pueden cambiarse por
  versiones npm cuando se desee consumir desde fuera del monorepo.
