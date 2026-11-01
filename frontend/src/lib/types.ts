import type {
  AgentId,
  AppNotification,
  BuiltInAgentId,
  LinkedLinearIssue,
  OneshotConfig,
  PendingWorktreeCreation,
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
  id: string;
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

/** A creation still naming its branch: it has no worktree yet, only the id
 *  its worktree will get. */
export interface PendingCreationInfo extends PendingWorktreeCreation {
  project: string;
}

/** One project's worktrees from the hub listing; `error` is that project's fetch failure. */
export interface ProjectWorktreeList {
  prefix: string;
  name: string;
  worktrees: WorktreeInfo[];
  pendingCreations: PendingCreationInfo[];
  error: string | null;
}

export interface WorktreeListRow {
  worktree: WorktreeInfo;
  depth: number;
}

/** A sidebar row for a creation still naming its branch. */
export interface PendingListRow {
  pending: PendingCreationInfo;
  depth: 0;
}

export type ActiveListRow = WorktreeListRow | PendingListRow;

/** The current project's sidebar list: active rows, then the archived ones
 *  folded at the bottom. Both pass the search, favorites first, sub-worktrees
 *  nested; creations still naming their branch sit at the top of the active
 *  rows, after the favorites. */
export interface ProjectListRows {
  active: ActiveListRow[];
  archived: WorktreeListRow[];
}

/** A project's avatar on the sidebar rail. */
export interface ProjectRailItem {
  prefix: string;
  name: string;
  initials: string;
  /** Tailwind classes tinting the avatar. */
  tint: string;
  /** Active worktrees waiting, in error or finished unread. */
  needsYou: number;
  /** An agent works or a worktree is being created. */
  running: boolean;
  error: string | null;
}

/** A repo a project header pulls or opens in the IDE: the project's own
 *  (`repo: null`) or one of its linked repos (`repo` = alias). */
export interface ProjectRepo {
  repo: string | null;
  label: string;
  ideUrl: string | null;
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
