/**
 * Docker container lifecycle for sandbox worktrees.
 *
 * Runs sandbox containers directly for managed docker worktrees.
 */

import { chmod, mkdir, rename, stat } from "node:fs/promises";
import { join } from "node:path";
import { type DockerProfileConfig } from "./config";
import { webmuxRuntimeStateDir } from "./webmux-paths";
import { log } from "../lib/log";

const DOCKER_RUN_TIMEOUT_MS = 60_000;
const DOCKER_IMAGE_PREPARE_TIMEOUT_MS = 10 * 60_000;
const SANDBOX_READY_TIMEOUT_MS = 30_000;
const EXISTING_CONTAINER_READY_TIMEOUT_MS = 5_000;
const DOCKER_KILL_GRACE_MS = 5_000;

/** Home directory of the `webmux` user the injected entrypoint creates. */
export const SANDBOX_HOME = "/home/webmux";
/** Webmux-owned files inside the container (entrypoint, CLI bundle, tools). */
const CONTAINER_WEBMUX_DIR = "/opt/webmux";
const CONTAINER_ENTRYPOINT = `${CONTAINER_WEBMUX_DIR}/entrypoint.sh`;
const CONTAINER_READY_MARKER = `${CONTAINER_WEBMUX_DIR}/.ready`;
export const CONTAINER_TOOLS_DIR = `${CONTAINER_WEBMUX_DIR}/tools`;

/** Host UID/GID the sandbox user is created with and every `docker exec` runs as. */
export interface SandboxUser {
  uid: number;
  gid: number;
}

export function hostSandboxUser(): SandboxUser {
  return { uid: process.getuid?.() ?? 0, gid: process.getgid?.() ?? 0 };
}

/** Check if a path (file or directory) exists on the host. */
async function pathExists(p: string): Promise<boolean> {
  try { await stat(p); return true; } catch { return false; }
}

/**
 * Sanitise a branch name into a Docker-safe segment.
 * Docker container names must match [a-zA-Z0-9][a-zA-Z0-9_.\-]*.
 * The "wm-" prefix (3) and "-<13-digit-ts>" suffix (14) consume 17 chars,
 * leaving 46 for the branch segment (total ≤ 63).
 */
function sanitiseBranchForName(branch: string): string {
  const s = branch
    .replace(/[^a-zA-Z0-9_.-]/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[^a-zA-Z0-9]+/, "")
    .replace(/-+$/, "")
    .slice(0, 46);
  return s || "x";
}

/** Container naming: wm-{sanitised-branch}-{timestamp} */
function containerName(branch: string): string {
  return `wm-${sanitiseBranchForName(branch)}-${Date.now()}`;
}

/** Return true if s is a valid environment variable key. */
function isValidEnvKey(s: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(s);
}

export interface LaunchContainerOpts {
  branch: string;
  wtDir: string;
  mainRepoDir: string;
  sandboxConfig: DockerProfileConfig;
  runtimeEnv: Record<string, string>;
}

/** Host paths that make the running webmux's own CLI usable inside a container. */
export interface WebmuxCliMounts {
  /** The running webmux's JS bundle (`bin/webmux.js`). */
  entryPath: string;
  /** Shell wrapper that runs the bundle with `bun`; mounted onto the container `PATH`. */
  wrapperPath: string;
  /** Live-instance registry dir (`~/.webmux/instances`), so the CLI finds the server. */
  instancesDir: string;
}

const CONTAINER_CLI_ENTRY = `${CONTAINER_WEBMUX_DIR}/webmux.js`;

/** Host PIDs in the instance registry mean nothing in the container's PID
 *  namespace, so the in-container CLI skips the registry's liveness check. */
export function buildWebmuxCliWrapper(): string {
  return `#!/bin/sh\nWEBMUX_SKIP_INSTANCE_PID_CHECK=1 exec bun ${CONTAINER_CLI_ENTRY} "$@"\n`;
}

/**
 * Entrypoint webmux injects into every sandbox container, whatever the image.
 * It runs as root, creates a `webmux` user with the host UID/GID (so files
 * written to mounted dirs belong to the host user), grants it passwordless
 * sudo when sudo exists, then idles. It is best-effort on purpose: a failed
 * step is logged to `docker logs` but the container stays up.
 */
export function buildSandboxEntrypoint(): string {
  return `#!/bin/sh
set -u
uid="\${WEBMUX_UID:?WEBMUX_UID is required}"
gid="\${WEBMUX_GID:?WEBMUX_GID is required}"
home=${SANDBOX_HOME}
shell=/bin/sh
[ -x /bin/bash ] && shell=/bin/bash

has_gid() { awk -F: -v g="$gid" '$3 == g { found = 1 } END { exit !found }' /etc/group; }
has_uid() { awk -F: -v u="$uid" '$3 == u { found = 1 } END { exit !found }' /etc/passwd; }

if ! has_gid; then
  if command -v groupadd >/dev/null 2>&1; then
    groupadd -o -g "$gid" webmux
  elif command -v addgroup >/dev/null 2>&1; then
    addgroup -g "$gid" webmux
  fi
  # A name clash (an existing "webmux" group with another GID) makes the tools fail.
  has_gid || echo "webmux-$gid:x:$gid:" >> /etc/group
fi
group=$(awk -F: -v g="$gid" '$3 == g { print $1; exit }' /etc/group)

if [ "$uid" = 0 ]; then
  : # webmux itself runs as root; reuse root as-is.
elif has_uid; then
  # The image already has this UID (node, bun, ubuntu...): repoint its home so
  # tools that read the passwd entry instead of $HOME (ssh, sudo -H) agree.
  if command -v usermod >/dev/null 2>&1; then
    usermod -d "$home" "$(awk -F: -v u="$uid" '$3 == u { print $1; exit }' /etc/passwd)"
  else
    sed -i "s#^\\([^:]*:[^:]*:$uid:[^:]*:[^:]*:\\)[^:]*#\\1$home#" /etc/passwd
  fi
else
  if command -v useradd >/dev/null 2>&1; then
    useradd -o -u "$uid" -g "$gid" -d "$home" -M -s "$shell" webmux
  elif command -v adduser >/dev/null 2>&1; then
    adduser -D -H -u "$uid" -G "$group" -h "$home" -s "$shell" webmux
  fi
  has_uid || echo "webmux-$uid:x:$uid:$gid::$home:$shell" >> /etc/passwd
fi

mkdir -p "$home" ${CONTAINER_TOOLS_DIR}
chown "$uid:$gid" "$home" ${CONTAINER_TOOLS_DIR}
# Docker creates the parents of mounts under $home as root. Hand them over,
# but never touch a mount point itself (a different device): that is a host dir.
home_dev=$(stat -c %d "$home")
find "$home" -xdev -maxdepth 3 -type d -user 0 | while IFS= read -r dir; do
  [ "$(stat -c %d "$dir")" = "$home_dev" ] && chown "$uid:$gid" "$dir"
done

if command -v sudo >/dev/null 2>&1; then
  mkdir -p /etc/sudoers.d
  echo "#$uid ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/webmux
  chmod 0440 /etc/sudoers.d/webmux
fi

touch ${CONTAINER_READY_MARKER}
exec sleep infinity
`;
}

export interface DockerGateway {
  launchContainer(opts: LaunchContainerOpts): Promise<string>;
  removeContainer(branch: string): Promise<void>;
}

export class BunDockerGateway implements DockerGateway {
  launchContainer(opts: LaunchContainerOpts): Promise<string> {
    return launchContainer(opts);
  }

  removeContainer(branch: string): Promise<void> {
    return removeContainer(branch);
  }
}

/** Host credentials forwarded into the sandbox, resolved at launch. */
export interface SandboxCredentials {
  /** GitHub token: `GH_TOKEN`, then `GITHUB_TOKEN`, then `gh auth token`. */
  ghToken: string | null;
  gitIdentity: { name: string; email: string } | null;
  /** SSH agent socket to mount: the host path on Linux, Docker Desktop's
   *  forwarded socket on macOS. */
  sshAuthSock: string | null;
}

const MACOS_SSH_AUTH_SOCK = "/run/host-services/ssh-auth.sock";

/** Git helper that answers github.com credential requests with `$GH_TOKEN`. */
const GH_TOKEN_CREDENTIAL_HELPER = `!f() { test "$1" = get && echo username=x-access-token && echo "password=$GH_TOKEN"; }; f`;

/** Git config injected through `GIT_CONFIG_KEY_n`/`GIT_CONFIG_VALUE_n`, in order. */
export function buildSandboxGitConfig(
  wtDir: string,
  mainRepoDir: string,
  credentials: SandboxCredentials,
): Array<[string, string]> {
  const entries: Array<[string, string]> = [
    ["safe.directory", wtDir],
    ["safe.directory", mainRepoDir],
    // `.git/config` is read-only in the sandbox, so `git push -u` cannot record
    // an upstream; this makes the next plain `git push` work anyway.
    ["push.autoSetupRemote", "true"],
  ];
  if (credentials.ghToken) {
    entries.push(
      // Empty value resets helpers inherited from system config.
      ["credential.https://github.com.helper", ""],
      ["credential.https://github.com.helper", GH_TOKEN_CREDENTIAL_HELPER],
      // Route SSH GitHub remotes through the token.
      ["url.https://github.com/.insteadOf", "git@github.com:"],
      ["url.https://github.com/.insteadOf", "ssh://git@github.com/"],
    );
  }
  return entries;
}

function isReservedEnvKey(key: string, reservedKeys: ReadonlySet<string>): boolean {
  return reservedKeys.has(key) || /^GIT_CONFIG_(COUNT|KEY_\d+|VALUE_\d+)$/.test(key);
}

/** Everything `buildDockerRunArgs` needs that the caller resolves with I/O. */
export interface DockerRunContext {
  /** Pre-generated container name. */
  name: string;
  /** Host home directory (e.g. Bun.env.HOME). */
  home: string;
  user: SandboxUser;
  /** Image to run, already present locally. */
  image: string;
  /** Host path of the generated entrypoint script. */
  entrypointPath: string;
  /** Host environment, read for `envPassthrough`. */
  hostEnv: Record<string, string | undefined>;
  credentials: SandboxCredentials;
  /** Host paths for the in-container `webmux` CLI, or null when the running
   *  webmux has no JS bundle to mount. */
  webmuxCli: WebmuxCliMounts | null;
}

/**
 * Build the `docker run` argument list. Pure: all I/O is resolved by the
 * caller and passed in through `ctx`.
 */
export function buildDockerRunArgs(opts: LaunchContainerOpts, ctx: DockerRunContext): string[] {
  const { wtDir, mainRepoDir, sandboxConfig, runtimeEnv } = opts;
  const { home, credentials, webmuxCli } = ctx;

  const args: string[] = [
    "docker", "run", "-d",
    "--name", ctx.name,
    "-w", wtDir,
    // Share the host network: dev servers bind host ports directly, and the
    // webmux server is reachable on localhost (CLI and control URL).
    "--network", "host",
    // Start as root with webmux's entrypoint, which creates the `webmux` user
    // with the host UID/GID; panes then `docker exec` as that user.
    // `--user 0:0` overrides a non-root `USER` in the image.
    "--user", "0:0",
    "--entrypoint", CONTAINER_ENTRYPOINT,
    "-v", `${ctx.entrypointPath}:${CONTAINER_ENTRYPOINT}:ro`,
  ];

  // Core env vars — defined first so passthrough cannot override them.
  const reservedKeys = new Set([
    "HOME", "TERM", "IS_SANDBOX", "SSH_AUTH_SOCK", "WEBMUX_UID", "WEBMUX_GID", "GH_TOKEN",
    "GIT_AUTHOR_NAME", "GIT_AUTHOR_EMAIL", "GIT_COMMITTER_NAME", "GIT_COMMITTER_EMAIL",
  ]);
  args.push("-e", `HOME=${SANDBOX_HOME}`);
  args.push("-e", `WEBMUX_UID=${ctx.user.uid}`);
  args.push("-e", `WEBMUX_GID=${ctx.user.gid}`);
  args.push("-e", "TERM=xterm-256color");
  args.push("-e", "IS_SANDBOX=1");

  // Git config without mounting ~/.gitconfig: safe.directory, push defaults,
  // and the GitHub token credential helper.
  const gitConfig = buildSandboxGitConfig(wtDir, mainRepoDir, credentials);
  args.push("-e", `GIT_CONFIG_COUNT=${gitConfig.length}`);
  gitConfig.forEach(([key, value], i) => {
    args.push("-e", `GIT_CONFIG_KEY_${i}=${key}`);
    args.push("-e", `GIT_CONFIG_VALUE_${i}=${value}`);
  });
  if (credentials.ghToken) {
    args.push("-e", `GH_TOKEN=${credentials.ghToken}`);
  }
  if (credentials.gitIdentity) {
    const { name, email } = credentials.gitIdentity;
    args.push("-e", `GIT_AUTHOR_NAME=${name}`, "-e", `GIT_AUTHOR_EMAIL=${email}`);
    args.push("-e", `GIT_COMMITTER_NAME=${name}`, "-e", `GIT_COMMITTER_EMAIL=${email}`);
  }

  // Pass through host env vars listed in the docker profile.
  if (sandboxConfig.envPassthrough) {
    for (const key of sandboxConfig.envPassthrough) {
      if (!isValidEnvKey(key)) {
        log.warn(`[docker] skipping invalid envPassthrough key: ${JSON.stringify(key)}`);
        continue;
      }
      if (isReservedEnvKey(key, reservedKeys)) continue;
      const val = ctx.hostEnv[key];
      if (val !== undefined) {
        args.push("-e", `${key}=${val}`);
      }
    }
  }

  // Pass through generated runtime env; skip reserved keys and invalid key names.
  for (const [key, val] of Object.entries(runtimeEnv)) {
    if (!isValidEnvKey(key)) {
      log.warn(`[docker] skipping invalid runtime env key: ${JSON.stringify(key)}`);
      continue;
    }
    if (isReservedEnvKey(key, reservedKeys)) continue;
    args.push("-e", `${key}=${val}`);
  }

  // Core mounts.
  args.push("-v", `${wtDir}:${wtDir}`);
  args.push("-v", `${mainRepoDir}/.git:${mainRepoDir}/.git`);
  args.push("-v", `${mainRepoDir}:${mainRepoDir}:ro`);
  // Close the sandbox-to-host hole: hooks and config (core.fsmonitor,
  // core.hooksPath...) would run code on the host's next git command.
  args.push("-v", `${mainRepoDir}/.git/hooks:${mainRepoDir}/.git/hooks:ro`);
  args.push("-v", `${mainRepoDir}/.git/config:${mainRepoDir}/.git/config:ro`);

  // Agent config mounts.
  args.push("-v", `${home}/.claude:${SANDBOX_HOME}/.claude`);
  args.push("-v", `${home}/.claude.json:${SANDBOX_HOME}/.claude.json`);
  args.push("-v", `${home}/.codex:${SANDBOX_HOME}/.codex`);

  // The running webmux's CLI, so agents can call `webmux port` in the container.
  if (webmuxCli) {
    args.push("-v", `${webmuxCli.entryPath}:${CONTAINER_CLI_ENTRY}:ro`);
    args.push("-v", `${webmuxCli.wrapperPath}:/usr/local/bin/webmux:ro`);
    args.push("-v", `${webmuxCli.instancesDir}:${SANDBOX_HOME}/.webmux/instances:ro`);
  }

  // SSH agent forwarding for non-GitHub remotes. The sandbox user has the
  // host UID, so it can use the socket. Use --mount instead of -v because
  // Docker's -v tries to mkdir socket paths and fails.
  if (credentials.sshAuthSock) {
    const sock = credentials.sshAuthSock;
    args.push("--mount", `type=bind,source=${sock},target=${sock}`);
    args.push("-e", `SSH_AUTH_SOCK=${sock}`);
  }

  // Additional mounts from config; require absolute host paths after ~ expansion.
  if (sandboxConfig.mounts) {
    for (const mount of sandboxConfig.mounts) {
      const hostPath = mount.hostPath.replace(/^~/, home);
      if (!hostPath.startsWith("/")) {
        log.warn(`[docker] skipping mount with non-absolute host path: ${JSON.stringify(hostPath)}`);
        continue;
      }
      const guestPath = mount.guestPath ?? hostPath;
      const suffix = mount.writable ? "" : ":ro";
      args.push("-v", `${hostPath}:${guestPath}${suffix}`);
    }
  }

  // Image; the entrypoint ends in `sleep infinity`.
  args.push(ctx.image);

  return args;
}

/**
 * Launch a sandbox container for a worktree. Returns the container name.
 * If a container for this branch is already running, returns its name without launching a second one.
 */
export async function launchContainer(opts: LaunchContainerOpts): Promise<string> {
  const { branch } = opts;

  // Idempotency: reuse an already-running container for this branch.
  const existing = await findContainer(branch);
  if (existing) {
    // A container still running its entrypoint becomes ready shortly; one that
    // never does predates the injected entrypoint and is replaced.
    if (await isSandboxReady(existing, EXISTING_CONTAINER_READY_TIMEOUT_MS)) {
      log.info(`[docker] reusing existing container ${existing} for branch ${branch}`);
      return existing;
    }
    log.info(`[docker] replacing container ${existing} for branch ${branch}: not started by the current entrypoint`);
    await Bun.spawn(["docker", "rm", "-f", existing], { stdout: "ignore", stderr: "ignore" }).exited;
  }

  if (!opts.sandboxConfig.image) {
    throw new Error("sandboxConfig.image is required but was empty");
  }

  const name = containerName(branch);
  const home = Bun.env.HOME ?? "/root";

  const image = opts.sandboxConfig.image;
  await ensureImage(image);
  const [webmuxCli, entrypointPath, credentials] = await Promise.all([
    prepareWebmuxCliMounts(),
    writeSandboxEntrypoint(),
    resolveSandboxCredentials(opts.mainRepoDir),
    // A missing hooks dir would make its read-only bind mount fail.
    mkdir(join(opts.mainRepoDir, ".git", "hooks"), { recursive: true }),
  ]);
  const args = buildDockerRunArgs(opts, {
    name,
    home,
    user: hostSandboxUser(),
    image,
    entrypointPath,
    hostEnv: Bun.env,
    credentials,
    webmuxCli,
  });

  if (process.platform === "darwin") {
    log.warn("[docker] sandbox containers use host networking; on macOS enable it in Docker Desktop >= 4.34 (Settings > Resources > Network > Enable host networking) or use OrbStack");
  }
  log.info(`[docker] launching container: ${name}`);
  const run = await runDocker(args, DOCKER_RUN_TIMEOUT_MS);
  if (run.exitCode !== 0) {
    // Clean up any stopped container docker may have left behind.
    await Bun.spawn(["docker", "rm", "-f", name], { stdout: "ignore", stderr: "ignore" }).exited;
    throw new Error(run.exitCode === "timeout"
      ? `docker run timed out after ${DOCKER_RUN_TIMEOUT_MS / 1000}s`
      : `docker run failed (exit ${run.exitCode}): ${run.stderr}`);
  }
  const containerId = run.stdout;

  try {
    await waitForSandboxReady(name);
  } catch (error) {
    await Bun.spawn(["docker", "rm", "-f", name], { stdout: "ignore", stderr: "ignore" }).exited;
    throw error;
  }

  log.info(`[docker] container ${name} ready (id=${containerId.trim().slice(0, 12)})`);

  return name;
}

/** Read a command's trimmed stdout, or null when it fails or prints nothing. */
async function readCommandOutput(argv: string[], cwd: string): Promise<string | null> {
  try {
    const proc = Bun.spawn(argv, { cwd, stdout: "pipe", stderr: "ignore" });
    const [exitCode, stdout] = await Promise.all([proc.exited, new Response(proc.stdout).text()]);
    const value = stdout.trim();
    return exitCode === 0 && value ? value : null;
  } catch {
    return null;
  }
}

async function resolveSshAuthSock(): Promise<string | null> {
  if (process.platform === "darwin") return MACOS_SSH_AUTH_SOCK;
  const sock = Bun.env.SSH_AUTH_SOCK;
  if (!sock) return null;
  try {
    return (await stat(sock)).isSocket() ? sock : null;
  } catch {
    return null;
  }
}

/** Resolve the host's GitHub token, git identity and SSH agent socket. */
async function resolveSandboxCredentials(repoDir: string): Promise<SandboxCredentials> {
  const [ghAuthToken, name, email, sshAuthSock] = await Promise.all([
    Bun.env.GH_TOKEN || Bun.env.GITHUB_TOKEN ? null : readCommandOutput(["gh", "auth", "token"], repoDir),
    readCommandOutput(["git", "config", "--get", "user.name"], repoDir),
    readCommandOutput(["git", "config", "--get", "user.email"], repoDir),
    resolveSshAuthSock(),
  ]);
  const ghToken = Bun.env.GH_TOKEN || Bun.env.GITHUB_TOKEN || ghAuthToken;
  if (!ghToken) log.info("[docker] no GitHub token found (GH_TOKEN, GITHUB_TOKEN, gh auth token); GitHub auth unavailable in the sandbox");
  return {
    ghToken,
    gitIdentity: name && email ? { name, email } : null,
    sshAuthSock,
  };
}

interface DockerCommandResult {
  exitCode: number | "timeout";
  stdout: string;
  stderr: string;
}

/** Run a docker command and kill it after `timeoutMs`, so a hung daemon or a
 *  slow pull cannot block the server indefinitely. */
async function runDocker(
  argv: string[],
  timeoutMs: number,
  onStdoutLine?: (line: string) => void,
): Promise<DockerCommandResult> {
  const proc = Bun.spawn(argv, { stdout: "pipe", stderr: "pipe" });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill();
    setTimeout(() => proc.kill("SIGKILL"), DOCKER_KILL_GRACE_MS).unref();
  }, timeoutMs);
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    onStdoutLine ? readLines(proc.stdout, onStdoutLine) : new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);
  clearTimeout(timer);
  return { exitCode: timedOut ? "timeout" : exitCode, stdout, stderr };
}

/** Read a stream to the end, reporting each complete line as it arrives. */
async function readLines(stream: ReadableStream<Uint8Array>, onLine: (line: string) => void): Promise<string> {
  const decoder = new TextDecoder();
  let all = "";
  let pending = "";
  for await (const chunk of stream) {
    const text = decoder.decode(chunk, { stream: true });
    all += text;
    const lines = (pending + text).split("\n");
    pending = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) onLine(line);
  }
  if (pending.trim()) onLine(pending);
  return all;
}

/** Make sure `image` is available locally, pulling it when missing. Kept apart
 *  from `docker run` so a slow first pull gets its own, longer timeout. */
async function ensureImage(image: string): Promise<void> {
  const inspect = await runDocker(["docker", "image", "inspect", "--format", "{{.Id}}", image], DOCKER_RUN_TIMEOUT_MS);
  if (inspect.exitCode === 0) return;

  log.info(`[docker] pulling image ${image}`);
  const pull = await runDocker(
    ["docker", "pull", image],
    DOCKER_IMAGE_PREPARE_TIMEOUT_MS,
    (line) => log.info(`[docker] pull ${image}: ${line}`),
  );
  if (pull.exitCode === "timeout") {
    throw new Error(`docker pull ${image} timed out after ${DOCKER_IMAGE_PREPARE_TIMEOUT_MS / 60_000} min`);
  }
  if (pull.exitCode !== 0) {
    throw new Error(`docker pull ${image} failed (exit ${pull.exitCode}): ${pull.stderr}`);
  }
  log.info(`[docker] pulled image ${image}`);
}

/** Poll for the entrypoint's ready marker. False on timeout or when the
 *  container stopped. */
async function isSandboxReady(name: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const probe = await runDocker(
      ["docker", "exec", name, "test", "-f", CONTAINER_READY_MARKER],
      Math.max(1000, deadline - Date.now()),
    );
    if (probe.exitCode === 0) return true;
    if (probe.stderr.includes("is not running")) return false;
    await Bun.sleep(200);
  }
  return false;
}

/** Wait until the entrypoint has created the sandbox user, so the first
 *  `docker exec -u` of a pane finds its home and sudoers in place. */
async function waitForSandboxReady(name: string): Promise<void> {
  if (await isSandboxReady(name, SANDBOX_READY_TIMEOUT_MS)) return;
  const logs = await runDocker(["docker", "logs", "--tail", "50", name], DOCKER_RUN_TIMEOUT_MS);
  throw new Error(`sandbox container ${name} did not become ready: ${(logs.stdout + logs.stderr).trim()}`);
}

/** Write the injected entrypoint to the runtime state dir and return its path. */
async function writeSandboxEntrypoint(): Promise<string> {
  const dir = join(webmuxRuntimeStateDir(), "docker");
  const path = join(dir, "entrypoint.sh");
  const content = buildSandboxEntrypoint();
  if (await Bun.file(path).exists() && await Bun.file(path).text() === content) return path;
  // Write then rename: a container still reading the old script keeps its inode.
  const tmpPath = `${path}.${process.pid}.tmp`;
  await mkdir(dir, { recursive: true });
  await Bun.write(tmpPath, content);
  await chmod(tmpPath, 0o755);
  await rename(tmpPath, path);
  return path;
}

/** Resolve the host paths for the in-container `webmux` CLI and write its
 *  wrapper script. `WEBMUX_CLI_ENTRY` is set by `webmux serve` to its own JS
 *  bundle; it is absent when the backend runs from source (dev mode). */
async function prepareWebmuxCliMounts(): Promise<WebmuxCliMounts | null> {
  const entryPath = Bun.env.WEBMUX_CLI_ENTRY;
  if (!entryPath || !(await pathExists(entryPath))) {
    log.debug("[docker] WEBMUX_CLI_ENTRY not set; the webmux CLI will not be available in the container");
    return null;
  }
  const stateDir = webmuxRuntimeStateDir();
  const instancesDir = join(stateDir, "instances");
  const wrapperDir = join(stateDir, "docker");
  const wrapperPath = join(wrapperDir, "webmux");
  await mkdir(instancesDir, { recursive: true });
  await mkdir(wrapperDir, { recursive: true });
  await Bun.write(wrapperPath, buildWebmuxCliWrapper());
  await chmod(wrapperPath, 0o755);
  return { entryPath, wrapperPath, instancesDir };
}

/**
 * Find the most-recently-started running container for a branch.
 * Returns the container name, or null if none is running.
 * Throws if the Docker daemon cannot be reached.
 */
export async function findContainer(branch: string): Promise<string | null> {
  const sanitised = sanitiseBranchForName(branch);
  const prefix = `wm-${sanitised}-`;
  const proc = Bun.spawn(
    ["docker", "ps", "--filter", `name=${prefix}`, "--format", "{{.Names}}"],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ]);

  if (exitCode !== 0) {
    throw new Error(`docker ps failed (exit ${exitCode}): ${stderr}`);
  }

  // Filter to exact prefix matches: the part after the prefix must be only
  // the numeric timestamp. This prevents "main" from matching "main-v2" containers.
  const names = stdout
    .trim()
    .split("\n")
    .filter(Boolean)
    .filter(n => n.startsWith(prefix) && /^\d+$/.test(n.slice(prefix.length)));

  // docker ps lists containers newest-first; return the first match.
  return names.at(0) ?? null;
}

/**
 * Remove all containers (running or stopped) for a branch.
 * Individual removal errors are logged but do not abort remaining removals.
 */
export async function removeContainer(branch: string): Promise<void> {
  const sanitised = sanitiseBranchForName(branch);
  const prefix = `wm-${sanitised}-`;
  const listProc = Bun.spawn(
    ["docker", "ps", "-a", "--filter", `name=${prefix}`, "--format", "{{.Names}}"],
    { stdout: "pipe", stderr: "pipe" },
  );
  const [listExit, listOut, listErr] = await Promise.all([
    listProc.exited,
    new Response(listProc.stdout).text(),
    new Response(listProc.stderr).text(),
  ]);

  if (listExit !== 0) {
    log.error(`[docker] removeContainer: docker ps failed for ${branch}: ${listErr}`);
    return;
  }

  const names = listOut
    .trim()
    .split("\n")
    .filter(Boolean)
    .filter(n => n.startsWith(prefix) && /^\d+$/.test(n.slice(prefix.length)));

  await Promise.all(
    names.map(async (cname) => {
      log.info(`[docker] removing container: ${cname}`);
      const rmProc = Bun.spawn(["docker", "rm", "-f", cname], { stdout: "ignore", stderr: "pipe" });
      const [rmExit, rmErr] = await Promise.all([
        rmProc.exited,
        new Response(rmProc.stderr).text(),
      ]);
      if (rmExit !== 0) {
        log.error(`[docker] failed to remove container ${cname}: ${rmErr}`);
      }
    }),
  );
}
