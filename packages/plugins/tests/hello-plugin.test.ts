import { describe, expect, it } from "vitest";
import {
  builtinPlugins,
  createEventBus,
  createServiceRegistry,
  helloPlugin,
  PluginManager
} from "../src/index.js";
import type { HelloService } from "../src/index.js";
import { RecordingLogger, tick } from "./helpers.js";

describe("helloPlugin", () => {
  it("declara metadatos coherentes con el contrato", () => {
    expect(helloPlugin.name).toBe("hello");
    expect(helloPlugin.version).toBe("0.1.0");
    expect(typeof helloPlugin.description).toBe("string");
    expect(helloPlugin.description?.length).toBeGreaterThan(0);
    expect(typeof helloPlugin.activate).toBe("function");
  });

  it("se incluye en builtinPlugins", () => {
    expect(builtinPlugins).toContain(helloPlugin);
    expect(builtinPlugins.map((plugin) => plugin.name)).toContain("hello");
  });

  it("activate registra el servicio hello con greet()", async () => {
    const services = createServiceRegistry();
    const logger = new RecordingLogger();
    const manager = new PluginManager({ services, logger });

    manager.register(helloPlugin);
    await manager.activate("hello");

    expect(manager.list()[0]?.status).toBe("active");
    expect(services.has("hello")).toBe(true);

    const hello = services.get<HelloService>("hello");
    expect(hello).toBeDefined();
    expect(hello?.greet()).toBe("¡Hola desde el plugin hello!");
  });

  it("activate registra un mensaje en el logger del host", async () => {
    const logger = new RecordingLogger();
    const manager = new PluginManager({ logger });

    manager.register(helloPlugin);
    await manager.activate("hello");

    expect(logger.messages).toContain(
      "[hello] plugin activado (api 0.1.0)"
    );
  });

  it("deactivate retira el servicio y se despide", async () => {
    const services = createServiceRegistry();
    const logger = new RecordingLogger();
    const manager = new PluginManager({ services, logger });

    manager.register(helloPlugin);
    await manager.activate("hello");
    expect(services.has("hello")).toBe(true);

    await manager.deactivate("hello");

    expect(manager.list()[0]?.status).toBe("deactivated");
    expect(services.has("hello")).toBe(false);
    expect(logger.messages.some((m) => m.includes("¡Hasta luego!"))).toBe(true);
  });

  it("escucha los eventos de log del bus durante su activación", async () => {
    const events = createEventBus();
    const logger = new RecordingLogger();
    const manager = new PluginManager({ events, logger });

    manager.register(helloPlugin);
    await manager.activate("hello");

    logger.messages.length = 0; // descartamos el mensaje de activación
    events.emit("log", { level: "warn", message: "algo pasa" });

    expect(
      logger.messages.some(
        (message) =>
          message.includes("[hello] eco de log") &&
          message.includes("algo pasa")
      )
    ).toBe(true);
  });

  it("puede reactivarse tras desactivarse (registro y bus limpios)", async () => {
    const services = createServiceRegistry();
    const manager = new PluginManager({ services });

    manager.register(helloPlugin);
    await manager.activate("hello");
    await manager.deactivate("hello");

    // El nombre "hello" vuelve a estar disponible en el registro.
    await expect(manager.activate("hello")).resolves.toBeUndefined();

    expect(services.has("hello")).toBe(true);
    expect(manager.activeCount).toBe(1);
  });

  it("unregister del plugin activo deja el registro de servicios limpio", async () => {
    const services = createServiceRegistry();
    const manager = new PluginManager({ services });

    manager.register(helloPlugin);
    await manager.activate("hello");

    expect(manager.unregister("hello")).toBe(true);
    await tick(); // deja completar la desactivación async

    expect(manager.has("hello")).toBe(false);
    expect(services.has("hello")).toBe(false);
    expect(services.list()).toEqual([]);
  });
});
