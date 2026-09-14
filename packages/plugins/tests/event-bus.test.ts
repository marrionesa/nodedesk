import { describe, expect, it, vi } from "vitest";
import { createEventBus } from "../src/index.js";

describe("createEventBus", () => {
  it("crea buses independientes en cada llamada", () => {
    const a = createEventBus();
    const b = createEventBus();
    const spy = vi.fn();
    a.on("log", spy);
    b.emit("log", { level: "info", message: "hola" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("entrega el payload tipado a los suscriptores", () => {
    const bus = createEventBus();
    const spy = vi.fn();
    bus.on("plugin:activated", spy);
    bus.emit("plugin:activated", { name: "hello" });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ name: "hello" });
  });

  it("soporta varios suscriptores del mismo evento", () => {
    const bus = createEventBus();
    const first = vi.fn();
    const second = vi.fn();
    bus.on("log", first);
    bus.on("log", second);
    bus.emit("log", { level: "warn", message: "cuidado" });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("emitir un evento sin suscriptores es un no-op", () => {
    const bus = createEventBus();
    expect(() =>
      bus.emit("plugin:deactivated", { name: "nadie" })
    ).not.toThrow();
  });

  it("off deja de recibir eventos", () => {
    const bus = createEventBus();
    const spy = vi.fn();
    bus.on("log", spy);
    bus.off("log", spy);
    bus.emit("log", { level: "info", message: "hola" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("off de un listener nunca suscrito no hace nada", () => {
    const bus = createEventBus();
    const spy = vi.fn();
    expect(() => bus.off("log", spy)).not.toThrow();
  });

  it("la función de desuscripción devuelta por on funciona", () => {
    const bus = createEventBus();
    const spy = vi.fn();
    const unsubscribe = bus.on("log", spy);

    bus.emit("log", { level: "info", message: "uno" });
    expect(spy).toHaveBeenCalledTimes(1);

    unsubscribe();
    bus.emit("log", { level: "info", message: "dos" });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("desuscribir solo afecta al listener indicado", () => {
    const bus = createEventBus();
    const a = vi.fn();
    const b = vi.fn();
    const unsubscribeA = bus.on("log", a);
    bus.on("log", b);

    unsubscribeA();
    bus.emit("log", { level: "info", message: "x" });

    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("emitir dentro de un listener no rompe la iteración", () => {
    const bus = createEventBus();
    const order: string[] = [];

    bus.on("log", (payload) => {
      order.push(`primero:${payload.message}`);
    });
    bus.on("log", (payload) => {
      order.push(`segundo:${payload.message}`);
      if (payload.message === "uno") {
        bus.emit("log", { level: "info", message: "dos" });
      }
    });

    bus.emit("log", { level: "info", message: "uno" });

    expect(order).toEqual([
      "primero:uno",
      "segundo:uno",
      "primero:dos",
      "segundo:dos"
    ]);
  });
});
