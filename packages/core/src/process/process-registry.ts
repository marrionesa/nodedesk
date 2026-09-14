import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

/**
 * Registro persistente de procesos en background.
 *
 * Derivado conceptualmente del registro `~/.nodedesk/projects.json` de V1
 * (`state.rs`), reducido a lo que el ecosistema necesita: anotar procesos
 * vivos (pid + ruta + log) para poder detenerlos o leer sus logs más
 * tarde. Usa `~/.nodedesk-v2/processes.json` para no colisionar con V1.
 */
export interface ProcessRecord {
  pid: number;
  /** Ruta absoluta de la raíz del proyecto. */
  root: string;
  /** Comando con el que se arrancó. */
  command: string;
  /** ISO-8601 del arranque. */
  startedAt: string;
  /** Fichero de log al que va la salida (modo detached). */
  logFile?: string;
}

/** Estado del registro serializable. */
export interface ProcessRegistryFile {
  version: 1;
  processes: ProcessRecord[];
}

/** Ruta por defecto del registro (`~/.nodedesk-v2/processes.json`). */
export function defaultRegistryPath(): string {
  return path.join(os.homedir(), ".nodedesk-v2", "processes.json");
}

/** Carpeta por defecto de logs (`~/.nodedesk-v2/logs`). */
export function defaultLogsDir(): string {
  return path.join(os.homedir(), ".nodedesk-v2", "logs");
}

export class ProcessRegistry {
  private processes: ProcessRecord[] = [];
  private readonly file: string;
  private loaded = false;

  constructor(file = defaultRegistryPath()) {
    this.file = file;
  }

  private async ensureLoaded(): Promise<void> {
    if (this.loaded) return;
    try {
      const raw = await fs.readFile(this.file, "utf8");
      const parsed = JSON.parse(raw) as ProcessRegistryFile;
      this.processes = Array.isArray(parsed.processes) ? parsed.processes : [];
    } catch {
      this.processes = [];
    }
    this.loaded = true;
  }

  private async persist(): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const payload: ProcessRegistryFile = {
      version: 1,
      processes: this.processes
    };
    await fs.writeFile(this.file, JSON.stringify(payload, null, 2), "utf8");
  }

  /** Anota un proceso vivo. */
  async add(record: ProcessRecord): Promise<void> {
    await this.ensureLoaded();
    this.processes = this.processes.filter(
      (existing) => existing.pid !== record.pid && existing.root !== record.root
    );
    this.processes.push(record);
    await this.persist();
  }

  /** Retira un proceso del registro (p.ej. al morir). */
  async remove(pid: number): Promise<void> {
    await this.ensureLoaded();
    this.processes = this.processes.filter(
      (existing) => existing.pid !== pid
    );
    await this.persist();
  }

  /** Todos los registros. */
  async list(): Promise<ProcessRecord[]> {
    await this.ensureLoaded();
    return [...this.processes];
  }

  /** Busca el registro de un proyecto por su ruta. */
  async findByRoot(root: string): Promise<ProcessRecord | null> {
    const absolute = path.resolve(root);
    const list = await this.list();
    return (
      list.find((record) => path.resolve(record.root) === absolute) ?? null
    );
  }

  /** Busca por pid exacto. */
  async findByPid(pid: number): Promise<ProcessRecord | null> {
    const list = await this.list();
    return list.find((record) => record.pid === pid) ?? null;
  }

  /**
   * Limpieza perezosa: retira del registro los pids que ya no existen.
   * Devuelve los registros retirados.
   */
  async prune(): Promise<ProcessRecord[]> {
    const { isProcessAlive } = await import("./kill.js");
    await this.ensureLoaded();
    const dead = this.processes.filter(
      (record) => !isProcessAlive(record.pid)
    );
    if (dead.length > 0) {
      this.processes = this.processes.filter(
        (record) => isProcessAlive(record.pid)
      );
      await this.persist();
    }
    return dead;
  }
}
