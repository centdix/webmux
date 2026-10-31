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
import { loadLastProject } from "./utils";
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
  InstanceSummary,
  PostWorktreeToLinearResponse,
  PostWorktreeToLinearTarget,
  ProjectInitPhase,
  ProjectInitState,
  ProjectSummary,
  ProjectWorktreeSnapshot,
  UpsertCustomAgentRequest,
  ValidateCustomAgentResponse,
  WorktreeInfo,
  WorktreeTab,
} from "./types";

/** The active project's prefix. Held in memory (the URL stays `/`): set by
 *  `setActiveProject` before the dashboard mounts and on every project switch.
 *  `export let` so importers always read the current value (ES live bindings). */
export let activePrefix = "";

/** Base path for the active project's API + WebSocket calls. Empty-project value
 *  until `setActiveProject` runs (main.ts resolves the project before mounting). */
export let apiBase: string = projectApiBasePath(activePrefix);

/** Per-project client — every worktree/agent/config call is scoped to the
 *  active project. */
export let api: ProjectApi = createProjectApi(activePrefix);

export function setActiveProject(prefix: string): void {
  activePrefix = prefix;
  apiBase = projectApiBasePath(prefix);
  api = createProjectApi(prefix);
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

function mapWorktree(snapshot: ProjectWorktreeSnapshot): WorktreeInfo {
  return {
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

export async function createWorktreeTab(branch: string): Promise<WorktreeTab> {
  const response = await api.createWorktreeTab({ params: { name: branch } });
  return response.tab;
}

export function selectWorktreeTab(branch: string, tabId: string): Promise<void> {
  return api.selectWorktreeTab({ params: { name: branch, tabId } }).then(() => undefined);
}

export function deleteWorktreeTab(branch: string, tabId: string): Promise<void> {
  return api.deleteWorktreeTab({ params: { name: branch, tabId } }).then(() => undefined);
}

export function postWorktreeToLinear(
  branch: string,
  target: PostWorktreeToLinearTarget,
): Promise<PostWorktreeToLinearResponse> {
  return api.postWorktreeToLinear({
    params: { name: branch },
    body: { target },
  });
}

export async function fetchWorktrees(): Promise<WorktreeInfo[]> {
  const response = await api.fetchWorktrees();
  return response.worktrees.map((worktree) => mapWorktree(worktree));
}

export async function setWorktreeLabel(branch: string, label: string | null): Promise<string | null> {
  const response = await api.setWorktreeLabel({
    params: { name: branch },
    body: { label },
  });
  return response.label;
}

export async function setWorktreeProfile(
  branch: string,
  profile: string,
): Promise<{ profile: string; restarted: boolean }> {
  const response = await api.setWorktreeProfile({
    params: { name: branch },
    body: { profile },
  });
  return { profile: response.profile, restarted: response.restarted };
}

export function attachWorktreeConversation(branch: string): Promise<AgentsUiWorktreeConversationResponse> {
  return api.attachAgentsWorktreeConversation({
    params: { name: branch },
  });
}

export function fetchWorktreeConversationHistory(branch: string): Promise<AgentsUiWorktreeConversationResponse> {
  return api.fetchAgentsWorktreeConversationHistory({
    params: { name: branch },
  });
}

export function sendWorktreeConversationMessage(
  branch: string,
  body: AgentsUiSendMessageRequest,
): Promise<AgentsUiSendMessageResponse> {
  return api.sendAgentsWorktreeConversationMessage({
    params: { name: branch },
    body,
  });
}

export function interruptWorktreeConversation(branch: string): Promise<AgentsUiInterruptResponse> {
  return api.interruptAgentsWorktreeConversation({
    params: { name: branch },
  });
}

export function refreshWorktreeAgentTerminal(branch: string): Promise<void> {
  return api.refreshWorktreeAgentTerminal({
    params: { name: branch },
  }).then(() => undefined);
}

function withWorktreeName(path: string, branch: string): string {
  return path.replace(":name", encodeURIComponent(branch));
}

function projectWsUrl(path: string): string {
  return `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}${apiBase}${path}`;
}

/** WebSocket URL of a worktree's terminal stream in the active project. */
export function terminalStreamUrl(worktree: string): string {
  return projectWsUrl(projectApiPaths.streamTerminal.replace(":worktree", encodeURIComponent(worktree)));
}

export function connectWorktreeConversationStream(
  branch: string,
  callbacks: {
    onEvent: (event: AgentsUiConversationEvent) => void;
    onError: (message: string) => void;
    onClose?: () => void;
  },
): () => void {
  const socket = new WebSocket(projectWsUrl(withWorktreeName(projectApiPaths.streamAgentsWorktreeConversation, branch)));
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

export function fetchAgents(): Promise<AgentDetails[]> {
  return api.fetchAgents().then((response) => response.agents);
}

export function createAgent(body: UpsertCustomAgentRequest): Promise<AgentResponse> {
  return api.createAgent({ body });
}

export function updateAgent(id: string, body: UpsertCustomAgentRequest): Promise<AgentResponse> {
  return api.updateAgent({ params: { id }, body });
}

export function deleteAgent(id: string): Promise<void> {
  return api.deleteAgent({ params: { id } }).then(() => undefined);
}

export function validateAgent(body: UpsertCustomAgentRequest): Promise<ValidateCustomAgentResponse> {
  return api.validateAgent({ body });
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

/** Project to open at boot (see `pickInitialProject`); `null` when nothing is
 *  registered, so the empty state mounts instead of a dashboard whose every
 *  per-project call would 404. */
export async function resolveInitialProject(): Promise<string | null> {
  const projects = await fetchProjects().catch((): ProjectSummary[] => []);
  return pickInitialProject(
    projects.map((project) => project.prefix),
    readLocationHash()?.project ?? null,
    loadLastProject(),
  );
}

/** Subscribe to the hub's merged notification stream. Until the dashboard is
 *  multi-project, only the active project's notifications are delivered. */
export function subscribeNotifications(
  onNotification: (n: AppNotification) => void,
  onDismiss: (id: number) => void,
  onInitial?: (n: AppNotification) => void,
): () => void {
  const es = new EventSource(hubApiPaths.streamNotifications);

  es.addEventListener("initial", (e: MessageEvent) => {
    try {
      const n = AppNotificationSchema.parse(JSON.parse(e.data));
      if (n.project === activePrefix) onInitial?.(n);
    } catch { /* ignore malformed SSE data */ }
  });

  es.addEventListener("notification", (e: MessageEvent) => {
    try {
      const n = AppNotificationSchema.parse(JSON.parse(e.data));
      if (n.project === activePrefix) onNotification(n);
    } catch { /* ignore malformed SSE data */ }
  });

  es.addEventListener("dismiss", (e: MessageEvent) => {
    try {
      const { project, id } = NotificationDismissalSchema.parse(JSON.parse(e.data));
      if (project === activePrefix) onDismiss(id);
    } catch { /* ignore malformed SSE data */ }
  });

  return () => es.close();
}

/** Dismiss on the project that emitted the notification (ids are per project). */
export async function dismissNotification(notification: AppNotification): Promise<void> {
  await createProjectApi(notification.project).dismissNotification({ params: { id: notification.id } });
}

export async function uploadFiles(worktree: string, files: File[]): Promise<FileUploadResult> {
  const form = new FormData();
  for (const file of files) {
    form.append("files", file);
  }
  const res = await fetch(`${apiBase}${withWorktreeName(projectApiPaths.uploadWorktreeFiles, worktree)}`, {
    method: "POST",
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as FileUploadResult;
}
