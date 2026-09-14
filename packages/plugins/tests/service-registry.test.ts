import { describe, expect, it } from "vitest";
import { createServiceRegistry } from "../src/index.js";

interface DemoService {
  answer: number;
}

describe("createServiceRegistry", () => {
  it("register + get + has exponen el servicio", () => {
    const registry = createServiceRegistry();
    const service: DemoService = { answer: 42 };

    expect(registry.has("demo")).toBe(false);
    registry.register("demo", service);

    expect(registry.has("demo")).toBe(true);
    expect(registry.get<DemoService>("demo")).toBe(service);
  });

  it("get de un servicio no registrado devuelve undefined", () => {
    const registry = createServiceRegistry();
    expect(registry.get("desconocido")).toBeUndefined();
  });

  it("register con nombre duplicado lanza Error", () => {
    const registry = createServiceRegistry();
    registry.register("uno", { valor: 1 });

    expect(() => registry.register("uno", { valor: 2 })).toThrowError(
      /ya existe un servicio registrado con el nombre "uno"/
    );
    // El servicio original permanece intacto.
    expect(registry.get<{ valor: number }>("uno")).toEqual({ valor: 1 });
  });

  it("unregister retira el servicio y devuelve true", () => {
    const registry = createServiceRegistry();
    registry.register("demo", { ok: true });

    expect(registry.unregister("demo")).toBe(true);
    expect(registry.has("demo")).toBe(false);
    expect(registry.get("demo")).toBeUndefined();
  });

  it("unregister de un servicio inexistente devuelve false", () => {
    const registry = createServiceRegistry();
    expect(registry.unregister("fantasma")).toBe(false);
  });

  it("list devuelve los nombres registrados", () => {
    const registry = createServiceRegistry();
    registry.register("b", 1);
    registry.register("a", 2);
    registry.register("c", 3);

    expect(registry.list().sort()).toEqual(["a", "b", "c"]);

    registry.unregister("b");
    expect(registry.list().sort()).toEqual(["a", "c"]);
  });

  it("permite re-registrar un nombre tras unregister", () => {
    const registry = createServiceRegistry();
    registry.register("demo", { version: 1 });
    registry.unregister("demo");

    expect(() => registry.register("demo", { version: 2 })).not.toThrow();
    expect(registry.get<{ version: number }>("demo")).toEqual({ version: 2 });
  });

  it("soporta servicios de cualquier forma (funciones incluidas)", () => {
    const registry = createServiceRegistry();
    const greet = (name: string): string => `hola ${name}`;

    registry.register("greeter", greet);
    expect(registry.get<(name: string) => string>("greeter")?.("mundo")).toBe(
      "hola mundo"
    );
  });
});
