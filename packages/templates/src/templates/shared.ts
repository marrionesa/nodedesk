import type { TemplateContext } from "../types.js";

/**
 * Piezas comunes a las templates built-in.
 *
 * En V1 estos generadores vivían en `templates.rs` (backend Rust) y en
 * `template-files.ts` (frontend), duplicados. Aquí viven una sola vez y las
 * templates los componen.
 */

/** `.gitignore` común (port directo del `GITIGNORE` de `templates.rs` de V1). */
export const GITIGNORE = "node_modules/\ndist/\n.env\n*.log\n.DS_Store\n";

/**
 * Construye el contenido del `package.json` del proyecto generado.
 *
 * Mantiene la forma que exigía V1 (`name` = slug, `version` 0.1.0,
 * `type: module`, scripts dev/start), serializado con indentación legible.
 */
export function buildPackageJson(
  context: TemplateContext,
  options: {
    scripts: Record<string, string>;
    dependencies?: Record<string, string>;
  }
): string {
  const pkg: Record<string, unknown> = {
    name: context.slug,
    version: "0.1.0",
    type: "module",
    scripts: options.scripts
  };
  if (options.dependencies !== undefined) {
    pkg.dependencies = options.dependencies;
  }
  return `${JSON.stringify(pkg, null, 2)}\n`;
}

/**
 * Construye el `README.md` del proyecto generado: título con el nombre
 * elegido y las instrucciones de arranque con el package manager indicado
 * por el contexto (adaptación del `readme()` de `templates.rs` de V1, sin
 * dominios locales ni referencias a la app de escritorio).
 */
export function buildReadme(
  context: TemplateContext,
  info: { templateId: string; stack: string }
): string {
  const pm = context.packageManager;
  const lines = [
    `# ${context.name}`,
    "",
    `Proyecto generado con la template \`${info.templateId}\` de **@nodedesk/templates**.`,
    "",
    `- Stack: ${info.stack}`,
    `- Puerto: \`${context.port}\` (variable de entorno \`PORT\`, definida en \`.env\`)`,
    "",
    "## Arranque",
    "",
    "```bash",
    `${pm} install`,
    `${pm} run dev`,
    "```",
    "",
    `El servidor arranca en \`http://localhost:${context.port}\`.`,
    ""
  ];
  return lines.join("\n");
}
