import type { AgentSummary, WorktreeInfo } from "./types";

export function findWorktreeAgent(
  agents: AgentSummary[],
  worktree: WorktreeInfo | undefined,
): AgentSummary | undefined {
  if (!worktree?.agentName) return undefined;
  return agents.find((candidate) => candidate.id === worktree.agentName);
}

/** Whether the dashboard can talk to this worktree's agent through the chat UI instead of
 *  the terminal. The name check is the fallback for the window before config has loaded. */
export function supportsWorktreeChat(
  agents: AgentSummary[],
  worktree: WorktreeInfo | undefined,
): boolean {
  if (!worktree?.agentName) return false;
  const agent = findWorktreeAgent(agents, worktree);
  return agent?.capabilities.inAppChat ?? (worktree.agentName === "codex" || worktree.agentName === "claude");
}

/** Forking a session into a tab is a built-in agent feature — the backend rejects it for
 *  custom agents, whose start command it cannot resume from a parent session. */
export function supportsWorktreeTabs(
  agents: AgentSummary[],
  worktree: WorktreeInfo | undefined,
): boolean {
  return findWorktreeAgent(agents, worktree)?.kind === "builtin";
}
