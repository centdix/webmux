import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { getAgentAdapter } from "../agents";
import { closeAssistant } from "../agents/shared";
import type {
  InitAgentCommandSpec,
  InitAgentStreamEvent,
  InitAgentStreamState,
  InitPromptSpec,
} from "../agents/types";
import { detectProjectName, run } from "../lib/shell";
import { isRecord } from "../lib/type-guards";

export type { InitAgentCommandSpec, InitAgentStreamEvent, InitPromptSpec };

export type InitAuthoringChoice = "claude" | "codex" | "opencode" | "pi" | "manual";
export type InitAgent = Exclude<InitAuthoringChoice, "manual">;
export type InitPackageManager = "bun" | "npm" | "pnpm" | "yarn";

export interface InitProjectContext {
  gitRoot: string;
  projectName: string;
  mainBranch: string;
  defaultAgent: InitAgent;
  packageManager: InitPackageManager;
}

export interface InitAgentRunResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  summary: string;
}

export interface InitAgentRunHandlers {
  onEvent?: (event: InitAgentStreamEvent) => void;
  /** Kill the agent if it runs longer than this (ms). Used server-side so a
   *  hung analysis can't stall project setup forever. */
  timeoutMs?: number;
}

function detectPackageManager(gitRoot: string): InitPackageManager {
  if (existsSync(join(gitRoot, "bun.lock")) || existsSync(join(gitRoot, "bun.lockb"))) return "bun";
  if (existsSync(join(gitRoot, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(gitRoot, "yarn.lock"))) return "yarn";
  return "npm";
}

function detectMainBranch(gitRoot: string): string {
  const originHead = run("git", ["symbolic-ref", "--quiet", "--short", "refs/remotes/origin/HEAD"], { cwd: gitRoot });
  if (originHead.success) {
    const branch = originHead.stdout.toString().trim().split("/").pop();
    if (branch) return branch;
  }

  const mainBranch = run("git", ["branch", "--list", "main"], { cwd: gitRoot });
  if (mainBranch.success && mainBranch.stdout.toString().trim()) return "main";

  const masterBranch = run("git", ["branch", "--list", "master"], { cwd: gitRoot });
  if (masterBranch.success && masterBranch.stdout.toString().trim()) return "master";

  const currentBranch = run("git", ["rev-parse", "--abbrev-ref", "HEAD"], { cwd: gitRoot });
  if (currentBranch.success) {
    const branch = currentBranch.stdout.toString().trim();
    if (branch && branch !== "HEAD") return branch;
  }

  return "main";
}

function buildRunScriptCommand(packageManager: InitPackageManager, scriptName: "dev" | "start"): string {
  if (packageManager === "bun") return `bun run ${scriptName}`;
  if (packageManager === "pnpm") return `pnpm ${scriptName}`;
  if (packageManager === "yarn") return `yarn ${scriptName}`;
  return `npm run ${scriptName}`;
}

export function detectInitProjectContext(gitRoot: string, defaultAgent: InitAgent): InitProjectContext {
  return {
    gitRoot,
    projectName: detectProjectName(gitRoot),
    mainBranch: detectMainBranch(gitRoot),
    defaultAgent,
    packageManager: detectPackageManager(gitRoot),
  };
}

export function buildInitPromptSpec(context: InitProjectContext): InitPromptSpec {
  const systemPrompt = [
    "You are bootstrapping a local repository for webmux.",
    "A starter `.webmux.yaml` already exists at the repo root.",
    "Inspect the repository in the current working directory and edit that existing `.webmux.yaml` in place.",
    "Do not modify any other file.",
    "Do not ask the user questions. Infer the config from the repository contents.",
    "Be efficient: inspect only the files needed to determine the project name, main branch, service layout, dev commands, and ports.",
    "The active, uncommented YAML must be valid and minimal.",
    "Do not remove other starter sections or their explanatory comments just because they are unused.",
    "Keep optional examples and comments in place so the user can uncomment and use them later.",
    `Set workspace.defaultAgent to ${context.defaultAgent}.`,
    "Use this config shape:",
    "name: infer from the repository",
    "workspace.mainBranch: infer from git",
    "workspace.worktreeRoot: keep ../worktrees unless there is clear evidence of an existing alternative",
    "services: one entry per real dev service with name, portEnv, and portStart when a default port is clear",
    "profiles.default.runtime: host",
    "profiles.default.envPassthrough: []",
    "profiles.default.panes: start with an agent pane focused true, then add command panes for real services",
    "Command panes should use the repository's real dev command and pass the relevant port env var into the command when needed.",
    "Use split: right for the first command pane and split: bottom for later command panes.",
    "Include integrations.github.linkedRepos as an empty list, integrations.linear.enabled as true, and startupEnvs as an empty object.",
    "Only include optional sections like auto_name, lifecycleHooks, sandbox/docker config, mounts, or systemPrompt if the repository gives clear evidence they are needed.",
    "Prefer editing the existing keys over replacing the file with a completely different shape.",
    "Preserve the existing template structure and comments unless a specific change requires updating them.",
    "Before finishing, verify that `.webmux.yaml` exists and contains the final YAML.",
  ].join("\n");

  return {
    systemPrompt,
    userPrompt: "Adapt the existing starter `.webmux.yaml` for this repository.",
  };
}

export function buildInitAgentCommand(
  agent: InitAgent,
  prompt: InitPromptSpec,
  outputPrefix = "webmux-init",
): InitAgentCommandSpec {
  return getAgentAdapter(agent).buildInitCommand(prompt, outputPrefix);
}

export function parseInitAgentStreamLine(
  agent: InitAgent,
  line: string,
  state: InitAgentStreamState = { assistantSnapshot: "", lastStatus: null },
): InitAgentStreamEvent[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return [];
  }

  if (!isRecord(parsed)) return [];
  return getAgentAdapter(agent).parseInitStreamLine(parsed, state);
}

async function consumeStructuredStream(
  stream: ReadableStream<Uint8Array> | null,
  agent: InitAgent,
  onEvent?: (event: InitAgentStreamEvent) => void,
): Promise<{ raw: string; assistantText: string }> {
  if (!stream) return { raw: "", assistantText: "" };

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  const state: InitAgentStreamState = { assistantSnapshot: "", lastStatus: null };
  let buffer = "";
  let raw = "";
  let assistantText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const text = decoder.decode(value, { stream: true });
    raw += text;
    buffer += text;

    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex !== -1) {
      const line = buffer.slice(0, newlineIndex).replace(/\r$/, "");
      buffer = buffer.slice(newlineIndex + 1);
      for (const event of parseInitAgentStreamLine(agent, line, state)) {
        if (event.kind === "assistant_delta") assistantText += event.text;
        onEvent?.(event);
      }
      newlineIndex = buffer.indexOf("\n");
    }
  }

  const tail = decoder.decode();
  raw += tail;
  buffer += tail;

  const finalLine = buffer.replace(/\r$/, "");
  if (finalLine) {
    for (const event of parseInitAgentStreamLine(agent, finalLine, state)) {
      if (event.kind === "assistant_delta") assistantText += event.text;
      onEvent?.(event);
    }
  }

  for (const event of closeAssistant(state)) {
    onEvent?.(event);
  }

  return { raw, assistantText };
}

async function consumeRawStream(stream: ReadableStream<Uint8Array> | null): Promise<string> {
  if (!stream) return "";

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let raw = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    raw += decoder.decode(value, { stream: true });
  }

  return raw + decoder.decode();
}

export async function runInitAgentCommand(
  spec: InitAgentCommandSpec,
  cwd: string,
  handlers: InitAgentRunHandlers = {},
): Promise<InitAgentRunResult> {
  const proc = Bun.spawn([spec.cmd, ...spec.args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });

  const timeout = handlers.timeoutMs
    ? setTimeout(() => {
        try { proc.kill(); } catch { /* already exited */ }
      }, handlers.timeoutMs)
    : null;

  try {
    const [exitCode, stdoutResult, stderr] = await Promise.all([
      proc.exited,
      consumeStructuredStream(proc.stdout, spec.agent, handlers.onEvent),
      consumeRawStream(proc.stderr),
    ]);

    return finalizeAgentRun(spec, exitCode, stdoutResult, stderr);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function finalizeAgentRun(
  spec: InitAgentCommandSpec,
  exitCode: number,
  stdoutResult: { raw: string; assistantText: string },
  stderr: string,
): InitAgentRunResult {

  let summary = stdoutResult.assistantText.trim();
  if (spec.summaryPath && existsSync(spec.summaryPath)) {
    try {
      summary = readFileSync(spec.summaryPath, "utf8").trim() || summary;
    } finally {
      rmSync(spec.summaryPath, { force: true });
    }
  }

  return { exitCode, stdout: stdoutResult.raw, stderr, summary };
}

export function buildStarterTemplate(input: {
  projectName: string;
  mainBranch: string;
  defaultAgent?: InitAgent;
  packageManager?: InitPackageManager;
}): string {
  const defaultAgent = input.defaultAgent ?? "claude";
  const packageManager = input.packageManager ?? "npm";
  const devCommand = buildRunScriptCommand(packageManager, "dev");
  // Branch auto-naming only runs on Claude or Codex, so the commented example keeps a
  // supported provider even when worktrees default to another agent.
  const autoNameProvider = defaultAgent === "codex" ? "codex" : "claude";

  return `# Starter config for webmux.
# Keep the active keys below as a minimal working setup, then uncomment
# the examples to enable more services, profiles, integrations, or hooks.

# Project display name shown in the dashboard and browser title.
name: ${input.projectName}

workspace:
  # Git branch new worktrees start from.
  mainBranch: ${input.mainBranch}
  # Relative or absolute directory where managed worktrees are created.
  worktreeRoot: ../worktrees
  # Agent new worktrees use by default.
  defaultAgent: ${defaultAgent}
  # Example background pull settings for keeping the main branch fresh.
  # autoPull:
  #   # Turn automatic pulls on or off.
  #   enabled: false
  #   # Seconds between pull attempts.
  #   intervalSeconds: 300

# Services define the ports webmux allocates and tracks per worktree.
services:
  # Example app service with a predictable per-worktree port.
  # - name: app
  #   # Env var name injected into panes and hooks.
  #   portEnv: PORT
  #   # Starting port for the first worktree slot.
  #   portStart: 3000
  #   # Port increment between worktree slots.
  #   portStep: 10
  #   # Link shown in the dashboard when the service is running.
  #   urlTemplate: http://localhost:\${PORT}

# Profiles define runtime, permissions, and tmux pane layout.
profiles:
  default:
    # Run panes directly on the host machine.
    runtime: host
    # Forward selected host env vars into the agent process.
    envPassthrough:
      # - ANTHROPIC_API_KEY
      # - OPENAI_API_KEY
    # Extra system instructions for the agent in this profile.
    # systemPrompt: >
    #   You are working in \${WEBMUX_WORKTREE_PATH}
    # Skip agent permission prompts in this profile.
    # yolo: true
    # Panes define the tmux layout created for each worktree session.
    panes:
      # Main AI coding pane.
      - id: agent
        # Pane type: agent, command, or shell.
        kind: agent
        # Focus this pane when the session opens.
        focus: true
        # Place this pane to the right of the existing layout.
        # split: right
        # Percent of the available space this pane should take.
        # sizePct: 50
        # Start this pane in the repo root or managed worktree.
        # cwd: worktree
      # Example dev server pane.
      # - id: app
      #   # Pane type: agent, command, or shell.
      #   kind: command
      #   # Place this pane to the right of the existing layout.
      #   split: right
      #   # Percent of the available space this pane should take.
      #   sizePct: 50
      #   # Start this pane in the repo root or managed worktree.
      #   cwd: worktree
      #   # Change into a subdirectory before running the command.
      #   workingDir: frontend
      #   # Command run when the pane starts. webmux injects $PORT.
      #   command: PORT=$PORT ${devCommand}
      # Example shell pane for manual commands.
      # - id: shell
      #   # Pane type: agent, command, or shell.
      #   kind: shell
      #   # Place this pane below the existing layout.
      #   split: bottom
      #   # Percent of the available space this pane should take.
      #   sizePct: 30
      #   # Start this pane in the repo root or managed worktree.
      #   cwd: repo

  # Example sandbox profile that runs panes inside Docker.
  # sandbox:
  #   # Run panes inside a container instead of on the host.
  #   runtime: docker
  #   # Docker image used for the sandbox container.
  #   image: ghcr.io/your-org/your-image:latest
  #   # Forward selected host env vars into the container.
  #   envPassthrough:
  #     - ANTHROPIC_API_KEY
  #     - OPENAI_API_KEY
  #   # Extra system instructions for the agent in this profile.
  #   systemPrompt: >
  #     Extra instructions for the sandbox profile.
  #   # Skip agent permission prompts in this profile.
  #   yolo: true
  #   # Extra host paths to mount into the container.
  #   mounts:
  #     # Host path mounted into the sandbox.
  #     - hostPath: ~/.codex
  #       # Path inside the container.
  #       guestPath: /root/.codex
  #       # Allow writes through this mount.
  #       writable: true
  #   # Panes define the tmux layout created for sandbox sessions.
  #   panes:
  #     # Main AI coding pane.
  #     - id: agent
  #       # Pane type: agent, command, or shell.
  #       kind: agent
  #       # Focus this pane when the session opens.
  #       focus: true
  #     # Example shell pane for manual commands.
  #     - id: shell
  #       # Pane type: agent, command, or shell.
  #       kind: shell
  #       # Place this pane to the right of the existing layout.
  #       split: right
  #       # Start this pane in the repo root or managed worktree.
  #       cwd: repo

# Integrations connect webmux to external systems.
integrations:
  github:
    # Additional local repos webmux should consider alongside the main repo.
    linkedRepos:
      # GitHub slug for a related repo.
      # - repo: your-org/your-repo
      #   # Short label shown in the UI.
      #   alias: repo
      #   # Relative or absolute path to that local checkout.
      #   dir: ../your-repo
    # Remove managed worktrees automatically when their PR merges.
    # autoRemoveOnMerge: true
  linear:
    # Enable Linear issue lookup and linking in the UI.
    enabled: true
    # Auto-create worktrees for assigned issues labeled "webmux" or "webmux_oneshot".
    # autoCreateWorktrees: true
    # Show a create-ticket action in the dashboard. The team to file into is
    # picked in the dialog at creation time.
    # createTicketOption: true
    # Restrict the auto-create watcher to issues from these teams. Useful when
    # the authenticated Linear user is in multiple teams or when running webmux
    # in several projects on the same machine that share a Linear account.
    # watchTeams: [ENG, OPS]

# startupEnvs become runtime env vars for panes, agents, and hooks.
startupEnvs:
  # Example feature flag available in every worktree session.
  # FEATURE_FLAG: true
  # Example service URL built from allocated ports.
  # API_BASE_URL: http://localhost:\${PORT}

# lifecycleHooks run custom shell commands during worktree lifecycle events.
# lifecycleHooks:
#   # Runs after env setup and before panes start.
#   postCreate: bun install
#   # Runs before the worktree directory is removed.
#   preRemove: tmux kill-session -t "$WEBMUX_WORKTREE_ID" || true

# auto_name lets webmux generate a branch name when one is not provided.
# auto_name:
#   # Provider used for automatic branch naming.
#   provider: ${autoNameProvider}
#   # Model used for automatic branch naming.
#   model: ${autoNameProvider === "codex" ? "gpt-5.1-codex" : "claude-3-5-haiku-latest"}
#   # Prompt that tells the model how to name branches.
#   system_prompt: >
#     Generate a short kebab-case git branch name.
`;
}
