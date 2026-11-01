<script lang="ts">
  import AddProjectForm from "./AddProjectForm.svelte";

  let { onProjectAdded }: { onProjectAdded: (prefix: string) => void } = $props();
</script>

<div class="min-h-screen flex items-center justify-center bg-bg text-primary p-6">
  <div class="w-full max-w-md">
    <h1 class="text-lg font-semibold mb-2">No projects yet</h1>
    <p class="text-sm text-muted mb-4">
      webmux serves every project from this one dashboard. Add a git repo below
      and webmux sets it up for you — scaffolding a
      <code class="text-primary">.webmux.yaml</code> and analyzing the project
      to fill it in.
    </p>
    <AddProjectForm onadded={onProjectAdded} />
  </div>
</div>
