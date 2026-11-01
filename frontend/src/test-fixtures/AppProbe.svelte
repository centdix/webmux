<script lang="ts">
  import { untrack } from "svelte";
  import type { WorktreeSelection } from "../lib/worktree-selection.svelte";

  let { selection, onNoProjects }: { selection: WorktreeSelection; onNoProjects: () => void } = $props();

  // Captured once per instance: a remount is the only way this text changes.
  const mountedFor = untrack(() => selection.project);
</script>

<p>mounted {mountedFor}</p>
<p>current {selection.project}</p>
<button type="button" onclick={() => selection.switchProject("beta")}>to beta</button>
<button type="button" onclick={onNoProjects}>no projects</button>
