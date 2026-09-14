import type { LoggerLike } from "@nodedesk/core";
import type { NodeDeskPlugin } from "../src/index.js";

/**
 * Logger de prueba que registra los mensajes en memoria para poder
 * asertar sobre ellos.
 */
export class RecordingLogger implements LoggerLike {
  readonly messages: string[] = [];

  debug(message: string): void {
    this.messages.push(message);
  }

  info(message: string): void {
    this.messages.push(message);
  }

  warn(message: string): void {
    this.messages.push(message);
  }

  error(message: string): void {
    this.messages.push(message);
  }
}

/**
 * Crea un plugin mínimo configurable para tests.
 *
 * Los overrides respetan el contrato `NodeDeskPlugin`, así que se pueden
 * sustituir `activate`, `deactivate` y los metadatos a placer.
 */
export function makePlugin(
  overrides: Partial<NodeDeskPlugin> = {}
): NodeDeskPlugin {
  return {
    name: "test-plugin",
    version: "1.0.0",
    activate: () => {},
    ...overrides
  };
}

/** Espera a que se vacíen las microtareas y temporizadores pendientes. */
export function tick(ms = 0): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
