<script lang="ts">
  import AgentStatusIcon from "./AgentStatusIcon.svelte";
  import type { OverflowStatusBarStatus } from "./worktree-list";

  let { status, count }: { status: OverflowStatusBarStatus; count: number } = $props();
</script>

<AgentStatusIcon status={status === "done-unread" ? "done" : status} unread={status === "done-unread"} size={12} />
<span>{count}</span>
