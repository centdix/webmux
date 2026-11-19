import { initContract } from "@ts-rest/core";
import {
  AgentsSendMessageRequestSchema,
  AgentsUiInterruptResponseSchema,
  AgentsUiSendMessageResponseSchema,
  AgentsUiWorktreeConversationResponseSchema,
  AgentIdParamsSchema,
  AgentListResponseSchema,
  AgentResponseSchema,
  AppConfigSchema,
  AvailableBranchesQuerySchema,
  BranchListResponseSchema,
  CiLogsResponseSchema,
  CreateTabResponseSchema,
  CreateWorktreeRequestSchema,
  CreateWorktreeResponseSchema,
  OpenWorktreeRequestSchema,
  EnabledResponseSchema,
  ErrorResponseSchema,
  OkResponseSchema,
  ProjectSnapshotSchema,
  PullMainRequestSchema,
  PullMainResponseSchema,
  RunIdParamsSchema,
  UpsertCustomAgentRequestSchema,
  ValidateCustomAgentResponseSchema,
  SendWorktreePromptRequestSchema,
  SetWorktreeArchivedRequestSchema,
  SetWorktreeArchivedResponseSchema,
  PostWorktreeToLinearRequestSchema,
  PostWorktreeToLinearResponseSchema,
  ProjectWorktreeSnapshotSchema,
  SetWorktreeLabelRequestSchema,
  SetWorktreeLabelResponseSchema,
  SetWorktreeProfileRequestSchema,
  SetWorktreeProfileResponseSchema,
  ToggleEnabledRequestSchema,
  WorktreeDiffResponseSchema,
  WorktreeListResponseSchema,
  WorktreeTabParamsSchema,
  WorktreeIdParamsSchema,
  WorktreeIdPortParamsSchema,
  RegisterWorktreePortRequestSchema,
  RegisterWorktreePortResponseSchema,
  WorktreePortListResponseSchema,
  NotificationIdParamsSchema,
  LinearIssuesResponseSchema,
  AutoNameConfigResponseSchema,
  ProjectsResponseSchema,
  AllProjectWorktreesQuerySchema,
  AllProjectWorktreesResponseSchema,
  AddProjectRequestSchema,
  AddProjectResponseSchema,
  ProjectInitsResponseSchema,
  ProjectPrefixParamsSchema,
} from "./schemas";

const c = initContract();

/** Hub routes: absolute paths, global to the server (no project scope). */
export const hubApiPaths = {
  fetchProjects: "/api/projects",
  addProject: "/api/projects",
  projectInits: "/api/projects/init",
  fetchAllProjectWorktrees: "/api/projects/worktrees",
  removeProject: "/api/projects/:prefix",
  streamNotifications: "/api/notifications/stream",
  fetchAgents: "/api/agents",
  createAgent: "/api/agents",
  updateAgent: "/api/agents/:id",
  deleteAgent: "/api/agents/:id",
  validateAgent: "/api/agents/validate",
} as const;

/** Mount point of one project's routes on the shared server. */
export const PROJECT_API_ROOT = "/api/projects";

/** Base path of one project's routes: every `projectApiPaths` entry is relative to it. */
export function projectApiBasePath(project: string): string {
  return `${PROJECT_API_ROOT}/${encodeURIComponent(project)}`;
}

/** Project routes: paths relative to `projectApiBasePath(project)`. */
export const projectApiPaths = {
  fetchConfig: "/config",
  fetchAvailableBranches: "/branches",
  fetchBaseBranches: "/base-branches",
  fetchProject: "/project",
  attachAgentsWorktreeConversation: "/agents/worktrees/:id/attach",
  fetchAgentsWorktreeConversationHistory: "/agents/worktrees/:id/history",
  sendAgentsWorktreeConversationMessage: "/agents/worktrees/:id/messages",
  interruptAgentsWorktreeConversation: "/agents/worktrees/:id/interrupt",
  streamAgentsWorktreeConversation: "/ws/agents/worktrees/:id",
  fetchWorktrees: "/worktrees",
  createWorktree: "/worktrees",
  removeWorktree: "/worktrees/:id",
  openWorktree: "/worktrees/:id/open",
  fetchNativeTerminalLaunch: "/worktrees/:id/terminal-launch",
  closeWorktree: "/worktrees/:id/close",
  refreshWorktreeAgentTerminal: "/worktrees/:id/agent-terminal/refresh",
  setWorktreeArchived: "/worktrees/:id/archive",
  syncWorktreePrs: "/worktrees/:id/sync-prs",
  postWorktreeToLinear: "/worktrees/:id/linear/post",
  setWorktreeLabel: "/worktrees/:id/label",
  setWorktreeProfile: "/worktrees/:id/profile",
  sendWorktreePrompt: "/worktrees/:id/send",
  createWorktreeTab: "/worktrees/:id/tabs",
  selectWorktreeTab: "/worktrees/:id/tabs/:tabId/select",
  deleteWorktreeTab: "/worktrees/:id/tabs/:tabId",
  worktreePorts: "/worktrees/:id/ports",
  deleteWorktreePort: "/worktrees/:id/ports/:label",
  mergeWorktree: "/worktrees/:id/merge",
  fetchWorktreeDiff: "/worktrees/:id/diff",
  fetchLinearIssues: "/linear/issues",
  fetchAutoNameConfig: "/project/auto-name",
  setLinearAutoCreate: "/linear/auto-create",
  setAutoRemoveOnMerge: "/github/auto-remove-on-merge",
  pullMain: "/pull-main",
  fetchCiLogs: "/ci-logs/:runId",
  dismissNotification: "/notifications/:id/dismiss",
  streamTerminal: "/ws/:id",
  uploadWorktreeFiles: "/worktrees/:id/upload",
  postRuntimeEvent: "/runtime/events",
} as const;

const commonErrorResponses = {
  400: ErrorResponseSchema,
  404: ErrorResponseSchema,
  409: ErrorResponseSchema,
  500: ErrorResponseSchema,
  502: ErrorResponseSchema,
  503: ErrorResponseSchema,
} as const;

export const projectContract = c.router({
  fetchConfig: {
    method: "GET",
    path: projectApiPaths.fetchConfig,
    responses: {
      200: AppConfigSchema,
    },
  },
  fetchAvailableBranches: {
    method: "GET",
    path: projectApiPaths.fetchAvailableBranches,
    query: AvailableBranchesQuerySchema,
    responses: {
      200: BranchListResponseSchema,
      400: ErrorResponseSchema,
      500: ErrorResponseSchema,
    },
  },
  fetchBaseBranches: {
    method: "GET",
    path: projectApiPaths.fetchBaseBranches,
    responses: {
      200: BranchListResponseSchema,
      500: ErrorResponseSchema,
    },
  },
  fetchProject: {
    method: "GET",
    path: projectApiPaths.fetchProject,
    responses: {
      200: ProjectSnapshotSchema,
      500: ErrorResponseSchema,
      502: ErrorResponseSchema,
    },
  },
  attachAgentsWorktreeConversation: {
    method: "POST",
    path: projectApiPaths.attachAgentsWorktreeConversation,
    pathParams: WorktreeIdParamsSchema,
    body: c.noBody(),
    responses: {
      200: AgentsUiWorktreeConversationResponseSchema,
      ...commonErrorResponses,
    },
  },
  fetchAgentsWorktreeConversationHistory: {
    method: "GET",
    path: projectApiPaths.fetchAgentsWorktreeConversationHistory,
    pathParams: WorktreeIdParamsSchema,
    responses: {
      200: AgentsUiWorktreeConversationResponseSchema,
      ...commonErrorResponses,
    },
  },
  sendAgentsWorktreeConversationMessage: {
    method: "POST",
    path: projectApiPaths.sendAgentsWorktreeConversationMessage,
    pathParams: WorktreeIdParamsSchema,
    body: AgentsSendMessageRequestSchema,
    responses: {
      200: AgentsUiSendMessageResponseSchema,
      ...commonErrorResponses,
    },
  },
  interruptAgentsWorktreeConversation: {
    method: "POST",
    path: projectApiPaths.interruptAgentsWorktreeConversation,
    pathParams: WorktreeIdParamsSchema,
    body: c.noBody(),
    responses: {
      200: AgentsUiInterruptResponseSchema,
      ...commonErrorResponses,
    },
  },
  fetchWorktrees: {
    method: "GET",
    path: projectApiPaths.fetchWorktrees,
    responses: {
      200: WorktreeListResponseSchema,
      500: ErrorResponseSchema,
      502: ErrorResponseSchema,
    },
  },
  createWorktree: {
    method: "POST",
    path: projectApiPaths.createWorktree,
    body: CreateWorktreeRequestSchema,
    responses: {
      201: CreateWorktreeResponseSchema,
      ...commonErrorResponses,
    },
  },
  removeWorktree: {
    method: "DELETE",
    path: projectApiPaths.removeWorktree,
    pathParams: WorktreeIdParamsSchema,
    responses: {
      200: OkResponseSchema,
      ...commonErrorResponses,
    },
  },
  openWorktree: {
    method: "POST",
    path: projectApiPaths.openWorktree,
    pathParams: WorktreeIdParamsSchema,
    body: OpenWorktreeRequestSchema,
    responses: {
      200: OkResponseSchema,
      ...commonErrorResponses,
    },
  },
  closeWorktree: {
    method: "POST",
    path: projectApiPaths.closeWorktree,
    pathParams: WorktreeIdParamsSchema,
    body: c.noBody(),
    responses: {
      200: OkResponseSchema,
      ...commonErrorResponses,
    },
  },
  refreshWorktreeAgentTerminal: {
    method: "POST",
    path: projectApiPaths.refreshWorktreeAgentTerminal,
    pathParams: WorktreeIdParamsSchema,
    body: c.noBody(),
    responses: {
      200: OkResponseSchema,
      ...commonErrorResponses,
    },
  },
  setWorktreeArchived: {
    method: "PUT",
    path: projectApiPaths.setWorktreeArchived,
    pathParams: WorktreeIdParamsSchema,
    body: SetWorktreeArchivedRequestSchema,
    responses: {
      200: SetWorktreeArchivedResponseSchema,
      ...commonErrorResponses,
    },
  },
  postWorktreeToLinear: {
    method: "POST",
    path: projectApiPaths.postWorktreeToLinear,
    pathParams: WorktreeIdParamsSchema,
    body: PostWorktreeToLinearRequestSchema,
    responses: {
      200: PostWorktreeToLinearResponseSchema,
      ...commonErrorResponses,
    },
  },
  syncWorktreePrs: {
    method: "POST",
    path: projectApiPaths.syncWorktreePrs,
    pathParams: WorktreeIdParamsSchema,
    body: c.noBody(),
    responses: {
      200: ProjectWorktreeSnapshotSchema,
      ...commonErrorResponses,
    },
  },
  setWorktreeLabel: {
    method: "PUT",
    path: projectApiPaths.setWorktreeLabel,
    pathParams: WorktreeIdParamsSchema,
    body: SetWorktreeLabelRequestSchema,
    responses: {
      200: SetWorktreeLabelResponseSchema,
      ...commonErrorResponses,
    },
  },
  setWorktreeProfile: {
    method: "PUT",
    path: projectApiPaths.setWorktreeProfile,
    pathParams: WorktreeIdParamsSchema,
    body: SetWorktreeProfileRequestSchema,
    responses: {
      200: SetWorktreeProfileResponseSchema,
      ...commonErrorResponses,
    },
  },
  sendWorktreePrompt: {
    method: "POST",
    path: projectApiPaths.sendWorktreePrompt,
    pathParams: WorktreeIdParamsSchema,
    body: SendWorktreePromptRequestSchema,
    responses: {
      200: OkResponseSchema,
      ...commonErrorResponses,
    },
  },
  createWorktreeTab: {
    method: "POST",
    path: projectApiPaths.createWorktreeTab,
    pathParams: WorktreeIdParamsSchema,
    body: c.noBody(),
    responses: {
      201: CreateTabResponseSchema,
      ...commonErrorResponses,
    },
  },
  selectWorktreeTab: {
    method: "POST",
    path: projectApiPaths.selectWorktreeTab,
    pathParams: WorktreeTabParamsSchema,
    body: c.noBody(),
    responses: {
      200: OkResponseSchema,
      ...commonErrorResponses,
    },
  },
  deleteWorktreeTab: {
    method: "DELETE",
    path: projectApiPaths.deleteWorktreeTab,
    pathParams: WorktreeTabParamsSchema,
    responses: {
      200: OkResponseSchema,
      ...commonErrorResponses,
    },
  },
  registerWorktreePort: {
    method: "POST",
    path: projectApiPaths.worktreePorts,
    pathParams: WorktreeIdParamsSchema,
    body: RegisterWorktreePortRequestSchema,
    responses: {
      200: RegisterWorktreePortResponseSchema,
      ...commonErrorResponses,
    },
  },
  fetchWorktreePorts: {
    method: "GET",
    path: projectApiPaths.worktreePorts,
    pathParams: WorktreeIdParamsSchema,
    responses: {
      200: WorktreePortListResponseSchema,
      ...commonErrorResponses,
    },
  },
  deleteWorktreePort: {
    method: "DELETE",
    path: projectApiPaths.deleteWorktreePort,
    pathParams: WorktreeIdPortParamsSchema,
    responses: {
      200: OkResponseSchema,
      ...commonErrorResponses,
    },
  },
  mergeWorktree: {
    method: "POST",
    path: projectApiPaths.mergeWorktree,
    pathParams: WorktreeIdParamsSchema,
    body: c.noBody(),
    responses: {
      200: OkResponseSchema,
      ...commonErrorResponses,
    },
  },
  fetchWorktreeDiff: {
    method: "GET",
    path: projectApiPaths.fetchWorktreeDiff,
    pathParams: WorktreeIdParamsSchema,
    responses: {
      200: WorktreeDiffResponseSchema,
      ...commonErrorResponses,
    },
  },
  fetchLinearIssues: {
    method: "GET",
    path: projectApiPaths.fetchLinearIssues,
    responses: {
      200: LinearIssuesResponseSchema,
      500: ErrorResponseSchema,
      502: ErrorResponseSchema,
    },
  },
  fetchAutoNameConfig: {
    method: "GET",
    path: projectApiPaths.fetchAutoNameConfig,
    responses: {
      200: AutoNameConfigResponseSchema,
      500: ErrorResponseSchema,
    },
  },
  setLinearAutoCreate: {
    method: "PUT",
    path: projectApiPaths.setLinearAutoCreate,
    body: ToggleEnabledRequestSchema,
    responses: {
      200: EnabledResponseSchema,
      ...commonErrorResponses,
    },
  },
  setAutoRemoveOnMerge: {
    method: "PUT",
    path: projectApiPaths.setAutoRemoveOnMerge,
    body: ToggleEnabledRequestSchema,
    responses: {
      200: EnabledResponseSchema,
      ...commonErrorResponses,
    },
  },
  pullMain: {
    method: "POST",
    path: projectApiPaths.pullMain,
    body: PullMainRequestSchema,
    responses: {
      200: PullMainResponseSchema,
      ...commonErrorResponses,
    },
  },
  fetchCiLogs: {
    method: "GET",
    path: projectApiPaths.fetchCiLogs,
    pathParams: RunIdParamsSchema,
    responses: {
      200: CiLogsResponseSchema,
      ...commonErrorResponses,
    },
  },
  dismissNotification: {
    method: "POST",
    path: projectApiPaths.dismissNotification,
    pathParams: NotificationIdParamsSchema,
    body: c.noBody(),
    responses: {
      200: OkResponseSchema,
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
    },
  },
}, {
  strictStatusCodes: true,
});

export const hubContract = c.router({
  fetchProjects: {
    method: "GET",
    path: hubApiPaths.fetchProjects,
    responses: {
      200: ProjectsResponseSchema,
      500: ErrorResponseSchema,
    },
  },
  addProject: {
    method: "POST",
    path: hubApiPaths.addProject,
    body: AddProjectRequestSchema,
    responses: {
      200: AddProjectResponseSchema,
      400: ErrorResponseSchema,
      500: ErrorResponseSchema,
    },
  },
  fetchAllProjectWorktrees: {
    method: "GET",
    path: hubApiPaths.fetchAllProjectWorktrees,
    query: AllProjectWorktreesQuerySchema,
    responses: {
      200: AllProjectWorktreesResponseSchema,
      400: ErrorResponseSchema,
      500: ErrorResponseSchema,
    },
  },
  projectInits: {
    method: "GET",
    path: hubApiPaths.projectInits,
    responses: {
      200: ProjectInitsResponseSchema,
      500: ErrorResponseSchema,
    },
  },
  removeProject: {
    method: "DELETE",
    path: hubApiPaths.removeProject,
    pathParams: ProjectPrefixParamsSchema,
    body: c.noBody(),
    responses: {
      200: OkResponseSchema,
      404: ErrorResponseSchema,
      500: ErrorResponseSchema,
    },
  },
  fetchAgents: {
    method: "GET",
    path: hubApiPaths.fetchAgents,
    responses: {
      200: AgentListResponseSchema,
      500: ErrorResponseSchema,
    },
  },
  createAgent: {
    method: "POST",
    path: hubApiPaths.createAgent,
    body: UpsertCustomAgentRequestSchema,
    responses: {
      200: AgentResponseSchema,
      400: ErrorResponseSchema,
      409: ErrorResponseSchema,
      500: ErrorResponseSchema,
    },
  },
  updateAgent: {
    method: "PUT",
    path: hubApiPaths.updateAgent,
    pathParams: AgentIdParamsSchema,
    body: UpsertCustomAgentRequestSchema,
    responses: {
      200: AgentResponseSchema,
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
      409: ErrorResponseSchema,
      500: ErrorResponseSchema,
    },
  },
  deleteAgent: {
    method: "DELETE",
    path: hubApiPaths.deleteAgent,
    pathParams: AgentIdParamsSchema,
    body: c.noBody(),
    responses: {
      200: OkResponseSchema,
      400: ErrorResponseSchema,
      404: ErrorResponseSchema,
      500: ErrorResponseSchema,
    },
  },
  validateAgent: {
    method: "POST",
    path: hubApiPaths.validateAgent,
    body: UpsertCustomAgentRequestSchema,
    responses: {
      200: ValidateCustomAgentResponseSchema,
      400: ErrorResponseSchema,
      500: ErrorResponseSchema,
    },
  },
}, {
  strictStatusCodes: true,
});
