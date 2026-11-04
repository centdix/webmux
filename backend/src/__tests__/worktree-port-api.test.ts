import { describe, expect, it } from "bun:test";
import type { PortRegistration } from "../domain/port-registrations";
import { PortRegistrationService } from "../services/port-registration-service";
import { ProjectRuntime } from "../services/project-runtime";
import {
  deleteWorktreePort,
  listWorktreePorts,
  registerWorktreePort,
  type WorktreePortApiDeps,
} from "../services/worktree-port-api";

function makeDeps(): { deps: WorktreePortApiDeps; entries: () => PortRegistration[]; reconciles: () => number } {
  let entries: PortRegistration[] = [];
  let reconciles = 0;
  const projectRuntime = new ProjectRuntime();
  projectRuntime.upsertWorktree({
    worktreeId: "wt_search",
    branch: "feature/search",
    path: "/repo/__worktrees/feature-search",
    runtime: "host",
  });
  const portRegistrations = new PortRegistrationService({
    registry: {
      list: () => entries.map((entry) => ({ ...entry })),
      replaceAll: (next) => {
        entries = next;
      },
    },
    portProbe: { isListening: async () => false },
    canBind: () => true,
    now: () => 1_000,
  });
  return {
    deps: {
      projectDir: "/repo",
      portRegistrations,
      projectRuntime,
      reconcile: async () => {
        reconciles++;
      },
    },
    entries: () => entries,
    reconciles: () => reconciles,
  };
}

async function body(response: Response): Promise<unknown> {
  return response.json();
}

describe("worktree port API by id", () => {
  it("registers, lists and releases a port keyed by the worktree id", async () => {
    const { deps, entries, reconciles } = makeDeps();
    const ref = { kind: "id", id: "wt_search" } as const;

    const registered = await registerWorktreePort(deps, ref, { label: "web" });
    expect(registered.status).toBe(200);
    expect(await body(registered)).toEqual({ label: "web", port: 4100, keep: false });
    expect(entries().map((entry) => entry.worktreeId)).toEqual(["wt_search"]);
    expect(reconciles()).toBe(1);

    const listed = await listWorktreePorts(deps, ref);
    expect(await body(listed)).toEqual({ ports: [{ label: "web", port: 4100, keep: false, running: false }] });

    const removed = await deleteWorktreePort(deps, ref, "web");
    expect(removed.status).toBe(200);
    expect(entries()).toEqual([]);
  });

  it("shares registrations with the branch routes of the same worktree", async () => {
    const { deps } = makeDeps();
    await registerWorktreePort(deps, { kind: "id", id: "wt_search" }, { label: "web" });

    const listed = await listWorktreePorts(deps, { kind: "branch", name: "feature/search" });
    expect(await body(listed)).toEqual({ ports: [{ label: "web", port: 4100, keep: false, running: false }] });
  });

  it("returns 404 for an unknown worktree id on every action", async () => {
    const { deps, entries } = makeDeps();
    const ref = { kind: "id", id: "wt_missing" } as const;

    const registered = await registerWorktreePort(deps, ref, { label: "web" });
    expect(registered.status).toBe(404);
    expect(await body(registered)).toEqual({ error: "Worktree not found: id wt_missing" });
    expect((await listWorktreePorts(deps, ref)).status).toBe(404);
    expect((await deleteWorktreePort(deps, ref, "web")).status).toBe(404);
    expect(entries()).toEqual([]);
  });

  it("does not resolve a branch name passed as an id", async () => {
    const { deps } = makeDeps();
    expect((await listWorktreePorts(deps, { kind: "id", id: "feature/search" })).status).toBe(404);
  });

  it("rejects an invalid label and a release of an unregistered label", async () => {
    const { deps } = makeDeps();
    const ref = { kind: "id", id: "wt_search" } as const;
    expect((await registerWorktreePort(deps, ref, { label: "Bad Label" })).status).toBe(400);
    const removed = await deleteWorktreePort(deps, ref, "web");
    expect(removed.status).toBe(404);
    expect(await body(removed)).toEqual({ error: "No port registered as \"web\" for id wt_search" });
  });
});
