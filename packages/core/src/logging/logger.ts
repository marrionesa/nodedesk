import type { LogEntry, LoggerLike } from "../types/process.js";
import { classifyLine } from "../process/classify.js";
import { nowIso } from "../utils/id.js";

/**
 * Logger en memoria con buffer circular.
 *
 * Port de `state.rs::push_log` de V1: buffer por proyecto con máximo de
 * 300 líneas (configurable) que descarta las más antiguas.
 */
export class MemoryLogger implements LoggerLike {
  private readonly buffer: LogEntry[] = [];
  private readonly capacity: number;

  constructor(capacity = 300) {
    this.capacity = Math.max(1, capacity);
  }

  debug(message: string): void {
    this.push(message, "info");
  }

  info(message: string): void {
    this.push(message, "info");
  }

  warn(message: string): void {
    this.push(message, "warn");
  }

  error(message: string): void {
    this.push(message, "error");
  }

  /** Registra una línea de proceso ya clasificada. */
  pushProcessLine(
    line: string,
    source: "stdout" | "stderr"
  ): LogEntry {
    const entry: LogEntry = {
      line,
      level: classifyLine(line, source),
      source,
      timestamp: nowIso()
    };
    this.append(entry);
    return entry;
  }

  /** Todas las entradas en orden cronológico. */
  entries(): LogEntry[] {
    return [...this.buffer];
  }

  /** Número de entradas almacenadas. */
  get size(): number {
    return this.buffer.length;
  }

  /** Vacía el buffer. */
  clear(): void {
    this.buffer.length = 0;
  }

  private push(message: string, level: LogEntry["level"]): void {
    this.append({
      line: message,
      level,
      source: "system",
      timestamp: nowIso()
    });
  }

  private append(entry: LogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length > this.capacity) {
      this.buffer.splice(0, this.buffer.length - this.capacity);
    }
  }
}

/**
 * Logger que escribe en consola con prefijo. Comodidad para CLIs y ejemplos.
 */
export class ConsoleLogger implements LoggerLike {
  constructor(private readonly prefix = "[nodedesk]") {}

  debug(message: string): void {
    console.debug(`${this.prefix} ${message}`);
  }

  info(message: string): void {
    console.log(`${this.prefix} ${message}`);
  }

  warn(message: string): void {
    console.warn(`${this.prefix} ${message}`);
  }

  error(message: string): void {
    console.error(`${this.prefix} ${message}`);
  }
}

/**
 * Logger multiplexor: envía cada mensaje a varios loggers a la vez
 * (p. ej. consola + memoria).
 */
export class CompositeLogger implements LoggerLike {
  constructor(private readonly loggers: LoggerLike[]) {}

  debug(message: string): void {
    for (const logger of this.loggers) logger.debug?.(message);
  }

  info(message: string): void {
    for (const logger of this.loggers) logger.info(message);
  }

  warn(message: string): void {
    for (const logger of this.loggers) logger.warn(message);
  }

  error(message: string): void {
    for (const logger of this.loggers) logger.error(message);
  }
}
