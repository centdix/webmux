import { describe, expect, it } from "bun:test";
import { resolveWorktreeIdByName } from "../services/worktree-name-resolver";

function makeDeps(initial: Record<string, string>, afterReconcile: Record<string, string> = initial) {
  let byBranch = initial;
  let reconciles = 0;
  return {
    get reconciles(): number {
      return reconciles;
    },
    deps: {
      runtime: {
        getWorktreeByBranch: (branch: string) => {
          const worktreeId = byBranch[branch];
          return worktreeId ? { worktreeId } : null;
        },
      },
      reconcile: async (): Promise<void> => {
        reconciles++;
        byBranch = afterReconcile;
      },
    },
  };
}

describe("resolveWorktreeIdByName", () => {
  it("resolves a known name without reconciling", async () => {
    const fixture = makeDeps({ "feature/a": "wt-a" });

    expect(await resolveWorktreeIdByName("feature/a", fixture.deps)).toBe("wt-a");
    expect(fixture.reconciles).toBe(0);
  });

  it("reconciles once and resolves a name the runtime did not know yet", async () => {
    const fixture = makeDeps({}, { "feature/renamed": "wt-a" });

    expect(await resolveWorktreeIdByName("feature/renamed", fixture.deps)).toBe("wt-a");
    expect(fixture.reconciles).toBe(1);
  });

  it("answers 404 when the name is still unknown after reconciling", async () => {
    const fixture = makeDeps({});

    await expect(resolveWorktreeIdByName("missing", fixture.deps)).rejects.toMatchObject({
      status: 404,
      message: "Worktree not found: missing",
    });
    expect(fixture.reconciles).toBe(1);
  });
});
