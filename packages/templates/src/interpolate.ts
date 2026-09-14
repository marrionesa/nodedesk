/**
 * Interpolación de tokens `{{key}}` en textos de template.
 *
 * Sustituye cada aparición de `{{clave}}` (con espacios opcionales, ej.
 * `{{ clave }}`) por el valor correspondiente de `vars`. Los tokens con
 * claves desconocidas se dejan tal cual, para que un contenido legítimo que
 * contenga llaves dobles no se corrompa silenciosamente.
 *
 * ```ts
 * interpolate("Hola {{name}}, puerto {{port}}", { name: "web", port: 3011 });
 * // → "Hola web, puerto 3011"
 * ```
 */
export function interpolate(
  text: string,
  vars: Record<string, string | number>
): string {
  return text.replace(/\{\{\s*(\w+)\s*\}\}/g, (token, key: string) =>
    Object.hasOwn(vars, key) ? String(vars[key]) : token
  );
}
