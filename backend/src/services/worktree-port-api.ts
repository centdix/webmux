import type { RegisterWorktreePortRequest } from "@webmux/api-contract";
import { isValidPortLabel } from "../domain/port-registrations";
import { errorResponse, jsonResponse } from "../lib/http";
import { log } from "../lib/log";
import type { PortRegistrationService } from "./port-registration-service";
import type { ProjectRuntime } from "./project-runtime";

/** How a port route addresses its worktree: by branch (`/worktrees/:name/ports`)
 *  or by its stable meta id (`/worktree-ids/:id/ports`), which survives the
 *  worktree checking out another branch. */
export type WorktreeRef = { kind: "branch"; name: string } | { kind: "id"; id: string };

export interface WorktreePortApiDeps {
  projectDir: string;
  portRegistrations: Pick<PortRegistrationService, "register" | "unregister" | "listWithStatus">;
  projectRuntime: Pick<ProjectRuntime, "getWorktree" | "getWorktreeByBranch">;
  reconcile: () => Promise<void>;
}

function describeRef(ref: WorktreeRef): string {
  return ref.kind === "branch" ? ref.name : `id ${ref.id}`;
}

async function resolveWorktreeId(deps: WorktreePortApiDeps, ref: WorktreeRef): Promise<string | null> {
  await deps.reconcile();
  const state = ref.kind === "branch"
    ? deps.projectRuntime.getWorktreeByBranch(ref.name)
    : deps.projectRuntime.getWorktree(ref.id);
  return state?.worktreeId ?? null;
}

export async function registerWorktreePort(
  deps: WorktreePortApiDeps,
  ref: WorktreeRef,
  request: RegisterWorktreePortRequest,
): Promise<Response> {
  const { label, port, keep } = request;
  if (!isValidPortLabel(label)) return errorResponse(`Invalid port label: ${label}`, 400);
  const worktreeId = await resolveWorktreeId(deps, ref);
  if (!worktreeId) return errorResponse(`Worktree not found: ${describeRef(ref)}`, 404);

  const result = deps.portRegistrations.register({ projectDir: deps.projectDir, worktreeId, label }, { port, keep });
  if (!result.ok) return errorResponse(result.error, result.reason === "conflict" ? 409 : 503);
  log.info(`[worktree:port] worktree=${describeRef(ref)} label=${label} port=${result.data.port} keep=${result.data.keep}`);
  return jsonResponse(result.data);
}

export async function listWorktreePorts(deps: WorktreePortApiDeps, ref: WorktreeRef): Promise<Response> {
  const worktreeId = await resolveWorktreeId(deps, ref);
  if (!worktreeId) return errorResponse(`Worktree not found: ${describeRef(ref)}`, 404);
  return jsonResponse({ ports: await deps.portRegistrations.listWithStatus(deps.projectDir, worktreeId) });
}

export async function deleteWorktreePort(deps: WorktreePortApiDeps, ref: WorktreeRef, label: string): Promise<Response> {
  const worktreeId = await resolveWorktreeId(deps, ref);
  if (!worktreeId) return errorResponse(`Worktree not found: ${describeRef(ref)}`, 404);
  if (!deps.portRegistrations.unregister({ projectDir: deps.projectDir, worktreeId, label })) {
    return errorResponse(`No port registered as "${label}" for ${describeRef(ref)}`, 404);
  }
  return jsonResponse({ ok: true });
}
