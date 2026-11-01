<script lang="ts">
  import { setUpProject } from "./api";
  import { errorMessage, projectInitPhaseLabel } from "./utils";
  import type { ProjectInitPhase } from "./types";

  let { onadded }: { onadded: (prefix: string) => void } = $props();

  let path = $state("");
  let error = $state<string | null>(null);
  let busy = $state(false);
  let phase = $state<ProjectInitPhase | null>(null);

  async function add(): Promise<void> {
    const target = path.trim();
    if (!target || busy) return;
    busy = true;
    error = null;
    phase = null;
    try {
      const { prefix } = await setUpProject(target, (next) => (phase = next));
      path = "";
      onadded(prefix);
    } catch (err) {
      error = errorMessage(err);
    } finally {
      busy = false;
      phase = null;
    }
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Enter") {
      event.preventDefault();
      void add();
    }
  }
</script>

<div class="flex gap-2">
  <input
    type="text"
    bind:value={path}
    onkeydown={onKeydown}
    placeholder="Path to a git repo"
    aria-label="Path to a git repo"
    disabled={busy}
    class="flex-1 min-w-0 px-3 py-2 text-sm rounded border border-edge bg-surface text-primary placeholder:text-muted disabled:opacity-50"
  />
  <button
    type="button"
    class="shrink-0 px-3 py-2 text-sm rounded border border-edge text-primary hover:bg-hover disabled:opacity-50"
    disabled={busy || path.trim() === ""}
    onclick={add}
  >
    Add
  </button>
</div>
{#if busy && phase}
  <div class="mt-3 flex items-center gap-2 text-sm text-muted">
    <span class="spinner"></span>
    {projectInitPhaseLabel(phase)}…
  </div>
{/if}
{#if error}
  <div class="mt-2 text-sm text-red-400 break-words">{error}</div>
{/if}
