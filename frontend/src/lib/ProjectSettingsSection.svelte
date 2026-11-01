<script lang="ts">
  import { untrack } from "svelte";
  import { errorMessage } from "./utils";
  import Btn from "./Btn.svelte";
  import SettingToggle from "./SettingToggle.svelte";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import AgentEditorDialog from "./AgentEditorDialog.svelte";
  import { createAgent, deleteAgent, fetchAgents, updateAgent, validateAgent, projectApi } from "./api";
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
    project,
    name,
    configs,
    defaultExpanded,
  }: {
    project: string;
    name: string;
    /** Each project's config: read for the toggles, updated once they save. */
    configs: ProjectCache<AppConfig>;
    defaultExpanded: boolean;
  } = $props();

  let expanded = $state(untrack(() => defaultExpanded));
  let config = $derived(configs.get(project));

  let pendingAutoCreate = $state<boolean | null>(null);
  let autoCreate = $derived(pendingAutoCreate ?? config?.linearAutoCreateWorktrees ?? false);
  let autoCreateSaving = $state(false);

  let pendingAutoRemove = $state<boolean | null>(null);
  let autoRemove = $derived(pendingAutoRemove ?? config?.autoRemoveOnMerge ?? false);
  let autoRemoveSaving = $state(false);

  let agents = $state<AgentDetails[]>([]);
  let customAgents = $derived(agents.filter((agent) => agent.kind === "custom"));
  let agentsLoading = $state(true);
  let agentsError = $state<string | null>(null);
  let agentsRequested = false;
  let editor = $state<AgentEditorState | null>(null);
  let deleteCandidate = $state<AgentDetails | null>(null);
  let deletingAgentId = $state<string | null>(null);

  // A section loads its project's data the first time it is expanded.
  $effect(() => {
    if (!expanded) return;
    configs.ensure(project);
    if (agentsRequested) return;
    agentsRequested = true;
    void loadAgentList();
  });

  async function loadAgentList(): Promise<void> {
    agentsLoading = true;
    agentsError = null;

    try {
      agents = await fetchAgents(project);
    } catch (err) {
      agentsError = errorMessage(err);
    } finally {
      agentsLoading = false;
    }
  }

  /** The config carries the agent summaries the rest of the app reads. */
  function reloadConfig(): void {
    configs.invalidate(project);
    configs.ensure(project);
  }

  function handleAutoCreateToggle(enabled: boolean): void {
    pendingAutoCreate = enabled;
    autoCreateSaving = true;
    projectApi(project).setLinearAutoCreate({ body: { enabled } })
      .then((result) => {
        configs.update(project, (c) => ({ ...c, linearAutoCreateWorktrees: result.enabled }));
      })
      .finally(() => {
        pendingAutoCreate = null;
        autoCreateSaving = false;
      });
  }

  function handleAutoRemoveToggle(enabled: boolean): void {
    pendingAutoRemove = enabled;
    autoRemoveSaving = true;
    projectApi(project).setAutoRemoveOnMerge({ body: { enabled } })
      .then((result) => {
        configs.update(project, (c) => ({ ...c, autoRemoveOnMerge: result.enabled }));
      })
      .finally(() => {
        pendingAutoRemove = null;
        autoRemoveSaving = false;
      });
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
      await updateAgent(project, editor.agentId, input);
    } else {
      await createAgent(project, input);
    }

    await loadAgentList();
    reloadConfig();
    editor = null;
  }

  function handleValidateAgent(input: UpsertCustomAgentRequest): Promise<ValidateCustomAgentResponse> {
    return validateAgent(project, input);
  }

  async function handleDeleteAgent(): Promise<void> {
    if (!deleteCandidate) return;
    deletingAgentId = deleteCandidate.id;

    try {
      await deleteAgent(project, deleteCandidate.id);
      await loadAgentList();
      reloadConfig();
      deleteCandidate = null;
    } finally {
      deletingAgentId = null;
    }
  }
</script>

<section class="rounded-lg border border-edge" aria-label={name}>
  <h3 class="m-0">
    <button
      type="button"
      class="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[13px] font-semibold text-primary bg-transparent border-none cursor-pointer hover:bg-hover rounded-lg"
      aria-expanded={expanded}
      onclick={() => (expanded = !expanded)}
    >
      <span class="min-w-0 truncate">{name}</span>
      <span class="text-[10px] text-muted" aria-hidden="true">{expanded ? "▾" : "▸"}</span>
    </button>
  </h3>

  {#if expanded}
    <div class="px-3 pb-3 space-y-4">
      <div>
        <span class="block text-xs text-muted mb-2">Agents</span>
        <div class="rounded-lg border border-edge bg-surface/40 p-3">
          <div class="mb-3 flex items-center justify-between gap-2">
            <div>
              <p class="text-[13px] text-primary">Custom agents</p>
              <p class="mt-0.5 text-[11px] text-muted">
                Add terminal agents that webmux can launch from the dashboard.
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

      <div>
        <span class="block text-xs text-muted mb-2">Linear</span>
        <SettingToggle
          title="Auto-create worktrees"
          description={'Automatically create worktrees for Todo Linear tickets with the "webmux" label.'}
          checked={autoCreate}
          disabled={!config || autoCreateSaving}
          ontoggle={handleAutoCreateToggle}
          aria-label="Auto-create worktrees for Linear tickets"
        />
      </div>

      <div>
        <span class="block text-xs text-muted mb-2">GitHub</span>
        <SettingToggle
          title="Auto-remove on merge"
          description="Automatically remove worktrees when their PR is merged on GitHub."
          checked={autoRemove}
          disabled={!config || autoRemoveSaving}
          ontoggle={handleAutoRemoveToggle}
          aria-label="Auto-remove worktrees on PR merge"
        />
      </div>
    </div>
  {/if}
</section>

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
