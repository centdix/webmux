import { describe, expect, it } from "bun:test";
import { resolveRouteWorktree } from "../services/worktree-id-resolver";

function makeDeps(
  initial: Record<string, string>,
  afterReconcile: Record<string, string> = initial,
  creating: string[] = [],
) {
  let branchById = initial;
  let reconciles = 0;
  return {
    get reconciles(): number {
      return reconciles;
    },
    deps: {
      runtime: {
        getWorktree: (worktreeId: string) => {
          const branch = branchById[worktreeId];
          return branch ? { worktreeId, branch } : null;
        },
      },
      reconcile: async (): Promise<void> => {
        reconciles++;
        branchById = afterReconcile;
      },
      isCreating: (worktreeId: string) => creating.includes(worktreeId),
    },
  };
}

describe("resolveRouteWorktree", () => {
  it("returns a known id with its current branch without reconciling", async () => {
    const fixture = makeDeps({ "wt-a": "feature/renamed" });

    expect(await resolveRouteWorktree("wt-a", fixture.deps)).toEqual({ worktreeId: "wt-a", branch: "feature/renamed" });
    expect(fixture.reconciles).toBe(0);
  });

  it("reconciles once and resolves an id the runtime did not know yet", async () => {
    const fixture = makeDeps({}, { "wt-a": "feature/a" });

    expect(await resolveRouteWorktree("wt-a", fixture.deps)).toEqual({ worktreeId: "wt-a", branch: "feature/a" });
    expect(fixture.reconciles).toBe(1);
  });

  it("answers 409 for an id still being created", async () => {
    const fixture = makeDeps({}, {}, ["wt-new"]);

    await expect(resolveRouteWorktree("wt-new", fixture.deps)).rejects.toMatchObject({
      status: 409,
      message: "Worktree is being created: wt-new",
    });
  });

  it("answers 404 when the id is still unknown after reconciling", async () => {
    const fixture = makeDeps({});

    await expect(resolveRouteWorktree("missing", fixture.deps)).rejects.toMatchObject({
      status: 404,
      message: "Worktree not found: missing",
    });
    expect(fixture.reconciles).toBe(1);
  });
});
