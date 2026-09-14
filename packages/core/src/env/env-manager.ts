import { promises as fs } from "node:fs";
import path from "node:path";

import { EnvFileError } from "../errors.js";
import type {
  EnvEntry,
  EnvManagerOptions
} from "../types/env.js";

import {
  parseEnv,
  serializeEnv,
  entriesToObject
} from "./dotenv.js";

/**
 * Gestor del fichero `.env` de un proyecto.
 *
 * Derivado de `env.rs` de V1 (`nd_get_env` / `nd_save_env`): lectura y
 * escritura de variables respetando comentarios, orden y formato.
 *
 * ```ts
 * const env = new EnvManager("./my-project");
 * await env.set("PORT", "3000");
 * const port = await env.get("PORT"); // "3000"
 * const all = await env.all();        // { PORT: "3000", ... }
 * await env.delete("DEBUG");
 * ```
 */
export class EnvManager {
  /** Ruta del fichero `.env` gestionado. */
  readonly path: string;

  private envEntries: EnvEntry[] = [];
  private loaded = false;
  private readonly autosave: boolean;

  constructor(root: string, options: EnvManagerOptions = {}) {
    this.path = options.path ?? path.join(root, ".env");
    this.autosave = options.autosave ?? true;
  }

  /** Carga (o recarga) el fichero `.env` desde disco. */
  async load(): Promise<void> {
    let content = "";
    try {
      content = await fs.readFile(this.path, "utf8");
    } catch {
      // Fichero inexistente: empezamos desde cero.
      content = "";
    }
    this.envEntries = parseEnv(content);
    this.loaded = true;
  }

  private async ensureLoaded(): Promise<void> {
    if (!this.loaded) await this.load();
  }

  /** `true` si el fichero `.env` existe en disco. */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.path);
      return true;
    } catch {
      return false;
    }
  }

  /** Valor de una variable (o `undefined` si no existe). */
  async get(key: string): Promise<string | undefined> {
    await this.ensureLoaded();
    return this.envEntries.find((entry) => entry.key === key)?.value;
  }

  /** `true` si la variable existe. */
  async has(key: string): Promise<boolean> {
    return (await this.get(key)) !== undefined;
  }

  /**
   * Fija (o actualiza) una variable y persiste el fichero si `autosave`
   * está activo. Conserva el comentario previo de la variable si existía.
   */
  async set(key: string, value: string): Promise<void> {
    this.assertKey(key);
    await this.ensureLoaded();

    const existing = this.envEntries.find((entry) => entry.key === key);
    if (existing) {
      existing.value = value;
      existing.quoted = existing.quoted ?? false;
    } else {
      this.envEntries.push({ key, value });
    }

    if (this.autosave) await this.save();
  }

  /** Elimina una variable y persiste si `autosave` está activo. */
  async delete(key: string): Promise<boolean> {
    await this.ensureLoaded();
    const index = this.envEntries.findIndex((entry) => entry.key === key);
    if (index === -1) return false;

    this.envEntries.splice(index, 1);
    if (this.autosave) await this.save();
    return true;
  }

  /** Todas las variables como objeto plano. */
  async all(): Promise<Record<string, string>> {
    await this.ensureLoaded();
    return entriesToObject(this.envEntries);
  }

  /** Nombres de variables en orden de aparición. */
  async keys(): Promise<string[]> {
    await this.ensureLoaded();
    return this.envEntries.map((entry) => entry.key);
  }

  /** Entradas completas (con comentarios), en orden. */
  async entries(): Promise<EnvEntry[]> {
    await this.ensureLoaded();
    return structuredClone(this.envEntries);
  }

  /**
   * Escribe el estado actual al fichero `.env`.
   * @throws EnvFileError si el disco falla.
   */
  async save(): Promise<void> {
    const content = serializeEnv(this.envEntries);
    try {
      await fs.mkdir(path.dirname(this.path), { recursive: true });
      await fs.writeFile(this.path, content, "utf8");
      this.loaded = true;
    } catch (error) {
      throw new EnvFileError(
        `escribiendo ${this.path}: ${errorMessage(error)}`
      );
    }
  }

  /**
   * Entorno combinado para lanzar procesos: `process.env` + variables del
   * `.env` (el fichero gana) + overrides (ganan sobre todo).
   *
   * Equivalente a `process.rs::build_process_env` de V1.
   */
  async buildEnvironment(
    overrides: Record<string, string> = {}
  ): Promise<Record<string, string>> {
    const merged: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) merged[key] = value;
    }
    Object.assign(merged, await this.all());
    Object.assign(merged, overrides);
    return merged;
  }

  private assertKey(key: string): void {
    if (
      key.length === 0 ||
      !/^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ||
      key.includes("\n")
    ) {
      throw new EnvFileError(`nombre de variable inválido: ${JSON.stringify(key)}`);
    }
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
