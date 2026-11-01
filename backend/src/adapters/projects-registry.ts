// Sync Node fs APIs on purpose: mirrors instance-registry.ts so writes flush
// from synchronous startup/shutdown paths where async (Bun.write) would not.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { isProjectEntry, type ProjectEntry } from "../domain/projects";
import { log } from "../lib/log";
import { webmuxRuntimeStateDir } from "./webmux-paths";

export interface ProjectsRegistry {
  /** All known, well-formed project entries, in insertion order. */
  list(): ProjectEntry[];
  /** Upsert by `path`: an existing entry with the same path is replaced. */
  add(entry: ProjectEntry): void;
  /** Remove the entry for `path`, if present. */
  remove(path: string): void;
}

function defaultRegistryFile(): string {
  return join(webmuxRuntimeStateDir(), "projects.json");
}

export type ProjectsRegistryReadResult =
  | { ok: true; entries: ProjectEntry[] }
  | { ok: false; error: string };

/** Strict read: a missing file is an empty registry, but an unreadable or
 *  malformed one is reported instead of being treated as empty. */
export function readProjectsRegistryFile(file: string = defaultRegistryFile()): ProjectsRegistryReadResult {
  let raw: string;
  try {
    raw = readFileSync(file, "utf8");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return { ok: true, entries: [] };
    return { ok: false, error: `Cannot read ${file}: ${error instanceof Error ? error.message : String(error)}` };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    return { ok: false, error: `Invalid JSON in ${file}: ${error instanceof Error ? error.message : String(error)}` };
  }
  if (!Array.isArray(parsed)) return { ok: false, error: `Invalid ${file}: expected a JSON array` };
  return { ok: true, entries: parsed.filter(isProjectEntry) };
}

export function createProjectsRegistry(file: string = defaultRegistryFile()): ProjectsRegistry {
  function read(): ProjectEntry[] {
    const result = readProjectsRegistryFile(file);
    if (result.ok) return result.entries;
    log.debug(`[projects-registry] ignoring ${result.error}`);
    return [];
  }

  function write(entries: ProjectEntry[]): void {
    mkdirSync(dirname(file), { recursive: true });
    const tmpPath = `${file}.${process.pid}.${Date.now()}.tmp`;
    writeFileSync(tmpPath, `${JSON.stringify(entries, null, 2)}\n`);
    renameSync(tmpPath, file);
  }

  return {
    list(): ProjectEntry[] {
      return read();
    },

    add(entry: ProjectEntry): void {
      const entries = read().filter((existing) => existing.path !== entry.path);
      entries.push(entry);
      write(entries);
    },

    remove(path: string): void {
      const entries = read();
      const next = entries.filter((entry) => entry.path !== path);
      if (next.length !== entries.length) write(next);
    },
  };
}
