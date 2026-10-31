import {
  AgentsUiConversationEventSchema,
  AppNotificationSchema,
  NotificationDismissalSchema,
  createHubApi,
  createProjectApi,
  hubApiPaths,
  projectApiBasePath,
  projectApiPaths,
  type ProjectApi,
} from "@webmux/api-contract";
import { pickInitialProject, readLocationHash } from "./project-location";
import { errorMessage, loadLastProject } from "./utils";
import type {
  AgentDetails,
  AgentResponse,
  AgentsUiConversationEvent,
  AgentsUiInterruptResponse,
  AgentsUiSendMessageRequest,
  AgentsUiSendMessageResponse,
  AgentsUiWorktreeConversationResponse,
  AppNotification,
  FileUploadResult,
  InitialProject,
  InstanceSummary,
  PostWorktreeToLinearResponse,
  PostWorktreeToLinearTarget,
  ProjectInitPhase,
  ProjectInitState,
  ProjectSummary,
  ProjectWorktreeList,
  ProjectWorktreeSnapshot,
  UpsertCustomAgentRequest,
  ValidateCustomAgentResponse,
  WorktreeInfo,
  WorktreeTab,
} from "./types";

const projectApis = new Map<string, ProjectApi>();

/** Memoised per-project client: every worktree/agent/config call names the
 *  project it targets (no module-level "active project"). */
export function projectApi(project: string): ProjectApi {
  let client = projectApis.get(project);
  if (!client) {
    client = createProjectApi(project);
    projectApis.set(project, client);
  }
  return client;
}

/** Hub client — project list/add/remove + the migration sensor are global (no prefix). */
const hubApi = createHubApi();

function mapAgentStatus(status: string): string {
  switch (status) {
    case "creating":
    case "running":
    case "starting":
      return "working";
    case "idle":
      return "waiting";
    case "stopped":
      return "done";
    case "error":
      return "error";
    default:
      return "idle";
  }
}

function mapWorktree(snapshot: ProjectWorktreeSnapshot, project: string): WorktreeInfo {
  return {
    project,
    branch: snapshot.branch,
    label: snapshot.label,
    ...(snapshot.baseBranch ? { baseBranch: snapshot.baseBranch } : {}),
    archived: snapshot.archived,
    agent: mapAgentStatus(snapshot.status),
    mux: snapshot.mux ? "✓" : "",
    path: snapshot.path,
    dir: snapshot.dir,
    dirty: snapshot.dirty,
    unpushed: snapshot.unpushed,
    status: snapshot.status,
    elapsed: snapshot.elapsed,
    profile: snapshot.profile,
    agentName: snapshot.agentName,
    agentLabel: snapshot.agentLabel,
    agentTerminalStale: snapshot.agentTerminalStale,
    services: snapshot.services,
    paneCount: snapshot.paneCount,
    prs: snapshot.prs,
    linearIssue: snapshot.linearIssue,
    creating: snapshot.creation !== null,
    creationPhase: snapshot.creation?.phase ?? null,
    source: snapshot.source,
    oneshot: snapshot.oneshot,
    tabs: snapshot.tabs,
    activeTabId: snapshot.activeTabId,
  };
}

export async function createWorktreeTab(project: string, branch: string): Promise<WorktreeTab> {
  const response = await projectApi(project).createWorktreeTab({ params: { name: branch } });
  return response.tab;
}

export function selectWorktreeTab(project: string, branch: string, tabId: string): Promise<void> {
  return projectApi(project).selectWorktreeTab({ params: { name: branch, tabId } }).then(() => undefined);
}

export function deleteWorktreeTab(project: string, branch: string, tabId: string): Promise<void> {
  return projectApi(project).deleteWorktreeTab({ params: { name: branch, tabId } }).then(() => undefined);
}

export function postWorktreeToLinear(
  project: string,
  branch: string,
  target: PostWorktreeToLinearTarget,
): Promise<PostWorktreeToLinearResponse> {
  return projectApi(project).postWorktreeToLinear({
    params: { name: branch },
    body: { target },
  });
}

export async function fetchWorktrees(project: string): Promise<WorktreeInfo[]> {
  const response = await projectApi(project).fetchWorktrees();
  return response.worktrees.map((worktree) => mapWorktree(worktree, project));
}

/** Every project's worktrees in one hub call, in registry order — the
 *  dashboard's single worktree poll. */
export async function fetchAllProjectWorktrees(): Promise<ProjectWorktreeList[]> {
  const response = await hubApi.fetchAllProjectWorktrees();
  return response.projects.map((project) => ({
    prefix: project.prefix,
    name: project.name,
    worktrees: project.worktrees.map((worktree) => mapWorktree(worktree, project.prefix)),
    error: project.error,
  }));
}

export async function setWorktreeLabel(project: string, branch: string, label: string | null): Promise<string | null> {
  const response = await projectApi(project).setWorktreeLabel({
    params: { name: branch },
    body: { label },
  });
  return response.label;
}

export async function setWorktreeProfile(
  project: string,
  branch: string,
  profile: string,
): Promise<{ profile: string; restarted: boolean }> {
  const response = await projectApi(project).setWorktreeProfile({
    params: { name: branch },
    body: { profile },
  });
  return { profile: response.profile, restarted: response.restarted };
}

export function attachWorktreeConversation(project: string, branch: string): Promise<AgentsUiWorktreeConversationResponse> {
  return projectApi(project).attachAgentsWorktreeConversation({
    params: { name: branch },
  });
}

export function fetchWorktreeConversationHistory(project: string, branch: string): Promise<AgentsUiWorktreeConversationResponse> {
  return projectApi(project).fetchAgentsWorktreeConversationHistory({
    params: { name: branch },
  });
}

export function sendWorktreeConversationMessage(
  project: string,
  branch: string,
  body: AgentsUiSendMessageRequest,
): Promise<AgentsUiSendMessageResponse> {
  return projectApi(project).sendAgentsWorktreeConversationMessage({
    params: { name: branch },
    body,
  });
}

export function interruptWorktreeConversation(project: string, branch: string): Promise<AgentsUiInterruptResponse> {
  return projectApi(project).interruptAgentsWorktreeConversation({
    params: { name: branch },
  });
}

export function refreshWorktreeAgentTerminal(project: string, branch: string): Promise<void> {
  return projectApi(project).refreshWorktreeAgentTerminal({
    params: { name: branch },
  }).then(() => undefined);
}

function withWorktreeName(path: string, branch: string): string {
  return path.replace(":name", encodeURIComponent(branch));
}

function projectSocketUrl(project: string, path: string): string {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}${projectApiBasePath(project)}${path}`;
}

export function terminalSocketUrl(project: string, worktree: string): string {
  return projectSocketUrl(project, projectApiPaths.streamTerminal.replace(":worktree", encodeURIComponent(worktree)));
}

export function connectWorktreeConversationStream(
  project: string,
  branch: string,
  callbacks: {
    onEvent: (event: AgentsUiConversationEvent) => void;
    onError: (message: string) => void;
    onClose?: () => void;
  },
): () => void {
  const socket = new WebSocket(
    projectSocketUrl(project, withWorktreeName(projectApiPaths.streamAgentsWorktreeConversation, branch)),
  );
  let closedByClient = false;

  socket.addEventListener("message", (event) => {
    if (typeof event.data !== "string") return;
    try {
      callbacks.onEvent(AgentsUiConversationEventSchema.parse(JSON.parse(event.data)));
    } catch {
      callbacks.onError("Received malformed conversation stream data");
    }
  });

  socket.addEventListener("error", () => {
    callbacks.onError("Conversation stream connection failed");
  });

  socket.addEventListener("close", () => {
    if (!closedByClient) {
      callbacks.onClose?.();
    }
  });

  return () => {
    closedByClient = true;
    socket.close();
  };
}

export function fetchAgents(project: string): Promise<AgentDetails[]> {
  return projectApi(project).fetchAgents().then((response) => response.agents);
}

export function createAgent(project: string, body: UpsertCustomAgentRequest): Promise<AgentResponse> {
  return projectApi(project).createAgent({ body });
}

export function updateAgent(project: string, id: string, body: UpsertCustomAgentRequest): Promise<AgentResponse> {
  return projectApi(project).updateAgent({ params: { id }, body });
}

export function deleteAgent(project: string, id: string): Promise<void> {
  return projectApi(project).deleteAgent({ params: { id } }).then(() => undefined);
}

export function validateAgent(project: string, body: UpsertCustomAgentRequest): Promise<ValidateCustomAgentResponse> {
  return projectApi(project).validateAgent({ body });
}

/** Other webmux servers running on this machine (migration sensor) — drives the
 *  banner that prompts the user to consolidate them with `webmux project migrate`. */
export async function fetchInstances(): Promise<InstanceSummary[]> {
  const response = await hubApi.fetchInstances();
  return response.instances;
}

export async function fetchProjects(): Promise<ProjectSummary[]> {
  const response = await hubApi.fetchProjects();
  return response.projects;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const SETUP_POLL_INTERVAL_MS = 600;
const SETUP_TIMEOUT_MS = 5 * 60_000;

/** Add a project and, when the repo has no `.webmux.yaml`, drive its setup
 *  (scaffold → analyze with Claude → register) to completion, reporting each
 *  phase via `onPhase`. Resolves with the project's prefix once it's ready. */
export async function setUpProject(
  path: string,
  onPhase?: (phase: ProjectInitPhase) => void,
): Promise<{ prefix: string }> {
  const res = await hubApi.addProject({ body: { path } });
  if (!res.initializing) {
    if (!res.project) throw new Error("Server accepted the project but returned nothing to open.");
    return { prefix: res.project.prefix };
  }

  const deadline = Date.now() + SETUP_TIMEOUT_MS;
  let lastPhase: ProjectInitPhase | null = null;
  while (Date.now() < deadline) {
    // A transient poll failure shouldn't fail the flow — the backend job keeps
    // running, so swallow it and retry until the deadline.
    const inits = await hubApi.projectInits().then((r) => r.inits).catch((): ProjectInitState[] => []);
    const state = inits.find((entry) => entry.path === res.path);
    if (state) {
      if (state.phase !== lastPhase) {
        lastPhase = state.phase;
        onPhase?.(state.phase);
      }
      if (state.phase === "ready" && state.prefix) return { prefix: state.prefix };
      if (state.phase === "failed") throw new Error(state.error ?? "Project setup failed.");
    }
    await delay(SETUP_POLL_INTERVAL_MS);
  }
  throw new Error("Project setup timed out.");
}

export async function removeProject(prefix: string): Promise<void> {
  await hubApi.removeProject({ params: { prefix } });
}

/** Project to open at boot (see `pickInitialProject`); `none` when nothing is
 *  registered, so the empty state mounts instead of a dashboard whose every
 *  per-project call would 404; `error` when the list itself failed to load. */
export async function resolveInitialProject(): Promise<InitialProject> {
  let projects: ProjectSummary[];
  try {
    projects = await fetchProjects();
  } catch (error) {
    return { kind: "error", message: errorMessage(error) };
  }
  const prefix = pickInitialProject(
    projects.map((project) => project.prefix),
    readLocationHash()?.project ?? null,
    loadLastProject(),
  );
  return prefix ? { kind: "project", prefix } : { kind: "none" };
}

/** Subscribe to the hub's merged notification stream. Until the dashboard is
 *  multi-project, only `project`'s notifications are delivered. */
export function subscribeNotifications(
  project: string,
  onNotification: (n: AppNotification) => void,
  onDismiss: (id: number) => void,
  onInitial?: (n: AppNotification) => void,
): () => void {
  const es = new EventSource(hubApiPaths.streamNotifications);

  es.addEventListener("initial", (e: MessageEvent) => {
    try {
      const n = AppNotificationSchema.parse(JSON.parse(e.data));
      if (n.project === project) onInitial?.(n);
    } catch { /* ignore malformed SSE data */ }
  });

  es.addEventListener("notification", (e: MessageEvent) => {
    try {
      const n = AppNotificationSchema.parse(JSON.parse(e.data));
      if (n.project === project) onNotification(n);
    } catch { /* ignore malformed SSE data */ }
  });

  es.addEventListener("dismiss", (e: MessageEvent) => {
    try {
      const dismissal = NotificationDismissalSchema.parse(JSON.parse(e.data));
      if (dismissal.project === project) onDismiss(dismissal.id);
    } catch { /* ignore malformed SSE data */ }
  });

  return () => es.close();
}

/** Dismiss on the project that emitted the notification (ids are per project). */
export async function dismissNotification(notification: AppNotification): Promise<void> {
  await projectApi(notification.project).dismissNotification({ params: { id: notification.id } });
}

export async function uploadFiles(project: string, worktree: string, files: File[]): Promise<FileUploadResult> {
  const form = new FormData();
  for (const file of files) {
    form.append("files", file);
  }
  const res = await fetch(`${projectApiBasePath(project)}${withWorktreeName(projectApiPaths.uploadWorktreeFiles, worktree)}`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as FileUploadResult;
}
