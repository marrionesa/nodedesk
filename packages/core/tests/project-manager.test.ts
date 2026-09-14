import { promises as fs } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { InvalidProjectError, PathNotFoundError } from "../src/errors.js";
import { ProjectManager } from "../src/project/project-manager.js";
import {
  createSampleProject,
  tempDir,
  writeFiles
} from "./helpers.js";

describe("ProjectManager.load", () => {
  it("carga un proyecto con package.json válido", async () => {
    const root = await createSampleProject();
    const project = await ProjectManager.load(root);

    expect(project.name).toBe("sample-app");
    expect(project.root).toBe(path.resolve(root));
    expect(project.scripts.dev).toBe("node src/server.mjs");
    expect(project.dependencies).toEqual(["express"]);
    expect(project.devDependencies).toEqual(["vitest"]);
    expect(project.nodeEngine).toBe(">=18");
    expect(project.hasNodeModules).toBe(false);
  });

  it("usa el nombre del directorio si package.json no tiene name", async () => {
    const root = await tempDir("sin-nombre-");
    await writeFiles(root, {
      "package.json": JSON.stringify({ version: "0.0.0" })
    });

    const project = await ProjectManager.load(root);
    expect(project.name).toBe(path.basename(root));
  });

  it("lanza InvalidProjectError sin package.json", async () => {
    const root = await tempDir();
    await expect(ProjectManager.load(root)).rejects.toThrow(
      InvalidProjectError
    );
  });

  it("lanza InvalidProjectError con package.json roto", async () => {
    const root = await tempDir();
    await writeFiles(root, { "package.json": "{ esto no es json" });
    await expect(ProjectManager.load(root)).rejects.toThrow(
      InvalidProjectError
    );
  });

  it("lanza PathNotFoundError si la ruta no existe", async () => {
    await expect(
      ProjectManager.load("/no/existe/esta/ruta")
    ).rejects.toThrow(PathNotFoundError);
  });
});

describe("ProjectManager.discover", () => {
  it("encuentra proyectos anidados respetando la profundidad", async () => {
    const workspace = await tempDir("workspace-");
    await writeFiles(workspace, {
      "apps/alpha/package.json": JSON.stringify({ name: "alpha" }),
      "apps/beta/package.json": JSON.stringify({ name: "beta" }),
      "libs/gamma/package.json": JSON.stringify({ name: "gamma" }),
      "tools/delta/README.md": "no soy un proyecto"
    });

    const projects = await ProjectManager.discover(workspace);
    const names = projects.map((p) => p.name).sort();
    expect(names).toEqual(["alpha", "beta", "gamma"]);
  });

  it("respeta depth y no desciende en proyectos si stopAtProject", async () => {
    const workspace = await tempDir("workspace-");
    await writeFiles(workspace, {
      "a/package.json": JSON.stringify({ name: "a" }),
      "a/node_modules/x/package.json": JSON.stringify({ name: "x" }),
      "a/nested/deep/package.json": JSON.stringify({ name: "deep" }),
      "a/sub/package.json": JSON.stringify({ name: "sub" })
    });

    const projects = await ProjectManager.discover(workspace, { depth: 1 });
    expect(projects.map((p) => p.name)).toEqual(["a"]);

    const deep = await ProjectManager.discover(workspace, {
      depth: 4,
      stopAtProject: false
    });
    expect(deep.map((p) => p.name).sort()).toEqual(["a", "deep", "sub"]);
  });

  it("ignora node_modules y directorios ocultos", async () => {
    const workspace = await tempDir("workspace-");
    await writeFiles(workspace, {
      "real/package.json": JSON.stringify({ name: "real" }),
      "node_modules/fake/package.json": JSON.stringify({ name: "fake" }),
      ".hidden/secret/package.json": JSON.stringify({ name: "secret" }),
      "dist/generated/package.json": JSON.stringify({ name: "generated" })
    });

    const projects = await ProjectManager.discover(workspace);
    expect(projects.map((p) => p.name)).toEqual(["real"]);
  });

  it("detecta el propio workspace si tiene package.json", async () => {
    const root = await createSampleProject();
    const projects = await ProjectManager.discover(root, { depth: 0 });
    expect(projects.map((p) => p.name)).toEqual(["sample-app"]);
  });

  it("lanza PathNotFoundError si la raíz no existe", async () => {
    await expect(
      ProjectManager.discover("/no/existe")
    ).rejects.toThrow(PathNotFoundError);
  });
});

describe("ProjectManager.isValid", () => {
  it("true para proyecto válido", async () => {
    const root = await createSampleProject();
    expect(await ProjectManager.isValid(root)).toBe(true);
  });

  it("false para directorio sin package.json", async () => {
    const root = await tempDir();
    expect(await ProjectManager.isValid(root)).toBe(false);
  });
});

describe("NodeProject", () => {
  it("expone metadata serializable y gestores", async () => {
    const root = await createSampleProject();
    const project = await ProjectManager.load(root);

    const snapshot = project.toJSON();
    expect(snapshot.name).toBe("sample-app");
    expect(snapshot.slug).toBe("sample-app");
    expect(snapshot.path).toBe(path.resolve(root));
    expect(snapshot.envPath).toBe(path.join(root, ".env"));
    expect(snapshot.scripts.test).toBe("node --test");

    expect(project.id).toMatch(/^prj-[0-9a-f]{7}$/);
    expect(project.createEnvManager().path).toBe(
      path.join(root, ".env")
    );
    expect(project.createProcessManager()).toBeDefined();
    expect(project.devCommand).toBe("npm run dev");
  });

  it("detecta node_modules y .git cuando existen", async () => {
    const root = await tempDir();
    await writeFiles(root, {
      "package.json": JSON.stringify({ name: "checked" })
    });
    await fs.mkdir(path.join(root, "node_modules"));
    await fs.mkdir(path.join(root, ".git"));

    const project = await ProjectManager.load(root);
    expect(project.hasNodeModules).toBe(true);
    expect(project.isGitRepository).toBe(true);
  });
});
