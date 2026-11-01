import type { WorktreeRef } from "./types";

/** The `#<project>/<branch>` location hash that reopens a precise worktree.
 *  Project prefixes are slugs (no `/`), so the first `/` splits project from
 *  branch; branch segments are URI-encoded but keep their `/` for readability. */
export interface LocationHash {
  project: string;
  branch: string | null;
}

export function parseLocationHash(hash: string): LocationHash | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const slash = raw.indexOf("/");
  const rawProject = slash === -1 ? raw : raw.slice(0, slash);
  const rawBranch = slash === -1 ? "" : raw.slice(slash + 1);
  if (!rawProject) return null;
  try {
    return { project: decodeURIComponent(rawProject), branch: decodeURIComponent(rawBranch) || null };
  } catch {
    return null;
  }
}

export function formatLocationHash(project: string, branch: string | null): string {
  const encodedProject = encodeURIComponent(project);
  if (!branch) return `#${encodedProject}`;
  return `#${encodedProject}/${branch.split("/").map(encodeURIComponent).join("/")}`;
}

/** Project to open at boot: a valid hash project, else the last opened one,
 *  else the first registered; `null` when none is registered. */
export function pickInitialProject(
  projects: string[],
  hashProject: string | null,
  savedProject: string | null,
): string | null {
  if (hashProject && projects.includes(hashProject)) return hashProject;
  if (savedProject && projects.includes(savedProject)) return savedProject;
  return projects[0] ?? null;
}

/** Worktree to select when `project` mounts: the hash branch when the hash
 *  targets this project, else the selection saved for it. */
export function pickInitialBranch(
  hash: LocationHash | null,
  project: string,
  savedBranch: string | null,
): string | null {
  if (hash?.project === project && hash.branch) return hash.branch;
  return savedBranch;
}

/** What a hash edited by hand or set by a same-tab link opens. */
export type HashTarget = { kind: "worktree"; ref: WorktreeRef } | { kind: "project"; project: string };

/** The worktree, or project, `hash` names when it exists; `null` otherwise. */
export function resolveHashTarget(
  hash: LocationHash | null,
  hasProject: (project: string) => boolean,
  hasWorktree: (ref: WorktreeRef) => boolean,
): HashTarget | null {
  if (!hash || !hasProject(hash.project)) return null;
  if (!hash.branch) return { kind: "project", project: hash.project };
  const ref = { project: hash.project, branch: hash.branch };
  return hasWorktree(ref) ? { kind: "worktree", ref } : null;
}

export function readLocationHash(): LocationHash | null {
  return parseLocationHash(window.location.hash);
}

/** Mirror the current project/worktree into the hash without adding a history
 *  entry; `null` project clears it. */
export function writeLocationHash(project: string | null, branch: string | null): void {
  const hash = project ? formatLocationHash(project, branch) : "";
  if (window.location.hash === hash) return;
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}${hash}`);
}
