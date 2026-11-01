import type { ProjectRailItem, ProjectWorktreeList } from "./types";
import { overflowStatusOf } from "./worktree-list";
import { attentionOf } from "./worktree-status";

export function projectInitials(name: string): string {
  const parts = name.split(/[-_\s/.]+/).filter(Boolean);
  const initials = parts.length > 1 ? parts[0][0] + parts[1][0] : (parts[0] ?? name).slice(0, 2);
  return initials.toUpperCase();
}

/** Initials unique among `names` (registered order): the first project keeps
 *  its plain initials and later ones sharing them get a number ("WA", "WA2").
 *  A suffixed value never equals another project's plain initials, so adding an
 *  unrelated project leaves the others unchanged. */
export function projectRailInitials(names: readonly string[]): string[] {
  const bases = names.map(projectInitials);
  const taken = new Set(bases);
  const seen = new Set<string>();
  return bases.map((base) => {
    if (!seen.has(base)) {
      seen.add(base);
      return base;
    }
    let n = 2;
    while (taken.has(`${base}${n}`)) n++;
    taken.add(`${base}${n}`);
    return `${base}${n}`;
  });
}

/** Theme-token tints for project avatars, picked by registered order: every
 *  hue filled, then every hue outlined. */
const PROJECT_TINTS = [
  "bg-accent/20 text-accent",
  "bg-merged/20 text-merged",
  "bg-success/20 text-success",
  "bg-warning/20 text-warning",
  "bg-primary/15 text-primary",
  "inset-ring inset-ring-accent/60 text-accent",
  "inset-ring inset-ring-merged/60 text-merged",
  "inset-ring inset-ring-success/60 text-success",
  "inset-ring inset-ring-warning/60 text-warning",
  "inset-ring inset-ring-primary/50 text-primary",
];

export function projectTint(index: number): string {
  return PROJECT_TINTS[index % PROJECT_TINTS.length];
}

/** One rail avatar per project, in the given (registered) order: how many of
 *  its active worktrees need you (waiting, error, unread), whether an agent
 *  runs or a worktree is being created, and its load error. */
export function buildProjectRail(projects: ProjectWorktreeList[], notified: ReadonlySet<string>): ProjectRailItem[] {
  const initials = projectRailInitials(projects.map((project) => project.name));
  return projects.map((project, index) => {
    const active = project.worktrees.filter((worktree) => !worktree.archived);
    return {
      prefix: project.prefix,
      name: project.name,
      initials: initials[index],
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
