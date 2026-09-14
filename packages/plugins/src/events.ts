import type { EventBus, HostEventMap } from "./types.js";

/**
 * Representación interna de un listener cualquiera del bus.
 *
 * `(payload: never) => void` es el "bottom" de las funciones de listener:
 * cualquier `(payload: T) => void` es asignable a él, lo que permite
 * guardar listeners de eventos distintos en un mismo `Set` sin `any`.
 */
type AnyListener = (payload: never) => void;

/**
 * Crea un bus de eventos tipado sobre la `HostEventMap`.
 *
 * - `on` devuelve una función de desuscripción (además de `off`).
 * - `emit` recorre una copia del conjunto de listeners, por lo que
 *   suscribirse o desuscribirse durante una emisión es seguro.
 */
export function createEventBus(): EventBus {
  const listeners = new Map<keyof HostEventMap, Set<AnyListener>>();

  function on<K extends keyof HostEventMap>(
    event: K,
    listener: (payload: HostEventMap[K]) => void
  ): () => void {
    let set = listeners.get(event);
    if (!set) {
      set = new Set<AnyListener>();
      listeners.set(event, set);
    }
    set.add(listener);
    return () => {
      off(event, listener);
    };
  }

  function off<K extends keyof HostEventMap>(
    event: K,
    listener: (payload: HostEventMap[K]) => void
  ): void {
    listeners.get(event)?.delete(listener);
  }

  function emit<K extends keyof HostEventMap>(
    event: K,
    payload: HostEventMap[K]
  ): void {
    const set = listeners.get(event);
    if (!set) return;
    // Copia defensiva: tolera (des)suscripciones durante la propia emisión.
    for (const listener of [...set]) {
      // Cada listener real espera el payload de su evento (garantizado por
      // `on`), así que la llamada es segura pese al borrado del tipo interno.
      (listener as (payload: HostEventMap[K]) => void)(payload);
    }
  }

  return { on, off, emit };
}
