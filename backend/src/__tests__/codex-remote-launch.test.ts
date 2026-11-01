import { afterEach, describe, expect, it } from "bun:test";
import { chmod, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AgentDefinition } from "../services/agent-registry";
import { buildAgentPaneCommand } from "../services/agent-service";

const CODEX: AgentDefinition = {
  id: "codex",
  label: "Codex",
  kind: "builtin",
  capabilities: { terminal: true, inAppChat: true, conversationHistory: true, interrupt: true, resume: true },
  implementation: { type: "builtin", agent: "codex" },
};

// Stands in for `codex`: logs each invocation with the env var it inherited. As `app-server` it
// listens on the unix socket, ignores SIGHUP and exits 0 on SIGTERM (or exits 1
// by itself after FAKE_SERVER_LIFETIME seconds, a crash). As the TUI it exits 1 for its first
// FAKE_TUI_CRASHES runs, or stays up for FAKE_TUI_SECONDS.
const FAKE_CODEX = `#!/bin/sh
echo "env=$WEBMUX_TEST_VAR args=$*" >> "$CODEX_LOG"
if [ "$1" = app-server ]; then
  for arg; do case "$arg" in unix://*) sock="\${arg#unix://}";; esac; done
  echo $$ > "$sock.pid"
  exec python3 -c 'import signal, socket, sys, time
signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
signal.signal(signal.SIGHUP, signal.SIG_IGN)
s = socket.socket(socket.AF_UNIX)
s.bind(sys.argv[1])
s.listen()
time.sleep(float(sys.argv[2]))
sys.exit(1)' "$sock" "\${FAKE_SERVER_LIFETIME:-30}"
fi
runs=$(grep -c -- "--remote" "$CODEX_LOG")
if [ "$runs" -le "\${FAKE_TUI_CRASHES:-0}" ]; then sleep 0.5; exit 1; fi
sleep "\${FAKE_TUI_SECONDS:-0}"
exit 0
`;

const cleanups: string[] = [];

afterEach(async () => {
  for (const dir of cleanups.splice(0)) await rm(dir, { recursive: true, force: true });
});

async function runCodexLaunch(input: {
  launch: Partial<Parameters<typeof buildAgentPaneCommand>[0]>;
  env?: Record<string, string>;
  /** Hang up the whole job once the app-server is listening, as closing the tmux pane does. */
  hangup?: boolean;
}): Promise<{ exitCode: number; log: string[]; socketPath: string; serverAlive: boolean }> {
  const dir = await mkdtemp(join(tmpdir(), "cx-launch-"));
  cleanups.push(dir);
  const binDir = join(dir, "bin");
  const codexPath = join(binDir, "codex");
  await Bun.write(codexPath, FAKE_CODEX);
  await chmod(codexPath, 0o755);
  const runtimeEnvPath = join(dir, "runtime.env");
  await Bun.write(runtimeEnvPath, "WEBMUX_TEST_VAR=from-runtime-env\n");
  const logPath = join(dir, "codex.log");
  await Bun.write(logPath, "");
  const socketPath = join(dir, "cx", "wt.sock");

  const command = buildAgentPaneCommand({
    agent: CODEX,
    runtimeEnvPath,
    repoRoot: "/repo",
    worktreePath: dir,
    branch: "feature",
    profileName: "default",
    appServerSocketPath: socketPath,
    ...input.launch,
  });
  const proc = Bun.spawn(["bash", "-c", command], {
    cwd: dir,
    env: { ...Bun.env, ...input.env, PATH: `${binDir}:${Bun.env.PATH}`, CODEX_LOG: logPath },
    stdout: "ignore",
    stderr: "ignore",
    detached: input.hangup === true,
  });
  const serverPidFile = Bun.file(`${socketPath}.pid`);
  if (input.hangup) {
    while (!await Bun.file(`${socketPath}.pid`).exists()) await Bun.sleep(50);
    await Bun.sleep(200);
    process.kill(-proc.pid, "SIGHUP");
  }
  const exitCode = await proc.exited;
  await Bun.sleep(200);
  const log = (await Bun.file(logPath).text()).trim().split("\n");
  const serverPid = Number((await serverPidFile.text()).trim());
  let serverAlive = true;
  try {
    process.kill(serverPid, 0);
  } catch {
    serverAlive = false;
  }
  return { exitCode, log, socketPath, serverAlive };
}

describe("codex launch with a per-worktree app-server", () => {
  it("starts the app-server with the runtime env and attaches the TUI to it", async () => {
    const { exitCode, log, socketPath } = await runCodexLaunch({
      launch: { yolo: true, systemPrompt: "Be brief", prompt: "ship it" },
    });

    expect(exitCode).toBe(0);
    expect(log).toEqual([
      `env=from-runtime-env args=app-server --enable hooks -c developer_instructions=Be brief --listen unix://${socketPath}`,
      `env=from-runtime-env args=--enable hooks --yolo --remote unix://${socketPath} -- ship it`,
    ]);
  });

  it("resumes the requested thread and keeps instructions off resumed sessions", async () => {
    const { log, socketPath } = await runCodexLaunch({
      launch: { launchMode: "resume", systemPrompt: "ignored on resume" },
    });

    expect(log).toEqual([
      `env=from-runtime-env args=app-server --enable hooks --listen unix://${socketPath}`,
      `env=from-runtime-env args=--enable hooks --remote unix://${socketPath} resume --last`,
    ]);
  });

  it("restarts both, resuming the latest thread, when the app-server crashes", async () => {
    const { exitCode, log, socketPath } = await runCodexLaunch({
      launch: { prompt: "ship it" },
      env: { FAKE_SERVER_LIFETIME: "0.2", FAKE_TUI_CRASHES: "1" },
    });

    expect(exitCode).toBe(0);
    expect(log.filter((line) => line.includes("--remote"))).toEqual([
      `env=from-runtime-env args=--enable hooks --remote unix://${socketPath} -- ship it`,
      `env=from-runtime-env args=--enable hooks --remote unix://${socketPath} resume --last`,
    ]);
  });

  it("gives up after three restarts", async () => {
    const { exitCode, log } = await runCodexLaunch({
      launch: {},
      env: { FAKE_SERVER_LIFETIME: "0.2", FAKE_TUI_CRASHES: "99" },
    });

    expect(exitCode).toBe(1);
    expect(log.filter((line) => line.includes("--remote"))).toHaveLength(4);
  }, 15_000);

  it("does not restart when the TUI fails while its app-server is still up", async () => {
    const { exitCode, log } = await runCodexLaunch({
      launch: {},
      env: { FAKE_TUI_CRASHES: "1" },
    });

    expect(exitCode).toBe(1);
    expect(log.filter((line) => line.includes("--remote"))).toHaveLength(1);
  });

  it("stops the app-server when the pane hangs up, even if the server ignores SIGHUP", async () => {
    const { serverAlive } = await runCodexLaunch({
      launch: {},
      env: { FAKE_TUI_SECONDS: "30" },
      hangup: true,
    });

    expect(serverAlive).toBe(false);
  });

  it("stops the app-server when the TUI quits", async () => {
    const { exitCode, serverAlive } = await runCodexLaunch({ launch: {} });

    expect(exitCode).toBe(0);
    expect(serverAlive).toBe(false);
  });

  it("launches forks without an app-server", () => {
    const command = buildAgentPaneCommand({
      agent: CODEX,
      runtimeEnvPath: "/tmp/runtime.env",
      repoRoot: "/repo",
      worktreePath: "/repo/__worktrees/feature",
      branch: "feature",
      profileName: "default",
      launchMode: "fork",
      forkFromSessionId: "root-abc",
      appServerSocketPath: "/tmp/cx/wt.sock",
    });

    expect(command).toContain("codex --enable hooks fork 'root-abc'");
    expect(command).not.toContain("app-server");
  });
});
