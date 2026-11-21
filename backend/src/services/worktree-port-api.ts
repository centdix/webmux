import type { RegisterWorktreePortRequest } from "@webmux/api-contract";
import { isValidPortLabel } from "../domain/port-registrations";
import { errorResponse, jsonResponse } from "../lib/http";
import { log } from "../lib/log";
import type { PortRegistrationService } from "./port-registration-service";

/** Port routes for a worktree the caller already resolved (`/worktrees/:id/ports`). */
export interface WorktreePortApiDeps {
  projectDir: string;
  portRegistrations: Pick<PortRegistrationService, "register" | "unregister" | "listWithStatus">;
}

export async function registerWorktreePort(
  deps: WorktreePortApiDeps,
  worktreeId: string,
  request: RegisterWorktreePortRequest,
): Promise<Response> {
  const { label, port, keep } = request;
  if (!isValidPortLabel(label)) return errorResponse(`Invalid port label: ${label}`, 400);

  const result = deps.portRegistrations.register({ projectDir: deps.projectDir, worktreeId, label }, { port, keep });
  if (!result.ok) return errorResponse(result.error, result.reason === "conflict" ? 409 : 503);
  log.info(`[worktree:port] worktreeId=${worktreeId} label=${label} port=${result.data.port} keep=${result.data.keep}`);
  return jsonResponse(result.data);
}

export async function listWorktreePorts(deps: WorktreePortApiDeps, worktreeId: string): Promise<Response> {
  return jsonResponse({ ports: await deps.portRegistrations.listWithStatus(deps.projectDir, worktreeId) });
}

export async function deleteWorktreePort(deps: WorktreePortApiDeps, worktreeId: string, label: string): Promise<Response> {
  if (!deps.portRegistrations.unregister({ projectDir: deps.projectDir, worktreeId, label })) {
    return errorResponse(`No port registered as "${label}" for ${worktreeId}`, 404);
  }
  return jsonResponse({ ok: true });
}
