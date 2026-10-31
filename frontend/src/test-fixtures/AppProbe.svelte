<script lang="ts">
  import { onMount } from "svelte";
  import { activePrefix, api } from "../lib/api";

  let { onSwitchProject }: { onSwitchProject: (prefix: string | null) => void } = $props();

  // Captured once per instance: a remount is the only way this text changes.
  const mountedFor = activePrefix;

  onMount(() => {
    void api.fetchConfig().catch(() => {});
  });
</script>

<p>mounted {mountedFor}</p>
<button type="button" onclick={() => onSwitchProject("beta")}>to beta</button>
