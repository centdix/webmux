import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BunGitGateway, type GitGateway, type TryGitCommandResult, type UnpushedCommit } from "../adapters/git";
import type { TmuxGateway } from "../adapters/tmux";
import {
  buildRuntimeEnvMap,
  getWorktreeStoragePaths,
  loadDotenvLocal,
  parseDotenv,
  readWorktreePrs,
  readWorktreeMeta,
  renderEnvFile,
  writeWorktreePrs,
  writeWorktreeMeta,
} from "../adapters/fs";
import type { WorktreeMeta } from "../domain/model";
import { createManagedWorktree, initializeManagedWorktree } from "../services/worktree-service";

function run(args: string[], cwd: string): string {
  const result = Bun.spawnSync(args, { cwd, stdout: "pipe", stderr: "pipe" });
  if (result.exitCode !== 0) {
    const stderr = new TextDecoder().decode(result.stderr).trim();
    throw new Error(`${args.join(" ")} failed: ${stderr || `exit ${result.exitCode}`}`);
  }

  return new TextDecoder().decode(result.stdout).trim();
}

class FakeGitGateway implements GitGateway {
  constructor(
    private readonly gitDir: string,
    private readonly calls: string[],
    private readonly fetchResult: TryGitCommandResult = { ok: true, stdout: "" },
  ) {}

  resolveRepoRoot(dir: string): string | null {
    this.calls.push(`resolveRepoRoot:${dir}`);
    return dir;
  }

  resolveWorktreeRoot(cwd: string): string {
    this.calls.push(`resolveWorktreeRoot:${cwd}`);
    return cwd;
  }

  resolveWorktreeGitDir(cwd: string): string {
    this.calls.push(`resolveWorktreeGitDir:${cwd}`);
    return this.gitDir;
  }

  listWorktrees() {
    return [];
  }

  listLiveWorktrees() {
    return [];
  }

  listLocalBranches(): string[] {
    return [];
  }

  listRemoteBranches(): string[] {
    return [];
  }

  readWorktreeStatus() {
    return {
      dirty: false,
      aheadCount: 0,
      currentCommit: null,
    };
  }

  readStatus(): string {
    return "";
  }

  createWorktree(opts: {
    repoRoot: string;
    worktreePath: string;
    branch: string;
    mode: "new" | "existing";
    baseBranch?: string;
    startPoint?: string;
  }): void {
    this.calls.push(
      `createWorktree:${opts.repoRoot}:${opts.worktreePath}:${opts.branch}:${opts.mode}:${opts.baseBranch ?? ""}:${opts.startPoint ?? ""}`,
    );
  }

  removeWorktree(): void {
    this.calls.push("removeWorktree");
  }

  deleteBranch(): void {
    this.calls.push("deleteBranch");
  }

  mergeBranch(): void {
    this.calls.push("mergeBranch");
  }

  currentBranch(): string {
    return "main";
  }

  readDiff(): string {
    return "";
  }

  listUnpushedCommits(): UnpushedCommit[] {
    return [];
  }

  fetchBranch(_repoRoot: string, remote: string, branch: string): TryGitCommandResult {
    this.calls.push(`fetchBranch:${remote}:${branch}`);
    return this.fetchResult;
  }

  fastForwardMerge(_repoRoot: string, _ref: string): TryGitCommandResult {
    return { ok: true, stdout: "" };
  }

  hardReset(_repoRoot: string, _ref: string): TryGitCommandResult {
    return { ok: true, stdout: "" };
  }
}

class FakeTmuxGateway implements TmuxGateway {
  createWindowError: Error | null = null;

  constructor(private readonly calls: string[]) {}

  getPaneId(_target: string): string {
    return "%0";
  }

  createParkedPane(_opts: {
    sessionName: string;
    parkingWindow: string;
    cwd: string;
    command: string;
    worktreeId: string;
  }): string {
    return "%99";
  }

  swapPanes(_source: string, _destination: string): void {}

  killPane(_target: string): void {}

  ensureServer(): void {
    this.calls.push("ensureServer");
  }

  ensureSession(sessionName: string, cwd: string): void {
    this.calls.push(`ensureSession:${sessionName}:${cwd}`);
  }

  hasWindow(sessionName: string, windowName: string): boolean {
    this.calls.push(`hasWindow:${sessionName}:${windowName}`);
    return false;
  }

  killWindow(sessionName: string, windowName: string): void {
    this.calls.push(`killWindow:${sessionName}:${windowName}`);
  }

  renameWindow(sessionName: string, windowName: string, newName: string): void {
    this.calls.push(`renameWindow:${sessionName}:${windowName}:${newName}`);
  }

  createWindow(opts: { sessionName: string; windowName: string; cwd: string; command?: string }): void {
    this.calls.push(`createWindow:${opts.sessionName}:${opts.windowName}:${opts.cwd}:${opts.command ?? ""}`);
    if (this.createWindowError) throw this.createWindowError;
  }

  splitWindow(opts: {
    target: string;
    split: "right" | "bottom";
    sizePct?: number;
    cwd: string;
    command?: string;
  }): void {
    this.calls.push(`splitWindow:${opts.target}:${opts.split}:${opts.sizePct ?? ""}:${opts.cwd}:${opts.command ?? ""}`);
  }

  setPaneOption(target: string, option: string, value: string): void {
    this.calls.push(`setPaneOption:${target}:${option}:${value}`);
  }

  setWindowOption(sessionName: string, windowName: string, option: string, value: string): void {
    this.calls.push(`setWindowOption:${sessionName}:${windowName}:${option}:${value}`);
  }

  runCommand(target: string, command: string): void {
    this.calls.push(`runCommand:${target}:${command}`);
  }

  selectPane(target: string): void {
    this.calls.push(`selectPane:${target}`);
  }

  listWindows() {
    return [];
  }
}

function makeMeta(): WorktreeMeta {
  return {
    schemaVersion: 1,
    worktreeId: "wt_test",
    branch: "feature/search-panel",
    baseBranch: "main",
    createdAt: "2026-03-06T00:00:00.000Z",
    profile: "default",
    agent: "claude",
    runtime: "host",
    startupEnvValues: {
      NODE_ENV: "development",
    },
  };
}

describe("renderEnvFile", () => {
  it("sorts keys and quotes unsafe values", () => {
    const rendered = renderEnvFile({
      Z_LAST: "two words",
      A_FIRST: "simple",
      EMPTY: "",
    });

    expect(rendered).toBe([
      "A_FIRST=simple",
      "EMPTY=''",
      "Z_LAST='two words'",
      "",
    ].join("\n"));
  });
});

describe("parseDotenv", () => {
  it("parses key=value pairs, ignoring comments and blank lines", () => {
    const content = [
      "# database config",
      "DB_HOST=localhost",
      "DB_PORT=5432",
      "",
      "  # another comment",
      "SECRET_KEY='my secret'",
      'API_URL="https://example.com"',
    ].join("\n");

    expect(parseDotenv(content)).toEqual({
      DB_HOST: "localhost",
      DB_PORT: "5432",
      SECRET_KEY: "my secret",
      API_URL: "https://example.com",
    });
  });

  it("handles values containing equals signs", () => {
    expect(parseDotenv("CONN=host=localhost;port=5432")).toEqual({
      CONN: "host=localhost;port=5432",
    });
  });

  it("returns empty object for empty content", () => {
    expect(parseDotenv("")).toEqual({});
    expect(parseDotenv("# just a comment")).toEqual({});
  });

  it("handles export prefix", () => {
    expect(parseDotenv("export FOO=bar\nexport BAZ='hello world'")).toEqual({
      FOO: "bar",
      BAZ: "hello world",
    });
  });

  it("trims trailing whitespace on unquoted values", () => {
    expect(parseDotenv("KEY=value   ")).toEqual({ KEY: "value" });
  });

  it("preserves a lone quote character as-is", () => {
    expect(parseDotenv('KEY="')).toEqual({ KEY: '"' });
    expect(parseDotenv("KEY='")).toEqual({ KEY: "'" });
  });
});

describe("loadDotenvLocal", () => {
  it("returns empty object when .env.local does not exist", async () => {
    const env = await loadDotenvLocal("/nonexistent/path");
    expect(env).toEqual({});
  });

  it("loads and parses .env.local from worktree path", async () => {
    const dir = await mkdtemp(join(tmpdir(), "webmux-dotenv-"));
    try {
      await Bun.write(join(dir, ".env.local"), "FOO=bar\nBAZ=qux\n");
      const env = await loadDotenvLocal(dir);
      expect(env).toEqual({ FOO: "bar", BAZ: "qux" });
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe("worktree env maps", () => {
  it("builds runtime env with metadata-derived WEBMUX fields", () => {
    const env = buildRuntimeEnvMap(makeMeta(), {
      WEBMUX_BRANCH: "override-me",
      WEBMUX_WORKTREE_PATH: "/tmp/worktree",
    });

    expect(env.NODE_ENV).toBe("development");
    expect(env.WEBMUX_WORKTREE_PATH).toBe("/tmp/worktree");
    expect(env.WEBMUX_BRANCH).toBe("feature/search-panel");
    expect(env.WEBMUX_PROFILE).toBe("default");
  });

  it("includes dotenv values at lowest priority", () => {
    const dotenv = {
      NODE_ENV: "production",
      CUSTOM_VAR: "from-dotenv",
    };
    const env = buildRuntimeEnvMap(makeMeta(), {
      WEBMUX_WORKTREE_PATH: "/tmp/worktree",
    }, dotenv);

    expect(env.CUSTOM_VAR).toBe("from-dotenv");
    expect(env.NODE_ENV).toBe("development");
  });

});

describe("initializeManagedWorktree", () => {
  let repoRoot = "";
  let gitDir = "";
  let worktreePath = "";

  afterEach(async () => {
    if (repoRoot) {
      await rm(repoRoot, { recursive: true, force: true });
      repoRoot = "";
    }
    if (gitDir) {
      await rm(gitDir, { recursive: true, force: true });
      gitDir = "";
    }
    if (worktreePath) {
      await rm(worktreePath, { recursive: true, force: true });
      worktreePath = "";
    }
  });

  it("writes metadata and env files into the worktree git admin dir", async () => {
    gitDir = await mkdtemp(join(tmpdir(), "webmux-gitdir-"));
    worktreePath = await mkdtemp(join(tmpdir(), "webmux-worktree-"));

    const result = await initializeManagedWorktree({
      gitDir,
      branch: "feature/search-panel",
      baseBranch: "main",
      profile: "default",
      agent: "claude",
      runtime: "host",
      startupEnvValues: { NODE_ENV: "development" },
      runtimeEnvExtras: { WEBMUX_WORKTREE_PATH: worktreePath },
      controlUrl: "http://127.0.0.1:5111",
      controlToken: "secret-token",
      worktreeId: "wt_test",
      now: () => new Date("2026-03-06T00:00:00.000Z"),
    });

    const paths = getWorktreeStoragePaths(gitDir);
    const meta = await readWorktreeMeta(gitDir);
    const runtimeEnvText = await Bun.file(paths.runtimeEnvPath).text();
    const controlEnvText = await Bun.file(paths.controlEnvPath).text();

    expect(result.paths).toEqual(paths);
    expect(meta).not.toBeNull();
    expect(meta?.worktreeId).toBe("wt_test");
    expect(meta?.baseBranch).toBe("main");

    expect(runtimeEnvText).toContain("NODE_ENV=development");
    expect(runtimeEnvText).toContain("WEBMUX_BRANCH=feature/search-panel");
    expect(runtimeEnvText).toContain(`WEBMUX_WORKTREE_PATH=${worktreePath}`);

    expect(controlEnvText).toContain("WEBMUX_CONTROL_TOKEN=secret-token");
    expect(controlEnvText).toContain("WEBMUX_CONTROL_URL=http://127.0.0.1:5111");
    expect(paths.prsPath).toBe(`${paths.webmuxDir}/prs.json`);
  });

  it("normalizes legacy codex conversation metadata when reading", async () => {
    gitDir = await mkdtemp(join(tmpdir(), "webmux-meta-normalize-"));

    const paths = getWorktreeStoragePaths(gitDir);
    await mkdir(paths.webmuxDir, { recursive: true });
    await Bun.write(paths.metaPath, JSON.stringify({
      ...makeMeta(),
      conversation: {
        provider: "codexAppServer",
        threadId: "thread-legacy",
        cwd: "/repo/__worktrees/feature-search",
        lastSeenAt: "2026-04-14T10:00:00.000Z",
      },
    }, null, 2));

    expect(await readWorktreeMeta(gitDir)).toEqual({
      ...makeMeta(),
      conversation: {
        provider: "codexAppServer",
        conversationId: "thread-legacy",
        threadId: "thread-legacy",
        cwd: "/repo/__worktrees/feature-search",
        lastSeenAt: "2026-04-14T10:00:00.000Z",
      },
      tabs: [
        {
          tabId: "root",
          kind: "root",
          label: "Root",
          seq: null,
          sessionId: "thread-legacy",
          createdAt: "2026-03-06T00:00:00.000Z",
        },
      ],
      activeTabId: "root",
      forkCounter: 0,
    });
  });

  it("loads old metadata that still carries allocatedPorts and drops the key", async () => {
    gitDir = await mkdtemp(join(tmpdir(), "webmux-meta-ports-"));

    const paths = getWorktreeStoragePaths(gitDir);
    await mkdir(paths.webmuxDir, { recursive: true });
    await Bun.write(paths.metaPath, JSON.stringify({
      ...makeMeta(),
      allocatedPorts: { FRONTEND_PORT: 3010, PORT: 5111 },
    }, null, 2));

    const meta = await readWorktreeMeta(gitDir);
    expect(meta?.worktreeId).toBe("wt_test");
    expect(meta).not.toHaveProperty("allocatedPorts");
  });

  it("normalizes blank labels out of worktree metadata", async () => {
    gitDir = await mkdtemp(join(tmpdir(), "webmux-meta-label-"));

    await writeWorktreeMeta(gitDir, {
      ...makeMeta(),
      label: "   ",
    });

    expect((await readWorktreeMeta(gitDir))?.label).toBeUndefined();
  });

  it("round-trips PR storage through the worktree webmux dir", async () => {
    gitDir = await mkdtemp(join(tmpdir(), "webmux-prs-gitdir-"));

    await writeWorktreePrs(gitDir, [
      {
        repo: "org/repo",
        number: 77,
        state: "open",
        isDraft: false,
        url: "https://github.com/org/repo/pull/77",
        updatedAt: "2026-03-06T00:00:00.000Z",
        ciStatus: "pending",
        ciChecks: [
          {
            name: "build",
            status: "pending",
            url: "https://github.com/org/repo/actions/runs/123",
            runId: 123,
          },
        ],
        comments: [],
      },
    ]);

    expect(await readWorktreePrs(gitDir)).toEqual([
      {
        repo: "org/repo",
        number: 77,
        state: "open",
        isDraft: false,
        url: "https://github.com/org/repo/pull/77",
        updatedAt: "2026-03-06T00:00:00.000Z",
        ciStatus: "pending",
        ciChecks: [
          {
            name: "build",
            status: "pending",
            url: "https://github.com/org/repo/actions/runs/123",
            runId: 123,
          },
        ],
        comments: [],
      },
    ]);
  });

  it("defaults isDraft to false for PR entries stored before draft tracking", async () => {
    gitDir = await mkdtemp(join(tmpdir(), "webmux-prs-legacy-"));
    const { webmuxDir, prsPath } = getWorktreeStoragePaths(gitDir);
    await mkdir(webmuxDir, { recursive: true });
    await Bun.write(
      prsPath,
      JSON.stringify([
        {
          repo: "org/repo",
          number: 77,
          state: "open",
          url: "https://github.com/org/repo/pull/77",
          updatedAt: "2026-03-06T00:00:00.000Z",
          ciStatus: "pending",
          ciChecks: [],
          comments: [],
        },
      ]),
    );

    const entries = await readWorktreePrs(gitDir);
    expect(entries).toHaveLength(1);
    expect(entries[0].isDraft).toBe(false);
  });

  it("can create a managed worktree and realize a tmux layout through gateways", async () => {
    gitDir = await mkdtemp(join(tmpdir(), "webmux-create-gitdir-"));
    worktreePath = await mkdtemp(join(tmpdir(), "webmux-create-worktree-"));
    await rm(worktreePath, { recursive: true, force: true });
    await mkdir(worktreePath, { recursive: true });

    const calls: string[] = [];
    const git = new FakeGitGateway(gitDir, calls);
    const tmux = new FakeTmuxGateway(calls);

    await createManagedWorktree(
      {
        repoRoot: "/repo/project",
        worktreePath,
        branch: "feature/search-panel",
        mode: "new",
        baseBranch: "main",
        profile: "default",
        agent: "claude",
        runtime: "host",
        startupEnvValues: { NODE_ENV: "development" },
        controlUrl: "http://127.0.0.1:5111",
        controlToken: "secret-token",
        worktreeId: "wt_test",
        now: () => new Date("2026-03-06T00:00:00.000Z"),
        sessionLayoutPlan: {
          sessionName: "wm-project-12345678",
          windowName: "wm-feature/search-panel",
          worktreeId: "wt_test",
          shellCommand: "shell-cmd",
          focusPaneIndex: 0,
          panes: [
            {
              id: "agent",
              index: 0,
              kind: "agent",
              cwd: worktreePath,
              startupCommand: "agent-cmd",
              focus: true,
            },
          ],
        },
      },
      { git, tmux },
    );

    expect(calls[0]).toBe("fetchBranch:origin:main");
    expect(calls[1]).toBe(`createWorktree:/repo/project:${worktreePath}:feature/search-panel:new:origin/main:`);
    expect(calls).toContain("ensureServer");
    expect(calls.some((call) => call.startsWith("createWindow:wm-project-12345678:wm-feature/search-panel"))).toBe(true);

    const meta = await readWorktreeMeta(gitDir);
    expect(meta?.branch).toBe("feature/search-panel");
    expect(meta?.baseBranch).toBe("main");
  });

  it("starts new worktrees from the freshly fetched origin base, not the stale local one", async () => {
    const originRoot = await mkdtemp(join(tmpdir(), "webmux-create-origin-"));
    run(["git", "init", "-b", "main"], originRoot);
    run(["git", "config", "user.name", "Test User"], originRoot);
    run(["git", "config", "user.email", "test@example.com"], originRoot);
    await Bun.write(join(originRoot, "README.md"), "# repo\n");
    run(["git", "add", "README.md"], originRoot);
    run(["git", "commit", "-m", "init"], originRoot);

    repoRoot = await mkdtemp(join(tmpdir(), "webmux-create-stale-"));
    run(["git", "clone", originRoot, repoRoot], tmpdir());

    await Bun.write(join(originRoot, "LATEST.md"), "latest\n");
    run(["git", "add", "LATEST.md"], originRoot);
    run(["git", "commit", "-m", "latest"], originRoot);

    await mkdir(join(repoRoot, "__worktrees"), { recursive: true });
    worktreePath = join(repoRoot, "__worktrees", "feature-fresh");

    try {
      const created = await createManagedWorktree(
        {
          repoRoot,
          worktreePath,
          branch: "feature-fresh",
          mode: "new",
          baseBranch: "main",
          profile: "default",
          agent: "claude",
          runtime: "host",
        },
        { git: new BunGitGateway() },
      );

      expect(await Bun.file(join(worktreePath, "LATEST.md")).exists()).toBe(true);
      expect(Bun.spawnSync(["git", "config", "--get", "branch.feature-fresh.merge"], { cwd: repoRoot }).exitCode).toBe(1);
      expect(created.meta.baseBranch).toBe("main");
    } finally {
      await rm(originRoot, { recursive: true, force: true });
    }
  });

  it("falls back to the local base when fetching origin fails", async () => {
    gitDir = await mkdtemp(join(tmpdir(), "webmux-create-gitdir-"));
    worktreePath = await mkdtemp(join(tmpdir(), "webmux-create-worktree-"));

    const calls: string[] = [];
    const git = new FakeGitGateway(gitDir, calls, { ok: false, stderr: "no remote" });

    await createManagedWorktree(
      {
        repoRoot: "/repo/project",
        worktreePath,
        branch: "feature/offline",
        mode: "new",
        baseBranch: "main",
        profile: "default",
        agent: "claude",
        runtime: "host",
      },
      { git },
    );

    expect(calls[1]).toBe(`createWorktree:/repo/project:${worktreePath}:feature/offline:new:main:`);
  });

  it("rolls back the git worktree and branch when initialization fails after creation", async () => {
    repoRoot = await mkdtemp(join(tmpdir(), "webmux-create-rollback-"));
    run(["git", "init", "-b", "main"], repoRoot);
    run(["git", "config", "user.name", "Test User"], repoRoot);
    run(["git", "config", "user.email", "test@example.com"], repoRoot);
    await Bun.write(join(repoRoot, "README.md"), "# repo\n");
    run(["git", "add", "README.md"], repoRoot);
    run(["git", "commit", "-m", "init"], repoRoot);
    await mkdir(join(repoRoot, "__worktrees"), { recursive: true });

    worktreePath = join(repoRoot, "__worktrees", "feature-rollback");

    await expect(
      createManagedWorktree(
        {
          repoRoot,
          worktreePath,
          branch: "feature-rollback",
          mode: "new",
          baseBranch: "main",
          profile: "default",
          agent: "claude",
          runtime: "host",
          controlUrl: "http://127.0.0.1:5111",
        },
        { git: new BunGitGateway() },
      ),
    ).rejects.toThrow("controlUrl and controlToken must be provided together");

    expect(new BunGitGateway().listWorktrees(repoRoot).some((entry) => entry.path === worktreePath)).toBe(false);
    expect(run(["git", "branch", "--list", "feature-rollback"], repoRoot)).toBe("");
  });

  it("rolls back the git worktree and branch when tmux layout creation fails", async () => {
    repoRoot = await mkdtemp(join(tmpdir(), "webmux-create-tmux-rollback-"));
    run(["git", "init", "-b", "main"], repoRoot);
    run(["git", "config", "user.name", "Test User"], repoRoot);
    run(["git", "config", "user.email", "test@example.com"], repoRoot);
    await Bun.write(join(repoRoot, "README.md"), "# repo\n");
    run(["git", "add", "README.md"], repoRoot);
    run(["git", "commit", "-m", "init"], repoRoot);
    await mkdir(join(repoRoot, "__worktrees"), { recursive: true });

    worktreePath = join(repoRoot, "__worktrees", "feature-tmux-rollback");

    const calls: string[] = [];
    const tmux = new FakeTmuxGateway(calls);
    tmux.createWindowError = new Error("tmux exploded");

    await expect(
      createManagedWorktree(
        {
          repoRoot,
          worktreePath,
          branch: "feature-tmux-rollback",
          mode: "new",
          baseBranch: "main",
          profile: "default",
          agent: "claude",
          runtime: "host",
          worktreeId: "wt_tmux_rollback",
          sessionLayoutPlan: {
            sessionName: "wm-project-12345678",
            windowName: "wm-feature-tmux-rollback",
            worktreeId: "wt_tmux_rollback",
            shellCommand: "shell-cmd",
            focusPaneIndex: 0,
            panes: [
              {
                id: "agent",
                index: 0,
                kind: "agent",
                cwd: worktreePath,
                startupCommand: "agent-cmd",
                focus: true,
              },
            ],
          },
        },
        { git: new BunGitGateway(), tmux },
      ),
    ).rejects.toThrow("tmux exploded");

    expect(calls).toContain("killWindow:wm-project-12345678:wm-feature-tmux-rollback");
    expect(new BunGitGateway().listWorktrees(repoRoot).some((entry) => entry.path === worktreePath)).toBe(false);
    expect(run(["git", "branch", "--list", "feature-tmux-rollback"], repoRoot)).toBe("");
  });
});
