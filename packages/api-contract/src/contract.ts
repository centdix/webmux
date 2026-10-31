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
  WorktreeNameParamsSchema,
  WorktreeTabParamsSchema,
  WorktreePortParamsSchema,
  RegisterWorktreePortRequestSchema,
  RegisterWorktreePortResponseSchema,
  WorktreePortListResponseSchema,
  NotificationIdParamsSchema,
  LinearIssuesResponseSchema,
  AutoNameConfigResponseSchema,
  InstancesResponseSchema,
  ProjectsResponseSchema,
  AllProjectWorktreesResponseSchema,
  AddProjectRequestSchema,
  AddProjectResponseSchema,
  ProjectInitsResponseSchema,
  ProjectPrefixParamsSchema,
  MigrateProjectsRequestSchema,
  MigrateProjectsResponseSchema,
} from "./schemas";

const c = initContract();

/** Hub routes: absolute paths, global to the server (no project scope). */
export const hubApiPaths = {
  fetchInstances: "/api/instances",
  fetchProjects: "/api/projects",
  addProject: "/api/projects",
  projectInits: "/api/projects/init",
  fetchAllProjectWorktrees: "/api/projects/worktrees",
  migrateProjects: "/api/projects/migrate",
  removeProject: "/api/projects/:prefix",
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
  fetchAgents: "/agents",
  createAgent: "/agents",
  updateAgent: "/agents/:id",
  deleteAgent: "/agents/:id",
  validateAgent: "/agents/validate",
  attachAgentsWorktreeConversation: "/agents/worktrees/:name/attach",
  fetchAgentsWorktreeConversationHistory: "/agents/worktrees/:name/history",
  sendAgentsWorktreeConversationMessage: "/agents/worktrees/:name/messages",
  interruptAgentsWorktreeConversation: "/agents/worktrees/:name/interrupt",
  streamAgentsWorktreeConversation: "/ws/agents/worktrees/:name",
  fetchWorktrees: "/worktrees",
  createWorktree: "/worktrees",
  removeWorktree: "/worktrees/:name",
  openWorktree: "/worktrees/:name/open",
  closeWorktree: "/worktrees/:name/close",
  refreshWorktreeAgentTerminal: "/worktrees/:name/agent-terminal/refresh",
  setWorktreeArchived: "/worktrees/:name/archive",
  syncWorktreePrs: "/worktrees/:name/sync-prs",
  postWorktreeToLinear: "/worktrees/:name/linear/post",
  setWorktreeLabel: "/worktrees/:name/label",
  setWorktreeProfile: "/worktrees/:name/profile",
  sendWorktreePrompt: "/worktrees/:name/send",
  createWorktreeTab: "/worktrees/:name/tabs",
  selectWorktreeTab: "/worktrees/:name/tabs/:tabId/select",
  deleteWorktreeTab: "/worktrees/:name/tabs/:tabId",
  worktreePorts: "/worktrees/:name/ports",
  deleteWorktreePort: "/worktrees/:name/ports/:label",
  mergeWorktree: "/worktrees/:name/merge",
  fetchWorktreeDiff: "/worktrees/:name/diff",
  fetchLinearIssues: "/linear/issues",
  fetchAutoNameConfig: "/project/auto-name",
  setLinearAutoCreate: "/linear/auto-create",
  setAutoRemoveOnMerge: "/github/auto-remove-on-merge",
  pullMain: "/pull-main",
  fetchCiLogs: "/ci-logs/:runId",
  dismissNotification: "/notifications/:id/dismiss",
  streamTerminal: "/ws/:worktree",
  uploadWorktreeFiles: "/worktrees/:name/upload",
  streamNotifications: "/notifications/stream",
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
  fetchAgents: {
    method: "GET",
    path: projectApiPaths.fetchAgents,
    responses: {
      200: AgentListResponseSchema,
      500: ErrorResponseSchema,
    },
  },
  createAgent: {
    method: "POST",
    path: projectApiPaths.createAgent,
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
    path: projectApiPaths.updateAgent,
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
    path: projectApiPaths.deleteAgent,
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
    path: projectApiPaths.validateAgent,
    body: UpsertCustomAgentRequestSchema,
    responses: {
      200: ValidateCustomAgentResponseSchema,
      400: ErrorResponseSchema,
      500: ErrorResponseSchema,
    },
  },
  attachAgentsWorktreeConversation: {
    method: "POST",
    path: projectApiPaths.attachAgentsWorktreeConversation,
    pathParams: WorktreeNameParamsSchema,
    body: c.noBody(),
    responses: {
      200: AgentsUiWorktreeConversationResponseSchema,
      ...commonErrorResponses,
    },
  },
  fetchAgentsWorktreeConversationHistory: {
    method: "GET",
    path: projectApiPaths.fetchAgentsWorktreeConversationHistory,
    pathParams: WorktreeNameParamsSchema,
    responses: {
      200: AgentsUiWorktreeConversationResponseSchema,
      ...commonErrorResponses,
    },
  },
  sendAgentsWorktreeConversationMessage: {
    method: "POST",
    path: projectApiPaths.sendAgentsWorktreeConversationMessage,
    pathParams: WorktreeNameParamsSchema,
    body: AgentsSendMessageRequestSchema,
    responses: {
      200: AgentsUiSendMessageResponseSchema,
      ...commonErrorResponses,
    },
  },
  interruptAgentsWorktreeConversation: {
    method: "POST",
    path: projectApiPaths.interruptAgentsWorktreeConversation,
    pathParams: WorktreeNameParamsSchema,
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
    pathParams: WorktreeNameParamsSchema,
    responses: {
      200: OkResponseSchema,
      ...commonErrorResponses,
    },
  },
  openWorktree: {
    method: "POST",
    path: projectApiPaths.openWorktree,
    pathParams: WorktreeNameParamsSchema,
    body: OpenWorktreeRequestSchema,
    responses: {
      200: OkResponseSchema,
      ...commonErrorResponses,
    },
  },
  closeWorktree: {
    method: "POST",
    path: projectApiPaths.closeWorktree,
    pathParams: WorktreeNameParamsSchema,
    body: c.noBody(),
    responses: {
      200: OkResponseSchema,
      ...commonErrorResponses,
    },
  },
  refreshWorktreeAgentTerminal: {
    method: "POST",
    path: projectApiPaths.refreshWorktreeAgentTerminal,
    pathParams: WorktreeNameParamsSchema,
    body: c.noBody(),
    responses: {
      200: OkResponseSchema,
      ...commonErrorResponses,
    },
  },
  setWorktreeArchived: {
    method: "PUT",
    path: projectApiPaths.setWorktreeArchived,
    pathParams: WorktreeNameParamsSchema,
    body: SetWorktreeArchivedRequestSchema,
    responses: {
      200: SetWorktreeArchivedResponseSchema,
      ...commonErrorResponses,
    },
  },
  postWorktreeToLinear: {
    method: "POST",
    path: projectApiPaths.postWorktreeToLinear,
    pathParams: WorktreeNameParamsSchema,
    body: PostWorktreeToLinearRequestSchema,
    responses: {
      200: PostWorktreeToLinearResponseSchema,
      ...commonErrorResponses,
    },
  },
  syncWorktreePrs: {
    method: "POST",
    path: projectApiPaths.syncWorktreePrs,
    pathParams: WorktreeNameParamsSchema,
    body: c.noBody(),
    responses: {
      200: ProjectWorktreeSnapshotSchema,
      ...commonErrorResponses,
    },
  },
  setWorktreeLabel: {
    method: "PUT",
    path: projectApiPaths.setWorktreeLabel,
    pathParams: WorktreeNameParamsSchema,
    body: SetWorktreeLabelRequestSchema,
    responses: {
      200: SetWorktreeLabelResponseSchema,
      ...commonErrorResponses,
    },
  },
  setWorktreeProfile: {
    method: "PUT",
    path: projectApiPaths.setWorktreeProfile,
    pathParams: WorktreeNameParamsSchema,
    body: SetWorktreeProfileRequestSchema,
    responses: {
      200: SetWorktreeProfileResponseSchema,
      ...commonErrorResponses,
    },
  },
  sendWorktreePrompt: {
    method: "POST",
    path: projectApiPaths.sendWorktreePrompt,
    pathParams: WorktreeNameParamsSchema,
    body: SendWorktreePromptRequestSchema,
    responses: {
      200: OkResponseSchema,
      ...commonErrorResponses,
    },
  },
  createWorktreeTab: {
    method: "POST",
    path: projectApiPaths.createWorktreeTab,
    pathParams: WorktreeNameParamsSchema,
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
    pathParams: WorktreeNameParamsSchema,
    body: RegisterWorktreePortRequestSchema,
    responses: {
      200: RegisterWorktreePortResponseSchema,
      ...commonErrorResponses,
    },
  },
  fetchWorktreePorts: {
    method: "GET",
    path: projectApiPaths.worktreePorts,
    pathParams: WorktreeNameParamsSchema,
    responses: {
      200: WorktreePortListResponseSchema,
      ...commonErrorResponses,
    },
  },
  deleteWorktreePort: {
    method: "DELETE",
    path: projectApiPaths.deleteWorktreePort,
    pathParams: WorktreePortParamsSchema,
    responses: {
      200: OkResponseSchema,
      ...commonErrorResponses,
    },
  },
  mergeWorktree: {
    method: "POST",
    path: projectApiPaths.mergeWorktree,
    pathParams: WorktreeNameParamsSchema,
    body: c.noBody(),
    responses: {
      200: OkResponseSchema,
      ...commonErrorResponses,
    },
  },
  fetchWorktreeDiff: {
    method: "GET",
    path: projectApiPaths.fetchWorktreeDiff,
    pathParams: WorktreeNameParamsSchema,
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
  fetchInstances: {
    method: "GET",
    path: hubApiPaths.fetchInstances,
    responses: {
      200: InstancesResponseSchema,
      500: ErrorResponseSchema,
    },
  },
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
    responses: {
      200: AllProjectWorktreesResponseSchema,
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
  migrateProjects: {
    method: "POST",
    path: hubApiPaths.migrateProjects,
    body: MigrateProjectsRequestSchema,
    responses: {
      200: MigrateProjectsResponseSchema,
      400: ErrorResponseSchema,
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
}, {
  strictStatusCodes: true,
});
