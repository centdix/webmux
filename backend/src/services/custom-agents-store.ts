import type { AgentDetails, UpsertCustomAgentRequest } from "@webmux/api-contract";
import { loadGlobalCustomAgents, writeGlobalCustomAgents } from "../adapters/global-config";
import { webmuxGlobalConfigPath } from "../adapters/webmux-paths";
import type { AgentId, CustomAgentConfig, CustomAgents } from "../domain/config";
import { isBuiltInAgentId, listAgentDetails, normalizeCustomAgentId } from "./agent-registry";

export type CustomAgentsResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: 400 | 404 | 409; error: string };

export interface CustomAgentsStoreDeps {
  path: string;
  agents: CustomAgents;
  write: (path: string, agents: CustomAgents) => Promise<void>;
}

function toAgentConfig(input: UpsertCustomAgentRequest): CustomAgentConfig {
  return {
    label: input.label,
    startCommand: input.startCommand,
    ...(input.resumeCommand?.trim() ? { resumeCommand: input.resumeCommand.trim() } : {}),
  };
}

/** The machine-wide custom agents, held once per process and shared by every
 *  project. Each change is written to the global config file, then applied in
 *  memory so every project sees it immediately. */
export class CustomAgentsStore {
  private agents: CustomAgents;

  constructor(private readonly deps: CustomAgentsStoreDeps) {
    this.agents = { ...deps.agents };
  }

  list(): CustomAgents {
    return this.agents;
  }

  details(): AgentDetails[] {
    return listAgentDetails(this.agents);
  }

  async create(input: UpsertCustomAgentRequest): Promise<CustomAgentsResult<AgentDetails>> {
    const agentId = normalizeCustomAgentId(input.label);
    if (isBuiltInAgentId(agentId) || this.agents[agentId]) {
      return { ok: false, status: 409, error: `Agent already exists: ${agentId}` };
    }
    return { ok: true, data: await this.save(agentId, toAgentConfig(input)) };
  }

  async update(agentId: AgentId, input: UpsertCustomAgentRequest): Promise<CustomAgentsResult<AgentDetails>> {
    if (isBuiltInAgentId(agentId)) {
      return { ok: false, status: 400, error: `Built-in agent cannot be edited: ${agentId}` };
    }
    if (!this.agents[agentId]) {
      return { ok: false, status: 404, error: `Unknown agent: ${agentId}` };
    }
    return { ok: true, data: await this.save(agentId, toAgentConfig(input)) };
  }

  async remove(agentId: AgentId): Promise<CustomAgentsResult<null>> {
    if (isBuiltInAgentId(agentId)) {
      return { ok: false, status: 400, error: `Built-in agent cannot be deleted: ${agentId}` };
    }
    if (!this.agents[agentId]) {
      return { ok: false, status: 404, error: `Unknown agent: ${agentId}` };
    }
    const { [agentId]: _removed, ...rest } = this.agents;
    await this.deps.write(this.deps.path, rest);
    this.agents = rest;
    return { ok: true, data: null };
  }

  private async save(agentId: AgentId, agent: CustomAgentConfig): Promise<AgentDetails> {
    const next = { ...this.agents, [agentId]: agent };
    await this.deps.write(this.deps.path, next);
    this.agents = next;
    const saved = this.details().find((entry) => entry.id === agentId);
    if (!saved) throw new Error(`Saved agent could not be loaded: ${agentId}`);
    return saved;
  }
}

/** Load the global custom agents (`~/.config/webmux/config.yaml` by default). */
export function loadCustomAgentsStore(path: string = webmuxGlobalConfigPath()): CustomAgentsStore {
  return new CustomAgentsStore({ path, agents: loadGlobalCustomAgents(path), write: writeGlobalCustomAgents });
}
