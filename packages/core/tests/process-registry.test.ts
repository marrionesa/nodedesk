import path from "node:path";
import { describe, expect, it } from "vitest";

import { ProcessRegistry } from "../src/process/process-registry.js";
import { tempDir } from "./helpers.js";

describe("ProcessRegistry", () => {
  it("arranca vacío si el fichero no existe", async () => {
    const registry = new ProcessRegistry(
      path.join(await tempDir(), "registry.json")
    );
    expect(await registry.list()).toEqual([]);
  });

  it("add/list/remove persisten en disco", async () => {
    const file = path.join(await tempDir(), "registry.json");
    const registry = new ProcessRegistry(file);
    const root = await tempDir();

    await registry.add({
      pid: 12345,
      root,
      command: "npm run dev",
      startedAt: "2025-01-01T00:00:00.000Z",
      logFile: "/tmp/x.log"
    });

    // Otra instancia lee el mismo fichero.
    const second = new ProcessRegistry(file);
    const list = await second.list();
    expect(list.length).toBe(1);
    expect(list[0]!.pid).toBe(12345);

    expect(await second.findByRoot(root)).not.toBeNull();
    expect(await second.findByPid(12345)).not.toBeNull();
    expect(await second.findByRoot("/no/existe")).toBeNull();

    await second.remove(12345);
    expect(await second.list()).toEqual([]);
  });

  it("reemplaza registros duplicados por pid o por root", async () => {
    const file = path.join(await tempDir(), "registry.json");
    const registry = new ProcessRegistry(file);
    const rootA = await tempDir();
    const rootB = await tempDir();

    await registry.add({
      pid: 100,
      root: rootA,
      command: "a",
      startedAt: "2025-01-01T00:00:00.000Z"
    });
    await registry.add({
      pid: 100,
      root: rootB,
      command: "b",
      startedAt: "2025-01-02T00:00:00.000Z"
    });

    const list = await registry.list();
    expect(list.length).toBe(1);
    expect(list[0]!.root).toBe(rootB);
  });

  it("prune retira pids muertos y devuelve lo retirado", async () => {
    const file = path.join(await tempDir(), "registry.json");
    const registry = new ProcessRegistry(file);
    const root = await tempDir();

    // Un pid imposible de tener vivo.
    await registry.add({
      pid: 999999999,
      root,
      command: "muerto",
      startedAt: "2025-01-01T00:00:00.000Z"
    });

    const pruned = await registry.prune();
    expect(pruned.length).toBe(1);
    expect(pruned[0]!.pid).toBe(999999999);
    expect(await registry.list()).toEqual([]);
  });
});
