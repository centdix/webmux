import type { ProjectRailItem, ProjectWorktreeList } from "./types";
import { overflowStatusOf } from "./worktree-list";
import { attentionOf } from "./worktree-status";

export function projectInitials(name: string): string {
  const parts = name.split(/[-_\s/.]+/).filter(Boolean);
  const initials = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? name).slice(0, 2);
  return initials.toUpperCase();
}

/** Theme-token tints for project avatars, picked by registered order. */
const PROJECT_TINTS = [
  "bg-accent/20 text-accent",
  "bg-merged/20 text-merged",
  "bg-success/20 text-success",
  "bg-warning/20 text-warning",
];

export function projectTint(index: number): string {
  return PROJECT_TINTS[index % PROJECT_TINTS.length];
}

/** One rail avatar per project, in the given (registered) order: how many of
 *  its active worktrees need you (waiting, error, unread), whether an agent
 *  runs or a worktree is being created, and its load error. */
export function buildProjectRail(projects: ProjectWorktreeList[], notified: ReadonlySet<string>): ProjectRailItem[] {
  return projects.map((project, index) => {
    const active = project.worktrees.filter((worktree) => !worktree.archived);
    return {
      prefix: project.prefix,
      name: project.name,
      initials: projectInitials(project.name),
      tint: projectTint(index),
      needsYou: active.filter((worktree) => overflowStatusOf(worktree, notified) !== null).length,
      running: active.some((worktree) => {
        const attention = attentionOf(worktree, notified);
        return attention === "working" || attention === "creating";
      }),
      error: project.error,
    };
  });
}

export function projectRailTitle(item: ProjectRailItem): string {
  return [
    item.name,
    item.needsYou > 0 ? `${item.needsYou} need${item.needsYou === 1 ? "s" : ""} you` : null,
    item.running ? "agents running" : null,
    item.error !== null ? "failed to load" : null,
  ].filter((part) => part !== null).join(" · ");
}
