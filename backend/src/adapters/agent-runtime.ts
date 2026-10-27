import { chmod, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { AGENT_ADAPTERS } from "../agents";
import { claudeSettingsPath } from "../agents/claude";
import { codexHooksPath } from "../agents/codex";
import { opencodePluginPath } from "../agents/opencode";
import { piExtensionPath } from "../agents/pi";
import { getWorktreeStoragePaths } from "./fs";

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
    subparsers.add_parser("pi-post-tool-use")
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

    if parsed.command in ("codex-post-tool-use", "opencode-post-tool-use", "pi-post-tool-use"):
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
  piExtensionPath: string;
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
  const missing = Object.values(AGENT_ADAPTERS).flatMap((adapter) => adapter.generatedArtifactExcludes).filter((entry) => !lines.includes(entry));
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
    claudeSettingsPath: claudeSettingsPath(input.worktreePath),
    codexHooksPath: codexHooksPath(input.worktreePath),
    opencodePluginPath: opencodePluginPath(input.worktreePath),
    piExtensionPath: piExtensionPath(storagePaths.webmuxDir),
  };

  await Bun.write(artifacts.agentCtlPath, buildAgentCtlScript());
  await chmod(artifacts.agentCtlPath, 0o755);
  await ensureGeneratedArtifactsIgnored(input.gitDir);

  // Every agent's bridge is written for every worktree, whichever agent it runs.
  for (const adapter of Object.values(AGENT_ADAPTERS)) {
    await adapter.writeRuntimeArtifacts({
      agentCtlPath: artifacts.agentCtlPath,
      worktreePath: input.worktreePath,
      webmuxDir: storagePaths.webmuxDir,
    });
  }

  return artifacts;
}
