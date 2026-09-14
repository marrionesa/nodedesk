/** Tipos de utilidades compartidas. */

/** Opciones de descubrimiento de proyectos. */
export interface DiscoveryOptions {
  /**
   * Profundidad máxima de búsqueda (por defecto `3`). `0` solo inspecciona
   * el propio directorio.
   */
  depth?: number;
  /**
   * Directorios a ignorar durante el recorrido (por defecto `node_modules`,
   * `.git`, `dist`, `build`, `out`, `coverage`, `.cache`, `.next`).
   */
  ignore?: string[];
  /**
   * No descender dentro de un proyecto ya encontrado (por defecto `true`).
   * Con `false` se descubren también subproyectos anidados.
   */
  stopAtProject?: boolean;
}

/** Resultado de crear ficheros desde una template (usado por @nodedesk/templates). */
export interface FileWriteResult {
  /** Rutas absolutas de los ficheros escritos. */
  files: string[];
  /** Número de ficheros. */
  count: number;
}
