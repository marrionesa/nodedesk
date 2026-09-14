/**
 * Helpers de los tests de integración de @nodedesk/cli.
 *
 * Lanzan el binario REAL (`dist/bin.js`) con `spawn`, aíslan el `HOME` para
 * no tocar el registro de procesos del usuario y crean fixtures de
 * proyectos en directorios temporales.
 */

import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Ruta del binario construido (los tests garantizan dist fresco vía `pnpm test`). */
export const BIN_PATH = fileURLToPath(new URL("../dist/bin.js", import.meta.url));

/** Resultado de una invocación del CLI. */
export interface CliResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Opciones de spawn del CLI. */
export interface CliSpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
}

/** Timeout por defecto para una invocación completa. */
const DEFAULT_TIMEOUT_MS = 25_000;

/** Lanza el binario con node (sin depender del bit de ejecución). */
export function spawnCli(
  args: string[],
  options: CliSpawnOptions = {}
): ChildProcessWithoutNullStreams {
  const child = spawn(process.execPath, [BIN_PATH, ...args], {
    cwd: options.cwd,
    env: { ...process.env, ...options.env },
    stdio: ["ignore", "pipe", "pipe"]
  });
  // stdio "pipe" garantiza stdout/stderr presentes (el cast evita null).
  return child as unknown as ChildProcessWithoutNullStreams;
}

/** Recoge stdout/stderr y el código de salida de un proceso del CLI. */
export async function collectResult(
  child: ChildProcessWithoutNullStreams,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<CliResult> {
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk: string) => {
    stderr += chunk;
  });

  const timer = setTimeout(() => {
    child.kill("SIGKILL");
  }, timeoutMs);

  const [code] = (await once(child, "close")) as [number | null, unknown];
  clearTimeout(timer);

  return { code: code ?? -1, stdout, stderr };
}

/** Ejecuta el CLI hasta el final y devuelve su resultado. */
export async function runCli(
  args: string[],
  options: CliSpawnOptions = {}
): Promise<CliResult> {
  return collectResult(spawnCli(args, options));
}

/** Espera (con sondeo) a que una condición se cumpla. */
export async function waitFor(
  condition: () => boolean | Promise<boolean>,
  timeoutMs = 8000
): Promise<void> {
  const step = 50;
  for (let waited = 0; waited < timeoutMs; waited += step) {
    if (await condition()) return;
    await new Promise((resolve) => setTimeout(resolve, step));
  }
  throw new Error("waitFor: se agotó el tiempo de espera");
}

/** Directorio temporal aislado (para proyectos fixture). */
export async function tempDir(prefix = "nodedesk-cli-"): Promise<string> {
  return mkdtemp(path.join(tmpdir(), prefix));
}

/** HOME temporal aislado (para el registro ~/.nodedesk-v2). */
export async function tempHome(): Promise<string> {
  return mkdtemp(path.join(tmpdir(), "nodedesk-home-"));
}

/** Crea un proyecto fixture con los ficheros indicados. */
export async function makeProject(
  files: Record<string, string>
): Promise<string> {
  const root = await tempDir();
  for (const [relative, content] of Object.entries(files)) {
    const target = path.join(root, relative);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }
  return root;
}

/** package.json mínimo con el script dev = node server.mjs. */
export function fixturePackageJson(name: string): string {
  return JSON.stringify(
    {
      name,
      private: true,
      type: "module",
      scripts: { dev: "node server.mjs" }
    },
    null,
    2
  );
}

/** Servidor fixture: imprime "listo", un aviso por stderr y vive para siempre. */
export const KEEP_ALIVE_SERVER = `const PORT = process.env.PORT ?? "sin-port";
console.log("listo en puerto " + PORT);
console.error("aviso de prueba");
setInterval(() => {}, 1000);
`;

/** Servidor fixture que muere solo con código de salida 3. */
export const DYING_SERVER = `console.log("adios");
process.exit(3);
`;
