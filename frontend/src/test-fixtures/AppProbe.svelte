<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { projectApi } from "../lib/api";

  let { project, onSwitchProject }: { project: string; onSwitchProject: (prefix: string | null) => void } = $props();

  // Captured once per instance: a remount is the only way this text changes.
  const mountedFor = untrack(() => project);

  onMount(() => {
    void projectApi(project).fetchConfig().catch(() => {});
  });
</script>

<p>mounted {mountedFor}</p>
<button type="button" onclick={() => onSwitchProject("beta")}>to beta</button>
