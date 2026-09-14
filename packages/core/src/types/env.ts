/**
 * Tipos de variables de entorno de @nodedesk/core.
 *
 * Modelos públicos para la gestión de ficheros `.env`.
 */

/** Una entrada (línea) de un fichero `.env`. */
export interface EnvEntry {
  /** Nombre de la variable. */
  key: string;
  /** Valor sin comillas. */
  value: string;
  /** Comentario asociado (líneas `#` previas, sin el `#`). */
  comment?: string;
  /** `true` si el valor original estaba entrecomillado. */
  quoted?: boolean;
}

/** Opciones del `EnvManager`. */
export interface EnvManagerOptions {
  /** Ruta del fichero `.env` (por defecto `<root>/.env`). */
  path?: string;
  /**
   * Persistir automáticamente en `set()` / `delete()`. Por defecto `true`.
   * Con `false`, hay que llamar `save()` explícitamente.
   */
  autosave?: boolean;
}
