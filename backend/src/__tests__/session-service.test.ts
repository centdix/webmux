import { describe, expect, it } from "bun:test";
import {
  WM_PANE_ID_OPTION,
  WM_WINDOW_ROLE_OPTION,
  WM_WORKTREE_ID_OPTION,
  type TmuxGateway,
} from "../adapters/tmux";
import {
  buildTmuxPaneSystemPrompt,
  ensureSessionLayout,
  isWorktreeOpen,
  planSessionLayout,
} from "../services/session-service";

class FakeTmuxGateway implements TmuxGateway {
  calls: string[] = [];
  existingWindows = new Set<string>();

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
    return this.existingWindows.has(`${sessionName}:${windowName}`);
  }

  killWindow(sessionName: string, windowName: string): void {
    this.calls.push(`killWindow:${sessionName}:${windowName}`);
  }

  renameWindow(sessionName: string, windowName: string, newName: string): void {
    this.calls.push(`renameWindow:${sessionName}:${windowName}:${newName}`);
  }

  createWindow(opts: { sessionName: string; windowName: string; cwd: string; command?: string }): void {
    this.calls.push(`createWindow:${opts.sessionName}:${opts.windowName}:${opts.cwd}:${opts.command ?? ""}`);
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

  setWindowOption(sessionName: string, windowName: string, option: string, value: string): void {
    this.calls.push(`setWindowOption:${sessionName}:${windowName}:${option}:${value}`);
  }

  setPaneOption(target: string, option: string, value: string): void {
    this.calls.push(`setPaneOption:${target}:${option}:${value}`);
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

describe("buildTmuxPaneSystemPrompt", () => {
  it("addresses each non-agent pane by label lookup rather than by index", () => {
    const prompt = buildTmuxPaneSystemPrompt([
      { id: "agent", kind: "agent", focus: true },
      { id: "backend", kind: "command", command: "bun run dev" },
      { id: "frontend", kind: "shell" },
    ]);

    expect(prompt).toContain(
      "- `backend` (command): `pane=$(tmux list-panes -t \"$TMUX_PANE\" "
        + `-f '#{==:#{${WM_PANE_ID_OPTION}},backend}' -F '#{pane_id}') `
        + "&& tmux capture-pane -p -S -50 -t \"${pane:?backend pane not found}\"`",
    );
    expect(prompt).toContain(
      "- `frontend` (shell): `pane=$(tmux list-panes -t \"$TMUX_PANE\" "
        + `-f '#{==:#{${WM_PANE_ID_OPTION}},frontend}' -F '#{pane_id}') `
        + "&& tmux capture-pane -p -S -50 -t \"${pane:?frontend pane not found}\"`",
    );
    // The agent's own pane is not something it should be capturing from.
    expect(prompt).not.toContain("`agent` (agent)");
    // Index-based targeting is the bug this replaces: a split renumbers every pane after it.
    expect(prompt).not.toContain("#{window_name}').1");
  });

  it("never targets a capture at an unguarded label lookup", () => {
    const prompt = buildTmuxPaneSystemPrompt([
      { id: "agent", kind: "agent", focus: true },
      { id: "backend", kind: "command", command: "bun run dev" },
    ]);

    // A label resolving to nothing collapses `-t "$(lookup)"` to `-t ""`, which tmux resolves to the
    // calling pane: the agent silently captures its own output, exit code 0.
    expect(prompt).not.toContain("-t \"$(tmux list-panes");
  });

  it("documents pane creation even when the profile has no other panes", () => {
    const prompt = buildTmuxPaneSystemPrompt([{ id: "agent", kind: "agent", focus: true }]);

    // No right-hand column yet: open one horizontally off the agent's own pane.
    expect(prompt).toContain(
      "tmux split-window -d -h -l 35% -c \"$PWD\" -t \"$TMUX_PANE\" -P -F '#{pane_id}'",
    );
    // A column already exists: stack under its rightmost pane, leaving the agent's pane alone.
    expect(prompt).toContain(
      "tmux split-window -d -v -l 50% -c \"$PWD\" -t \"$right\" -P -F '#{pane_id}'",
    );
    expect(prompt).toContain(
      "right=$(tmux list-panes -t \"$TMUX_PANE\" -F '#{pane_left} #{pane_id}' | sort -rn | head -1 | cut -d\" \" -f2)",
    );
    expect(prompt).not.toContain("can be inspected");
  });

  it("never launches a created pane's command as the pane process", () => {
    const prompt = buildTmuxPaneSystemPrompt([{ id: "agent", kind: "agent", focus: true }]);

    // A command passed to split-window becomes the pane's process, so tmux destroys the pane — and
    // its scrollback — as soon as that process exits or takes a Ctrl-C. send-keys into a shell pane
    // survives both.
    expect(prompt).toContain("tmux send-keys -t %7 -l -- 'your-command'; tmux send-keys -t %7 C-m");
    expect(prompt).not.toContain("-F '#{pane_id}' 'your-command'");
    // The agent's own pane must never be the thing that gets split vertically.
    expect(prompt).not.toContain("-v -l 25% -c \"$PWD\" -t \"$TMUX_PANE\"");
  });
});

describe("planSessionLayout", () => {
  it("materializes pane cwd and command with a deterministic session/window name", () => {
    const plan = planSessionLayout(
      "/repo/project",
      "feature/search",
      "wt_test",
      [
        { id: "agent", kind: "agent", focus: true },
        { id: "shell", kind: "shell", split: "right", sizePct: 25 },
        {
          id: "dev",
          kind: "command",
          command: "npm run dev",
          split: "bottom",
          cwd: "repo",
          workingDir: "apps/web",
        },
      ],
      {
        repoRoot: "/repo/project",
        worktreePath: "/repo/project/__worktrees/feature-search",
        paneCommands: {
          agent: "webmux-agent --start",
          shell: "webmux-shell --shell",
        },
      },
    );

    expect(plan.windowName).toBe("wm-feature/search");
    expect(plan.shellCommand).toBe("webmux-shell --shell");
    expect(plan.panes).toEqual([
      {
        id: "agent",
        index: 0,
        kind: "agent",
        cwd: "/repo/project/__worktrees/feature-search",
        startupCommand: "webmux-agent --start",
        focus: true,
      },
      {
        id: "shell",
        index: 1,
        kind: "shell",
        cwd: "/repo/project/__worktrees/feature-search",
        focus: false,
        split: "right",
        sizePct: 25,
      },
      {
        id: "dev",
        index: 2,
        kind: "command",
        cwd: "/repo/project",
        startupCommand: "cd -- '/repo/project/apps/web' && npm run dev",
        focus: false,
        split: "bottom",
      },
    ]);
    expect(plan.focusPaneIndex).toBe(0);
  });

  it("keeps absolute command workingDir values intact", () => {
    const plan = planSessionLayout(
      "/repo/project",
      "feature/search",
      "wt_test",
      [
        {
          id: "dev",
          kind: "command",
          command: "bun run dev",
          workingDir: "/repo/shared/frontend",
        },
      ],
      {
        repoRoot: "/repo/project",
        worktreePath: "/repo/project/__worktrees/feature-search",
        paneCommands: {
          agent: "agent",
          shell: "shell",
        },
      },
    );

    expect(plan.panes[0]?.startupCommand).toBe("cd -- '/repo/shared/frontend' && bun run dev");
  });

  it("throws when a command pane has no command", () => {
    expect(() =>
      planSessionLayout(
        "/repo/project",
        "feature/search",
        "wt_test",
        [{ id: "dev", kind: "command" }],
        {
          repoRoot: "/repo/project",
          worktreePath: "/repo/project/__worktrees/feature-search",
          paneCommands: {
            agent: "agent",
            shell: "shell",
          },
        },
      ),
    ).toThrow('Pane "dev" is kind=command but has no command');
  });
});

describe("ensureSessionLayout", () => {
  it("creates a fresh window and realizes all panes in order", () => {
    const tmux = new FakeTmuxGateway();
    const plan = planSessionLayout(
      "/repo/project",
      "feature/search",
      "wt_test",
      [
        { id: "agent", kind: "agent", focus: true },
        { id: "shell", kind: "shell", split: "right", sizePct: 25 },
      ],
      {
        repoRoot: "/repo/project",
        worktreePath: "/repo/project/__worktrees/feature-search",
        paneCommands: {
          agent: "agent-start",
          shell: "shell-cmd",
        },
      },
    );

    ensureSessionLayout(tmux, plan);

    expect(tmux.calls).toContain("ensureServer");
    expect(
      tmux.calls.some((call) =>
        call.startsWith(`createWindow:${plan.sessionName}:${plan.windowName}:/repo/project/__worktrees/feature-search:shell-cmd`),
      ),
    ).toBe(true);
    expect(tmux.calls).toContain(`setWindowOption:${plan.sessionName}:${plan.windowName}:pane-base-index:0`);
    // The stable identity anchor: survives a branch rename, unlike the window name.
    expect(tmux.calls).toContain(
      `setWindowOption:${plan.sessionName}:${plan.windowName}:${WM_WORKTREE_ID_OPTION}:wt_test`,
    );
    expect(tmux.calls).toContain(
      `setWindowOption:${plan.sessionName}:${plan.windowName}:${WM_WINDOW_ROLE_OPTION}:main`,
    );
    expect(
      tmux.calls.some((call) =>
        call.startsWith(`splitWindow:${plan.sessionName}:${plan.windowName}.0:right:25:/repo/project/__worktrees/feature-search:shell-cmd`),
      ),
    ).toBe(true);
    expect(tmux.calls).toContain(`runCommand:${plan.sessionName}:${plan.windowName}.0:agent-start`);
    expect(tmux.calls.at(-1)).toBe(`selectPane:${plan.sessionName}:${plan.windowName}.0`);
    // Every pane carries its template id, so later lookups never rely on an index.
    expect(tmux.calls).toContain(
      `setPaneOption:${plan.sessionName}:${plan.windowName}.0:${WM_PANE_ID_OPTION}:agent`,
    );
    expect(tmux.calls).toContain(
      `setPaneOption:${plan.sessionName}:${plan.windowName}.1:${WM_PANE_ID_OPTION}:shell`,
    );
    // Labelling must happen while the planned indexes still hold — before any startup command runs
    // and can split the window itself.
    const lastLabel = tmux.calls.findLastIndex((call) => call.startsWith("setPaneOption:"));
    const firstStartup = tmux.calls.findIndex((call) => call.startsWith("runCommand:"));
    expect(lastLabel).toBeLessThan(firstStartup);
  });

  it("replaces an existing window before recreating it", () => {
    const tmux = new FakeTmuxGateway();
    const plan = planSessionLayout(
      "/repo/project",
      "feature/search",
      "wt_test",
      [{ id: "agent", kind: "agent", focus: true }],
      {
        repoRoot: "/repo/project",
        worktreePath: "/repo/project/__worktrees/feature-search",
        paneCommands: {
          agent: "agent-start",
          shell: "shell-cmd",
        },
      },
    );
    tmux.existingWindows.add(`${plan.sessionName}:${plan.windowName}`);

    ensureSessionLayout(tmux, plan);

    expect(tmux.calls).toContain(`killWindow:${plan.sessionName}:${plan.windowName}`);
  });
});

describe("isWorktreeOpen", () => {
  it("checks the expected project session and window names", () => {
    const tmux = new FakeTmuxGateway();
    const open = isWorktreeOpen(tmux, "/repo/project", "feature/search");

    expect(open).toBe(false);
    expect(tmux.calls.some((call) => call.includes(":wm-feature/search"))).toBe(true);
  });
});
