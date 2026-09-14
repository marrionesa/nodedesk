import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

/** Crea un directorio temporal para tests. */
export async function tempDir(prefix = "nodedesk-test-"): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

/** Escribe ficheros relativos dentro de un directorio. */
export async function writeFiles(
  root: string,
  files: Record<string, string>
): Promise<void> {
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, content, "utf8");
  }
}

/** Crea un proyecto Node.js mínimo en un directorio temporal. */
export async function createSampleProject(
  overrides: Record<string, string> = {}
): Promise<string> {
  const root = await tempDir();
  await writeFiles(root, {
    "package.json": JSON.stringify(
      {
        name: "sample-app",
        version: "1.2.3",
        private: true,
        scripts: {
          dev: "node src/server.mjs",
          start: "node src/server.mjs",
          test: "node --test"
        },
        dependencies: { express: "^4.19.0" },
        devDependencies: { vitest: "^1.0.0" },
        engines: { node: ">=18" },
        ...overrides
      },
      null,
      2
    ),
    "src/server.mjs": "console.log('ready');\n",
    ".env": "PORT=3000\n",
    ...Object.fromEntries(
      Object.entries(overrides).map(([key, value]) => [key, value])
    )
  });
  return root;
}
