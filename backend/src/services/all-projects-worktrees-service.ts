export interface ProjectWorktreesSource<T> {
  prefix: string;
  name: string;
  readWorktrees: () => Promise<T[]>;
}

export interface ProjectWorktreesResult<T> {
  prefix: string;
  name: string;
  worktrees: T[];
  error: string | null;
}

/** Read every project's worktrees concurrently. One project failing yields an
 *  entry with `error` set and no worktrees; the others are still returned, in
 *  input order. */
export async function collectAllProjectWorktrees<T>(
  projects: ProjectWorktreesSource<T>[],
): Promise<ProjectWorktreesResult<T>[]> {
  const settled = await Promise.allSettled(projects.map((project) => project.readWorktrees()));
  return projects.map((project, index): ProjectWorktreesResult<T> => {
    const result = settled[index];
    return result.status === "fulfilled"
      ? { prefix: project.prefix, name: project.name, worktrees: result.value, error: null }
      : {
          prefix: project.prefix,
          name: project.name,
          worktrees: [],
          error: result.reason instanceof Error ? result.reason.message : String(result.reason),
        };
  });
}
