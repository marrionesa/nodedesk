import { describe, expect, it, vi } from "vitest";
import {
  createEventBus,
  createPluginContext,
  createServiceRegistry,
  defaultCore,
  NoopLogger,
  PLUGIN_API_VERSION
} from "../src/index.js";
import { RecordingLogger } from "./helpers.js";

describe("createPluginContext", () => {
  it("expone la versión del contrato como apiVersion", () => {
    const context = createPluginContext({ pluginName: "demo" });
    expect(context.apiVersion).toBe(PLUGIN_API_VERSION);
    expect(context.apiVersion).toBe("0.1.0");
  });

  it("incluye el nombre del plugin destinatario", () => {
    const context = createPluginContext({ pluginName: "mi-plugin" });
    expect(context.pluginName).toBe("mi-plugin");
  });

  it("expone las clases reales de @nodedesk/core por defecto", () => {
    const context = createPluginContext({ pluginName: "demo" });

    expect(typeof context.core.ProjectManager).toBe("function");
    expect(typeof context.core.ProjectManager.discover).toBe("function");
    expect(typeof context.core.ProjectManager.load).toBe("function");
    expect(typeof context.core.ProcessManager).toBe("function");
    expect(typeof context.core.EnvManager).toBe("function");
  });

  it("usa un NoopLogger por defecto", () => {
    const context = createPluginContext({ pluginName: "demo" });
    expect(context.logger).toBeInstanceOf(NoopLogger);

    // Silencioso: registrar mensajes no lanza ni escribe nada.
    expect(() => {
      context.logger.info("mensaje");
      context.logger.warn("aviso");
      context.logger.error("fallo");
      context.logger.debug?.("detalle");
    }).not.toThrow();
  });

  it("crea bus y registro propios si no se inyectan", () => {
    const context = createPluginContext({ pluginName: "demo" });
    const otro = createPluginContext({ pluginName: "otro" });

    expect(context.events).toBeDefined();
    expect(context.services).toBeDefined();

    // Aislamiento: cada contexto tiene su propia infraestructura.
    const spy = vi.fn();
    context.events.on("log", spy);
    otro.events.emit("log", { level: "info", message: "aislado" });
    expect(spy).not.toHaveBeenCalled();

    context.services.register("propio", 1);
    expect(otro.services.has("propio")).toBe(false);
  });

  it("respeta la infraestructura inyectada", () => {
    const logger = new RecordingLogger();
    const events = createEventBus();
    const services = createServiceRegistry();

    const context = createPluginContext({
      pluginName: "demo",
      logger,
      events,
      services
    });

    expect(context.logger).toBe(logger);
    expect(context.events).toBe(events);
    expect(context.services).toBe(services);
  });

  it("permite inyectar un core propio (DI explícita)", () => {
    const injected = defaultCore();
    const context = createPluginContext({ pluginName: "demo", core: injected });

    expect(context.core).toBe(injected);
    expect(context.core.ProjectManager).toBe(injected.ProjectManager);
  });
});
