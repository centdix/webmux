import * as p from "@clack/prompts";
import { createProjectApi, type ProjectApi } from "@webmux/api-contract";
import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { buildSeedFromLinear, defaultSeedFromLinearDeps } from "../../backend/src/services/conversation-export-service";
import { CommandUsageError, resolveProjectPrefix, resolveServedProjectPrefix, run, serverOrigin, withServerConnection } from "./shared";
import { readOpenSessionsState, readWorktreeArchiveState, readWorktreeMeta, readWorktreePrs } from "../../backend/src/adapters/fs";
import type { OpenSessionsState, PrEntry } from "../../backend/src/domain/model";
import { buildProjectSessionName, buildWorktreeWindowName } from "../../backend/src/adapters/tmux";
import type { AgentId, AutoNameConfig } from "../../backend/src/domain/config";
import type { WorktreeCreationPhase } from "../../backend/src/domain/model";
import { compareWorktreeOrder, isValidWorktreeName } from "../../backend/src/domain/policies";
import { isValidPortLabel } from "../../backend/src/domain/port-registrations";
import { buildArchivedWorktreePathSet } from "../../backend/src/services/archive-service";
import { createProjectsRegistry } from "../../backend/src/adapters/projects-registry";
import type { ProjectEntry } from "../../backend/src/domain/projects";
import { createPortRegistrationService, createWebmuxRuntime } from "../../backend/src/runtime";
import type { CreateLifecycleWorktreeInput, CreateLifecycleWorktreesInput, CreateLifecycleWorktreesResult, CreateWorktreeProgress, PruneWorktreesResult } from "../../backend/src/services/lifecycle-service";

const PHASE_LABELS: Record<WorktreeCreationPhase, string> = {
  creating_worktree: "Creating worktree",
  running_post_create_hook: "Running post-create hook",
  preparing_runtime: "Preparing runtime",
  starting_session: "Starting session",
  reconciling: "Reconciling",
};

export type WorktreeSubcommand = "add" | "list" | "open" | "close" | "refresh" | "remove" | "merge" | "send" | "prune" | "restore" | "archive" | "unarchive" | "label" | "profile" | "tab" | "port";

type WorktreeListMode = "active" | "all" | "archived";

interface LifecycleServiceLike {
  createWorktree(input: CreateLifecycleWorktreeInput): Promise<{ branch: string; worktreeId: string }>;
  createWorktrees(input: CreateLifecycleWorktreesInput): Promise<CreateLifecycleWorktreesResult>;
  openWorktree(branch: string): Promise<{ branch: string; worktreeId: string }>;
  closeWorktree(branch: string): Promise<void>;
  refreshAgentTerminal(branch: string): Promise<{ branch: string; worktreeId: string }>;
  setWorktreeArchived(branch: string, archived: boolean): Promise<void>;
  setWorktreeLabel(branch: string, label: string | null): Promise<{ label: string | null }>;
  setWorktreeProfile(branch: string, profile: string): Promise<{ profile: string; restarted: boolean }>;
  removeWorktree(branch: string): Promise<void>;
  mergeWorktree(branch: string): Promise<void>;
  pruneWorktrees(): Promise<PruneWorktreesResult>;
}

export interface WorktreeRuntimeLike {
  projectDir: string;
  config: {
    workspace: {
      mainBranch: string;
    };
    autoName: AutoNameConfig | null;
  };
  git: {
    listWorktrees(cwd: string): Array<{ path: string; branch: string | null; bare: boolean }>;
    resolveWorktreeGitDir(cwd: string): string;
  };
  tmux: {
    listWindows(): Array<{
      sessionName: string;
      windowName: string;
      worktreeId?: string | null;
      role?: string | null;
    }>;
  };
  lifecycleService: LifecycleServiceLike;
}

interface WorktreeCommandContext {
  command: WorktreeSubcommand;
  args: string[];
  projectDir: string;
  port: number;
}

interface WorktreeCommandDependencies {
  createRuntime?: (options: {
    projectDir: string;
    port: number;
    prefix?: string;
    onCreateProgress?: (progress: CreateWorktreeProgress) => void;
  }) => WorktreeRuntimeLike;
  stdout?: (message: string) => void;
  stderr?: (message: string) => void;
  switchToTmuxWindow?: (projectDir: string, branch: string) => void;
  confirmPrune?: (worktreeCount: number) => Promise<boolean>;
  /** Resolve the served project's prefix for server-backed commands (send/tab/port).
   *  Injectable so tests can exercise the HTTP shape without a live server. */
  resolveServedProject?: (port: number, projectDir: string) => Promise<string>;
  /** Resolve the project's route prefix so control.env written by in-process
   *  commands (add/open/refresh) matches the dashboard's prefixed routes.
   *  Returns undefined when it can't be resolved (no server), so no control URL
   *  is written. Injectable so tests can drive it without a live server. */
  resolveProjectPrefix?: (port: number, projectDir: string) => Promise<string | undefined>;
  /** Read the saved open-sessions snapshot (used by `restore`). Injectable so
   *  tests can drive restore without touching the filesystem. */
  readOpenSessions?: (gitDir: string) => Promise<OpenSessionsState>;
  /** Worktree `port` targets when `--worktree` is omitted. Defaults to the agent's
   *  `$WEBMUX_BRANCH`, else the current git branch of `projectDir`. */
  resolveCurrentBranch?: (projectDir: string) => string | null;
  /** Projects listed by `list --all-projects`. Defaults to the persisted
   *  registry (`~/.webmux/projects.json`). */
  listProjects?: () => ProjectEntry[];
  /** Whether a registered project's folder still exists (`list --all-projects`). */
  pathExists?: (path: string) => boolean;
}

export function getWorktreeCommandUsage(command: WorktreeSubcommand): string {
  switch (command) {
    case "add":
      return [
        "Usage:",
        "  webmux add [branch] [--existing] [--base <branch>] [--profile <name>] [--agent <id>] [--prompt <text>] [--env KEY=VALUE] [--detach] [--from-linear <issue-id>]",
        "",
        "Options:",
        "  --existing               Use an existing local or remote branch instead of creating a new one",
        "  --base <branch>         Base branch for a new worktree (defaults to config)",
        "  --profile <name>         Worktree profile from .webmux.yaml",
        "  --agent <id>              Agent id to launch (repeatable)",
        "  --prompt <text>          Initial agent prompt",
        "  --env KEY=VALUE          Runtime env override (repeatable)",
        "  -d, --detach             Create worktree without switching to it",
        "  --from-linear ID         Bootstrap from a Linear issue — loads the issue body as",
        "                           context, plus any saved webmux session or linked PR",
        "  --help                   Show this help message",
      ].join("\n");
    case "list":
      return [
        "Usage:",
        "  webmux list [--all|--archived] [--search <text>] [--all-projects]",
        "",
        "Options:",
        "  --all                    Include archived worktrees",
        "  --archived               Show only archived worktrees",
        "  --search <text>          Filter worktrees by branch/profile/agent",
        "  --all-projects           List worktrees of every registered project, grouped by project",
        "  --help                   Show this help message",
      ].join("\n");
    case "open":
      return "Usage:\n  webmux open <branch>";
    case "close":
      return "Usage:\n  webmux close <branch>";
    case "refresh":
      return "Usage:\n  webmux refresh <branch>";
    case "archive":
      return "Usage:\n  webmux archive <branch>";
    case "unarchive":
      return "Usage:\n  webmux unarchive <branch>";
    case "label":
      return [
        "Usage:",
        "  webmux label <branch> <label>",
        "  webmux label <branch> --clear",
        "",
        "Options:",
        "  --clear                  Clear the workspace label",
        "  --label <text>           Label text",
        "  --help                   Show this help message",
      ].join("\n");
    case "profile":
      return [
        "Usage:",
        "  webmux profile <branch> <profile>",
        "",
        "Switches the worktree to another profile from .webmux.yaml. An open",
        "worktree is restarted with the new pane layout and commands; a closed",
        "one picks the new profile up on its next open.",
        "",
        "Options:",
        "  --profile <name>         Profile name (alternative to positional arg)",
        "  --help                   Show this help message",
      ].join("\n");
    case "remove":
      return "Usage:\n  webmux remove <branch>";
    case "merge":
      return "Usage:\n  webmux merge <branch>";
    case "send":
      return [
        "Usage:",
        "  webmux send <branch> <prompt> [--preamble <text>]",
        "",
        "Options:",
        "  --prompt <text>          Prompt text (alternative to positional arg)",
        "  --preamble <text>        Preamble text sent before the prompt",
        "  --help                   Show this help message",
      ].join("\n");
    case "prune":
      return "Usage:\n  webmux prune";
    case "restore":
      return "Usage:\n  webmux restore\n\nRe-open every worktree session that was open the last time sessions were saved.";
    case "port":
      return [
        "Usage:",
        "  webmux port <label> [--port <n>] [--keep]   Get a port for a service and print it",
        "  webmux port ls                              List registered ports",
        "  webmux port rm <label>                      Release a port",
        "",
        "The same label returns the same port. A port is shown in the dashboard",
        "while something listens on it, and released after 5 minutes idle (unless",
        "kept) or when the worktree is removed.",
        "",
        "Options:",
        "  --port <n>               Register a port the service already uses",
        "  --keep                   Never release the port for being idle",
        "  --worktree <branch>      Target worktree (defaults to the current one)",
        "  --help                   Show this help message",
      ].join("\n");
    case "tab":
      return [
        "Usage:",
        "  webmux tab <branch>                 List the agent tabs (★ marks the active one)",
        "  webmux tab <branch> new             Create a new forked tab",
        "  webmux tab <branch> switch <tabId>  Switch the visible agent pane to a tab",
        "  webmux tab <branch> close <tabId>   Delete a forked tab",
        "",
        "Options:",
        "  --help                   Show this help message",
      ].join("\n");
  }
}

function readOptionValue(args: string[], index: number, flag: string): {
  value: string;
  nextIndex: number;
} {
  const arg = args[index];
  if (!arg) {
    throw new CommandUsageError(`${flag} requires a value`);
  }

  const prefix = `${flag}=`;
  if (arg.startsWith(prefix)) {
    return {
      value: arg.slice(prefix.length),
      nextIndex: index,
    };
  }

  const value = args[index + 1];
  if (value === undefined) {
    throw new CommandUsageError(`${flag} requires a value`);
  }

  return {
    value,
    nextIndex: index + 1,
  };
}

function parseAgent(value: string): AgentId {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new CommandUsageError("Agent id cannot be empty");
  }
  return trimmed;
}

export interface ParsedAddCommand {
  input: CreateLifecycleWorktreesInput;
  detach: boolean;
  fromLinearIssueId: string | null;
  branchExplicit: boolean;
}

export function parseAddCommandArgs(args: string[]): ParsedAddCommand | null {
  const input: CreateLifecycleWorktreesInput = {};
  const envOverrides: Record<string, string> = {};
  const selectedAgents: AgentId[] = [];
  let detach = false;
  let fromLinearIssueId: string | null = null;
  let branchExplicit = false;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg) continue;

    if (arg === "--help" || arg === "-h") {
      return null;
    }

    if (arg === "--existing") {
      input.mode = "existing";
      continue;
    }

    if (arg === "--detach" || arg === "-d") {
      detach = true;
      continue;
    }

    if (arg === "--profile" || arg.startsWith("--profile=")) {
      const { value, nextIndex } = readOptionValue(args, index, "--profile");
      input.profile = value;
      index = nextIndex;
      continue;
    }

    if (arg === "--base" || arg.startsWith("--base=")) {
      const { value, nextIndex } = readOptionValue(args, index, "--base");
      input.baseBranch = value;
      index = nextIndex;
      continue;
    }

    if (arg === "--agent" || arg.startsWith("--agent=")) {
      const { value, nextIndex } = readOptionValue(args, index, "--agent");
      selectedAgents.push(parseAgent(value));
      index = nextIndex;
      continue;
    }

    if (arg === "--prompt" || arg.startsWith("--prompt=")) {
      const { value, nextIndex } = readOptionValue(args, index, "--prompt");
      input.prompt = value;
      index = nextIndex;
      continue;
    }

    if (arg === "--env" || arg.startsWith("--env=")) {
      const { value, nextIndex } = readOptionValue(args, index, "--env");
      const separatorIndex = value.indexOf("=");
      if (separatorIndex <= 0) {
        throw new CommandUsageError("--env must use KEY=VALUE");
      }
      envOverrides[value.slice(0, separatorIndex)] = value.slice(separatorIndex + 1);
      index = nextIndex;
      continue;
    }

    if (arg === "--from-linear" || arg.startsWith("--from-linear=")) {
      const { value, nextIndex } = readOptionValue(args, index, "--from-linear");
      const trimmed = value.trim();
      if (!/^[A-Z]+-\d+$/.test(trimmed)) {
        throw new CommandUsageError(`--from-linear expects an issue id like ENG-123 (got "${trimmed}")`);
      }
      fromLinearIssueId = trimmed;
      index = nextIndex;
      continue;
    }

    if (arg === "--branch" || arg.startsWith("--branch=")) {
      const { value, nextIndex } = readOptionValue(args, index, "--branch");
      if (input.branch && input.branch !== value) {
        throw new CommandUsageError(`Conflicting branch values: "${input.branch}" and "${value}"`);
      }
      input.branch = value.trim();
      branchExplicit = true;
      index = nextIndex;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new CommandUsageError(`Unknown option: ${arg}`);
    }

    if (input.branch) {
      throw new CommandUsageError(`Unexpected argument: ${arg}`);
    }

    input.branch = arg;
    branchExplicit = true;
  }

  if (selectedAgents.length > 0) {
    input.agents = selectedAgents;
  }

  if (Object.keys(envOverrides).length > 0) {
    input.envOverrides = envOverrides;
  }

  return { input, detach, fromLinearIssueId, branchExplicit };
}

export type TabAction = "list" | "new" | "switch" | "close";

export interface ParsedTabCommand {
  branch: string;
  action: TabAction;
  tabId?: string;
}

export function parseTabCommandArgs(args: string[]): ParsedTabCommand | null {
  const positional: string[] = [];
  for (const arg of args) {
    if (arg === "--help" || arg === "-h") return null;
    if (arg.startsWith("-")) throw new CommandUsageError(`Unknown option: ${arg}`);
    positional.push(arg);
  }

  const [branch, rawAction = "list", tabId, ...rest] = positional;
  if (!branch) throw new CommandUsageError("Missing required argument: <branch>");
  if (!isValidWorktreeName(branch)) throw new CommandUsageError("Invalid worktree name");
  if (rawAction !== "list" && rawAction !== "new" && rawAction !== "switch" && rawAction !== "close") {
    throw new CommandUsageError(`Unknown tab action: ${rawAction}`);
  }
  if ((rawAction === "switch" || rawAction === "close") && !tabId) {
    throw new CommandUsageError(`The "${rawAction}" action requires a <tabId>`);
  }
  if (rest.length > 0) throw new CommandUsageError(`Unexpected argument: ${rest[0]}`);

  return { branch, action: rawAction, ...(tabId ? { tabId } : {}) };
}

export type ParsedPortCommand =
  | { action: "register"; branch: string; label: string; port?: number; keep?: true }
  | { action: "list"; branch: string }
  | { action: "remove"; branch: string; label: string };

export function parsePortCommandArgs(args: string[], defaultBranch: string | null): ParsedPortCommand | null {
  const positional: string[] = [];
  let branch: string | null = null;
  let port: number | undefined;
  let keep = false;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg) continue;
    if (arg === "--help" || arg === "-h") return null;

    if (arg === "--keep") {
      keep = true;
      continue;
    }

    if (arg === "--worktree" || arg.startsWith("--worktree=")) {
      const { value, nextIndex } = readOptionValue(args, index, "--worktree");
      branch = value;
      index = nextIndex;
      continue;
    }

    if (arg === "--port" || arg.startsWith("--port=")) {
      const { value, nextIndex } = readOptionValue(args, index, "--port");
      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
        throw new CommandUsageError(`Invalid port: ${value}`);
      }
      port = parsed;
      index = nextIndex;
      continue;
    }

    if (arg.startsWith("-")) throw new CommandUsageError(`Unknown option: ${arg}`);
    positional.push(arg);
  }

  const target = branch ?? defaultBranch;
  if (!target) {
    throw new CommandUsageError("Could not tell which worktree this is; pass --worktree <branch>");
  }
  if (!isValidWorktreeName(target)) throw new CommandUsageError("Invalid worktree name");

  const [first, second, ...rest] = positional;
  if (!first) throw new CommandUsageError("Missing required argument: <label>");

  if (first === "ls") {
    if (second || port !== undefined || keep) throw new CommandUsageError("The \"ls\" action takes no arguments");
    return { action: "list", branch: target };
  }

  const isRemove = first === "rm";
  const label = isRemove ? second : first;
  const extra = isRemove ? rest[0] : second;
  if (!label) throw new CommandUsageError("Missing required argument: <label>");
  if (extra) throw new CommandUsageError(`Unexpected argument: ${extra}`);
  if (!isValidPortLabel(label)) {
    throw new CommandUsageError(`Invalid label: ${label} (use lowercase letters, digits, - or _)`);
  }
  if (isRemove) {
    if (port !== undefined || keep) throw new CommandUsageError("The \"rm\" action does not take --port or --keep");
    return { action: "remove", branch: target, label };
  }
  return {
    action: "register",
    branch: target,
    label,
    ...(port !== undefined ? { port } : {}),
    ...(keep ? { keep: true as const } : {}),
  };
}

function defaultResolveCurrentBranch(projectDir: string): string | null {
  if (Bun.env.WEBMUX_BRANCH) return Bun.env.WEBMUX_BRANCH;
  const result = run("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: projectDir });
  const branch = result.success ? result.stdout.toString().trim() : "";
  return branch && branch !== "HEAD" ? branch : null;
}

export function parseBranchCommandArgs(args: string[]): string | null {
  let branch: string | null = null;

  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      return null;
    }

    if (arg.startsWith("-")) {
      throw new CommandUsageError(`Unknown option: ${arg}`);
    }

    if (branch) {
      throw new CommandUsageError(`Unexpected argument: ${arg}`);
    }

    branch = arg;
  }

  if (!branch) {
    throw new CommandUsageError("Missing required argument: <branch>");
  }

  if (!isValidWorktreeName(branch)) {
    throw new CommandUsageError("Invalid worktree name");
  }

  return branch;
}

export interface ParsedSendCommand {
  branch: string;
  text: string;
  preamble?: string;
}

export interface ParsedLabelCommand {
  branch: string;
  label: string | null;
}

export interface ParsedProfileCommand {
  branch: string;
  profile: string;
}

export interface ParsedListCommand {
  mode: WorktreeListMode;
  search: string;
  allProjects: boolean;
}

export function parseLabelCommandArgs(args: string[]): ParsedLabelCommand | null {
  let branch: string | null = null;
  let clear = false;
  let optionLabel: string | null = null;
  const labelParts: string[] = [];

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg) continue;

    if (arg === "--help" || arg === "-h") {
      return null;
    }

    if (arg === "--clear") {
      clear = true;
      continue;
    }

    if (arg === "--label" || arg.startsWith("--label=")) {
      if (optionLabel !== null) {
        throw new CommandUsageError("Cannot use --label more than once");
      }
      const { value, nextIndex } = readOptionValue(args, index, "--label");
      optionLabel = value;
      index = nextIndex;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new CommandUsageError(`Unknown option: ${arg}`);
    }

    if (!branch) {
      branch = arg;
      continue;
    }

    if (optionLabel !== null) {
      throw new CommandUsageError("Cannot use --label with a positional label");
    }
    labelParts.push(arg);
  }

  if (!branch) {
    throw new CommandUsageError("Missing required argument: <branch>");
  }

  if (!isValidWorktreeName(branch)) {
    throw new CommandUsageError("Invalid worktree name");
  }

  if (optionLabel !== null && labelParts.length > 0) {
    throw new CommandUsageError("Cannot use --label with a positional label");
  }

  const label = (optionLabel ?? labelParts.join(" ")).trim();
  if (clear && label) {
    throw new CommandUsageError("Cannot use --clear with a label");
  }

  if (!clear && !label) {
    throw new CommandUsageError("Missing required argument: <label>");
  }

  return {
    branch,
    label: clear ? null : label,
  };
}

export function parseProfileCommandArgs(args: string[]): ParsedProfileCommand | null {
  let branch: string | null = null;
  let profile: string | null = null;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg) continue;

    if (arg === "--help" || arg === "-h") {
      return null;
    }

    if (arg === "--profile" || arg.startsWith("--profile=")) {
      if (profile !== null) {
        throw new CommandUsageError("Cannot use --profile more than once");
      }
      const { value, nextIndex } = readOptionValue(args, index, "--profile");
      profile = value;
      index = nextIndex;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new CommandUsageError(`Unknown option: ${arg}`);
    }

    if (!branch) {
      branch = arg;
      continue;
    }

    if (profile !== null) {
      throw new CommandUsageError("Cannot use --profile with a positional profile");
    }
    profile = arg;
  }

  if (!branch) {
    throw new CommandUsageError("Missing required argument: <branch>");
  }

  if (!isValidWorktreeName(branch)) {
    throw new CommandUsageError("Invalid worktree name");
  }

  const trimmedProfile = profile?.trim() ?? "";
  if (!trimmedProfile) {
    throw new CommandUsageError("Missing required argument: <profile>");
  }

  return {
    branch,
    profile: trimmedProfile,
  };
}

export function parseSendCommandArgs(args: string[]): ParsedSendCommand | null {
  let branch: string | null = null;
  let text: string | null = null;
  let preamble: string | undefined;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg) continue;

    if (arg === "--help" || arg === "-h") {
      return null;
    }

    if (arg === "--prompt" || arg.startsWith("--prompt=")) {
      if (text) throw new CommandUsageError("Cannot use --prompt with a positional prompt argument");
      const { value, nextIndex } = readOptionValue(args, index, "--prompt");
      text = value;
      index = nextIndex;
      continue;
    }

    if (arg === "--preamble" || arg.startsWith("--preamble=")) {
      const { value, nextIndex } = readOptionValue(args, index, "--preamble");
      preamble = value;
      index = nextIndex;
      continue;
    }

    if (arg.startsWith("-")) {
      throw new CommandUsageError(`Unknown option: ${arg}`);
    }

    if (!branch) {
      branch = arg;
      continue;
    }

    if (!text) {
      text = arg;
      continue;
    }

    throw new CommandUsageError(`Unexpected argument: ${arg}. Use either a positional prompt or --prompt, not both`);
  }

  if (!branch) {
    throw new CommandUsageError("Missing required argument: <branch>");
  }

  if (!isValidWorktreeName(branch)) {
    throw new CommandUsageError("Invalid worktree name");
  }

  if (!text) {
    throw new CommandUsageError("Missing required argument: <prompt>");
  }

  return { branch, text, preamble };
}

function parsePruneCommandArgs(args: string[]): boolean {
  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      return false;
    }

    if (arg.startsWith("-")) {
      throw new CommandUsageError(`Unknown option: ${arg}`);
    }

    throw new CommandUsageError(`Unexpected argument: ${arg}`);
  }

  return true;
}

function parseRestoreCommandArgs(args: string[]): boolean {
  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      return false;
    }

    if (arg.startsWith("-")) {
      throw new CommandUsageError(`Unknown option: ${arg}`);
    }

    throw new CommandUsageError(`Unexpected argument: ${arg}`);
  }

  return true;
}

export function parseListCommandArgs(args: string[]): ParsedListCommand | null {
  let mode: WorktreeListMode = "active";
  let search = "";
  let allProjects = false;

  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (!arg) continue;

    if (arg === "--help" || arg === "-h") {
      return null;
    }

    if (arg === "--all") {
      if (mode === "archived") {
        throw new CommandUsageError("Cannot use --all with --archived");
      }
      mode = "all";
      continue;
    }

    if (arg === "--archived") {
      if (mode === "all") {
        throw new CommandUsageError("Cannot use --archived with --all");
      }
      mode = "archived";
      continue;
    }

    if (arg === "--all-projects") {
      allProjects = true;
      continue;
    }

    if (arg === "--search" || arg.startsWith("--search=")) {
      const { value, nextIndex } = readOptionValue(args, index, "--search");
      search = value;
      index = nextIndex;
      continue;
    }

    throw new CommandUsageError(`Unknown option: ${arg}`);
  }

  return { mode, search, allProjects };
}

function listProjectWorktrees(
  runtime: WorktreeRuntimeLike,
): Array<{ path: string; branch: string | null; bare: boolean }> {
  const projectDir = resolve(runtime.projectDir);
  return runtime.git.listWorktrees(projectDir)
    .filter((entry) => !entry.bare && resolve(entry.path) !== projectDir);
}

/** Open windows for this project, indexed both by the stable worktree id anchor and by window name.
 *  The id is authoritative: a window's name is derived from the branch and goes stale when the
 *  branch is renamed inside the worktree. The name set remains as a fallback for windows created
 *  before the anchor existed (the server backfills those on its next reconcile). */
interface OpenWorktreeWindows {
  names: Set<string>;
  worktreeIds: Set<string>;
}

type ListedTmuxWindow = ReturnType<WorktreeRuntimeLike["tmux"]["listWindows"]>[number];

function listTmuxWindows(runtime: WorktreeRuntimeLike): ListedTmuxWindow[] {
  try {
    return runtime.tmux.listWindows();
  } catch {
    return [];
  }
}

function buildOpenWorktreeWindows(
  runtime: WorktreeRuntimeLike,
  windows: ListedTmuxWindow[] = listTmuxWindows(runtime),
): OpenWorktreeWindows {
  const sessionName = buildProjectSessionName(resolve(runtime.projectDir));
  const scoped = windows.filter((w) => w.sessionName === sessionName);
  return {
    names: new Set(scoped.map((w) => w.windowName)),
    worktreeIds: new Set(
      scoped
        .filter((w) => w.role !== "parking")
        .map((w) => w.worktreeId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  };
}

function isWorktreeWindowOpen(
  open: OpenWorktreeWindows,
  branch: string,
  worktreeId: string | null | undefined,
): boolean {
  if (worktreeId && open.worktreeIds.has(worktreeId)) return true;
  return open.names.has(buildWorktreeWindowName(branch));
}

async function readWorktreeId(
  runtime: WorktreeRuntimeLike,
  worktreePath: string,
): Promise<string | null> {
  try {
    const meta = await readWorktreeMeta(runtime.git.resolveWorktreeGitDir(worktreePath));
    return meta?.worktreeId ?? null;
  } catch {
    return null;
  }
}

async function defaultConfirmPrune(worktreeCount: number): Promise<boolean> {
  const response = await p.confirm({
    message: `Prune ${worktreeCount} closed worktree${worktreeCount === 1 ? "" : "s"}? This action cannot be undone.`,
    initialValue: false,
  });
  return !p.isCancel(response) && response;
}

function defaultSwitchToTmuxWindow(projectDir: string, branch: string): void {
  const sessionName = buildProjectSessionName(resolve(projectDir));
  const windowName = buildWorktreeWindowName(branch);
  const target = `${sessionName}:${windowName}`;

  const selectResult = Bun.spawnSync(["tmux", "select-window", "-t", target], {
    stdout: "pipe",
    stderr: "pipe",
  });
  if (selectResult.exitCode !== 0) return;

  if (Bun.env.TMUX) {
    const result = Bun.spawnSync(["tmux", "switch-client", "-t", sessionName], {
      stdout: "pipe",
      stderr: "pipe",
    });
    if (result.exitCode !== 0) {
      console.error(`Warning: failed to switch tmux client to ${sessionName}`);
    }
  } else {
    const result = Bun.spawnSync(["tmux", "attach-session", "-t", sessionName], {
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    });
    if (result.exitCode !== 0) {
      console.error(`Warning: failed to attach to tmux session ${sessionName}`);
    }
  }
}

export interface ListedWorktreeRow {
  branch: string;
  label: string | null;
  isOpen: boolean;
  archived: boolean;
  prStates: PrEntry["state"][];
  info: string;
  searchText: string;
}

function matchesListSearch(row: ListedWorktreeRow, query: string): boolean {
  return query.length === 0 || row.searchText.toLowerCase().includes(query.toLowerCase());
}

/** `readWindows` lets `list --all-projects` share one tmux listing across projects. */
async function collectWorktreeRows(
  runtime: WorktreeRuntimeLike,
  readWindows: () => ListedTmuxWindow[] = () => listTmuxWindows(runtime),
): Promise<ListedWorktreeRow[]> {
  const projectDir = resolve(runtime.projectDir);
  const entries = listProjectWorktrees(runtime);
  if (entries.length === 0) return [];

  const openWindows = buildOpenWorktreeWindows(runtime, readWindows());

  const projectGitDir = runtime.git.resolveWorktreeGitDir(projectDir);
  const archivedPaths = buildArchivedWorktreePathSet(await readWorktreeArchiveState(projectGitDir));
  return await Promise.all(entries.map(async (entry) => {
    const branch = entry.branch ?? basename(entry.path);
    const gitDir = runtime.git.resolveWorktreeGitDir(entry.path);
    const meta = await readWorktreeMeta(gitDir);
    const isOpen = isWorktreeWindowOpen(openWindows, branch, meta?.worktreeId);
    const prs = await readWorktreePrs(gitDir);
    const info = meta ? `${meta.profile} / ${meta.agent}` : "";
    return {
      branch,
      label: meta?.label ?? null,
      isOpen,
      archived: archivedPaths.has(resolve(entry.path)),
      prStates: prs.map((pr) => pr.state),
      info,
      searchText: [
        meta?.label ?? "",
        branch,
        meta?.baseBranch ?? "",
        meta?.profile ?? "",
        meta?.agent ?? "",
      ].join(" "),
    } satisfies ListedWorktreeRow;
  }));
}

/** Output lines for one project's worktree list. `rows` and `notices` are kept
 *  apart so the grouped `--all-projects` output can mute the notices. */
export interface WorktreeListLines {
  rows: string[];
  notices: string[];
}

export function formatWorktreeList(rows: ListedWorktreeRow[], options: ParsedListCommand): WorktreeListLines {
  if (rows.length === 0) return { rows: [], notices: ["No worktrees found."] };

  const query = options.search.trim();
  const matchingRows = rows
    .filter((row) => matchesListSearch(row, query))
    .sort((a, b) =>
      compareWorktreeOrder(
        { branch: a.branch, open: a.isOpen, prStates: a.prStates },
        { branch: b.branch, open: b.isOpen, prStates: b.prStates },
      )
    );
  const visibleRows = matchingRows.filter((row) => {
    if (options.mode === "all") return true;
    if (options.mode === "archived") return row.archived;
    return !row.archived;
  });
  const hiddenArchivedCount = options.mode === "active"
    ? matchingRows.filter((row) => row.archived).length
    : 0;
  const hiddenSuffix = `${hiddenArchivedCount} archived worktree${hiddenArchivedCount === 1 ? "" : "s"}`;

  if (visibleRows.length === 0) {
    if (hiddenArchivedCount > 0) {
      return { rows: [], notices: [`No active worktrees found. ${hiddenSuffix} hidden. Use --all or --archived.`] };
    }
    if (options.mode === "archived") return { rows: [], notices: ["No archived worktrees found."] };
    return { rows: [], notices: [query ? `No worktrees found for "${query}".` : "No worktrees found."] };
  }

  const maxName = Math.max(...visibleRows.map((row) =>
    (row.label ? `${row.label} (${row.branch})` : row.branch).length
  ));
  const lines = visibleRows.map((row) => {
    const status = `${row.isOpen ? "open" : "closed"}${row.archived ? " archived" : ""}`;
    const name = row.label ? `${row.label} (${row.branch})` : row.branch;
    return `${name.padEnd(maxName + 2)} ${status.padEnd(15)} ${row.info}`.trimEnd();
  });

  return {
    rows: lines,
    notices: hiddenArchivedCount > 0 ? [`Hidden ${hiddenSuffix}. Use --all or --archived.`] : [],
  };
}

async function listWorktrees(
  runtime: WorktreeRuntimeLike,
  stdout: (message: string) => void,
  options: ParsedListCommand,
): Promise<void> {
  const { rows, notices } = formatWorktreeList(await collectWorktreeRows(runtime), options);
  for (const line of [...rows, ...notices]) stdout(line);
}

function muted(text: string): string {
  return process.stdout.isTTY ? `\x1b[2m${text}\x1b[0m` : text;
}

/** Indents and mutes every line of `text`, so multi-line messages (e.g. git
 *  stderr) stay inside their project group. */
function mutedLines(text: string): string[] {
  return text.split("\n").map((line) => `  ${muted(line)}`);
}

/** `list --all-projects`: one header per registered project, then its rows
 *  indented. A project that fails to load prints a muted error and the listing
 *  moves on to the next one; the exit code is 1 if any project failed. */
async function listAllProjectsWorktrees(
  projects: ProjectEntry[],
  createRuntime: (projectDir: string) => WorktreeRuntimeLike,
  pathExists: (path: string) => boolean,
  stdout: (message: string) => void,
  options: ParsedListCommand,
): Promise<number> {
  if (projects.length === 0) {
    stdout("No projects registered. Use `webmux project add` to add one.");
    return 0;
  }

  let exitCode = 0;
  let windows: ListedTmuxWindow[] | null = null;
  for (const [index, project] of projects.entries()) {
    if (index > 0) stdout("");
    stdout(`${project.name} ${muted(project.path)}`);
    if (!pathExists(project.path)) {
      for (const line of mutedLines(`Path not found: ${project.path}`)) stdout(line);
      exitCode = 1;
      continue;
    }
    try {
      const runtime = createRuntime(project.path);
      const rows = await collectWorktreeRows(runtime, () => (windows ??= listTmuxWindows(runtime)));
      const { rows: lines, notices } = formatWorktreeList(rows, options);
      for (const line of lines) stdout(`  ${line}`);
      for (const line of notices.flatMap(mutedLines)) stdout(line);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      for (const line of mutedLines(`Failed to list worktrees: ${message}`)) stdout(line);
      exitCode = 1;
    }
  }
  return exitCode;
}

export async function runWorktreeCommand(
  context: WorktreeCommandContext,
  deps: WorktreeCommandDependencies = {},
): Promise<number> {
  const createRuntime: NonNullable<WorktreeCommandDependencies["createRuntime"]> = deps.createRuntime
    ?? ((options) => createWebmuxRuntime({ ...options, portRegistrations: createPortRegistrationService() }));
  const stdout = deps.stdout ?? ((message: string) => console.log(message));
  const stderr = deps.stderr ?? ((message: string) => console.error(message));
  const resolveServedProject = deps.resolveServedProject ?? resolveServedProjectPrefix;
  const connectProjectApi = async (): Promise<ProjectApi> => createProjectApi(
    await withServerConnection(context.port, () => resolveServedProject(context.port, context.projectDir)),
    { origin: serverOrigin(context.port) },
  );
  const switchToTmuxWindow = deps.switchToTmuxWindow ?? defaultSwitchToTmuxWindow;
  const confirmPrune = deps.confirmPrune ?? defaultConfirmPrune;
  const readOpenSessions = deps.readOpenSessions ?? readOpenSessionsState;

  // The project's route prefix, resolved from the running server at most once.
  // Only commands that write control.env (add/open/refresh) need it.
  //
  // `createRuntime === undefined` is the production sentinel: real callers never
  // inject deps, so production always resolves. A test that injects createRuntime
  // without a prefix resolver skips the lookup, keeping offline commands offline.
  const shouldResolvePrefix = deps.resolveProjectPrefix !== undefined || deps.createRuntime === undefined;
  let prefixPromise: Promise<string | undefined> | null = null;
  const resolvePrefix = (): Promise<string | undefined> => {
    if (!shouldResolvePrefix) return Promise.resolve(undefined);
    if (!prefixPromise) {
      prefixPromise = (deps.resolveProjectPrefix ?? resolveProjectPrefix)(context.port, context.projectDir);
    }
    return prefixPromise;
  };

  try {
    if (context.command === "add") {
      const parsed = parseAddCommandArgs(context.args);
      if (!parsed) {
        stdout(getWorktreeCommandUsage("add"));
        return 0;
      }

      const runtime = createRuntime({
        projectDir: context.projectDir,
        port: context.port,
        prefix: await resolvePrefix(),
        onCreateProgress: (progress) => {
          stdout(PHASE_LABELS[progress.phase] ?? progress.phase);
        },
      });

      if (parsed.fromLinearIssueId) {
        stdout(`Resolving Linear issue ${parsed.fromLinearIssueId}...`);
        const seed = await buildSeedFromLinear(
          { issueId: parsed.fromLinearIssueId },
          defaultSeedFromLinearDeps,
        );
        if (!seed.ok) {
          stderr(`Linear seed lookup failed: ${seed.error}`);
          return 1;
        }
        stdout(`Linear seed source: ${seed.data.source}${seed.data.branch ? ` branch=${seed.data.branch}` : ""}${seed.data.prUrl ? ` pr=${seed.data.prUrl}` : ""}`);

        if (!parsed.branchExplicit && seed.data.branch) {
          parsed.input.branch = seed.data.branch;
        }
        if (!parsed.input.branch) {
          stderr("Linear issue did not resolve to a branch; pass --branch to override.");
          return 1;
        }
        if (seed.data.source !== "none") parsed.input.mode = "existing";
        if (seed.data.conversationMarkdown) {
          parsed.input.prompt = parsed.input.prompt
            ? `${seed.data.conversationMarkdown}\n\n---\n\n${parsed.input.prompt}`
            : seed.data.conversationMarkdown;
        }
      }

      if (!parsed.input.branch && parsed.input.prompt && runtime.config.autoName) {
        stdout("Generating branch name...");
      }

      const result = await runtime.lifecycleService.createWorktrees(parsed.input);
      for (const branch of result.branches) {
        stdout(`Created worktree ${branch}`);
      }
      if (!parsed.detach) {
        switchToTmuxWindow(runtime.projectDir, result.primaryBranch);
      }
      return 0;
    }

    if (context.command === "list") {
      const parsed = parseListCommandArgs(context.args);
      if (!parsed) {
        stdout(getWorktreeCommandUsage("list"));
        return 0;
      }

      if (parsed.allProjects) {
        const listProjects = deps.listProjects ?? (() => createProjectsRegistry().list());
        return await listAllProjectsWorktrees(
          listProjects(),
          (projectDir) => createRuntime({ projectDir, port: context.port }),
          deps.pathExists ?? existsSync,
          stdout,
          parsed,
        );
      }

      const runtime = createRuntime({
        projectDir: context.projectDir,
        port: context.port,
      });
      await listWorktrees(runtime, stdout, parsed);
      return 0;
    }

    if (context.command === "prune") {
      if (!parsePruneCommandArgs(context.args)) {
        stdout(getWorktreeCommandUsage("prune"));
        return 0;
      }

      const runtime = createRuntime({
        projectDir: context.projectDir,
        port: context.port,
      });
      const worktrees = listProjectWorktrees(runtime);
      if (worktrees.length === 0) {
        stdout("No worktrees found.");
        return 0;
      }

      const openWindows = buildOpenWorktreeWindows(runtime);
      const closedWorktrees = (await Promise.all(
        worktrees.map(async (entry) => {
          const branch = entry.branch ?? basename(entry.path);
          const worktreeId = await readWorktreeId(runtime, entry.path);
          return isWorktreeWindowOpen(openWindows, branch, worktreeId) ? null : entry;
        }),
      )).filter((entry) => entry !== null);
      if (closedWorktrees.length === 0) {
        stdout("No closed worktrees to prune.");
        return 0;
      }

      if (!await confirmPrune(closedWorktrees.length)) {
        stdout("Aborted.");
        return 0;
      }

      const result = await runtime.lifecycleService.pruneWorktrees();
      if (result.removedBranches.length === 0) {
        stdout("No closed worktrees to prune.");
        return 0;
      }
      stdout(
        `Pruned ${result.removedBranches.length} worktree${result.removedBranches.length === 1 ? "" : "s"}: ${result.removedBranches.join(", ")}`,
      );
      return 0;
    }

    if (context.command === "restore") {
      if (!parseRestoreCommandArgs(context.args)) {
        stdout(getWorktreeCommandUsage("restore"));
        return 0;
      }

      const runtime = createRuntime({
        projectDir: context.projectDir,
        port: context.port,
        prefix: await resolvePrefix(),
      });
      const projectDir = resolve(runtime.projectDir);
      const gitDir = runtime.git.resolveWorktreeGitDir(projectDir);
      const state = await readOpenSessions(gitDir);

      if (state.branches.length === 0) {
        stdout("No saved sessions to restore.");
        return 0;
      }

      const openWindows = buildOpenWorktreeWindows(runtime);

      const existingWorktrees = new Map(
        listProjectWorktrees(runtime).map((entry) => [entry.branch ?? basename(entry.path), entry]),
      );

      let restored = 0;
      let skipped = 0;
      let failed = 0;
      let firstRestored: string | null = null;

      for (const branch of state.branches) {
        const entry = existingWorktrees.get(branch);
        const worktreeId = entry ? await readWorktreeId(runtime, entry.path) : null;
        if (isWorktreeWindowOpen(openWindows, branch, worktreeId)) {
          stdout(`Already open: ${branch}`);
          skipped++;
          continue;
        }
        if (!entry) {
          stderr(`Skipping ${branch}: worktree no longer exists`);
          skipped++;
          continue;
        }
        try {
          await runtime.lifecycleService.openWorktree(branch);
          stdout(`Restored ${branch}`);
          restored++;
          if (!firstRestored) firstRestored = branch;
        } catch (error) {
          stderr(`Failed to restore ${branch}: ${error instanceof Error ? error.message : String(error)}`);
          failed++;
        }
      }

      const summaryParts = [`Restored ${restored} session${restored === 1 ? "" : "s"}`];
      if (skipped > 0) summaryParts.push(`skipped ${skipped}`);
      if (failed > 0) summaryParts.push(`${failed} failed`);
      stdout(`${summaryParts.join(", ")}.`);

      if (firstRestored) {
        switchToTmuxWindow(runtime.projectDir, firstRestored);
      }
      return failed > 0 ? 1 : 0;
    }

    if (context.command === "send") {
      const parsed = parseSendCommandArgs(context.args);
      if (!parsed) {
        stdout(getWorktreeCommandUsage("send"));
        return 0;
      }

      const api = await connectProjectApi();
      await withServerConnection(context.port, () =>
        api.sendWorktreePrompt({
          params: { name: parsed.branch },
          body: {
            text: parsed.text,
            ...(parsed.preamble ? { preamble: parsed.preamble } : {}),
          },
        }),
      );

      stdout(`Sent prompt to ${parsed.branch}`);
      return 0;
    }

    if (context.command === "tab") {
      const parsed = parseTabCommandArgs(context.args);
      if (!parsed) {
        stdout(getWorktreeCommandUsage("tab"));
        return 0;
      }

      const api = await connectProjectApi();
      await withServerConnection(context.port, async () => {
        if (parsed.action === "new") {
          const { tab } = await api.createWorktreeTab({ params: { name: parsed.branch } });
          stdout(`Created ${tab.label} (${tab.tabId}) in ${parsed.branch}`);
          return;
        }
        if (parsed.action === "switch" || parsed.action === "close") {
          const tabId = parsed.tabId;
          if (!tabId) throw new CommandUsageError(`The "${parsed.action}" action requires a <tabId>`);
          if (parsed.action === "switch") {
            await api.selectWorktreeTab({ params: { name: parsed.branch, tabId } });
            stdout(`Switched ${parsed.branch} to tab ${tabId}`);
          } else {
            await api.deleteWorktreeTab({ params: { name: parsed.branch, tabId } });
            stdout(`Closed tab ${tabId} in ${parsed.branch}`);
          }
          return;
        }
        const { worktrees } = await api.fetchWorktrees();
        const worktree = worktrees.find((candidate) => candidate.branch === parsed.branch);
        if (!worktree) {
          stdout(`Worktree not found: ${parsed.branch}`);
          return;
        }
        for (const tab of worktree.tabs) {
          const marker = tab.tabId === worktree.activeTabId ? "★" : " ";
          stdout(`${marker} ${tab.label.padEnd(10)} ${tab.tabId}`);
        }
      });
      return 0;
    }

    if (context.command === "port") {
      const resolveCurrentBranch = deps.resolveCurrentBranch ?? defaultResolveCurrentBranch;
      const parsed = parsePortCommandArgs(context.args, resolveCurrentBranch(context.projectDir));
      if (!parsed) {
        stdout(getWorktreeCommandUsage("port"));
        return 0;
      }

      const api = await connectProjectApi();
      await withServerConnection(context.port, async () => {
        if (parsed.action === "register") {
          const { port } = await api.registerWorktreePort({
            params: { name: parsed.branch },
            body: {
              label: parsed.label,
              ...(parsed.port !== undefined ? { port: parsed.port } : {}),
              ...(parsed.keep ? { keep: true } : {}),
            },
          });
          // Bare port on stdout so `PORT=$(webmux port web)` works.
          stdout(String(port));
          return;
        }
        if (parsed.action === "remove") {
          await api.deleteWorktreePort({ params: { name: parsed.branch, label: parsed.label } });
          stdout(`Released ${parsed.label} in ${parsed.branch}`);
          return;
        }
        const { ports } = await api.fetchWorktreePorts({ params: { name: parsed.branch } });
        for (const entry of ports) {
          const status = entry.running ? "running" : "idle";
          stdout(`${entry.label.padEnd(12)} ${String(entry.port).padEnd(6)} ${entry.keep ? `${status.padEnd(7)} kept` : status}`);
        }
      });
      return 0;
    }

    if (context.command === "label") {
      const parsed = parseLabelCommandArgs(context.args);
      if (!parsed) {
        stdout(getWorktreeCommandUsage("label"));
        return 0;
      }

      const runtime = createRuntime({
        projectDir: context.projectDir,
        port: context.port,
      });
      const result = await runtime.lifecycleService.setWorktreeLabel(parsed.branch, parsed.label);
      stdout(result.label
        ? `Labeled worktree ${parsed.branch} as "${result.label}"`
        : `Cleared label for ${parsed.branch}`);
      return 0;
    }

    if (context.command === "profile") {
      const parsed = parseProfileCommandArgs(context.args);
      if (!parsed) {
        stdout(getWorktreeCommandUsage("profile"));
        return 0;
      }

      // Switching profiles reopens the worktree, which rewrites control.env —
      // so it needs the prefixed control URL, same as open/refresh.
      const runtime = createRuntime({
        projectDir: context.projectDir,
        port: context.port,
        prefix: await resolvePrefix(),
      });
      const result = await runtime.lifecycleService.setWorktreeProfile(parsed.branch, parsed.profile);
      stdout(result.restarted
        ? `Switched ${parsed.branch} to profile "${result.profile}" and restarted the session`
        : `Switched ${parsed.branch} to profile "${result.profile}" — applies on next open`);
      return 0;
    }

    const command: Exclude<WorktreeSubcommand, "add" | "list" | "send" | "prune" | "restore" | "label" | "profile" | "tab"> = context.command;
    const branch = parseBranchCommandArgs(context.args);
    if (!branch) {
      stdout(getWorktreeCommandUsage(command));
      return 0;
    }

    // open/refresh rewrite control.env, so they need the prefixed control URL;
    // the rest (close/archive/unarchive/remove/merge) don't touch it.
    const needsPrefix = command === "open" || command === "refresh";
    const runtime = createRuntime({
      projectDir: context.projectDir,
      port: context.port,
      prefix: needsPrefix ? await resolvePrefix() : undefined,
    });

    switch (command) {
      case "open":
        await runtime.lifecycleService.openWorktree(branch);
        stdout(`Opened worktree ${branch}`);
        switchToTmuxWindow(runtime.projectDir, branch);
        return 0;
      case "close":
        await runtime.lifecycleService.closeWorktree(branch);
        stdout(`Closed worktree ${branch}`);
        return 0;
      case "refresh":
        await runtime.lifecycleService.refreshAgentTerminal(branch);
        stdout(`Refreshed agent terminal for ${branch}`);
        return 0;
      case "archive":
        await runtime.lifecycleService.setWorktreeArchived(branch, true);
        stdout(`Archived worktree ${branch}`);
        return 0;
      case "unarchive":
        await runtime.lifecycleService.setWorktreeArchived(branch, false);
        stdout(`Restored worktree ${branch}`);
        return 0;
      case "remove":
        await runtime.lifecycleService.removeWorktree(branch);
        stdout(`Removed worktree ${branch}`);
        return 0;
      case "merge":
        await runtime.lifecycleService.mergeWorktree(branch);
        stdout(`Merged ${branch} into ${runtime.config.workspace.mainBranch}`);
        return 0;
    }
  } catch (error) {
    stderr(`Error: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
