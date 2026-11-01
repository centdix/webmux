<script lang="ts">
  import type { WorktreeInfo } from "../../lib/types";
  import AgentStatusIcon from "../../lib/AgentStatusIcon.svelte";
  import Btn from "../../lib/Btn.svelte";
  import PrBadge from "../../lib/PrBadge.svelte";
  import LinearBadge from "../../lib/LinearBadge.svelte";
  import { ciStatusTextClass } from "../../lib/utils";

  let { worktree }: { worktree: WorktreeInfo | null } = $props();
</script>

<!-- Stand-in for the TopBar + terminal: where row actions and details live once the sidebar sheds them. -->
<div class="flex min-w-0 flex-1 flex-col bg-surface">
  <div class="flex flex-col gap-1.5 border-b border-edge bg-topbar px-3 py-2.5">
    {#if worktree}
      <div class="flex min-w-0 items-center gap-1.5">
        <span class="min-w-0 truncate text-sm font-semibold" title={worktree.branch}>{worktree.label ?? worktree.branch}</span>
        <AgentStatusIcon status={worktree.agent} pill size={10} />
      </div>
      <div class="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1 text-[10px] text-muted">
        <span>{worktree.project}</span>
        {#if worktree.agentLabel}<span>· {worktree.agentLabel}</span>{/if}
        {#if worktree.profile}<span>· {worktree.profile}</span>{/if}
        {#if worktree.dirty}<span class="text-warning">· dirty</span>{/if}
        {#each worktree.prs as pr (pr.number)}
          <PrBadge {pr} />
          {#if pr.ciStatus !== "none"}<span class={ciStatusTextClass(pr.ciStatus)}>CI {pr.ciStatus}</span>{/if}
        {/each}
        {#if worktree.linearIssue}<LinearBadge issue={worktree.linearIssue} />{/if}
      </div>
      <div class="flex gap-1.5 pt-0.5">
        <Btn small>Close</Btn>
        <Btn small variant="accent-outline">Archive</Btn>
        <Btn small variant="danger-outline">Remove</Btn>
      </div>
    {:else}
      <span class="text-sm text-muted">Select a worktree</span>
    {/if}
  </div>
  <div class="flex flex-1 flex-col gap-1.5 p-3">
    {#each [70, 45, 85, 30, 60] as width}
      <span class="h-2 rounded bg-hover" style="width:{width}%"></span>
    {/each}
    <span class="mt-2 text-[10px] text-muted/70">TopBar + terminal of the selected worktree</span>
  </div>
</div>
