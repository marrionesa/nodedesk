/**
 * @nodedesk/example-process-manager — Ejemplo 2 del ecosistema.
 *
 * Demuestra el ciclo de vida completo de `ProcessManager` (@nodedesk/core):
 *
 * 1. Crea un mini-proyecto en un directorio temporal (package.json con
 *    script `dev` + un server.mjs que imprime líneas y vive hasta que llega
 *    un SIGTERM).
 * 2. Muestra el comando que `resolveCommand()` resolvería para el script.
 * 3. Lo arranca en modo attached y escucha los eventos `log` (clasificados
 *    en info/warn/error/system) imprimiendo el nivel con color ANSI propio.
 * 4. Espera 3 segundos y hace un `stop()` limpio (SIGTERM al grupo completo
 *    → periodo de gracia → SIGKILL), con try/finally para no dejar procesos
 *    colgados.
 * 5. Imprime un resumen con el exit code y la señal de terminación.
 */

import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { detectPackageManager, ProcessManager, sleep } from "@nodedesk/core";
import type {
  LogEntry,
  LogLevel,
  ProcessExit,
  ProcessStatus
} from "@nodedesk/core";

/* ------------------------------- constantes ------------------------------ */

/** Segundos que el proceso hijo vive antes del stop(). */
const DEMO_SECONDS = 3;

/** package.json del mini-proyecto (packageManager declarado: sin lockfile,
 *  `detectPackageManager` lo deduce del campo estándar `packageManager`). */
const MINI_PACKAGE_JSON = JSON.stringify(
  {
    name: "mini-demo",
    private: true,
    type: "module",
    packageManager: "pnpm@9.15.9",
    scripts: { dev: "node server.mjs" }
  },
  null,
  2
);

/** El proceso que arrancaremos: imprime líneas y vive hasta el SIGTERM. */
const MINI_SERVER = `// Mini servidor de demostración.
const started = Date.now();
console.log("mini servidor arrancado (node " + process.version + ", pid " + process.pid + ")");

let tick = 0;
const timer = setInterval(() => {
  tick += 1;
  if (tick === 2) {
    console.log("⚠ uso de memoria por encima de lo habitual (simulado)");
  } else if (tick === 3) {
    process.stderr.write("err! la dependencia externa tarda demasiado (simulado)\\n");
  } else {
    console.log("heartbeat " + tick + " · " + (Date.now() - started) + " ms de vida");
  }
}, 700);

process.on("SIGTERM", () => {
  clearInterval(timer);
  console.log("recibido SIGTERM → cierre limpio");
  process.exit(0);
});
`;

/* ------------------------------- consola -------------------------------- */

/** Los colores ANSI se desactivan si la variable NO_COLOR está presente. */
const color = process.env.NO_COLOR === undefined;

const paint = (code: string, text: string): string =>
  color ? `\u001b[${code}m${text}\u001b[0m` : text;

const bold = (text: string): string => paint("1", text);
const dim = (text: string): string => paint("2", text);
const cyan = (text: string): string => paint("36", text);
const green = (text: string): string => paint("32", text);
const yellow = (text: string): string => paint("33", text);
const red = (text: string): string => paint("31", text);

const LINE = "─".repeat(74);

function header(title: string): void {
  console.log(`\n${dim(LINE)}`);
  console.log(bold(`  ${title}`));
  console.log(dim(LINE));
}

function step(title: string): void {
  console.log(`\n${bold(`  ${title}`)}`);
}

/** Color por nivel de log (los cuatro niveles de classifyLine). */
function levelColor(level: LogLevel): (text: string) => string {
  switch (level) {
    case "info":
      return (text) => text;
    case "warn":
      return yellow;
    case "error":
      return red;
    case "system":
      return cyan;
  }
}

/* --------------------------------- flujo -------------------------------- */

async function main(): Promise<void> {
  header("Ejemplo 2 · ProcessManager — ciclo de vida completo");

  /* 1. Mini-proyecto en un directorio temporal. */
  step("1 · Creando un mini-proyecto en un directorio temporal");
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "nodedesk-example-"));
  await fs.writeFile(path.join(root, "package.json"), MINI_PACKAGE_JSON, "utf8");
  await fs.writeFile(path.join(root, "server.mjs"), MINI_SERVER, "utf8");
  console.log(`  directorio temporal: ${dim(root)}`);
  console.log(`  package.json → script "dev": ${bold("node server.mjs")}`);
  console.log(dim("  server.mjs (el proceso que vamos a arrancar):"));
  for (const line of MINI_SERVER.trimEnd().split("\n")) {
    console.log(dim(`  │ ${line}`));
  }

  /* 2. Qué resolvería ProcessManager para el script "dev". */
  step("2 · Resolución del comando (resolveCommand + detección de PM)");
  const manager = new ProcessManager(root);
  const resolved = await manager.resolveCommand("dev");
  const pm = await detectPackageManager(root);
  console.log(`  resolveCommand("dev") → ${bold(resolved)}`);
  console.log(
    `  detectPackageManager → ${bold(pm.id)} (vía ${pm.detected})`
  );
  console.log(
    dim('  el demo arranca "node server.mjs" directamente para mantener la salida sin ruido')
  );

  /* 3. Suscribirse a los eventos ANTES de arrancar. */
  step("3 · Suscripción a eventos (antes de arrancar)");
  console.log(
    dim("  eventos: log (clasificado) · status · exit — el nivel se pinta con ANSI propio")
  );

  let exit: ProcessExit | null = null;
  let logCount = 0;

  manager.on("log", (entry: LogEntry) => {
    logCount += 1;
    const tag = levelColor(entry.level)(`[${entry.level}]`.padEnd(9));
    console.log(`  ${tag} ${entry.line}`);
  });
  manager.on("status", (status: ProcessStatus) => {
    console.log(dim(`  [estado] ${status}`));
  });
  manager.on("exit", (result: ProcessExit) => {
    exit = result;
  });

  /* 4-5. Arrancar, dejarlo vivir 3 s y pararlo SIEMPRE (try/finally). */
  step(`4 · start() en modo attached · ${DEMO_SECONDS} s de vida`);
  try {
    const info = await manager.start({ command: "node server.mjs" });
    console.log(
      `  start() → pid ${bold(String(info.pid))} · estado ${info.status} · comando "${info.command}"`
    );
    console.log(
      dim(`  el hijo corre en su propio grupo: el apagado nunca nos afecta a nosotros`)
    );
    await sleep(DEMO_SECONDS * 1000);
  } finally {
    step("5 · stop() — SIGTERM al grupo completo (gracia → SIGKILL)");
    if (manager.running) {
      await manager.stop();
    } else {
      console.log(dim("  (el proceso ya no estaba corriendo)"));
    }
  }

  /* 6. Resumen. */
  step("6 · Resumen");
  const result: ProcessExit = exit ?? (await manager.wait());
  console.log(`  exit code: ${bold(String(result.code))}`);
  console.log(`  señal de terminación: ${bold(String(result.signal))}`);
  console.log(`  líneas de log recibidas: ${logCount}`);
  console.log(
    dim("  · el hijo directo (un «sh -c», el comando se lanza con shell) murió por la")
  );
  console.log(
    dim("    señal SIGTERM → exit code null. El mini servidor node también la recibió")
  );
  console.log(
    dim("    (SIGTERM al grupo completo): imprimió su despedida y salió con exit(0).")
  );

  await fs.rm(root, { recursive: true, force: true });
  console.log(dim(`  directorio temporal eliminado: ${root}`));
  console.log(`\n  ${green("✔ demo completada")}`);
}

/* Ejecución con gestión de errores y código de salida. */
main()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((error: unknown) => {
    console.error(
      red(`\n✗ ${error instanceof Error ? error.message : String(error)}`)
    );
    process.exitCode = 1;
  });
