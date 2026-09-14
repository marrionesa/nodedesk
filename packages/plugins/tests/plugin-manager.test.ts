import { describe, expect, it, vi } from "vitest";
import { NodeDeskError } from "@nodedesk/core";
import {
  createEventBus,
  createServiceRegistry,
  PluginActivationError,
  PluginManager
} from "../src/index.js";
import type { PluginContext } from "../src/index.js";
import { makePlugin, RecordingLogger, tick } from "./helpers.js";

describe("PluginManager — registro", () => {
  it("register añade el plugin y devuelve el manager (fluido)", () => {
    const manager = new PluginManager();
    const plugin = makePlugin({ name: "alfa" });

    expect(manager.register(plugin)).toBe(manager);
    expect(manager.has("alfa")).toBe(true);
    expect(manager.size).toBe(1);
  });

  it("register encadenado mantiene el orden de registro", () => {
    const manager = new PluginManager();
    manager
      .register(makePlugin({ name: "uno" }))
      .register(makePlugin({ name: "dos" }))
      .register(makePlugin({ name: "tres" }));

    expect(manager.list().map((info) => info.name)).toEqual([
      "uno",
      "dos",
      "tres"
    ]);
  });

  it("register duplicado lanza Error y no modifica el registro", () => {
    const manager = new PluginManager();
    manager.register(makePlugin({ name: "dup" }));

    expect(() => manager.register(makePlugin({ name: "dup" }))).toThrowError(
      /ya existe un plugin registrado con el nombre "dup"/
    );
    expect(manager.size).toBe(1);
  });

  it("get devuelve el plugin registrado o null", () => {
    const manager = new PluginManager();
    const plugin = makePlugin({ name: "alfa" });
    manager.register(plugin);

    expect(manager.get("alfa")).toBe(plugin);
    expect(manager.get("fantasma")).toBeNull();
  });

  it("list expone PluginInfo con estado inicial registered", () => {
    const manager = new PluginManager();
    manager.register(
      makePlugin({
        name: "alfa",
        version: "2.3.4",
        description: "descripción alfa"
      })
    );
    manager.register(makePlugin({ name: "beta", version: "0.0.1" }));

    const infos = manager.list();
    expect(infos[0]).toMatchObject({
      name: "alfa",
      version: "2.3.4",
      description: "descripción alfa",
      status: "registered"
    });
    expect(infos[1]).toMatchObject({
      name: "beta",
      version: "0.0.1",
      status: "registered"
    });
    expect(infos[1].description).toBeUndefined();
    expect(infos[0].lastError).toBeUndefined();
  });

  it("list devuelve una copia: mutarla no afecta al manager", () => {
    const manager = new PluginManager();
    manager.register(makePlugin({ name: "alfa" }));

    const infos = manager.list();
    infos.length = 0;

    expect(manager.size).toBe(1);
    expect(manager.list()).toHaveLength(1);
  });
});

describe("PluginManager — ciclo de vida", () => {
  it("registered → active → deactivated emitiendo eventos del bus", async () => {
    const events = createEventBus();
    const activated = vi.fn();
    const deactivated = vi.fn();
    events.on("plugin:activated", activated);
    events.on("plugin:deactivated", deactivated);

    const manager = new PluginManager({ events });
    manager.register(makePlugin({ name: "ciclo" }));

    expect(manager.list()[0]?.status).toBe("registered");

    await manager.activate("ciclo");
    expect(manager.list()[0]?.status).toBe("active");
    expect(manager.activeCount).toBe(1);
    expect(activated).toHaveBeenCalledTimes(1);
    expect(activated).toHaveBeenCalledWith({ name: "ciclo" });

    await manager.deactivate("ciclo");
    expect(manager.list()[0]?.status).toBe("deactivated");
    expect(manager.activeCount).toBe(0);
    expect(deactivated).toHaveBeenCalledTimes(1);
    expect(deactivated).toHaveBeenCalledWith({ name: "ciclo" });
  });

  it("activate entrega un contexto fresco en cada activación", async () => {
    const manager = new PluginManager();
    const contexts: PluginContext[] = [];
    manager.register(
      makePlugin({
        name: "ctx",
        activate: (context) => {
          contexts.push(context);
        }
      })
    );

    await manager.activate("ctx");
    await manager.deactivate("ctx");
    await manager.activate("ctx");

    expect(contexts).toHaveLength(2);
    expect(contexts[0]).not.toBe(contexts[1]);
    // La infraestructura compartida se mantiene entre activaciones.
    expect(contexts[0]?.events).toBe(contexts[1]?.events);
    expect(contexts[0]?.services).toBe(contexts[1]?.services);
  });

  it("activate de un plugin desconocido lanza Error", async () => {
    const manager = new PluginManager();
    await expect(manager.activate("fantasma")).rejects.toThrowError(
      /no hay ningún plugin registrado con el nombre "fantasma"/
    );
  });

  it("activate sobre un plugin ya activo es un no-op silencioso", async () => {
    const events = createEventBus();
    const activated = vi.fn();
    events.on("plugin:activated", activated);

    const activateSpy = vi.fn();
    const manager = new PluginManager({ events });
    manager.register(makePlugin({ name: "x", activate: activateSpy }));

    await manager.activate("x");
    await manager.activate("x");

    expect(activateSpy).toHaveBeenCalledTimes(1);
    expect(activated).toHaveBeenCalledTimes(1);
    expect(manager.activeCount).toBe(1);
  });

  it("deactivate de un plugin no activo es un no-op", async () => {
    const events = createEventBus();
    const deactivated = vi.fn();
    events.on("plugin:deactivated", deactivated);

    const deactivateSpy = vi.fn();
    const manager = new PluginManager({ events });
    manager.register(makePlugin({ name: "x", deactivate: deactivateSpy }));

    await manager.deactivate("x"); // registrado, nunca activado
    await manager.deactivate("fantasma"); // ni siquiera existe

    expect(deactivateSpy).not.toHaveBeenCalled();
    expect(deactivated).not.toHaveBeenCalled();
    expect(manager.list()[0]?.status).toBe("registered");
  });

  it("deactivate de un plugin sin deactivate definido es un no-op", async () => {
    const events = createEventBus();
    const deactivated = vi.fn();
    events.on("plugin:deactivated", deactivated);

    const manager = new PluginManager({ events });
    manager.register(makePlugin({ name: "simple" })); // sin deactivate

    await manager.activate("simple");
    await expect(manager.deactivate("simple")).resolves.toBeUndefined();

    expect(manager.list()[0]?.status).toBe("deactivated");
    expect(deactivated).toHaveBeenCalledWith({ name: "simple" });
  });

  it("un plugin desactivado puede volver a activarse", async () => {
    const manager = new PluginManager();
    manager.register(makePlugin({ name: "re" }));

    await manager.activate("re");
    await manager.deactivate("re");
    await manager.activate("re");

    expect(manager.list()[0]?.status).toBe("active");
    expect(manager.activeCount).toBe(1);
  });
});

describe("PluginManager — errores de activación", () => {
  it("relanza PluginActivationError con toda la información", async () => {
    const boom = new Error("fallo intencional");
    const manager = new PluginManager();
    manager.register(
      makePlugin({
        name: "malo",
        activate: () => {
          throw boom;
        }
      })
    );

    let thrown: unknown;
    try {
      await manager.activate("malo");
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(PluginActivationError);
    expect(thrown).toBeInstanceOf(NodeDeskError);
    expect(thrown).toBeInstanceOf(Error);
    const activationError = thrown as PluginActivationError;
    expect(activationError.code).toBe("ND_PLUGIN_ACTIVATION");
    expect(activationError.pluginName).toBe("malo");
    expect(activationError.originalError).toBe(boom);
    expect(activationError.message).toContain("malo");
    expect(activationError.message).toContain("fallo intencional");
  });

  it("marca estado error + lastError y emite plugin:error", async () => {
    const events = createEventBus();
    const errors: Array<{ name: string; error: Error }> = [];
    events.on("plugin:error", (payload) => errors.push(payload));

    const manager = new PluginManager({ events });
    manager.register(
      makePlugin({
        name: "malo",
        activate: () => {
          throw new Error("fallo intencional");
        }
      })
    );

    await expect(manager.activate("malo")).rejects.toThrowError(
      PluginActivationError
    );

    const info = manager.list()[0];
    expect(info?.status).toBe("error");
    expect(info?.lastError).toBe("fallo intencional");
    expect(manager.activeCount).toBe(0);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.name).toBe("malo");
    expect(errors[0]?.error).toBeInstanceOf(Error);
    expect(errors[0]?.error.message).toBe("fallo intencional");
  });

  it("el manager sigue operativo tras un fallo de activación", async () => {
    const manager = new PluginManager();
    manager.register(
      makePlugin({
        name: "malo",
        activate: () => {
          throw new Error("boom");
        }
      })
    );
    await expect(manager.activate("malo")).rejects.toBeInstanceOf(
      PluginActivationError
    );

    // El manager acepta registros y activaciones nuevas.
    manager.register(makePlugin({ name: "bueno" }));
    await manager.activate("bueno");
    expect(manager.has("bueno")).toBe(true);
    expect(manager.activeCount).toBe(1);

    // E incluso permite reintentar la activación del plugin fallido.
    await expect(manager.activate("malo")).rejects.toBeInstanceOf(
      PluginActivationError
    );
    expect(manager.list().find((info) => info.name === "malo")?.status).toBe(
      "error"
    );
  });

  it("un activate asíncrono que rechaza también se envuelve", async () => {
    const manager = new PluginManager();
    manager.register(
      makePlugin({
        name: "async-malo",
        activate: async () => {
          await Promise.resolve();
          throw new Error("fallo diferido");
        }
      })
    );

    await expect(manager.activate("async-malo")).rejects.toThrowError(
      /fallo diferido/
    );
    expect(manager.list()[0]?.status).toBe("error");
    expect(manager.list()[0]?.lastError).toBe("fallo diferido");
  });

  it("una reactivación exitosa limpia el lastError previo", async () => {
    const manager = new PluginManager();
    let falla = true;
    manager.register(
      makePlugin({
        name: "intermitente",
        activate: () => {
          if (falla) throw new Error("primera vez falla");
        }
      })
    );

    await expect(manager.activate("intermitente")).rejects.toThrow();
    expect(manager.list()[0]?.lastError).toBe("primera vez falla");

    falla = false;
    await manager.activate("intermitente");

    expect(manager.list()[0]?.status).toBe("active");
    expect(manager.list()[0]?.lastError).toBeUndefined();
  });
});

describe("PluginManager — errores de desactivación", () => {
  it("un deactivate que lanza marca error y NO propaga", async () => {
    const events = createEventBus();
    const errors: Array<{ name: string; error: Error }> = [];
    events.on("plugin:error", (payload) => errors.push(payload));

    const manager = new PluginManager({ events });
    manager.register(
      makePlugin({
        name: "explota-al-apagar",
        deactivate: () => {
          throw new Error("limpieza rota");
        }
      })
    );

    await manager.activate("explota-al-apagar");

    // No rechaza: la desactivación es best-effort.
    await expect(manager.deactivate("explota-al-apagar")).resolves.toBeUndefined();

    const info = manager.list()[0];
    expect(info?.status).toBe("error");
    expect(info?.lastError).toBe("limpieza rota");
    expect(manager.activeCount).toBe(0);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.name).toBe("explota-al-apagar");
    expect(errors[0]?.error.message).toBe("limpieza rota");
  });

  it("un deactivate asíncrono que rechaza tampoco propaga", async () => {
    const manager = new PluginManager();
    manager.register(
      makePlugin({
        name: "async-apagado",
        deactivate: async () => {
          await Promise.resolve();
          throw new Error("limpieza asíncrona rota");
        }
      })
    );

    await manager.activate("async-apagado");
    await expect(manager.deactivate("async-apagado")).resolves.toBeUndefined();
    expect(manager.list()[0]?.status).toBe("error");
    expect(manager.list()[0]?.lastError).toBe("limpieza asíncrona rota");
  });
});

describe("PluginManager — activateAll / deactivateAll", () => {
  it("activateAll activa en orden y aísla los fallos", async () => {
    const orden: string[] = [];
    const manager = new PluginManager();
    manager
      .register(
        makePlugin({
          name: "uno",
          activate: () => {
            orden.push("uno");
          }
        })
      )
      .register(
        makePlugin({
          name: "dos",
          activate: () => {
            throw new Error("dos explota");
          }
        })
      )
      .register(
        makePlugin({
          name: "tres",
          activate: async () => {
            orden.push("tres");
          }
        })
      );

    await manager.activateAll();

    expect(orden).toEqual(["uno", "tres"]);

    const porNombre = new Map(manager.list().map((info) => [info.name, info]));
    expect(porNombre.get("uno")?.status).toBe("active");
    expect(porNombre.get("dos")?.status).toBe("error");
    expect(porNombre.get("dos")?.lastError).toBe("dos explota");
    expect(porNombre.get("tres")?.status).toBe("active");
    expect(manager.size).toBe(3);
    expect(manager.activeCount).toBe(2);
  });

  it("activateAll respeta el orden de registro", async () => {
    const orden: string[] = [];
    const manager = new PluginManager();
    for (const name of ["a", "b", "c", "d"]) {
      manager.register(
        makePlugin({
          name,
          activate: async () => {
            orden.push(name);
          }
        })
      );
    }

    await manager.activateAll();
    expect(orden).toEqual(["a", "b", "c", "d"]);
  });

  it("deactivateAll desactiva solo los plugins activos", async () => {
    const events = createEventBus();
    const deactivated: string[] = [];
    events.on("plugin:deactivated", (payload) => deactivated.push(payload.name));

    const manager = new PluginManager({ events });
    manager.register(makePlugin({ name: "activo-1" }));
    manager.register(
      makePlugin({
        name: "roto",
        activate: () => {
          throw new Error("no arranca");
        }
      })
    );
    manager.register(makePlugin({ name: "activo-2" }));

    await manager.activateAll();
    expect(manager.activeCount).toBe(2);

    // Este se registra después: nunca llega a activarse.
    manager.register(makePlugin({ name: "nunca-activado" }));
    expect(manager.activeCount).toBe(2);

    await manager.deactivateAll();

    expect(manager.activeCount).toBe(0);
    expect(deactivated.sort()).toEqual(["activo-1", "activo-2"]);

    const porNombre = new Map(manager.list().map((info) => [info.name, info]));
    expect(porNombre.get("activo-1")?.status).toBe("deactivated");
    expect(porNombre.get("activo-2")?.status).toBe("deactivated");
    expect(porNombre.get("roto")?.status).toBe("error"); // no estaba activo
    expect(porNombre.get("nunca-activado")?.status).toBe("registered");
  });
});

describe("PluginManager — unregister", () => {
  it("retira un plugin registrado y devuelve true", () => {
    const manager = new PluginManager();
    manager.register(makePlugin({ name: "fuera" }));

    expect(manager.unregister("fuera")).toBe(true);
    expect(manager.has("fuera")).toBe(false);
    expect(manager.size).toBe(0);
    expect(manager.get("fuera")).toBeNull();
  });

  it("unregister de un nombre desconocido devuelve false", () => {
    const manager = new PluginManager();
    expect(manager.unregister("fantasma")).toBe(false);
  });

  it("unregister de un plugin activo lo desactiva antes de retirarlo", async () => {
    const events = createEventBus();
    const despedidas: string[] = [];
    const deactivated: string[] = [];
    events.on("plugin:deactivated", (payload) => deactivated.push(payload.name));

    const manager = new PluginManager({ events });
    manager.register(
      makePlugin({
        name: "adios",
        deactivate: () => {
          despedidas.push("adios");
        }
      })
    );
    await manager.activate("adios");

    const removed = manager.unregister("adios");
    expect(removed).toBe(true);
    expect(manager.has("adios")).toBe(false);
    expect(manager.size).toBe(0);

    // La desactivación se dispara durante el unregister (la parte síncrona
    // del plugin ya corrió) y su cola async completa en microtareas.
    expect(despedidas).toEqual(["adios"]);
    await tick();
    expect(deactivated).toEqual(["adios"]);
  });

  it("unregister no desactiva plugins que no estaban activos", async () => {
    const events = createEventBus();
    const deactivated = vi.fn();
    events.on("plugin:deactivated", deactivated);

    const manager = new PluginManager({ events });
    manager.register(makePlugin({ name: "inactivo" }));

    expect(manager.unregister("inactivo")).toBe(true);
    await tick();
    expect(deactivated).not.toHaveBeenCalled();
  });

  it("permite re-registrar el mismo nombre tras unregister", () => {
    const manager = new PluginManager();
    manager.register(makePlugin({ name: "r" }));
    manager.unregister("r");

    expect(() => manager.register(makePlugin({ name: "r" }))).not.toThrow();
    expect(manager.size).toBe(1);
  });
});

describe("PluginManager — inyección de dependencias", () => {
  it("comparte la infraestructura inyectada con los contextos", async () => {
    const logger = new RecordingLogger();
    const events = createEventBus();
    const services = createServiceRegistry();

    const manager = new PluginManager({ logger, events, services });
    let visto: PluginContext | undefined;
    manager.register(
      makePlugin({
        name: "di",
        activate: (context) => {
          visto = context;
        }
      })
    );

    await manager.activate("di");

    expect(visto?.pluginName).toBe("di");
    expect(visto?.logger).toBe(logger);
    expect(visto?.events).toBe(events);
    expect(visto?.services).toBe(services);
    expect(visto?.apiVersion).toBe("0.1.0");
  });

  it("crea infraestructura propia si no se inyecta nada", async () => {
    const manager = new PluginManager();
    let visto: PluginContext | undefined;
    manager.register(
      makePlugin({
        name: "fresco",
        activate: (context) => {
          visto = context;
        }
      })
    );

    await manager.activate("fresco");

    expect(visto?.events).toBeDefined();
    expect(visto?.services).toBeDefined();
    expect(typeof visto?.core.ProjectManager.discover).toBe("function");
  });

  it("el logger inyectado registra un aviso cuando activateAll aísla un fallo", async () => {
    const logger = new RecordingLogger();
    const manager = new PluginManager({ logger });
    manager.register(
      makePlugin({
        name: "ruidoso",
        activate: () => {
          throw new Error("mucho ruido");
        }
      })
    );

    await manager.activateAll();

    expect(
      logger.messages.some((message) => message.includes("ruidoso"))
    ).toBe(true);
  });
});
