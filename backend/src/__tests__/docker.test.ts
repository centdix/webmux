import { describe, expect, it } from "bun:test";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildDockerRunArgs,
  buildSandboxGitConfig,
  buildSandboxEntrypoint,
  buildWebmuxCliWrapper,
  type LaunchContainerOpts,
  type SandboxCredentials,
  type WebmuxCliMounts,
} from "../adapters/docker";
import type { DockerProfileConfig } from "../adapters/config";

const HOME = "/home/testuser";
const UID = 1000;
const GID = 1000;
const ENTRYPOINT = `${HOME}/.webmux/docker/entrypoint.sh`;

/** Minimal valid opts; individual tests override what they need. */
function makeDockerProfile(overrides: Partial<DockerProfileConfig> = {}): DockerProfileConfig {
  return {
    runtime: "docker",
    image: "my-image:latest",
    envPassthrough: [],
    panes: [],
    ...overrides,
  };
}

function makeOpts(overrides: Partial<LaunchContainerOpts> = {}): LaunchContainerOpts {
  return {
    branch: "my-branch",
    wtDir: "/repos/my-branch",
    mainRepoDir: "/repos/main",
    sandboxConfig: makeDockerProfile(),
    runtimeEnv: {},
    ...overrides,
  };
}

/** Shorthand: call buildDockerRunArgs with test defaults for the trailing params. */
const NO_CREDENTIALS: SandboxCredentials = { ghToken: null, gitIdentity: null, sshAuthSock: null };

function build(
  opts: LaunchContainerOpts,
  credentials: SandboxCredentials = NO_CREDENTIALS,
  webmuxCli: WebmuxCliMounts | null = null,
  hostEnv: Record<string, string | undefined> = {},
): string[] {
  return buildDockerRunArgs(opts, {
    name: "wm-test-123",
    home: HOME,
    user: { uid: UID, gid: GID },
    image: opts.sandboxConfig.image,
    entrypointPath: ENTRYPOINT,
    hostEnv,
    credentials,
    webmuxCli,
  });
}

/** Pull all -v flag values out of an args array. */
function mounts(args: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < args.length - 1; i++) {
    if (args[i] === "-v") result.push(args[i + 1]!);
  }
  return result;
}

/** Pull all -p flag values out of an args array. */
function ports(args: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < args.length - 1; i++) {
    if (args[i] === "-p") result.push(args[i + 1]!);
  }
  return result;
}

/** Pull all -e flag values out of an args array. */
function envFlags(args: string[]): string[] {
  const result: string[] = [];
  for (let i = 0; i < args.length - 1; i++) {
    if (args[i] === "-e") result.push(args[i + 1]!);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Sandbox user + injected entrypoint
// ---------------------------------------------------------------------------

describe("buildDockerRunArgs — sandbox user", () => {
  it("starts as root with the injected entrypoint, overriding the image USER", () => {
    const args = build(makeOpts());
    expect(args[args.indexOf("--user") + 1]).toBe("0:0");
    expect(args.filter((a) => a === "--user")).toHaveLength(1);
    expect(args[args.indexOf("--entrypoint") + 1]).toBe("/opt/webmux/entrypoint.sh");
    expect(mounts(args)).toContain(`${ENTRYPOINT}:/opt/webmux/entrypoint.sh:ro`);
  });

  it("passes the host UID/GID and the sandbox HOME", () => {
    const flags = envFlags(build(makeOpts()));
    expect(flags).toContain(`WEBMUX_UID=${UID}`);
    expect(flags).toContain(`WEBMUX_GID=${GID}`);
    expect(flags).toContain("HOME=/home/webmux");
  });

  it("ends with the image and no command (the entrypoint idles)", () => {
    const args = build(makeOpts());
    expect(args.at(-1)).toBe("my-image:latest");
  });

  it("mounts agent config under /home/webmux", () => {
    const m = mounts(build(makeOpts()));
    expect(m).toContain(`${HOME}/.claude:/home/webmux/.claude`);
    expect(m).toContain(`${HOME}/.claude.json:/home/webmux/.claude.json`);
    expect(m).toContain(`${HOME}/.codex:/home/webmux/.codex`);
    expect(m.some((v) => v.includes(":/root/"))).toBe(false);
  });

  it("WEBMUX_UID from runtime env cannot override the host UID", () => {
    const flags = envFlags(build(makeOpts({ runtimeEnv: { WEBMUX_UID: "0" } })));
    expect(flags.filter((f) => f.startsWith("WEBMUX_UID="))).toEqual([`WEBMUX_UID=${UID}`]);
  });
});

describe("buildDockerRunArgs — envPassthrough", () => {
  it("forwards listed host vars that are set, from the given host env", () => {
    const flags = envFlags(build(
      makeOpts({ sandboxConfig: makeDockerProfile({ envPassthrough: ["FOO", "UNSET", "HOME"] }) }),
      NO_CREDENTIALS, null, { FOO: "bar", HOME: "/host" },
    ));
    expect(flags).toContain("FOO=bar");
    expect(flags.some((f) => f.startsWith("UNSET="))).toBe(false);
    expect(flags).not.toContain("HOME=/host");
  });
});

describe("buildSandboxEntrypoint", () => {
  const script = buildSandboxEntrypoint();

  it("is a POSIX sh script that ends by idling", () => {
    expect(script.startsWith("#!/bin/sh\n")).toBe(true);
    expect(script.trimEnd().endsWith("exec sleep infinity")).toBe(true);
  });

  it("creates the user with the host UID, tolerating an existing UID, with a busybox fallback", () => {
    expect(script).toContain('useradd -o -u "$uid" -g "$gid" -d "$home"');
    expect(script).toContain('adduser -D -H -u "$uid"');
    expect(script).toContain('addgroup -g "$gid" webmux');
    expect(script).toContain("home=/home/webmux");
  });

  it("repoints the home of a UID the image already has, and falls back to editing passwd", () => {
    expect(script).toContain('usermod -d "$home"');
    expect(script).toContain('has_uid || echo "webmux-$uid:x:$uid:$gid::$home:$shell" >> /etc/passwd');
    expect(script).toContain('has_gid || echo "webmux-$gid:x:$gid:" >> /etc/group');
  });

  it("hands over the home and tools dirs without a recursive chown", () => {
    expect(script).toContain('chown "$uid:$gid" "$home" /opt/webmux/tools');
    expect(script).toContain('find "$home" -xdev -maxdepth 3 -type d -user 0');
    expect(script).not.toContain("chown -R");
    expect(script).not.toContain("chmod -R");
  });

  it("grants passwordless sudo by UID only when sudo exists", () => {
    expect(script).toContain("if command -v sudo >/dev/null 2>&1; then");
    expect(script).toContain('echo "#$uid ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/webmux');
  });

  it("signals readiness before idling", () => {
    expect(script.indexOf("touch /opt/webmux/.ready")).toBeLessThan(script.indexOf("exec sleep infinity"));
  });

  it("passes sh -n syntax check", () => {
    const proc = Bun.spawnSync(["sh", "-n"], { stdin: new TextEncoder().encode(script) });
    expect(proc.exitCode).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// extraMounts
// ---------------------------------------------------------------------------

describe("buildDockerRunArgs — extraMounts", () => {
  it("adds a read-only mount when writable is false", () => {
    const args = build(makeOpts({ sandboxConfig: makeDockerProfile({ image: "img", mounts: [
      { hostPath: "/data/shared", guestPath: "/mnt/shared", writable: false },
    ] }) }));
    expect(mounts(args)).toContain("/data/shared:/mnt/shared:ro");
  });

  it("adds a writable mount when writable is true", () => {
    const args = build(makeOpts({ sandboxConfig: makeDockerProfile({ image: "img", mounts: [
      { hostPath: "/data/shared", guestPath: "/mnt/shared", writable: true },
    ] }) }));
    expect(mounts(args)).toContain("/data/shared:/mnt/shared");
    expect(mounts(args)).not.toContain("/data/shared:/mnt/shared:ro");
  });

  it("defaults to read-only when writable is omitted", () => {
    const args = build(makeOpts({ sandboxConfig: makeDockerProfile({ image: "img", mounts: [
      { hostPath: "/data/shared", guestPath: "/mnt/shared" },
    ] }) }));
    expect(mounts(args)).toContain("/data/shared:/mnt/shared:ro");
  });

  it("uses hostPath as guestPath when guestPath is omitted", () => {
    const args = build(makeOpts({ sandboxConfig: makeDockerProfile({ image: "img", mounts: [
      { hostPath: "/data/shared" },
    ] }) }));
    expect(mounts(args)).toContain("/data/shared:/data/shared:ro");
  });

  it("expands ~ to the home directory", () => {
    const args = build(makeOpts({ sandboxConfig: makeDockerProfile({ image: "img", mounts: [
      { hostPath: "~/projects", guestPath: "/root/projects" },
    ] }) }));
    expect(mounts(args)).toContain(`${HOME}/projects:/root/projects:ro`);
  });

  it("skips mounts with non-absolute paths after ~ expansion", () => {
    const args = build(makeOpts({ sandboxConfig: makeDockerProfile({ image: "img", mounts: [
      { hostPath: "relative/path", guestPath: "/mnt/data" },
    ] }) }));
    expect(mounts(args).join("\n")).not.toContain("/mnt/data");
  });

  it("includes multiple extra mounts in order", () => {
    const args = build(makeOpts({ sandboxConfig: makeDockerProfile({ image: "img", mounts: [
      { hostPath: "/data/a", guestPath: "/mnt/a", writable: true },
      { hostPath: "/data/b", guestPath: "/mnt/b" },
    ] }) }));
    const m = mounts(args);
    expect(m).toContain("/data/a:/mnt/a");
    expect(m).toContain("/data/b:/mnt/b:ro");
  });
});

// ---------------------------------------------------------------------------
// Networking
// ---------------------------------------------------------------------------

describe("buildDockerRunArgs — networking", () => {
  it("runs the container on the host network", () => {
    const args = build(makeOpts());
    const idx = args.indexOf("--network");
    expect(idx).toBeGreaterThan(-1);
    expect(args[idx + 1]).toBe("host");
  });

  it("publishes no ports, even when the runtime env carries port values", () => {
    const args = build(makeOpts({ runtimeEnv: { PORT: "3000", FRONTEND_PORT: "3001" } }));
    expect(ports(args)).toHaveLength(0);
  });

  it("does not add a host.docker.internal mapping", () => {
    expect(build(makeOpts())).not.toContain("--add-host");
  });
});

// ---------------------------------------------------------------------------
// In-container webmux CLI
// ---------------------------------------------------------------------------

describe("buildDockerRunArgs — webmux CLI", () => {
  const CLI: WebmuxCliMounts = {
    entryPath: "/opt/pkg/webmux/bin/webmux.js",
    wrapperPath: `${HOME}/.webmux/docker/webmux`,
    instancesDir: `${HOME}/.webmux/instances`,
  };

  it("mounts the CLI bundle, the PATH wrapper and the instance registry read-only", () => {
    const m = mounts(build(makeOpts(), NO_CREDENTIALS, CLI));
    expect(m).toContain("/opt/pkg/webmux/bin/webmux.js:/opt/webmux/webmux.js:ro");
    expect(m).toContain(`${HOME}/.webmux/docker/webmux:/usr/local/bin/webmux:ro`);
    expect(m).toContain(`${HOME}/.webmux/instances:/home/webmux/.webmux/instances:ro`);
  });

  it("adds no CLI mounts when there is no bundle to mount", () => {
    const m = mounts(build(makeOpts()));
    expect(m.some((v) => v.includes("/opt/webmux/webmux.js") || v.includes("/usr/local/bin/webmux") || v.includes(".webmux/instances"))).toBe(false);
  });

  it("wrapper runs the mounted bundle with bun and skips host PID checks", () => {
    const wrapper = buildWebmuxCliWrapper();
    expect(wrapper.startsWith("#!/bin/sh\n")).toBe(true);
    expect(wrapper).toContain('WEBMUX_SKIP_INSTANCE_PID_CHECK=1 exec bun /opt/webmux/webmux.js "$@"');
  });
});

// ---------------------------------------------------------------------------
// Reserved env var protection
// ---------------------------------------------------------------------------

describe("buildDockerRunArgs — reserved env vars", () => {
  it("HOME from runtime env does not override the sandbox HOME", () => {
    const args = build(makeOpts({ runtimeEnv: { HOME: "/attacker" } }));
    const flags = envFlags(args);
    expect(flags).toContain("HOME=/home/webmux");
    expect(flags).not.toContain("HOME=/attacker");
  });

  it("IS_SANDBOX from runtime env is silently dropped", () => {
    const args = build(makeOpts({ runtimeEnv: { IS_SANDBOX: "0" } }));
    const flags = envFlags(args);
    expect(flags).toContain("IS_SANDBOX=1");
    expect(flags.filter(f => f.startsWith("IS_SANDBOX="))).toHaveLength(1);
  });

  it("does not inject legacy workmux rpc env vars", () => {
    const flags = envFlags(build(makeOpts()));
    expect(flags.some((flag) => flag.startsWith("WORKMUX_RPC_"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Git credentials
// ---------------------------------------------------------------------------

/** Map GIT_CONFIG_KEY_n/VALUE_n env flags back to ordered [key, value] pairs. */
function gitConfigPairs(args: string[]): Array<[string, string]> {
  const flags = envFlags(args);
  const get = (k: string): string | undefined => flags.find((f) => f.startsWith(`${k}=`))?.slice(k.length + 1);
  const count = Number(get("GIT_CONFIG_COUNT"));
  return Array.from({ length: count }, (_, i): [string, string] => [get(`GIT_CONFIG_KEY_${i}`)!, get(`GIT_CONFIG_VALUE_${i}`)!]);
}

describe("buildDockerRunArgs — git credentials", () => {
  const WITH_TOKEN: SandboxCredentials = {
    ghToken: "ghp_secret",
    gitIdentity: { name: "Ada Lovelace", email: "ada@example.com" },
    sshAuthSock: null,
  };

  it("always sets safe.directory and push.autoSetupRemote", () => {
    expect(gitConfigPairs(build(makeOpts()))).toEqual([
      ["safe.directory", "/repos/my-branch"],
      ["safe.directory", "/repos/main"],
      ["push.autoSetupRemote", "true"],
    ]);
  });

  it("without a token: no GH_TOKEN, no credential helper, no insteadOf", () => {
    const args = build(makeOpts());
    expect(envFlags(args).some((f) => f.startsWith("GH_TOKEN="))).toBe(false);
    expect(gitConfigPairs(args).some(([k]) => k.startsWith("credential.") || k.startsWith("url."))).toBe(false);
  });

  it("with a token: passes GH_TOKEN, resets then sets the github.com helper, rewrites SSH remotes", () => {
    const args = build(makeOpts(), WITH_TOKEN);
    expect(envFlags(args)).toContain("GH_TOKEN=ghp_secret");
    const pairs = gitConfigPairs(args);
    const helpers = pairs.filter(([k]) => k === "credential.https://github.com.helper").map(([, v]) => v);
    expect(helpers[0]).toBe("");
    expect(helpers[1]).toContain('echo "password=$GH_TOKEN"');
    expect(helpers[1]).toContain("username=x-access-token");
    expect(pairs.filter(([k]) => k === "url.https://github.com/.insteadOf").map(([, v]) => v))
      .toEqual(["git@github.com:", "ssh://git@github.com/"]);
  });

  it("the helper itself never embeds the token", () => {
    const pairs = buildSandboxGitConfig("/wt", "/repo", WITH_TOKEN);
    expect(pairs.some(([, v]) => v.includes("ghp_secret"))).toBe(false);
  });

  it("passes the host git identity as author and committer", () => {
    const flags = envFlags(build(makeOpts(), WITH_TOKEN));
    expect(flags).toContain("GIT_AUTHOR_NAME=Ada Lovelace");
    expect(flags).toContain("GIT_AUTHOR_EMAIL=ada@example.com");
    expect(flags).toContain("GIT_COMMITTER_NAME=Ada Lovelace");
    expect(flags).toContain("GIT_COMMITTER_EMAIL=ada@example.com");
  });

  it("runtime env and envPassthrough cannot override GIT_CONFIG_*, GH_TOKEN or the identity", () => {
    const args = build(
      makeOpts({
        runtimeEnv: { GIT_CONFIG_KEY_7: "core.fsmonitor", GIT_CONFIG_COUNT: "9", GH_TOKEN: "evil" },
        sandboxConfig: makeDockerProfile({ envPassthrough: ["GIT_AUTHOR_NAME", "GIT_CONFIG_VALUE_3"] }),
      }),
      WITH_TOKEN,
      null,
      { GIT_AUTHOR_NAME: "Mallory", GIT_CONFIG_VALUE_3: "x" },
    );
    const flags = envFlags(args);
    expect(flags).not.toContain("GIT_CONFIG_KEY_7=core.fsmonitor");
    expect(flags.filter((f) => f.startsWith("GIT_CONFIG_COUNT="))).toEqual(["GIT_CONFIG_COUNT=7"]);
    expect(flags).not.toContain("GH_TOKEN=evil");
    expect(flags).not.toContain("GIT_AUTHOR_NAME=Mallory");
    expect(flags).not.toContain("GIT_CONFIG_VALUE_3=x");
  });

  it("no longer mounts ~/.gitconfig, ~/.ssh or ~/.config/gh", () => {
    const m = mounts(build(makeOpts(), WITH_TOKEN));
    expect(m.some((v) => v.includes(".gitconfig") || v.includes("/.ssh") || v.includes(".config/gh"))).toBe(false);
  });
});

describe("buildDockerRunArgs — git hardening", () => {
  it("mounts .git/hooks and .git/config read-only over the writable .git", () => {
    const m = mounts(build(makeOpts()));
    const gitIdx = m.indexOf("/repos/main/.git:/repos/main/.git");
    expect(gitIdx).toBeGreaterThan(-1);
    expect(m.indexOf("/repos/main/.git/hooks:/repos/main/.git/hooks:ro")).toBeGreaterThan(gitIdx);
    expect(m.indexOf("/repos/main/.git/config:/repos/main/.git/config:ro")).toBeGreaterThan(gitIdx);
  });
});

// ---------------------------------------------------------------------------
// SSH agent forwarding
// ---------------------------------------------------------------------------

describe("buildDockerRunArgs — SSH agent forwarding", () => {
  const withSock = (sshAuthSock: string): SandboxCredentials => ({ ...NO_CREDENTIALS, sshAuthSock });

  it("mounts the Linux host socket via --mount and sets SSH_AUTH_SOCK", () => {
    const sock = "/run/user/1000/keyring/ssh";
    const args = build(makeOpts(), withSock(sock));
    expect(args).toContain(`type=bind,source=${sock},target=${sock}`);
    expect(envFlags(args)).toContain(`SSH_AUTH_SOCK=${sock}`);
  });

  it("mounts Docker Desktop's forwarded socket on macOS", () => {
    const sock = "/run/host-services/ssh-auth.sock";
    const args = build(makeOpts(), withSock(sock));
    expect(args).toContain(`type=bind,source=${sock},target=${sock}`);
    expect(envFlags(args)).toContain(`SSH_AUTH_SOCK=${sock}`);
  });

  it("does nothing when there is no socket", () => {
    const args = build(makeOpts());
    expect(args.includes("--mount")).toBe(false);
    expect(envFlags(args).join("\n")).not.toContain("SSH_AUTH_SOCK");
  });

  it("SSH_AUTH_SOCK from envPassthrough is blocked by reservedKeys", () => {
    const args = build(makeOpts({ sandboxConfig: makeDockerProfile({ image: "img", envPassthrough: ["SSH_AUTH_SOCK"] }) }), NO_CREDENTIALS, null, { SSH_AUTH_SOCK: "/x" });
    expect(envFlags(args).filter(f => f.startsWith("SSH_AUTH_SOCK="))).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Opt-in integration: run the generated entrypoint in real containers. Skipped
// unless docker is reachable and the (small) test images are already present.
// ---------------------------------------------------------------------------

function dockerImagePresent(image: string): boolean {
  try {
    return Bun.spawnSync(["docker", "image", "inspect", image], { stdout: "ignore", stderr: "ignore" }).exitCode === 0;
  } catch {
    return false;
  }
}

for (const image of ["busybox:latest", "alpine:3.20", "debian:bookworm-slim"]) {
  describe.skipIf(!dockerImagePresent(image))(`sandbox entrypoint on ${image}`, () => {
    it("creates the host-UID user, a writable home, and leaves root-owned mounts alone", async () => {
      const dir = await mkdtemp(join(tmpdir(), "webmux-entrypoint-"));
      const entrypointPath = join(dir, "entrypoint.sh");
      await writeFile(entrypointPath, buildSandboxEntrypoint());
      await chmod(entrypointPath, 0o755);
      const name = `wm-entrypoint-test-${Date.now()}`;
      const uid = 4242;
      const gid = 4343;
      try {
        const run = Bun.spawnSync([
          "docker", "run", "-d", "--name", name, "--user", "0:0",
          "--entrypoint", "/opt/webmux/entrypoint.sh",
          "-v", `${entrypointPath}:/opt/webmux/entrypoint.sh:ro`,
          "-v", "/etc:/home/webmux/.config/hostetc:ro",
          "-e", `WEBMUX_UID=${uid}`, "-e", `WEBMUX_GID=${gid}`,
          image,
        ]);
        expect(run.exitCode).toBe(0);
        let ready = false;
        for (let i = 0; i < 50 && !ready; i++) {
          ready = Bun.spawnSync(["docker", "exec", name, "test", "-f", "/opt/webmux/.ready"]).exitCode === 0;
          if (!ready) await Bun.sleep(100);
        }
        expect(ready).toBe(true);
        const probe = Bun.spawnSync([
          "docker", "exec", "-u", `${uid}:${gid}`, "-e", "HOME=/home/webmux", name, "sh", "-c",
          "id -u; id -g; touch $HOME/probe && echo writable; stat -c %u $HOME/.config $HOME/.config/hostetc",
        ]);
        expect(probe.stdout.toString().trim().split("\n")).toEqual([
          String(uid), String(gid), "writable", String(uid), "0",
        ]);
      } finally {
        Bun.spawnSync(["docker", "rm", "-f", name], { stdout: "ignore", stderr: "ignore" });
        await rm(dir, { recursive: true, force: true });
      }
    }, 20_000);
  });
}
