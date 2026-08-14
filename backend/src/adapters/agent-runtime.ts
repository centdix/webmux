import { chmod, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { getWorktreeStoragePaths } from "./fs";

/** Agent-runtime files webmux generates inside the worktree. They are excluded locally so
 *  they never show up as untracked changes in the branch the agent is working on. */
const GENERATED_AGENT_ARTIFACT_EXCLUDES = [
  ".codex/hooks.json",
  ".opencode/plugin/webmux.js",
  ".opencode/webmux-instructions.md",
  ".opencode/webmux-sessions.jsonl",
];

interface CommandHookConfig {
  type: "command";
  command: string;
  async?: boolean;
  timeout?: number;
}

interface HookMatcherConfig {
  matcher?: string;
  hooks: CommandHookConfig[];
}

interface HookConfigFile {
  hooks: Record<string, HookMatcherConfig[]>;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildAgentCtlScript(): string {
  return `#!/usr/bin/env python3
import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path


CONTROL_ENV_PATH = Path(__file__).resolve().with_name("control.env")
CONTROL_REQUEST_TIMEOUT_SECONDS = 2


def read_control_env():
    env = {}
    try:
        content = CONTROL_ENV_PATH.read_text()
    except OSError as error:
        raise RuntimeError(f"failed to read control.env: {error}") from error

    for raw_line in content.splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if len(value) >= 2 and value.startswith("'") and value.endswith("'"):
            value = value[1:-1].replace("'\\\\''", "'")
        env[key] = value

    return env


def build_parser():
    parser = argparse.ArgumentParser(prog="webmux-agentctl")
    subparsers = parser.add_subparsers(dest="command", required=True)

    subparsers.add_parser("agent-stopped")

    status_changed = subparsers.add_parser("status-changed")
    status_changed.add_argument("--lifecycle", choices=["starting", "running", "idle", "stopped"], required=True)
    status_changed.add_argument("--best-effort", action="store_true")

    pr_opened = subparsers.add_parser("pr-opened")
    pr_opened.add_argument("--url")

    runtime_error = subparsers.add_parser("runtime-error")
    runtime_error.add_argument("--message", required=True)

    subparsers.add_parser("claude-user-prompt-submit")
    subparsers.add_parser("claude-post-tool-use")
    subparsers.add_parser("opencode-post-tool-use")
    subparsers.add_parser("codex-session-start")
    subparsers.add_parser("codex-user-prompt-submit")
    subparsers.add_parser("codex-permission-request")
    subparsers.add_parser("codex-post-tool-use")
    subparsers.add_parser("codex-stop")

    return parser


def build_payload(command, args, control_env):
    payload = {
        "worktreeId": control_env["WEBMUX_WORKTREE_ID"],
        "branch": control_env["WEBMUX_BRANCH"],
    }

    if command == "agent-stopped":
        payload["type"] = "agent_stopped"
        return payload
    if command == "status-changed":
        payload["type"] = "agent_status_changed"
        payload["lifecycle"] = args.lifecycle
        return payload
    if command == "pr-opened":
        payload["type"] = "pr_opened"
        if args.url:
            payload["url"] = args.url
        return payload
    if command == "runtime-error":
        payload["type"] = "runtime_error"
        payload["message"] = args.message
        return payload
    raise RuntimeError(f"unsupported command: {command}")


def read_hook_payload():
    raw = sys.stdin.read()
    if not raw.strip():
        return {}

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        return {}

    return parsed if isinstance(parsed, dict) else {}


def iter_string_values(value):
    if isinstance(value, str):
        yield value
        return
    if isinstance(value, dict):
        for child in value.values():
            yield from iter_string_values(child)
        return
    if isinstance(value, list):
        for child in value:
            yield from iter_string_values(child)


def find_pr_url(value):
    for text in iter_string_values(value):
        match = re.search(r"https://github\\.com/[^\\s\\\"]+/pull/\\d+", text)
        if match:
            return match.group(0)
    return None


def maybe_send_pr_opened(hook_payload, control_env):
    tool_name = hook_payload.get("tool_name")
    tool_input = hook_payload.get("tool_input")
    # Agents spell the shell tool differently ("Bash" for Claude, "bash" for opencode).
    normalized_tool = tool_name.lower() if isinstance(tool_name, str) else ""
    if not isinstance(tool_input, dict) or normalized_tool != "bash":
        return True

    command = tool_input.get("command")
    if not isinstance(command, str) or "gh pr create" not in command:
        return True

    pr_args = argparse.Namespace(url=find_pr_url(hook_payload.get("tool_response")))
    return send_payload(build_payload("pr-opened", pr_args, control_env), control_env)


def send_payload(payload, control_env):
    request = urllib.request.Request(
        control_env["WEBMUX_CONTROL_URL"],
        data=json.dumps(payload).encode(),
        headers={
            "Authorization": f"Bearer {control_env['WEBMUX_CONTROL_TOKEN']}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=CONTROL_REQUEST_TIMEOUT_SECONDS) as response:
            if response.status < 200 or response.status >= 300:
                print(f"control endpoint returned HTTP {response.status}", file=sys.stderr)
                return False
    except urllib.error.HTTPError as error:
        print(f"control endpoint returned HTTP {error.code}", file=sys.stderr)
        return False
    except Exception as error:
        print(f"failed to send runtime event: {error}", file=sys.stderr)
        return False

    return True


def main():
    parsed = build_parser().parse_args()

    try:
        control_env = read_control_env()
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        return 1

    required_keys = [
        "WEBMUX_CONTROL_URL",
        "WEBMUX_CONTROL_TOKEN",
        "WEBMUX_WORKTREE_ID",
        "WEBMUX_BRANCH",
    ]
    missing = [key for key in required_keys if not control_env.get(key)]
    if missing:
        print(f"missing control env keys: {', '.join(missing)}", file=sys.stderr)
        return 1

    if parsed.command == "codex-session-start":
        send_payload(build_payload("status-changed", argparse.Namespace(lifecycle="idle"), control_env), control_env)
        return 0

    if parsed.command == "codex-user-prompt-submit":
        send_payload(build_payload("status-changed", argparse.Namespace(lifecycle="running"), control_env), control_env)
        return 0

    if parsed.command == "claude-user-prompt-submit":
        if not send_payload(build_payload("status-changed", argparse.Namespace(lifecycle="running"), control_env), control_env):
            return 1
        return 0

    if parsed.command == "codex-permission-request":
        send_payload(build_payload("status-changed", argparse.Namespace(lifecycle="idle"), control_env), control_env)
        return 0

    if parsed.command in ("codex-post-tool-use", "opencode-post-tool-use"):
        hook_payload = read_hook_payload()
        maybe_send_pr_opened(hook_payload, control_env)
        return 0

    if parsed.command == "claude-post-tool-use":
        hook_payload = read_hook_payload()
        return 0 if maybe_send_pr_opened(hook_payload, control_env) else 1

    if parsed.command == "codex-stop":
        send_payload(build_payload("agent-stopped", parsed, control_env), control_env)
        print(json.dumps({}))
        return 0

    payload = build_payload(parsed.command, parsed, control_env)
    if not send_payload(payload, control_env):
        return 0 if getattr(parsed, "best_effort", False) else 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
`;
}

export interface AgentRuntimeArtifacts {
  agentCtlPath: string;
  claudeSettingsPath: string;
  codexHooksPath: string;
  opencodePluginPath: string;
}

/** File the opencode launch command writes the profile system prompt to, referenced from
 *  `OPENCODE_CONFIG_CONTENT.instructions` because opencode has no `--append-system-prompt`. */
export function opencodeInstructionsPath(worktreePath: string): string {
  return join(worktreePath, ".opencode", "webmux-instructions.md");
}

/** Session ids the generated opencode plugin records, newest last. opencode keeps its
 *  transcripts in a database rather than per-session files, so this is what session
 *  discovery reads instead of scanning a well-known agent directory. */
export function opencodeSessionsPath(worktreePath: string): string {
  return join(worktreePath, ".opencode", "webmux-sessions.jsonl");
}

/** opencode has no shell-hook config: lifecycle reporting goes through a generated plugin
 *  that shells out to the same `webmux-agentctl` the Claude and Codex hooks use. */
function buildOpencodePlugin(input: { agentCtlPath: string; sessionsPath: string }): string {
  return `// Generated by webmux — do not edit. Reports opencode lifecycle events to the dashboard.
import { spawn, spawnSync } from "node:child_process"
import { appendFileSync } from "node:fs"

const AGENTCTL = ${JSON.stringify(input.agentCtlPath)}
const SESSIONS_PATH = ${JSON.stringify(input.sessionsPath)}

let reportedLifecycle = null

// Lifecycle reports are sent synchronously, in event order. opencode emits a last "busy"
// status alongside the end of a turn, and an in-flight async report of it would land after
// the turn-end report and leave the dashboard stuck on "running".
function reportLifecycle(args, lifecycle) {
  if (reportedLifecycle === lifecycle) return
  reportedLifecycle = lifecycle
  spawnSync(AGENTCTL, args, { stdio: "ignore" })
}

// Payload reports carry no state, so they stay off the event loop. Detached so the report
// still lands when opencode exits right after the tool call that triggered it.
function notify(args, payload) {
  const child = spawn(AGENTCTL, args, { stdio: ["pipe", "ignore", "ignore"], detached: true })
  // A missing or unwritable agentctl must never take the agent's turn down with it.
  child.on("error", () => {})
  if (child.stdin) {
    child.stdin.on("error", () => {})
    child.stdin.end(JSON.stringify(payload))
  }
  child.unref()
}

export const WebmuxBridge = async () => {
  // Runs once per opencode start, including \`--session\`/\`--continue\` resumes, which emit
  // no session events until the first turn. This is the "agent is up" signal.
  reportLifecycle(["status-changed", "--lifecycle", "idle", "--best-effort"], "idle")

  return {
    event: async ({ event }) => {
      const props = event.properties
      // Subagents get their own sessions in the same process; only top-level ones
      // (no parent) are sessions webmux can resume or fork.
      if (event.type === "session.created") {
        if (props.info && !props.info.parentID) {
          appendFileSync(SESSIONS_PATH, JSON.stringify({ id: props.sessionID, at: Date.now() }) + "\\n")
        }
        return
      }
      // Only "busy" is forwarded: session.idle is what ends a turn, and the idle side of
      // session.status fires alongside it.
      if (event.type === "session.status") {
        if (props.status && props.status.type === "busy") {
          reportLifecycle(["status-changed", "--lifecycle", "running", "--best-effort"], "running")
        }
        return
      }
      if (event.type === "session.idle") {
        reportLifecycle(["agent-stopped"], "stopped")
        return
      }
      if (event.type === "permission.asked") {
        reportLifecycle(["status-changed", "--lifecycle", "idle", "--best-effort"], "idle")
      }
    },
    "tool.execute.after": async (input, output) => {
      if (input.tool !== "bash") return
      notify(["opencode-post-tool-use"], {
        tool_name: input.tool,
        tool_input: input.args,
        tool_response: output,
      })
    },
  }
}
`;
}

function buildClaudeHookSettings(input: AgentRuntimeArtifacts): HookConfigFile {
  return {
    hooks: {
      UserPromptSubmit: [
        {
          hooks: [
            {
              type: "command",
              command: `${shellQuote(input.agentCtlPath)} claude-user-prompt-submit`,
              async: true,
            },
          ],
        },
      ],
      Notification: [
        {
          matcher: "permission_prompt|elicitation_dialog",
          hooks: [
            {
              type: "command",
              command: `${shellQuote(input.agentCtlPath)} status-changed --lifecycle idle`,
              async: true,
            },
          ],
        },
      ],
      Stop: [
        {
          hooks: [
            {
              type: "command",
              command: `${shellQuote(input.agentCtlPath)} agent-stopped`,
              async: true,
            },
          ],
        },
      ],
      PostToolUse: [
        {
          hooks: [
            {
              type: "command",
              command: `${shellQuote(input.agentCtlPath)} status-changed --lifecycle running`,
              async: true,
            },
          ],
        },
        {
          matcher: "Bash",
          hooks: [
            {
              type: "command",
              command: `${shellQuote(input.agentCtlPath)} claude-post-tool-use`,
              async: true,
            },
          ],
        },
      ],
    },
  };
}

function buildCodexHookSettings(input: AgentRuntimeArtifacts): HookConfigFile {
  const statusCommand = `${shellQuote(input.agentCtlPath)} status-changed --lifecycle running --best-effort`;
  return {
    hooks: {
      SessionStart: [
        {
          matcher: "startup|resume|clear",
          hooks: [
            {
              type: "command",
              command: `${shellQuote(input.agentCtlPath)} codex-session-start`,
              timeout: 30,
            },
          ],
        },
      ],
      UserPromptSubmit: [
        {
          hooks: [
            {
              type: "command",
              command: `${shellQuote(input.agentCtlPath)} codex-user-prompt-submit`,
              timeout: 30,
            },
          ],
        },
      ],
      PermissionRequest: [
        {
          hooks: [
            {
              type: "command",
              command: `${shellQuote(input.agentCtlPath)} codex-permission-request`,
              timeout: 30,
            },
          ],
        },
      ],
      PreToolUse: [
        {
          hooks: [
            {
              type: "command",
              command: statusCommand,
              timeout: 30,
            },
          ],
        },
      ],
      PostToolUse: [
        {
          matcher: "Bash",
          hooks: [
            {
              type: "command",
              command: `${shellQuote(input.agentCtlPath)} codex-post-tool-use`,
              timeout: 30,
            },
          ],
        },
      ],
      Stop: [
        {
          hooks: [
            {
              type: "command",
              command: `${shellQuote(input.agentCtlPath)} codex-stop`,
              timeout: 30,
            },
          ],
        },
      ],
    },
  };
}

async function mergeClaudeSettings(
  settingsPath: string,
  hookSettings: HookConfigFile["hooks"],
): Promise<void> {
  let existing: Record<string, unknown> = {};

  try {
    const file = Bun.file(settingsPath);
    if (await file.exists()) {
      const parsed = await file.json();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        existing = parsed as Record<string, unknown>;
      }
    }
  } catch {
    existing = {};
  }

  const existingHooks = existing.hooks;
  const mergedHooks = existingHooks && typeof existingHooks === "object" && !Array.isArray(existingHooks)
    ? { ...existingHooks, ...hookSettings }
    : hookSettings;
  const merged = { ...existing, hooks: mergedHooks };
  await Bun.write(settingsPath, JSON.stringify(merged, null, 2) + "\n");
}

function commandStartsWithAgentCtl(command: string, agentCtlPath: string): boolean {
  const trimmedCommand = command.trimStart();
  const quotedAgentCtlPath = shellQuote(agentCtlPath);
  return trimmedCommand === agentCtlPath
    || trimmedCommand.startsWith(`${agentCtlPath} `)
    || trimmedCommand === quotedAgentCtlPath
    || trimmedCommand.startsWith(`${quotedAgentCtlPath} `);
}

function isWebmuxHookGroup(group: unknown, agentCtlPath: string): boolean {
  if (!isRecord(group) || !Array.isArray(group.hooks)) return false;
  return group.hooks.some((hook) =>
    isRecord(hook)
    && typeof hook.command === "string"
    && commandStartsWithAgentCtl(hook.command, agentCtlPath)
  );
}

async function mergeCodexHooksFile(
  hooksPath: string,
  hookSettings: HookConfigFile["hooks"],
  agentCtlPath: string,
): Promise<void> {
  let existing: Record<string, unknown> = {};

  try {
    const file = Bun.file(hooksPath);
    if (await file.exists()) {
      const parsed = await file.json();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        existing = parsed as Record<string, unknown>;
      }
    }
  } catch {
    existing = {};
  }

  const existingHooks = isRecord(existing.hooks) ? existing.hooks : {};
  const mergedHooks: Record<string, unknown> = { ...existingHooks };
  for (const [eventName, groups] of Object.entries(hookSettings)) {
    const eventGroups = existingHooks[eventName];
    const preservedGroups = Array.isArray(eventGroups)
      ? eventGroups.filter((group) => !isWebmuxHookGroup(group, agentCtlPath))
      : [];
    mergedHooks[eventName] = [...preservedGroups, ...groups];
  }

  await Bun.write(hooksPath, JSON.stringify({ ...existing, hooks: mergedHooks }, null, 2) + "\n");
}

async function resolveGitCommonDir(gitDir: string): Promise<string> {
  try {
    const commonDir = (await Bun.file(join(gitDir, "commondir")).text()).trim();
    if (!commonDir) return gitDir;
    return commonDir.startsWith("/") ? commonDir : resolve(gitDir, commonDir);
  } catch {
    return gitDir;
  }
}

async function ensureGeneratedArtifactsIgnored(gitDir: string): Promise<void> {
  const commonDir = await resolveGitCommonDir(gitDir);
  const excludePath = join(commonDir, "info", "exclude");
  let existing = "";

  try {
    existing = await Bun.file(excludePath).text();
  } catch {
    existing = "";
  }

  const lines = existing.split(/\r?\n/).map((line) => line.trim());
  const missing = GENERATED_AGENT_ARTIFACT_EXCLUDES.filter((entry) => !lines.includes(entry));
  if (missing.length === 0) return;

  await mkdir(dirname(excludePath), { recursive: true });
  const separator = existing.length > 0 && !existing.endsWith("\n") ? "\n" : "";
  await Bun.write(excludePath, `${existing}${separator}${missing.join("\n")}\n`);
}

export async function ensureAgentRuntimeArtifacts(input: {
  gitDir: string;
  worktreePath: string;
}): Promise<AgentRuntimeArtifacts> {
  const storagePaths = getWorktreeStoragePaths(input.gitDir);
  const artifacts: AgentRuntimeArtifacts = {
    agentCtlPath: join(storagePaths.webmuxDir, "webmux-agentctl"),
    claudeSettingsPath: join(input.worktreePath, ".claude", "settings.local.json"),
    codexHooksPath: join(input.worktreePath, ".codex", "hooks.json"),
    opencodePluginPath: join(input.worktreePath, ".opencode", "plugin", "webmux.js"),
  };

  await mkdir(dirname(artifacts.claudeSettingsPath), { recursive: true });
  await mkdir(dirname(artifacts.codexHooksPath), { recursive: true });
  await mkdir(dirname(artifacts.opencodePluginPath), { recursive: true });

  await Bun.write(artifacts.agentCtlPath, buildAgentCtlScript());
  await chmod(artifacts.agentCtlPath, 0o755);

  const hookSettings = buildClaudeHookSettings(artifacts);
  const hooks = hookSettings.hooks;
  if (!isRecord(hooks)) {
    throw new Error("Invalid Claude hook settings");
  }
  await mergeClaudeSettings(artifacts.claudeSettingsPath, hooks);
  await ensureGeneratedArtifactsIgnored(input.gitDir);
  await mergeCodexHooksFile(artifacts.codexHooksPath, buildCodexHookSettings(artifacts).hooks, artifacts.agentCtlPath);
  // The plugin file is webmux-owned, so it is rewritten rather than merged.
  await Bun.write(
    artifacts.opencodePluginPath,
    buildOpencodePlugin({
      agentCtlPath: artifacts.agentCtlPath,
      sessionsPath: opencodeSessionsPath(input.worktreePath),
    }),
  );

  return artifacts;
}
