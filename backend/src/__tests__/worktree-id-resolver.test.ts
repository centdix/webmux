import { describe, expect, it } from "bun:test";
import { resolveRouteWorktree, WorktreeBusyGuards } from "../services/worktree-id-resolver";

function makeDeps(
  initial: Record<string, string>,
  afterReconcile: Record<string, string> = initial,
  creating: string[] = [],
) {
  let branchById = initial;
  let reconciles = 0;
  const guards = new WorktreeBusyGuards((worktreeId) => creating.includes(worktreeId));
  return {
    guards,
    get reconciles(): number {
      return reconciles;
    },
    renameBranch(worktreeId: string, branch: string): void {
      branchById = { ...branchById, [worktreeId]: branch };
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
      guards,
    },
  };
}

const IDLE = { requireIdle: true };
const ANY = { requireIdle: false };

describe("resolveRouteWorktree", () => {
  it("returns a known id with its current branch without reconciling", async () => {
    const fixture = makeDeps({ "wt-a": "feature/renamed" });

    expect(await resolveRouteWorktree("wt-a", fixture.deps, IDLE)).toEqual({ worktreeId: "wt-a", branch: "feature/renamed" });
    expect(fixture.reconciles).toBe(0);
  });

  it("reconciles once and resolves an id the runtime did not know yet", async () => {
    const fixture = makeDeps({}, { "wt-a": "feature/a" });

    expect(await resolveRouteWorktree("wt-a", fixture.deps, IDLE)).toEqual({ worktreeId: "wt-a", branch: "feature/a" });
    expect(fixture.reconciles).toBe(1);
  });

  it("answers 404 when the id is still unknown after reconciling", async () => {
    const fixture = makeDeps({});

    await expect(resolveRouteWorktree("missing", fixture.deps, ANY)).rejects.toMatchObject({
      status: 404,
      message: "Worktree not found: missing",
    });
    expect(fixture.reconciles).toBe(1);
  });

  it("answers 409 for an id still being created, without reconciling", async () => {
    const fixture = makeDeps({}, {}, ["wt-new"]);

    await expect(resolveRouteWorktree("wt-new", fixture.deps, ANY)).rejects.toMatchObject({
      status: 409,
      message: "Worktree is being created: wt-new",
    });
    expect(fixture.reconciles).toBe(0);
  });

  it("answers 409 for an id being removed even after a reconcile dropped it from the runtime", async () => {
    const fixture = makeDeps({});

    fixture.guards.markRemoving("wt-a");
    await expect(resolveRouteWorktree("wt-a", fixture.deps, ANY)).rejects.toMatchObject({
      status: 409,
      message: "Worktree is being removed: wt-a",
    });
    expect(fixture.reconciles).toBe(0);
  });

  it("guards a known worktree in order: creating, removing, tabs updating", async () => {
    const creating = makeDeps({ "wt-a": "feature/a" }, undefined, ["wt-a"]);
    await expect(resolveRouteWorktree("wt-a", creating.deps, IDLE)).rejects.toMatchObject({
      status: 409,
      message: "Worktree is being created: feature/a",
    });

    const removing = makeDeps({ "wt-a": "feature/a" });
    await removing.guards.withRemoving("wt-a", "feature/a", async () => {
      await expect(resolveRouteWorktree("wt-a", removing.deps, IDLE)).rejects.toMatchObject({
        status: 409,
        message: "Worktree is being removed: feature/a",
      });
    });

    const tabs = makeDeps({ "wt-a": "feature/a" });
    await tabs.guards.withMutatingTab("wt-a", "feature/a", async () => {
      await expect(resolveRouteWorktree("wt-a", tabs.deps, IDLE)).rejects.toMatchObject({
        status: 409,
        message: "Worktree tabs are being updated: feature/a",
      });
    });
  });

  it("does not guard a known worktree unless asked to", async () => {
    const fixture = makeDeps({ "wt-a": "feature/a" }, undefined, ["wt-a"]);
    fixture.guards.markRemoving("wt-a");

    expect(await resolveRouteWorktree("wt-a", fixture.deps, ANY)).toEqual({ worktreeId: "wt-a", branch: "feature/a" });
  });

  it("keys the guards by id, so a renamed worktree stays busy", async () => {
    const fixture = makeDeps({ "wt-a": "feature/a" });

    await fixture.guards.withRemoving("wt-a", "feature/a", async () => {
      fixture.renameBranch("wt-a", "feature/renamed");
      await expect(resolveRouteWorktree("wt-a", fixture.deps, IDLE)).rejects.toMatchObject({
        status: 409,
        message: "Worktree is being removed: feature/renamed",
      });
      await expect(resolveRouteWorktree("wt-b", fixture.deps, IDLE)).rejects.toMatchObject({ status: 404 });
    });
    expect(await resolveRouteWorktree("wt-a", fixture.deps, IDLE)).toMatchObject({ worktreeId: "wt-a" });
  });
});

describe("WorktreeBusyGuards", () => {
  it("serializes tab mutations and excludes removal while one runs", async () => {
    const guards = new WorktreeBusyGuards(() => false);

    await guards.withMutatingTab("wt-a", "feature/a", async () => {
      await expect(guards.withMutatingTab("wt-a", "feature/a", async () => {})).rejects.toMatchObject({ status: 409 });
      await expect(guards.withRemoving("wt-a", "feature/a", async () => {})).rejects.toMatchObject({ status: 409 });
      expect(await guards.withMutatingTab("wt-b", "feature/b", async () => "other")).toBe("other");
    });
    expect(await guards.withRemoving("wt-a", "feature/a", async () => "removed")).toBe("removed");
  });

  it("releases the lock when the operation throws", async () => {
    const guards = new WorktreeBusyGuards(() => false);

    await expect(guards.withRemoving("wt-a", "feature/a", async () => {
      throw new Error("boom");
    })).rejects.toThrow("boom");
    expect(guards.isRemoving("wt-a")).toBe(false);
  });
});
