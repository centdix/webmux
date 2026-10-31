// Sync Node fs APIs on purpose: mirrors projects-registry.ts so a read-modify-write
// of the shared file can't interleave with another request in this process.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parsePortRegistration, type PortRegistration } from "../domain/port-registrations";
import { log } from "../lib/log";
import { webmuxRuntimeStateDir } from "./webmux-paths";

export interface PortRegistry {
  list(): PortRegistration[];
  replaceAll(entries: PortRegistration[]): void;
}

function defaultRegistryFile(): string {
  return join(webmuxRuntimeStateDir(), "ports.json");
}

export function createPortRegistry(file: string = defaultRegistryFile()): PortRegistry {
  return {
    list(): PortRegistration[] {
      let raw: string;
      try {
        raw = readFileSync(file, "utf8");
      } catch {
        return [];
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        log.debug(`[port-registry] ignoring malformed ${file}`);
        return [];
      }
      if (!Array.isArray(parsed)) return [];
      return parsed.map(parsePortRegistration).filter((entry) => entry !== null);
    },

    replaceAll(entries: PortRegistration[]): void {
      mkdirSync(dirname(file), { recursive: true });
      const tmpPath = `${file}.${process.pid}.${Date.now()}.tmp`;
      writeFileSync(tmpPath, `${JSON.stringify(entries, null, 2)}\n`);
      renameSync(tmpPath, file);
    },
  };
}
