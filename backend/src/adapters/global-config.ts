import { existsSync, readFileSync } from "node:fs";
import { mkdir, rename } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { AgentId, CustomAgentConfig, CustomAgents } from "../domain/config";
import { isRecord } from "../lib/type-guards";

function parseCustomAgent(raw: unknown): CustomAgentConfig | null {
  if (!isRecord(raw)) return null;
  if (typeof raw.label !== "string" || !raw.label.trim()) return null;
  if (typeof raw.startCommand !== "string" || !raw.startCommand.trim()) return null;

  return {
    label: raw.label.trim(),
    startCommand: raw.startCommand.trim(),
    ...(typeof raw.resumeCommand === "string" && raw.resumeCommand.trim()
      ? { resumeCommand: raw.resumeCommand.trim() }
      : {}),
  };
}

function parseCustomAgents(raw: unknown): CustomAgents {
  if (!isRecord(raw)) return {};

  return Object.entries(raw).reduce<CustomAgents>((acc, [id, value]) => {
    if (!id.trim()) return acc;
    const parsed = parseCustomAgent(value);
    if (parsed) {
      acc[id.trim()] = parsed;
    }
    return acc;
  }, {});
}

/** Parse the global config file; a missing or empty file is an empty document.
 *  Throws when the file exists but is not a YAML mapping. */
function readGlobalConfigDocument(path: string): Record<string, unknown> {
  if (!existsSync(path)) return {};
  const parsed: unknown = parseYaml(readFileSync(path, "utf8"));
  if (parsed === null || parsed === undefined) return {};
  if (!isRecord(parsed)) throw new Error(`Global config is not a YAML mapping: ${path}`);
  return parsed;
}

/** Read the custom agents from the global config file (`agents:`); a missing or
 *  unreadable file means no custom agents. */
export function loadGlobalCustomAgents(path: string): CustomAgents {
  try {
    return readGlobalCustomAgents(path);
  } catch {
    return {};
  }
}

/** Read the custom agents from the global config file, throwing when it exists
 *  but cannot be parsed. */
export function readGlobalCustomAgents(path: string): CustomAgents {
  return parseCustomAgents(readGlobalConfigDocument(path).agents);
}

/** Set (or, with `null`, remove) one agent in the file's current `agents:`
 *  section, keeping its other agents and keys, and return the resulting agents.
 *  Refuses to write when the file exists but cannot be parsed. */
export async function writeGlobalCustomAgent(
  path: string,
  agentId: AgentId,
  agent: CustomAgentConfig | null,
): Promise<CustomAgents> {
  const document = readGlobalConfigDocument(path);
  const agents = isRecord(document.agents) ? { ...document.agents } : {};
  if (agent) {
    agents[agentId] = {
      label: agent.label,
      startCommand: agent.startCommand,
      ...(agent.resumeCommand ? { resumeCommand: agent.resumeCommand } : {}),
    };
  } else {
    delete agents[agentId];
  }
  if (Object.keys(agents).length === 0) {
    delete document.agents;
  } else {
    document.agents = agents;
  }

  await mkdir(dirname(path), { recursive: true });
  const tempPath = join(dirname(path), `.${basename(path)}.${process.pid}.${Date.now()}.tmp`);
  await Bun.write(tempPath, stringifyYaml(document));
  await rename(tempPath, path);
  return parseCustomAgents(document.agents);
}
