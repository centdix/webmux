<script lang="ts">
  import { untrack } from "svelte";
  import { errorMessage } from "./utils";
  import SettingToggle from "./SettingToggle.svelte";
  import { projectApi } from "./api";
  import type { ProjectCache } from "./project-cache.svelte";
  import type { AppConfig } from "./types";

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

  const bodyId = $props.id();
  let expanded = $state(untrack(() => defaultExpanded));
  let config = $derived(configs.get(project));

  let pendingAutoCreate = $state<boolean | null>(null);
  let autoCreate = $derived(pendingAutoCreate ?? config?.linearAutoCreateWorktrees ?? false);
  let autoCreateSaving = $state(false);

  let pendingAutoRemove = $state<boolean | null>(null);
  let autoRemove = $derived(pendingAutoRemove ?? config?.autoRemoveOnMerge ?? false);
  let autoRemoveSaving = $state(false);
  let toggleError = $state<string | null>(null);

  // A section loads its project's config the first time it is expanded.
  $effect(() => {
    if (!expanded) return;
    configs.ensure(project);
  });

  function handleAutoCreateToggle(enabled: boolean): void {
    pendingAutoCreate = enabled;
    autoCreateSaving = true;
    toggleError = null;
    projectApi(project).setLinearAutoCreate({ body: { enabled } })
      .then((result) => {
        configs.update(project, (c) => ({ ...c, linearAutoCreateWorktrees: result.enabled }));
      })
      .catch((err: unknown) => (toggleError = errorMessage(err)))
      .finally(() => {
        pendingAutoCreate = null;
        autoCreateSaving = false;
      });
  }

  function handleAutoRemoveToggle(enabled: boolean): void {
    pendingAutoRemove = enabled;
    autoRemoveSaving = true;
    toggleError = null;
    projectApi(project).setAutoRemoveOnMerge({ body: { enabled } })
      .then((result) => {
        configs.update(project, (c) => ({ ...c, autoRemoveOnMerge: result.enabled }));
      })
      .catch((err: unknown) => (toggleError = errorMessage(err)))
      .finally(() => {
        pendingAutoRemove = null;
        autoRemoveSaving = false;
      });
  }
</script>

<section class="rounded-lg border border-edge" aria-label={name}>
  <h3 class="m-0">
    <button
      type="button"
      class="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[13px] font-semibold text-primary bg-transparent border-none cursor-pointer hover:bg-hover rounded-lg"
      aria-expanded={expanded}
      aria-controls={bodyId}
      onclick={() => (expanded = !expanded)}
    >
      <span class="min-w-0 truncate">{name}</span>
      <span class="text-[10px] text-muted" aria-hidden="true">{expanded ? "▾" : "▸"}</span>
    </button>
  </h3>

  {#if expanded}
    <div id={bodyId} class="px-3 pb-3 space-y-4">
      <div>
        <span class="block text-xs text-muted mb-2">Linear</span>
        <SettingToggle
          title="Auto-create worktrees"
          description={'Automatically create worktrees for Todo Linear tickets with the "webmux" label. Every project with this on acts on the same tickets unless its config sets integrations.linear.watchTeams.'}
          checked={autoCreate}
          disabled={!config || autoCreateSaving}
          ontoggle={handleAutoCreateToggle}
          aria-label={`Auto-create worktrees for Linear tickets in ${name}`}
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
          aria-label={`Auto-remove worktrees on PR merge in ${name}`}
        />
      </div>

      {#if toggleError}
        <p class="text-[12px] text-danger" role="alert">{toggleError}</p>
      {/if}
    </div>
  {/if}
</section>
