import { describe, expect, it } from "bun:test";
import {
  buildDockerRunArgs,
  buildSandboxEntrypoint,
  buildWebmuxCliWrapper,
  type LaunchContainerOpts,
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
function build(
  opts: LaunchContainerOpts,
  existingPaths = new Set<string>(),
  sshAuthSock?: string,
  webmuxCli: WebmuxCliMounts | null = null,
): string[] {
  return buildDockerRunArgs(opts, {
    name: "wm-test-123",
    home: HOME,
    user: { uid: UID, gid: GID },
    image: opts.sandboxConfig.image,
    entrypointPath: ENTRYPOINT,
    existingPaths,
    sshAuthSock,
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
  it("starts as root with the injected entrypoint instead of --user", () => {
    const args = build(makeOpts());
    expect(args).not.toContain("--user");
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
// extraMounts conflict resolution: config wins over credential defaults
// ---------------------------------------------------------------------------

describe("buildDockerRunArgs — extraMounts override credential mounts", () => {
  it("config ~/.ssh writable overrides the default read-only credential mount", () => {
    const existingPaths = new Set([`${HOME}/.ssh`]);
    const args = build(
      makeOpts({ sandboxConfig: makeDockerProfile({ image: "img", mounts: [
        { hostPath: "~/.ssh", guestPath: "/home/webmux/.ssh", writable: true },
      ] }) }),
      existingPaths,
    );
    const m = mounts(args);
    expect(m).toContain(`${HOME}/.ssh:/home/webmux/.ssh`);
    expect(m).not.toContain(`${HOME}/.ssh:/home/webmux/.ssh:ro`);
  });

  it("config ~/.ssh read-only still suppresses the credential mount (config controls it)", () => {
    const existingPaths = new Set([`${HOME}/.ssh`]);
    const args = build(
      makeOpts({ sandboxConfig: makeDockerProfile({ image: "img", mounts: [
        { hostPath: "~/.ssh", guestPath: "/home/webmux/.ssh", writable: false },
      ] }) }),
      existingPaths,
    );
    const m = mounts(args);
    const sshMounts = m.filter(v => v.includes("/home/webmux/.ssh"));
    expect(sshMounts).toHaveLength(1);
    expect(sshMounts[0]).toBe(`${HOME}/.ssh:/home/webmux/.ssh:ro`);
  });

  it("config ~/.gitconfig override does not affect unrelated credential mounts", () => {
    const existingPaths = new Set([`${HOME}/.gitconfig`, `${HOME}/.ssh`]);
    const args = build(
      makeOpts({ sandboxConfig: makeDockerProfile({ image: "img", mounts: [
        { hostPath: "~/.gitconfig", guestPath: "/home/webmux/.gitconfig", writable: true },
      ] }) }),
      existingPaths,
    );
    const m = mounts(args);
    expect(m).toContain(`${HOME}/.gitconfig:/home/webmux/.gitconfig`);
    expect(m).not.toContain(`${HOME}/.gitconfig:/home/webmux/.gitconfig:ro`);
    expect(m).toContain(`${HOME}/.ssh:/home/webmux/.ssh:ro`);
  });

  it("credential mounts are included normally when there are no extraMounts", () => {
    const existingPaths = new Set([`${HOME}/.gitconfig`, `${HOME}/.ssh`]);
    const args = build(makeOpts(), existingPaths);
    const m = mounts(args);
    expect(m).toContain(`${HOME}/.gitconfig:/home/webmux/.gitconfig:ro`);
    expect(m).toContain(`${HOME}/.ssh:/home/webmux/.ssh:ro`);
  });

  it("credential mounts are omitted for paths that do not exist on the host", () => {
    const args = build(makeOpts());
    const m = mounts(args);
    expect(m).not.toContain(`${HOME}/.gitconfig:/home/webmux/.gitconfig:ro`);
    expect(m).not.toContain(`${HOME}/.ssh:/home/webmux/.ssh:ro`);
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
    const m = mounts(build(makeOpts(), new Set(), undefined, CLI));
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
// SSH agent forwarding
// ---------------------------------------------------------------------------

describe("buildDockerRunArgs — SSH agent forwarding", () => {
  const SOCK = "/run/user/1000/keyring/ssh";

  it("mounts the socket via --mount and sets SSH_AUTH_SOCK when present", () => {
    const args = build(makeOpts(), new Set([SOCK]), SOCK);
    expect(args).toContain(`type=bind,source=${SOCK},target=${SOCK}`);
    expect(envFlags(args)).toContain(`SSH_AUTH_SOCK=${SOCK}`);
  });

  it("does nothing when sshAuthSock is undefined", () => {
    const args = build(makeOpts(), new Set(), undefined);
    expect(mounts(args).join("\n")).not.toContain("SSH_AUTH_SOCK");
    expect(envFlags(args).join("\n")).not.toContain("SSH_AUTH_SOCK");
  });

  it("does nothing when socket path is not in existingPaths", () => {
    const args = build(makeOpts(), new Set(), SOCK);
    expect(mounts(args).join("\n")).not.toContain(SOCK);
    expect(envFlags(args).join("\n")).not.toContain("SSH_AUTH_SOCK");
  });

  it("SSH_AUTH_SOCK from envPassthrough is blocked by reservedKeys", () => {
    const args = build(makeOpts({ sandboxConfig: makeDockerProfile({ image: "img", envPassthrough: ["SSH_AUTH_SOCK"] }) }));
    expect(envFlags(args).filter(f => f.startsWith("SSH_AUTH_SOCK="))).toHaveLength(0);
  });
});
