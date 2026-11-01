import type { CreatingWorktreeState, PrEntry, ProjectSnapshot, WorktreeSnapshot } from "../domain/model";
import { compareWorktreeOrder, type WorktreeOrderFields } from "../domain/policies";
import type { RuntimeNotification } from "./notification-service";
import { ProjectRuntime } from "./project-runtime";

function formatElapsedSince(startedAt: string | null, now: () => Date): string {
  if (!startedAt) return "";
  const startedMs = Date.parse(startedAt);
  if (Number.isNaN(startedMs)) return "";

  const diffMs = Math.max(0, now().getTime() - startedMs);
  const diffMinutes = Math.floor(diffMs / 60_000);

  if (diffMinutes < 1) return "0m";
  if (diffMinutes < 60) return `${diffMinutes}m`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

function clonePrEntry(pr: PrEntry): PrEntry {
  return {
    ...pr,
    ciChecks: pr.ciChecks.map((check) => ({ ...check })),
    comments: pr.comments.map((comment) => ({ ...comment })),
  };
}

function mapCreationSnapshot(creating: CreatingWorktreeState | null): WorktreeSnapshot["creation"] {
  return creating
    ? {
        phase: creating.phase,
      }
    : null;
}

function mapWorktreeSnapshot(
  state: ReturnType<ProjectRuntime["listWorktrees"]>[number],
  now: () => Date,
  creating: CreatingWorktreeState | null,
  isArchived: (path: string) => boolean,
  findLinearIssue?: (branch: string) => WorktreeSnapshot["linearIssue"],
  findAgentLabel?: (agentId: string | null) => string | null,
): WorktreeSnapshot {
  return {
    id: creating?.worktreeId ?? state.worktreeId,
    branch: state.branch,
    label: state.label,
    ...(state.baseBranch ? { baseBranch: state.baseBranch } : {}),
    path: state.path,
    dir: state.path,
    archived: isArchived(state.path),
    profile: state.profile,
    agentName: state.agentName,
    agentLabel: findAgentLabel ? findAgentLabel(state.agentName) : state.agentName,
    agentTerminalStale: state.agentTerminalStale,
    mux: state.session.exists,
    dirty: state.git.dirty,
    unpushed: state.git.aheadCount > 0,
    paneCount: state.session.paneCount,
    status: creating ? "creating" : state.agent.lifecycle,
    elapsed: formatElapsedSince(state.agent.lastStartedAt, now),
    services: state.services.map((service) => ({ ...service })),
    prs: state.prs.map((pr) => clonePrEntry(pr)),
    linearIssue: findLinearIssue ? findLinearIssue(state.branch) : null,
    creation: mapCreationSnapshot(creating),
    source: state.source,
    oneshot: state.oneshot,
    tabs: state.tabs.map((tab) => ({ ...tab })),
    activeTabId: state.activeTabId,
  };
}

function mapCreatingWorktreeSnapshot(
  creating: CreatingWorktreeState,
  isArchived: (path: string) => boolean,
  findLinearIssue?: (branch: string) => WorktreeSnapshot["linearIssue"],
  findAgentLabel?: (agentId: string | null) => string | null,
): WorktreeSnapshot {
  return {
    id: creating.worktreeId,
    branch: creating.branch,
    label: null,
    ...(creating.baseBranch ? { baseBranch: creating.baseBranch } : {}),
    path: creating.path,
    dir: creating.path,
    archived: isArchived(creating.path),
    profile: creating.profile,
    agentName: creating.agentName,
    agentLabel: findAgentLabel ? findAgentLabel(creating.agentName) : creating.agentName,
    agentTerminalStale: false,
    mux: false,
    dirty: false,
    unpushed: false,
    paneCount: 0,
    status: "creating",
    elapsed: "",
    services: [],
    prs: [],
    linearIssue: findLinearIssue ? findLinearIssue(creating.branch) : null,
    creation: mapCreationSnapshot(creating),
    source: creating.source,
    oneshot: null,
    tabs: [],
    activeTabId: null,
  };
}

function orderFieldsOf(worktree: WorktreeSnapshot): WorktreeOrderFields {
  return {
    branch: worktree.branch,
    creating: worktree.creation !== null,
    open: worktree.mux,
    prStates: worktree.prs.map((pr) => pr.state),
  };
}

interface BuildWorktreeSnapshotsInput {
  runtime: ProjectRuntime;
  creatingWorktrees?: CreatingWorktreeState[];
  isArchived?: (path: string) => boolean;
  findLinearIssue?: (branch: string) => WorktreeSnapshot["linearIssue"];
  findAgentLabel?: (agentId: string | null) => string | null;
  now?: () => Date;
}

export function buildWorktreeSnapshots(input: BuildWorktreeSnapshotsInput): WorktreeSnapshot[] {
  const now = input.now ?? (() => new Date());
  const isArchived = input.isArchived ?? (() => false);
  const creatingWorktrees = input.creatingWorktrees ?? [];
  const runtimeWorktrees = input.runtime.listWorktrees();
  const runtimeIds = new Set(runtimeWorktrees.map((state) => state.worktreeId));
  const creatingById = new Map(creatingWorktrees.map((worktree) => [worktree.worktreeId, worktree]));
  // Path fallback, only for creations not yet listed under their id: between
  // `git worktree add` and the meta write, a reconcile lists the new worktree
  // under its unmanaged id.
  const creatingByPath = new Map(
    creatingWorktrees
      .filter((worktree) => !runtimeIds.has(worktree.worktreeId))
      .map((worktree) => [worktree.path, worktree]),
  );
  const mergedCreatingIds = new Set<string>();
  const worktrees = runtimeWorktrees.map((state) => {
    const creating = creatingById.get(state.worktreeId) ?? creatingByPath.get(state.path) ?? null;
    if (creating) mergedCreatingIds.add(creating.worktreeId);
    return mapWorktreeSnapshot(
      state,
      now,
      creating,
      isArchived,
      input.findLinearIssue,
      input.findAgentLabel,
    );
  });

  for (const creating of creatingWorktrees) {
    if (!mergedCreatingIds.has(creating.worktreeId)) {
      worktrees.push(mapCreatingWorktreeSnapshot(creating, isArchived, input.findLinearIssue, input.findAgentLabel));
    }
  }

  worktrees.sort((left, right) => compareWorktreeOrder(orderFieldsOf(left), orderFieldsOf(right)));

  return worktrees;
}

export function buildProjectSnapshot(input: BuildWorktreeSnapshotsInput & {
  projectName: string;
  mainBranch: string;
  notifications: RuntimeNotification[];
}): ProjectSnapshot {
  return {
    project: {
      name: input.projectName,
      mainBranch: input.mainBranch,
    },
    worktrees: buildWorktreeSnapshots(input),
    notifications: input.notifications.map((notification) => ({ ...notification })),
  };
}
