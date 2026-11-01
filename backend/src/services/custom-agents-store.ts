import type { AgentDetails, UpsertCustomAgentRequest } from "@webmux/api-contract";
import { loadGlobalCustomAgents, readGlobalCustomAgents, writeGlobalCustomAgent } from "../adapters/global-config";
import { webmuxGlobalConfigPath } from "../adapters/webmux-paths";
import type { AgentId, CustomAgentConfig, CustomAgents } from "../domain/config";
import { isBuiltInAgentId, listAgentDetails, normalizeCustomAgentId } from "./agent-registry";

export type CustomAgentsResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: 400 | 404 | 409; error: string };

export interface CustomAgentsStoreDeps {
  path: string;
  agents: CustomAgents;
  read: (path: string) => CustomAgents;
  write: (path: string, agentId: AgentId, agent: CustomAgentConfig | null) => Promise<CustomAgents>;
}

function toAgentConfig(input: UpsertCustomAgentRequest): CustomAgentConfig {
  return {
    label: input.label,
    startCommand: input.startCommand,
    ...(input.resumeCommand?.trim() ? { resumeCommand: input.resumeCommand.trim() } : {}),
  };
}

/** The machine-wide custom agents, held once per process and shared by every
 *  project. Changes run one at a time: each re-reads the global config file,
 *  checks against and writes to its current `agents:`, then applies the result
 *  in memory so every project sees it immediately. */
export class CustomAgentsStore {
  private agents: CustomAgents;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(private readonly deps: CustomAgentsStoreDeps) {
    this.agents = { ...deps.agents };
  }

  list(): Readonly<CustomAgents> {
    return this.agents;
  }

  details(): AgentDetails[] {
    return listAgentDetails(this.agents);
  }

  create(input: UpsertCustomAgentRequest): Promise<CustomAgentsResult<AgentDetails>> {
    return this.enqueue(async () => {
      const agentId = normalizeCustomAgentId(input.label);
      if (isBuiltInAgentId(agentId) || this.deps.read(this.deps.path)[agentId]) {
        return { ok: false, status: 409, error: `Agent already exists: ${agentId}` };
      }
      return { ok: true, data: await this.save(agentId, toAgentConfig(input)) };
    });
  }

  update(agentId: AgentId, input: UpsertCustomAgentRequest): Promise<CustomAgentsResult<AgentDetails>> {
    return this.enqueue(async () => {
      if (isBuiltInAgentId(agentId)) {
        return { ok: false, status: 400, error: `Built-in agent cannot be edited: ${agentId}` };
      }
      if (!this.deps.read(this.deps.path)[agentId]) {
        return { ok: false, status: 404, error: `Unknown agent: ${agentId}` };
      }
      return { ok: true, data: await this.save(agentId, toAgentConfig(input)) };
    });
  }

  remove(agentId: AgentId): Promise<CustomAgentsResult<null>> {
    return this.enqueue(async () => {
      if (isBuiltInAgentId(agentId)) {
        return { ok: false, status: 400, error: `Built-in agent cannot be deleted: ${agentId}` };
      }
      if (!this.deps.read(this.deps.path)[agentId]) {
        return { ok: false, status: 404, error: `Unknown agent: ${agentId}` };
      }
      this.agents = await this.deps.write(this.deps.path, agentId, null);
      return { ok: true, data: null };
    });
  }

  private enqueue<T>(run: () => Promise<T>): Promise<T> {
    const next = this.queue.then(run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async save(agentId: AgentId, agent: CustomAgentConfig): Promise<AgentDetails> {
    this.agents = await this.deps.write(this.deps.path, agentId, agent);
    const saved = this.details().find((entry) => entry.id === agentId);
    if (!saved) throw new Error(`Saved agent could not be loaded: ${agentId}`);
    return saved;
  }
}

/** Load the global custom agents (`~/.config/webmux/config.yaml` by default). */
export function loadCustomAgentsStore(path: string = webmuxGlobalConfigPath()): CustomAgentsStore {
  return new CustomAgentsStore({
    path,
    agents: loadGlobalCustomAgents(path),
    read: readGlobalCustomAgents,
    write: writeGlobalCustomAgent,
  });
}
