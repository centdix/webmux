import type {
  AgentId,
  AppNotification,
  BuiltInAgentId,
  LinkedLinearIssue,
  OneshotConfig,
  PrEntry,
  ServiceStatus,
  WorktreeCreationPhase,
  WorktreeSource,
  WorktreeTab,
} from "@webmux/api-contract";

export type {
  AgentsUiConversationEvent,
  AgentsUiConversationMessage,
  AgentsUiConversationMessageDeltaEvent,
  AgentsUiConversationMessageUpsertEvent,
  AgentsUiConversationStatusEvent,
  AgentsUiConversationState,
  AgentsUiInterruptResponse,
  AgentsUiSendMessageResponse,
  AgentsUiWorktreeConversationResponse,
  AgentCapabilities,
  AgentDetails,
  AgentId,
  AgentKind,
  BuiltInAgentId,
  AgentListResponse,
  AgentResponse,
  AgentSummary,
  ValidateCustomAgentResponse,
  AppConfig,
  AppNotification,
  AvailableBranch,
  AvailableBranchesQuery,
  BranchListResponse,
  CiCheck,
  CreateWorktreeRequest,
  CreateWorktreeResponse,
  LinearIssue,
  LinearIssueAvailability,
  LinearIssueLabel,
  LinearIssueState,
  LinearIssuesResponse,
  LinkedLinearIssue,
  LinkedRepoInfo,
  NotificationDismissal,
  OneshotConfig,
  PostWorktreeToLinearRequest,
  PostWorktreeToLinearResponse,
  PostWorktreeToLinearTarget,
  FromLinearInput,
  IdeKind,
  InstanceSummary,
  PrComment,
  PrEntry,
  ProfileConfig,
  ProjectInitPhase,
  ProjectInitState,
  ProjectSnapshot,
  ProjectSummary,
  ProjectWorktreeSnapshot,
  PullMainResult,
  UpsertCustomAgentRequest,
  ServiceStatus,
  SetWorktreeArchivedRequest,
  SetWorktreeArchivedResponse,
  SetWorktreeLabelRequest,
  SetWorktreeLabelResponse,
  UnpushedCommit,
  WorktreeCreationPhase,
  WorktreeCreationState,
  WorktreeCreateMode,
  WorktreeDiffResponse,
  WorktreeListResponse,
  WorktreeSource,
  WorktreeTab,
} from "@webmux/api-contract";
export type { AgentsSendMessageRequest as AgentsUiSendMessageRequest } from "@webmux/api-contract";

export interface FileUploadResult {
  files: Array<{ path: string }>;
}

export interface AskUserQuestionOption {
  label: string;
  description?: string;
}

export interface AskUserQuestionItem {
  question: string;
  header: string;
  multiSelect?: boolean;
  options: AskUserQuestionOption[];
}

export interface AskUserQuestionInput {
  questions: AskUserQuestionItem[];
}

export interface DiffDialogProps {
  project: string;
  branch: string;
  ideUrl?: string | null;
  onclose: () => void;
}

/** Identity of a worktree across projects: branch names are only unique per project. */
export interface WorktreeRef {
  project: string;
  branch: string;
}

export interface WorktreeInfo extends WorktreeRef {
  label: string | null;
  baseBranch?: string;
  archived: boolean;
  agent: string;
  mux: string;
  path: string;
  dir: string | null;
  dirty: boolean;
  unpushed: boolean;
  status: string;
  elapsed: string;
  profile: string | null;
  agentName: AgentId | null;
  agentLabel: string | null;
  agentTerminalStale: boolean;
  services: ServiceStatus[];
  paneCount: number;
  prs: PrEntry[];
  linearIssue: LinkedLinearIssue | null;
  creating: boolean;
  creationPhase: WorktreeCreationPhase | null;
  source: WorktreeSource;
  oneshot: OneshotConfig | null;
  tabs: WorktreeTab[];
  activeTabId: string | null;
}

/** One project's worktrees from the hub listing; `error` is that project's fetch failure. */
export interface ProjectWorktreeList {
  prefix: string;
  name: string;
  worktrees: WorktreeInfo[];
  error: string | null;
}

export interface WorktreeListRow {
  worktree: WorktreeInfo;
  depth: number;
}

/** One project of the sidebar list: its header, then its rows. */
export interface WorktreeListSection {
  prefix: string;
  name: string;
  error: string | null;
  collapsed: boolean;
  /** Worktrees passing the filters, favorites first, sub-worktrees nested;
   *  computed even when collapsed (the header counts them). */
  rows: WorktreeListRow[];
  /** Shown in place of rows when the project has none to show. */
  emptyMessage: string | null;
}

export type ToastTone = "info" | "success" | "error";

export interface ToastInput {
  tone: ToastTone;
  message: string;
  detail?: string;
}

export interface UiToastItem extends ToastInput {
  id: string;
  source: "ui";
}

export interface NotificationToastItem extends ToastInput {
  id: string;
  source: "notification";
  notification: AppNotification;
  branch: string;
  url?: string;
}

export type ToastItem = UiToastItem | NotificationToastItem;

/** Boot-time project resolution: a project to open, none registered, or the
 *  project list could not be fetched (distinct from an empty list). */
export type InitialProject =
  | { kind: "project"; prefix: string }
  | { kind: "none" }
  | { kind: "error"; message: string };
