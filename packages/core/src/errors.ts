/**
 * Jerarquía de errores de @nodedesk/core.
 *
 * Todos los errores del ecosistema extienden `NodeDeskError` para que los
 * consumidores puedan distinguirlos con `instanceof` o con `error.code`.
 */

/** Error base del ecosistema NodeDesk. */
export class NodeDeskError extends Error {
  /** Código estable del error (ej. `ND_INVALID_PROJECT`). */
  readonly code: string;

  constructor(message: string, code = "ND_ERROR") {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

/** La ruta no contiene un proyecto Node.js válido (sin `package.json`). */
export class InvalidProjectError extends NodeDeskError {
  constructor(path: string) {
    super(`"${path}" no es un proyecto Node.js: falta package.json`, "ND_INVALID_PROJECT");
  }
}

/** No se encuentra la ruta indicada. */
export class PathNotFoundError extends NodeDeskError {
  constructor(path: string) {
    super(`no existe la ruta: ${path}`, "ND_PATH_NOT_FOUND");
  }
}

/** Un proceso no puede arrancarse o ya está en marcha. */
export class ProcessError extends NodeDeskError {
  constructor(message: string) {
    super(message, "ND_PROCESS");
  }
}

/** El proceso no está corriendo cuando se esperaba que sí. */
export class ProcessNotRunningError extends NodeDeskError {
  constructor(id: string) {
    super(`el proceso ${id} no está corriendo`, "ND_PROCESS_NOT_RUNNING");
  }
}

/** Error al leer o escribir el fichero `.env`. */
export class EnvFileError extends NodeDeskError {
  constructor(message: string) {
    super(message, "ND_ENV_FILE");
  }
}
