import { getAgentAdapter } from "../agents";
import { quoteShell } from "../agents/shared";
import type { AgentLaunchMode } from "../agents/types";
import type { AgentDefinition } from "./agent-registry";

export type { AgentLaunchMode };

const DOCKER_PATH_FALLBACK = "/root/.local/bin:/usr/local/bin:/root/.bun/bin:/root/.cargo/bin";

const CUSTOM_AGENT_TEMPLATE_VARS = {
  PROMPT: "WEBMUX_AGENT_PROMPT",
  SYSTEM_PROMPT: "WEBMUX_AGENT_SYSTEM_PROMPT",
  WORKTREE_PATH: "WEBMUX_AGENT_WORKTREE_PATH",
  REPO_PATH: "WEBMUX_AGENT_REPO_PATH",
  BRANCH: "WEBMUX_AGENT_BRANCH",
  PROFILE: "WEBMUX_AGENT_PROFILE",
} as const;

function buildRuntimeBootstrap(runtimeEnvPath: string): string {
  return `set -a; . ${quoteShell(runtimeEnvPath)}; set +a`;
}

function buildDockerRuntimeBootstrap(runtimeEnvPath: string): string {
  return `${buildRuntimeBootstrap(runtimeEnvPath)}; export PATH="$PATH:${DOCKER_PATH_FALLBACK}"`;
}

function renderCustomCommandTemplate(template: string): string {
  return template
    .replaceAll("${PROMPT}", `$${CUSTOM_AGENT_TEMPLATE_VARS.PROMPT}`)
    .replaceAll("${SYSTEM_PROMPT}", `$${CUSTOM_AGENT_TEMPLATE_VARS.SYSTEM_PROMPT}`)
    .replaceAll("${WORKTREE_PATH}", `$${CUSTOM_AGENT_TEMPLATE_VARS.WORKTREE_PATH}`)
    .replaceAll("${REPO_PATH}", `$${CUSTOM_AGENT_TEMPLATE_VARS.REPO_PATH}`)
    .replaceAll("${BRANCH}", `$${CUSTOM_AGENT_TEMPLATE_VARS.BRANCH}`)
    .replaceAll("${PROFILE}", `$${CUSTOM_AGENT_TEMPLATE_VARS.PROFILE}`);
}

function buildCustomAgentExports(input: {
  prompt?: string;
  systemPrompt?: string;
  worktreePath: string;
  repoRoot: string;
  branch: string;
  profileName: string;
}): string {
  const envEntries: Array<[string, string]> = [
    [CUSTOM_AGENT_TEMPLATE_VARS.PROMPT, input.prompt ?? ""],
    [CUSTOM_AGENT_TEMPLATE_VARS.SYSTEM_PROMPT, input.systemPrompt ?? ""],
    [CUSTOM_AGENT_TEMPLATE_VARS.WORKTREE_PATH, input.worktreePath],
    [CUSTOM_AGENT_TEMPLATE_VARS.REPO_PATH, input.repoRoot],
    [CUSTOM_AGENT_TEMPLATE_VARS.BRANCH, input.branch],
    [CUSTOM_AGENT_TEMPLATE_VARS.PROFILE, input.profileName],
  ];

  return envEntries
    .map(([key, value]) => `export ${key}=${quoteShell(value)}`)
    .join("; ");
}

function buildCustomAgentInvocation(input: {
  agent: Extract<AgentDefinition, { kind: "custom" }>;
  systemPrompt?: string;
  prompt?: string;
  worktreePath: string;
  repoRoot: string;
  branch: string;
  profileName: string;
  launchMode?: AgentLaunchMode;
}): string {
  const template = input.launchMode === "resume" && input.agent.implementation.config.resumeCommand
    ? input.agent.implementation.config.resumeCommand
    : input.agent.implementation.config.startCommand;
  const exports = buildCustomAgentExports(input);
  const renderedCommand = renderCustomCommandTemplate(template);
  return `${exports}; ${renderedCommand}`;
}

function buildAgentInvocation(input: {
  agent: AgentDefinition;
  runtimeEnvPath: string;
  yolo?: boolean;
  systemPrompt?: string;
  prompt?: string;
  launchMode?: AgentLaunchMode;
  worktreePath: string;
  repoRoot: string;
  branch: string;
  profileName: string;
  resumeConversationId?: string;
  forkFromSessionId?: string;
  pinSessionId?: string;
  appServerSocketPath?: string;
}): string {
  if (input.agent.kind === "builtin") {
    return getAgentAdapter(input.agent.implementation.agent).buildCommand({
      yolo: input.yolo,
      systemPrompt: input.systemPrompt,
      prompt: input.prompt,
      worktreePath: input.worktreePath,
      runtimeEnvPath: input.runtimeEnvPath,
      launchMode: input.launchMode,
      resumeConversationId: input.resumeConversationId,
      forkFromSessionId: input.forkFromSessionId,
      pinSessionId: input.pinSessionId,
      appServerSocketPath: input.appServerSocketPath,
    });
  }

  return buildCustomAgentInvocation({
    agent: input.agent,
    systemPrompt: input.systemPrompt,
    prompt: input.prompt,
    worktreePath: input.worktreePath,
    repoRoot: input.repoRoot,
    branch: input.branch,
    profileName: input.profileName,
    launchMode: input.launchMode,
  });
}

function buildAgentCommand(input: {
  agent: AgentDefinition;
  runtimeEnvPath: string;
  repoRoot: string;
  worktreePath: string;
  branch: string;
  profileName: string;
  yolo?: boolean;
  systemPrompt?: string;
  prompt?: string;
  launchMode?: AgentLaunchMode;
  resumeConversationId?: string;
  forkFromSessionId?: string;
  pinSessionId?: string;
  appServerSocketPath?: string;
}, bootstrap = buildRuntimeBootstrap): string {
  return `${bootstrap(input.runtimeEnvPath)}; ${buildAgentInvocation(input)}`;
}

function buildDockerExecCommand(
  containerName: string,
  worktreePath: string,
  command: string,
): string {
  return `docker exec -it -w ${quoteShell(worktreePath)} ${quoteShell(containerName)} /bin/sh -c ${quoteShell(command)}`;
}

export function buildManagedShellCommand(
  runtimeEnvPath: string,
  shellPath = Bun.env.SHELL || "/bin/bash",
): string {
  return `bash -lc ${quoteShell(`${buildRuntimeBootstrap(runtimeEnvPath)}; exec ${quoteShell(shellPath)} -i`)}`;
}

export function buildAgentPaneCommand(input: {
  agent: AgentDefinition;
  runtimeEnvPath: string;
  repoRoot: string;
  worktreePath: string;
  branch: string;
  profileName: string;
  yolo?: boolean;
  systemPrompt?: string;
  prompt?: string;
  launchMode?: AgentLaunchMode;
  resumeConversationId?: string;
  forkFromSessionId?: string;
  pinSessionId?: string;
  appServerSocketPath?: string;
}): string {
  return buildAgentCommand(input);
}

export function buildDockerShellCommand(
  containerName: string,
  worktreePath: string,
  runtimeEnvPath: string,
  shellPath = "/bin/bash",
): string {
  return buildDockerExecCommand(
    containerName,
    worktreePath,
    `${buildDockerRuntimeBootstrap(runtimeEnvPath)}; if [ -x ${quoteShell(shellPath)} ]; then exec ${quoteShell(shellPath)} -i; elif [ -x /bin/sh ]; then exec /bin/sh -i; else echo 'webmux: no shell found in container' >&2; exit 127; fi`,
  );
}

export function buildDockerAgentPaneCommand(input: {
  agent: AgentDefinition;
  runtimeEnvPath: string;
  repoRoot: string;
  worktreePath: string;
  branch: string;
  profileName: string;
  yolo?: boolean;
  systemPrompt?: string;
  prompt?: string;
  launchMode?: AgentLaunchMode;
  resumeConversationId?: string;
  forkFromSessionId?: string;
  pinSessionId?: string;
}): string {
  return buildAgentCommand(input, buildDockerRuntimeBootstrap);
}
