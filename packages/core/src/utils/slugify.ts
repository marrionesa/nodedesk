/**
 * Convierte un nombre arbitrario en un slug seguro (minúsculas, ASCII,
 * guiones, máx. 40 caracteres). Derivado de `state.rs::slugify` de V1.
 */
export function slugify(name: string, fallback = "project"): string {
  const lowered = name.toLowerCase();
  let slug = "";
  let lastWasDash = true;

  for (const ch of lowered) {
    if (/[a-z0-9]/.test(ch)) {
      slug += ch;
      lastWasDash = false;
    } else if (!lastWasDash) {
      slug += "-";
      lastWasDash = true;
    }
  }

  const trimmed = slug.replace(/^-+|-+$/g, "");
  const result = trimmed.length > 0 ? trimmed : fallback;
  return result.slice(0, 40);
}
