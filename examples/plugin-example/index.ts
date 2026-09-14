/**
 * @nodedesk/example-plugin-example — Ejemplo 5 del ecosistema.
 *
 * Demuestra `@nodedesk/plugins` sobre la infraestructura de `@nodedesk/core`:
 *
 * 1. El host construye su infraestructura: bus de eventos + registro de
 *    servicios compartidos (con los que luego leerá el servicio "math").
 * 2. Registra DOS plugins custom:
 *    - "saludo": un plugin normal — usa el logger del host y escucha el bus.
 *    - "math": expone un servicio "math" con add(a, b) en el registro.
 * 3. Los activa con PluginManager y USA el servicio desde el host.
 * 4. Activa también el plugin builtin "hello" y llama a su servicio.
 * 5. Emite un evento "log" por el bus (los plugins suscritos hacen eco).
 * 6. Muestra list() con los estados y desactiva todo (deactivateAll).
 */

import process from "node:process";

import { ConsoleLogger } from "@nodedesk/core";
import type { LoggerLike } from "@nodedesk/core";
import {
  createEventBus,
  createServiceRegistry,
  helloPlugin,
  PluginManager
} from "@nodedesk/plugins";
import type {
  HelloService,
  NodeDeskPlugin,
  PluginInfo,
  PluginStatus
} from "@nodedesk/plugins";

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

/** Color del estado de un plugin. */
function statusColor(status: PluginStatus): (text: string) => string {
  switch (status) {
    case "active":
      return green;
    case "error":
      return red;
    case "deactivated":
      return yellow;
    default:
      return dim;
  }
}

/** Imprime manager.list() con los estados coloreados. */
function printList(infos: PluginInfo[], title: string): void {
  console.log(`\n  ${bold(title)}`);
  for (const info of infos) {
    const description =
      info.description === undefined ? "" : dim(`  — ${info.description}`);
    console.log(
      `    ${cyan(info.name.padEnd(9))} ${info.version.padEnd(7)} ${statusColor(info.status)(info.status)}${description}`
    );
  }
}

/* ------------------------------ plugins custom --------------------------- */

/** Servicio que el plugin "math" publica en el registro del host. */
interface MathService {
  add(a: number, b: number): number;
}

/**
 * Plugin normal: no publica servicio, pero usa el logger del host y escucha
 * los eventos "log" del bus (con su función de baja para la limpieza).
 */
function makeSaludoPlugin(): NodeDeskPlugin {
  // deactivate() no recibe argumentos: se limpia con lo capturado en activate.
  let logger: LoggerLike | undefined;
  let offLog: (() => void) | undefined;
  let seenLogs = 0;

  return {
    name: "saludo",
    version: "1.0.0",
    description: "Plugin normal: usa el logger del host y escucha el bus de eventos.",

    activate(context) {
      logger = context.logger;
      seenLogs = 0;
      offLog = context.events.on("log", (entry) => {
        seenLogs += 1;
        context.logger.info(`[saludo] eco del bus (${entry.level}): ${entry.message}`);
      });
      context.logger.info(`[saludo] activado (contrato ${context.apiVersion})`);
    },

    deactivate() {
      offLog?.();
      offLog = undefined;
      logger?.info(`[saludo] desactivado (he visto ${seenLogs} evento(s) de log)`);
    }
  };
}

/** Plugin de servicio: expone "math" con add(a, b) para el host y otros plugins. */
function makeMathPlugin(): NodeDeskPlugin {
  let unregister: (() => void) | undefined;
  let logger: LoggerLike | undefined;

  return {
    name: "math",
    version: "1.2.0",
    description: 'Expone el servicio "math" con add(a, b).',

    activate(context) {
      logger = context.logger;
      const math: MathService = {
        add(a, b) {
          return a + b;
        }
      };
      context.services.register<MathService>("math", math);
      context.logger.info('[math] servicio "math" registrado');
      unregister = () => {
        context.services.unregister("math");
      };
    },

    deactivate() {
      unregister?.();
      unregister = undefined;
      logger?.info('[math] servicio "math" retirado');
    }
  };
}

/* --------------------------------- flujo --------------------------------- */

async function main(): Promise<void> {
  header("Ejemplo 5 · PluginManager — plugins, servicios y bus de eventos");

  /* 1. Infraestructura del host. */
  step("1 · Infraestructura del host (bus + registro de servicios)");
  const events = createEventBus();
  const services = createServiceRegistry();
  events.on("plugin:activated", ({ name }) => {
    console.log(green(`  ✔ plugin:activated → ${name}`));
  });
  events.on("plugin:deactivated", ({ name }) => {
    console.log(`  ○ plugin:deactivated → ${name}`);
  });
  events.on("plugin:error", ({ name, error }) => {
    console.log(red(`  ✗ plugin:error → ${name}: ${error.message}`));
  });
  console.log(dim("  el host espía el ciclo de vida: plugin:activated/deactivated/error"));

  /* 2. PluginManager con inyección de dependencias. */
  step("2 · PluginManager (logger visible + bus y registro compartidos)");
  const manager = new PluginManager({
    logger: new ConsoleLogger("[host]"),
    events,
    services
  });
  console.log(dim("  todo el contexto es inyectable: logger, events, services y core"));

  /* 3. Registrar dos plugins custom. */
  step("3 · Registrar dos plugins custom (register, encadenable)");
  const saludo = makeSaludoPlugin();
  const math = makeMathPlugin();
  manager.register(saludo).register(math);
  printList(manager.list(), `manager.list() — ${manager.size} plugin(s) registrados`);

  /* 4. Activar ambos. */
  step("4 · Activar ambos (activate)");
  await manager.activate("saludo");
  await manager.activate("math");

  /* 5. Usar el servicio "math" desde el host. */
  step('5 · Usar el servicio "math" desde el host');
  const mathService = services.get<MathService>("math");
  if (mathService === undefined) {
    throw new Error('el servicio "math" no está disponible');
  }
  console.log(`  services.get<MathService>("math").add(2, 3) → ${green(String(mathService.add(2, 3)))}`);
  console.log(`  servicios disponibles: ${services.list().map((name) => cyan(name)).join(", ")}`);

  /* 6. Activar el plugin builtin "hello". */
  step('6 · Activar el plugin builtin "hello"');
  manager.register(helloPlugin);
  await manager.activate("hello");
  const hello = services.get<HelloService>("hello");
  if (hello === undefined) {
    throw new Error('el servicio "hello" no está disponible');
  }
  console.log(`  hello.greet() → ${green(hello.greet())}`);

  /* 7. Emitir un evento "log" por el bus (los plugins suscritos hacen eco). */
  step('7 · Emitir un evento "log" por el bus');
  events.emit("log", {
    level: "info",
    message: "el host saluda a todos los plugins"
  });
  console.log(dim("  (los plugins suscritos — saludo y hello — responden al evento)"));

  /* 8. Estado de todos. */
  step("8 · Estado de todos los plugins (list)");
  printList(
    manager.list(),
    `${manager.activeCount} activo(s) de ${manager.size} registrado(s)`
  );

  /* 9. Desactivar todo. */
  step("9 · Desactivar todo (deactivateAll)");
  await manager.deactivateAll();
  printList(
    manager.list(),
    `tras deactivateAll() — activos: ${manager.activeCount} de ${manager.size}`
  );
  console.log(dim('  el registro de servicios queda vacío: ' + JSON.stringify(services.list())));

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
