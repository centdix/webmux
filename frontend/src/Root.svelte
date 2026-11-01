<script lang="ts">
  import { untrack } from "svelte";
  import App from "./App.svelte";
  import Btn from "./lib/Btn.svelte";
  import EmptyProjects from "./lib/EmptyProjects.svelte";
  import { resolveInitialProject } from "./lib/api";
  import { writeLocationHash } from "./lib/project-location";
  import { applyTheme, loadSavedTheme, saveLastProject } from "./lib/utils";
  import { WorktreeSelection } from "./lib/worktree-selection.svelte";
  import type { InitialProject } from "./lib/types";

  let { initial }: { initial: InitialProject } = $props();

  /** Null in the empty state; App mounts once and moves between projects
   *  through it. */
  let selection = $state<WorktreeSelection | null>(null);
  let loadError = $state<string | null>(null);
  let retrying = $state(false);

  // The empty and error states render before App, which owns theme changes.
  applyTheme(loadSavedTheme());
  // Boot-time choice only; later switches come from the dashboard/empty state.
  untrack(() => applyInitial(initial));

  $effect(() => {
    if (selection) saveLastProject(selection.project);
  });

  /** Open the dashboard on `next`, or the empty state when null. */
  function openProject(next: string | null): void {
    if (!next) {
      writeLocationHash(null, null);
      saveLastProject(null);
    }
    selection = next ? new WorktreeSelection(next) : null;
  }

  /** A failed project fetch keeps the hash and last project untouched; only a
   *  genuinely empty list falls back to the empty state. */
  function applyInitial(result: InitialProject): void {
    if (result.kind === "error") {
      loadError = result.message;
      return;
    }
    loadError = null;
    openProject(result.kind === "project" ? result.prefix : null);
  }

  async function retry(): Promise<void> {
    retrying = true;
    applyInitial(await resolveInitialProject());
    retrying = false;
  }
</script>

{#if loadError !== null}
  <div class="min-h-screen flex items-center justify-center bg-surface text-primary p-6">
    <div class="w-full max-w-md">
      <h1 class="text-lg font-semibold mb-2">Could not load projects</h1>
      <p class="text-sm text-danger mb-4 break-words">{loadError}</p>
      <Btn type="button" disabled={retrying} onclick={retry}>Retry</Btn>
    </div>
  </div>
{:else if selection === null}
  <EmptyProjects onProjectAdded={openProject} />
{:else}
  <App {selection} onNoProjects={() => openProject(null)} />
{/if}
