import { getAgentAdapter } from "../agents";
import { quoteShell } from "../agents/shared";
import type { AgentLaunchMode } from "../agents/types";
import type { AgentDefinition } from "./agent-registry";
import { CONTAINER_TOOLS_DIR, SANDBOX_HOME, type SandboxUser } from "../adapters/docker";

export type { AgentLaunchMode };

const DOCKER_PATH_FALLBACK = `${SANDBOX_HOME}/.local/bin:/usr/local/bin:${SANDBOX_HOME}/.bun/bin:${SANDBOX_HOME}/.cargo/bin`;

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

const DOCKER_TOOLS_PATH = `${CONTAINER_TOOLS_DIR}/bin:${CONTAINER_TOOLS_DIR}/bun/bin`;

const DOCKER_TOOLS_ENV = `NPM_CONFIG_PREFIX=${CONTAINER_TOOLS_DIR} BUN_INSTALL=${CONTAINER_TOOLS_DIR}/bun`;

/** Global npm/bun installs (including an agent's self-update) go to the shared
 *  tools volume: the image's default prefix is not writable by the sandbox user. */
function buildDockerRuntimeBootstrap(runtimeEnvPath: string): string {
  return `${buildRuntimeBootstrap(runtimeEnvPath)}; export ${DOCKER_TOOLS_ENV} PATH="${DOCKER_TOOLS_PATH}:$PATH:${DOCKER_PATH_FALLBACK}"`;
}

/**
 * Install step for the sandbox's shared tools volume, serialized with `flock`
 * so two containers starting together don't install over each other. With a
 * `binary`, it is skipped once that binary is on the PATH; without one (custom
 * agents) it runs on every launch, so the command must be idempotent.
 */
export function buildSandboxInstallCommand(install: string, binary?: string): string {
  const isInstalled = binary ? `command -v ${binary} >/dev/null 2>&1` : null;
  const notice = binary ? `webmux: installing ${binary} in the sandbox...` : "webmux: running the agent's sandbox install...";
  // The install runs as its own `sh -c` so a trailing `;`, `&` or comment in a
  // user-supplied command cannot break the surrounding script.
  const script = `${isInstalled ? `${isInstalled} || ` : ""}{ echo ${quoteShell(notice)}; sh -c ${quoteShell(install)}; }`;
  const env = DOCKER_TOOLS_ENV;
  const locked = `if command -v flock >/dev/null 2>&1; then ${env} flock ${CONTAINER_TOOLS_DIR}/.lock sh -c ${quoteShell(script)}; else ${env} sh -c ${quoteShell(script)}; fi`;
  return isInstalled ? `${isInstalled} || { ${locked}; }` : locked;
}

const SANDBOX_INSTALL_FAILED = "webmux: the agent install failed (see above); it is retried on the next launch";

/** The mounted webmux CLI runs on bun, which most images lack. */
const BUN_INSTALL_STEP = `if command -v webmux >/dev/null 2>&1; then ${buildSandboxInstallCommand("npm i -g bun", "bun")}; fi`;

function buildAgentSandboxInstall(agent: AgentDefinition): string | null {
  if (agent.kind === "builtin") {
    const adapter = getAgentAdapter(agent.implementation.agent);
    return buildSandboxInstallCommand(adapter.sandbox.install, adapter.binary);
  }
  const install = agent.implementation.config.sandboxInstall;
  return install ? buildSandboxInstallCommand(install) : null;
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
}): string {
  return `${buildRuntimeBootstrap(input.runtimeEnvPath)}; ${buildAgentInvocation(input)}`;
}

function buildDockerExecCommand(input: {
  containerName: string;
  worktreePath: string;
  user: SandboxUser;
  home: string;
  command: string;
}): string {
  return [
    "docker exec -it",
    `-u ${input.user.uid}:${input.user.gid}`,
    `-e HOME=${quoteShell(input.home)}`,
    `-w ${quoteShell(input.worktreePath)}`,
    quoteShell(input.containerName),
    `/bin/sh -c ${quoteShell(input.command)}`,
  ].join(" ");
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
}): string {
  return buildAgentCommand(input);
}

export function buildDockerShellCommand(
  containerName: string,
  worktreePath: string,
  runtimeEnvPath: string,
  user: SandboxUser,
  shellPath = "/bin/bash",
): string {
  return buildDockerExecCommand({
    containerName,
    worktreePath,
    user,
    home: SANDBOX_HOME,
    command: `${buildDockerRuntimeBootstrap(runtimeEnvPath)}; if [ -x ${quoteShell(shellPath)} ]; then exec ${quoteShell(shellPath)} -i; elif [ -x /bin/sh ]; then exec /bin/sh -i; else echo 'webmux: no shell found in container' >&2; exit 127; fi`,
  });
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
  const install = buildAgentSandboxInstall(input.agent);
  const steps = [
    buildDockerRuntimeBootstrap(input.runtimeEnvPath),
    BUN_INSTALL_STEP,
    // The invocation stays last and unwrapped: custom start commands are user text.
    install ? `{ ${install}; } || echo ${quoteShell(SANDBOX_INSTALL_FAILED)} >&2` : null,
    buildAgentInvocation(input),
  ];
  return steps.filter((step): step is string => step !== null).join("; ");
}
