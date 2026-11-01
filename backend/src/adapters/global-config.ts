import { readFileSync } from "node:fs";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { CustomAgents } from "../domain/config";
import { isRecord } from "../lib/type-guards";
import { parseCustomAgents } from "./config";

function readGlobalConfigDocument(path: string): Record<string, unknown> {
  try {
    const parsed: unknown = parseYaml(readFileSync(path, "utf8"));
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

/** Read the custom agents from the global config file (`agents:`); a missing or
 *  unreadable file means no custom agents. */
export function loadGlobalCustomAgents(path: string): CustomAgents {
  return parseCustomAgents(readGlobalConfigDocument(path).agents);
}

/** Replace the `agents:` section of the global config file, keeping its other keys. */
export async function writeGlobalCustomAgents(path: string, agents: CustomAgents): Promise<void> {
  const document = readGlobalConfigDocument(path);
  if (Object.keys(agents).length === 0) {
    delete document.agents;
  } else {
    document.agents = Object.fromEntries(
      Object.entries(agents).map(([id, agent]) => [id, {
        label: agent.label,
        startCommand: agent.startCommand,
        ...(agent.resumeCommand ? { resumeCommand: agent.resumeCommand } : {}),
      }]),
    );
  }
  await Bun.write(path, stringifyYaml(document));
}
