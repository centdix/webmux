<script lang="ts">
  import { onMount } from "svelte";
  import { errorMessage } from "./utils";
  import Btn from "./Btn.svelte";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import AgentEditorDialog from "./AgentEditorDialog.svelte";
  import { createAgent, deleteAgent, fetchAgents, updateAgent, validateAgent } from "./api";
  import type { ProjectCache } from "./project-cache.svelte";
  import type {
    AgentDetails,
    AppConfig,
    UpsertCustomAgentRequest,
    ValidateCustomAgentResponse,
  } from "./types";

  interface AgentEditorState {
    mode: "create" | "edit";
    agentId?: string;
    title: string;
    initialValue: {
      label: string;
      startCommand: string;
      resumeCommand: string;
    };
  }

  let {
    configs,
  }: {
    /** Every project's config carries the agent summaries; reloaded after a change. */
    configs: ProjectCache<AppConfig>;
  } = $props();

  let agents = $state<AgentDetails[]>([]);
  let customAgents = $derived(agents.filter((agent) => agent.kind === "custom"));
  let agentsLoading = $state(true);
  let agentsError = $state<string | null>(null);
  let editor = $state<AgentEditorState | null>(null);
  let deleteCandidate = $state<AgentDetails | null>(null);
  let deletingAgentId = $state<string | null>(null);

  onMount(() => {
    void loadAgentList();
  });

  async function loadAgentList(): Promise<void> {
    agentsLoading = true;
    agentsError = null;

    try {
      agents = await fetchAgents();
    } catch (err) {
      agentsError = errorMessage(err);
    } finally {
      agentsLoading = false;
    }
  }

  function openCreateAgentEditor(): void {
    editor = {
      mode: "create",
      title: "Add custom agent",
      initialValue: {
        label: "",
        startCommand: "",
        resumeCommand: "",
      },
    };
  }

  function openEditAgentEditor(agent: AgentDetails): void {
    editor = {
      mode: "edit",
      agentId: agent.id,
      title: `Edit ${agent.label}`,
      initialValue: {
        label: agent.label,
        startCommand: agent.startCommand ?? "",
        resumeCommand: agent.resumeCommand ?? "",
      },
    };
  }

  function openDuplicateAgentEditor(agent: AgentDetails): void {
    editor = {
      mode: "create",
      title: `Duplicate ${agent.label}`,
      initialValue: {
        label: `${agent.label} Copy`,
        startCommand: agent.startCommand ?? "",
        resumeCommand: agent.resumeCommand ?? "",
      },
    };
  }

  async function handleSaveAgent(input: UpsertCustomAgentRequest): Promise<void> {
    if (!editor) return;

    if (editor.mode === "edit" && editor.agentId) {
      await updateAgent(editor.agentId, input);
    } else {
      await createAgent(input);
    }

    await loadAgentList();
    configs.reloadLoaded();
    editor = null;
  }

  function handleValidateAgent(input: UpsertCustomAgentRequest): Promise<ValidateCustomAgentResponse> {
    return validateAgent(input);
  }

  async function handleDeleteAgent(): Promise<void> {
    if (!deleteCandidate) return;
    deletingAgentId = deleteCandidate.id;

    try {
      await deleteAgent(deleteCandidate.id);
      await loadAgentList();
      configs.reloadLoaded();
      deleteCandidate = null;
    } finally {
      deletingAgentId = null;
    }
  }
</script>

<div class="mb-5">
  <span class="block text-xs text-muted mb-2">Agents</span>
  <div class="rounded-lg border border-edge bg-surface/40 p-3">
    <div class="mb-3 flex items-center justify-between gap-2">
      <div>
        <p class="text-[13px] text-primary">Custom agents</p>
        <p class="mt-0.5 text-[11px] text-muted">
          Terminal agents webmux can launch in every project. Saved to <code class="text-accent/80">~/.config/webmux/config.yaml</code>.
        </p>
      </div>
      <Btn type="button" variant="cta" onclick={openCreateAgentEditor}>Add agent</Btn>
    </div>

    {#if agentsLoading}
      <p class="text-[12px] text-muted">Loading agents...</p>
    {:else if agentsError}
      <p class="text-[12px] text-danger">{agentsError}</p>
    {:else if customAgents.length === 0}
      <p class="text-[12px] text-muted">No custom agents setup</p>
    {:else}
      <div class="space-y-2">
        {#each customAgents as agent (agent.id)}
          <div class="rounded-lg border border-edge bg-surface px-3 py-2.5">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="text-[13px] text-primary">{agent.label}</span>
                </div>
                <p class="mt-1 text-[11px] text-muted font-mono break-all">
                  {agent.startCommand}
                </p>
                {#if agent.resumeCommand}
                  <p class="mt-1 text-[11px] text-muted font-mono break-all">
                    Resume: {agent.resumeCommand}
                  </p>
                {/if}
              </div>

              <div class="flex shrink-0 gap-2 text-[11px]">
                <button type="button" class="text-accent hover:underline" onclick={() => openEditAgentEditor(agent)}>
                  Edit
                </button>
                <button type="button" class="text-accent hover:underline" onclick={() => openDuplicateAgentEditor(agent)}>
                  Duplicate
                </button>
                <button
                  type="button"
                  class="text-danger hover:underline disabled:opacity-60"
                  disabled={deletingAgentId === agent.id}
                  onclick={() => (deleteCandidate = agent)}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

{#if editor}
  <AgentEditorDialog
    title={editor.title}
    initialValue={editor.initialValue}
    onsave={handleSaveAgent}
    onvalidate={handleValidateAgent}
    onclose={() => (editor = null)}
  />
{/if}

{#if deleteCandidate}
  <ConfirmDialog
    message={`Delete agent "${deleteCandidate.label}"?`}
    onconfirm={() => {
      void handleDeleteAgent();
    }}
    oncancel={() => {
      deleteCandidate = null;
    }}
  />
{/if}
