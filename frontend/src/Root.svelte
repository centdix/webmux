<script lang="ts">
  import { untrack } from "svelte";
  import App from "./App.svelte";
  import EmptyProjects from "./lib/EmptyProjects.svelte";
  import { setActiveProject } from "./lib/api";
  import { writeLocationHash } from "./lib/project-location";
  import { saveLastProject } from "./lib/utils";

  let { initialProject }: { initialProject: string | null } = $props();

  let project = $state<string | null>(null);
  // Boot-time choice only; later switches come from the dashboard/empty state.
  untrack(() => switchProject(initialProject));

  /** Switch the dashboard to `next` in memory: no reload, no path change —
   *  `{#key}` remounts App against the new project's API client. */
  function switchProject(next: string | null): void {
    if (next) setActiveProject(next);
    else writeLocationHash(null, null);
    saveLastProject(next);
    project = next;
  }
</script>

{#if project === null}
  <EmptyProjects onProjectAdded={switchProject} />
{:else}
  {#key project}
    <App onSwitchProject={switchProject} />
  {/key}
{/if}
