import { describe, expect, it } from "vitest";

import {
  detectPackageManager,
  installCommand,
  scriptCommand,
  supportedPackageManagers
} from "../src/project/package-manager.js";
import { tempDir, writeFiles } from "./helpers.js";

describe("detectPackageManager", () => {
  it("detecta npm por package-lock.json", async () => {
    const dir = await tempDir();
    await writeFiles(dir, {
      "package.json": JSON.stringify({ name: "x" }),
      "package-lock.json": "{}"
    });
    const pm = await detectPackageManager(dir);
    expect(pm.id).toBe("npm");
    expect(pm.detected).toBe("lockfile");
  });

  it("detecta pnpm por pnpm-lock.yaml", async () => {
    const dir = await tempDir();
    await writeFiles(dir, {
      "package.json": JSON.stringify({ name: "x" }),
      "pnpm-lock.yaml": "lockfileVersion: '9.0'"
    });
    const pm = await detectPackageManager(dir);
    expect(pm.id).toBe("pnpm");
    expect(pm.detected).toBe("lockfile");
  });

  it("detecta yarn por yarn.lock", async () => {
    const dir = await tempDir();
    await writeFiles(dir, {
      "package.json": JSON.stringify({ name: "x" }),
      "yarn.lock": ""
    });
    const pm = await detectPackageManager(dir);
    expect(pm.id).toBe("yarn");
    expect(pm.detected).toBe("lockfile");
  });

  it("detecta bun por bun.lockb o bun.lock", async () => {
    const dir = await tempDir();
    await writeFiles(dir, {
      "package.json": JSON.stringify({ name: "x" }),
      "bun.lock": "# @bun"
    });
    const pm = await detectPackageManager(dir);
    expect(pm.id).toBe("bun");
    expect(pm.detected).toBe("lockfile");
  });

  it("detecta por el campo packageManager si no hay lockfile", async () => {
    const dir = await tempDir();
    await writeFiles(dir, {
      "package.json": JSON.stringify({
        name: "x",
        packageManager: "pnpm@9.1.0"
      })
    });
    const pm = await detectPackageManager(dir);
    expect(pm.id).toBe("pnpm");
    expect(pm.detected).toBe("packageJson");
  });

  it("por defecto usa npm", async () => {
    const dir = await tempDir();
    await writeFiles(dir, { "package.json": JSON.stringify({ name: "x" }) });
    const pm = await detectPackageManager(dir);
    expect(pm.id).toBe("npm");
    expect(pm.detected).toBe("default");
  });

  it("el lockfile tiene prioridad sobre packageManager", async () => {
    const dir = await tempDir();
    await writeFiles(dir, {
      "package.json": JSON.stringify({
        name: "x",
        packageManager: "yarn@1.22.0"
      }),
      "pnpm-lock.yaml": "lockfileVersion: '9.0'"
    });
    const pm = await detectPackageManager(dir);
    expect(pm.id).toBe("pnpm");
  });
});

describe("comandos de package manager", () => {
  it("scriptCommand usa `run` en los cuatro gestores", () => {
    expect(scriptCommand({ id: "npm", name: "npm", lockFile: null, command: "npm", detected: "default" }, "dev")).toBe(
      "npm run dev"
    );
    expect(scriptCommand({ id: "pnpm", name: "pnpm", lockFile: null, command: "pnpm", detected: "default" }, "build")).toBe(
      "pnpm run build"
    );
    expect(scriptCommand({ id: "yarn", name: "Yarn", lockFile: null, command: "yarn", detected: "default" }, "test")).toBe(
      "yarn run test"
    );
    expect(scriptCommand({ id: "bun", name: "Bun", lockFile: null, command: "bun", detected: "default" }, "dev")).toBe(
      "bun run dev"
    );
  });

  it("installCommand de npm silencia audit y fund", () => {
    expect(
      installCommand({ id: "npm", name: "npm", lockFile: null, command: "npm", detected: "default" })
    ).toBe("npm install --no-audit --no-fund");
    expect(
      installCommand({ id: "bun", name: "Bun", lockFile: null, command: "bun", detected: "default" })
    ).toBe("bun install");
  });

  it("supportedPackageManagers lista los cuatro", () => {
    expect(supportedPackageManagers()).toEqual([
      "npm",
      "pnpm",
      "yarn",
      "bun"
    ]);
  });
});
