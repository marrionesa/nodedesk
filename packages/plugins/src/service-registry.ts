import type { ServiceRegistry } from "./types.js";

/**
 * Crea un registro de servicios simple e inyectable.
 *
 * Los plugins publican servicios (cualquier valor: objetos, funciones,
 * instancias…) bajo un nombre único y los retiran al desactivarse. El
 * consumidor decide la forma del servicio vía `get<T>()`.
 */
export function createServiceRegistry(): ServiceRegistry {
  const services = new Map<string, unknown>();

  return {
    register<T>(name: string, service: T): void {
      if (services.has(name)) {
        throw new Error(
          `ya existe un servicio registrado con el nombre "${name}"`
        );
      }
      services.set(name, service);
    },

    get<T>(name: string): T | undefined {
      // El almacén interno es opaco (`unknown`): la forma la fija el consumidor.
      return services.get(name) as T | undefined;
    },

    has(name: string): boolean {
      return services.has(name);
    },

    unregister(name: string): boolean {
      return services.delete(name);
    },

    list(): string[] {
      return [...services.keys()];
    }
  };
}
