<script lang="ts">
  import { onMount } from "svelte";
  import { fetchProjects, removeProject, setUpProject } from "./api";
  import ConfirmDialog from "./ConfirmDialog.svelte";
  import { errorMessage, projectInitPhaseLabel } from "./utils";
  import type { ProjectInitPhase, ProjectSummary } from "./types";

  let { current, onSwitch }: { current: string; onSwitch: (prefix: string | null) => void } = $props();

  let projects = $state<ProjectSummary[]>([]);
  let open = $state(false);
  let addPath = $state("");
  let error = $state<string | null>(null);
  let confirmRemove = $state<ProjectSummary | null>(null);
  let busy = $state(false);
  let addPhase = $state<ProjectInitPhase | null>(null);
  let triggerEl: HTMLButtonElement | undefined = $state();
  let menuEl: HTMLDivElement | undefined = $state();
  let menuRect = $state<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

  onMount(() => {
    void load();
  });

  async function load(): Promise<void> {
    try {
      projects = await fetchProjects();
    } catch {
      projects = [];
    }
  }

  function switchTo(prefix: string | null): void {
    open = false;
    if (prefix !== current) onSwitch(prefix);
  }

  function positionMenu(): void {
    if (!triggerEl) return;
    const rect = triggerEl.getBoundingClientRect();
    const width = Math.max(rect.width + 120, 280);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    menuRect = { top: rect.bottom + 4, left, width };
  }

  function toggle(): void {
    if (open) {
      open = false;
      return;
    }
    error = null;
    void load();
    positionMenu();
    open = true;
  }

  function handleDocumentClick(event: MouseEvent): void {
    if (!open) return;
    const target = event.target;
    if (!(target instanceof Node)) return;
    if (triggerEl?.contains(target)) return;
    if (menuEl?.contains(target)) return;
    open = false;
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (open && event.key === "Escape") {
      open = false;
      triggerEl?.focus();
    }
  }

  async function handleAdd(): Promise<void> {
    const path = addPath.trim();
    if (!path || busy) return;
    busy = true;
    error = null;
    addPhase = null;
    try {
      const { prefix } = await setUpProject(path, (next) => (addPhase = next));
      addPath = "";
      switchTo(prefix);
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
      addPhase = null;
    }
  }

  function handleAddKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleAdd();
    }
  }

  function handleRemoveClick(event: MouseEvent, project: ProjectSummary): void {
    event.preventDefault();
    event.stopPropagation();
    if (busy) return;
    error = null;
    // Removing the open project tears down the dashboard: confirm first.
    if (project.prefix === current) confirmRemove = project;
    else void remove(project.prefix);
  }

  async function remove(prefix: string): Promise<void> {
    busy = true;
    error = null;
    try {
      await removeProject(prefix);
      // A failed reload must not read as "no projects left": keep the current
      // state and surface the error instead.
      const remaining = await fetchProjects();
      projects = remaining;
      confirmRemove = null;
      // The dashboard can't stay on a removed project: move to another one,
      // or to the empty state when none is left.
      if (prefix === current) switchTo(remaining[0]?.prefix ?? null);
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
    }
  }
</script>

<svelte:window onclick={handleDocumentClick} onkeydown={handleKeydown} onresize={() => open && positionMenu()} onscroll={() => open && positionMenu()} />

<button
  bind:this={triggerEl}
  type="button"
  class="shrink-0 h-6 w-6 inline-flex items-center justify-center rounded-md text-muted hover:bg-hover hover:text-primary"
  title="Switch project"
  aria-haspopup="menu"
  aria-expanded={open}
  onclick={toggle}
>
  <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden="true">
    <path d="M2 4 L6 8 L10 4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</button>

{#if open}
  <div
    bind:this={menuEl}
    role="menu"
    class="fixed z-50 rounded-md border border-edge bg-surface shadow-lg overflow-hidden"
    style="top: {menuRect.top}px; left: {menuRect.left}px; width: {menuRect.width}px;"
  >
    <div class="px-3 py-2 text-[11px] text-muted uppercase tracking-wide border-b border-edge">
      Projects
    </div>
    {#each projects as project (project.prefix)}
      <div class="flex items-stretch border-t border-edge first:border-t-0 hover:bg-hover">
        <button
          type="button"
          class="block flex-1 min-w-0 px-3 py-2 text-[12px] text-left"
          role="menuitem"
          onclick={() => switchTo(project.prefix)}
        >
          <div class="text-primary font-medium truncate">
            {project.name}
            {#if project.prefix === current}
              <span class="text-muted text-[10px] font-normal">· current</span>
            {/if}
          </div>
          <div class="text-muted text-[11px] truncate">{project.path}</div>
        </button>
        <button
          type="button"
          class="shrink-0 px-2 text-muted hover:text-primary"
          title="Remove project"
          disabled={busy}
          onclick={(event) => handleRemoveClick(event, project)}
        >
          ×
        </button>
      </div>
    {/each}

    <div class="px-3 py-2 border-t border-edge">
      <div class="flex gap-1">
        <input
          type="text"
          bind:value={addPath}
          onkeydown={handleAddKeydown}
          placeholder="Path to a git repo…"
          disabled={busy}
          class="flex-1 min-w-0 px-2 py-1 text-[12px] rounded border border-edge bg-bg text-primary placeholder:text-muted disabled:opacity-50"
        />
        <button
          type="button"
          class="shrink-0 px-2 py-1 text-[12px] rounded border border-edge text-primary hover:bg-hover disabled:opacity-50"
          disabled={busy || addPath.trim() === ""}
          onclick={handleAdd}
        >
          Add
        </button>
      </div>
      {#if busy && addPhase}
        <div class="mt-1 flex items-center gap-1 text-[11px] text-muted">
          <span class="spinner"></span>
          {projectInitPhaseLabel(addPhase)}…
        </div>
      {/if}
      {#if error}
        <div class="mt-1 text-[11px] text-red-400 break-words">{error}</div>
      {/if}
    </div>
  </div>
{/if}

{#if confirmRemove}
  {@const target = confirmRemove}
  <ConfirmDialog
    message={`Remove ${target.name}, the project open now? The dashboard switches to another project.`}
    loading={busy}
    error={error ?? ""}
    onconfirm={() => remove(target.prefix)}
    oncancel={() => (confirmRemove = null)}
  />
{/if}
