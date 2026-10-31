import { resolve } from "node:path";
import type { PaneTemplate, PaneKind } from "../domain/config";
import type { TmuxGateway } from "../adapters/tmux";
import {
  buildProjectSessionName,
  buildWorktreeWindowName,
  WM_PANE_ID_OPTION,
  WM_WINDOW_ROLE_OPTION,
  WM_WORKTREE_ID_OPTION,
} from "../adapters/tmux";

export interface PaneCommandSet {
  agent: string;
  shell: string;
}

export interface SessionLayoutContext {
  repoRoot: string;
  worktreePath: string;
  paneCommands: PaneCommandSet;
}

export interface PlannedPane {
  id: string;
  index: number;
  kind: PaneKind;
  cwd: string;
  startupCommand?: string;
  focus: boolean;
  split?: "right" | "bottom";
  sizePct?: number;
}

export interface SessionLayoutPlan {
  sessionName: string;
  windowName: string;
  worktreeId: string;
  shellCommand: string;
  panes: PlannedPane[];
  focusPaneIndex: number;
}

function quoteShell(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

function resolvePaneCwd(template: PaneTemplate, ctx: SessionLayoutContext): string {
  return template.cwd === "repo" ? ctx.repoRoot : ctx.worktreePath;
}

function buildCommandPaneStartupCommand(template: PaneTemplate, ctx: SessionLayoutContext): string {
  if (!template.command) {
    throw new Error(`Pane "${template.id}" is kind=command but has no command`);
  }
  if (!template.workingDir) {
    return template.command;
  }

  const workingDir = resolve(resolvePaneCwd(template, ctx), template.workingDir);
  return `cd -- ${quoteShell(workingDir)} && ${template.command}`;
}

function resolvePaneStartupCommand(template: PaneTemplate, ctx: SessionLayoutContext): string | undefined {
  switch (template.kind) {
    case "agent":
      return ctx.paneCommands.agent;
    case "shell":
      return undefined;
    case "command":
      return buildCommandPaneStartupCommand(template, ctx);
  }
}

/** Capture a labelled pane, resolving its `@wm_pane_id` to a pane id scoped to the agent's own
 *  window (`list-panes -t "$TMUX_PANE"` lists the window containing that pane).
 *  The `${pane:?}` guard matters: a label that resolves to nothing — the pane was closed, or its
 *  command exited — would otherwise collapse to `-t ""`, which tmux resolves to the *calling* pane,
 *  handing the agent its own output with exit code 0. */
function paneCaptureCommand(paneName: string): string {
  const lookup = `tmux list-panes -t "$TMUX_PANE" -f '#{==:#{${WM_PANE_ID_OPTION}},${paneName}}' -F '#{pane_id}'`;
  return `pane=$(${lookup}) && tmux capture-pane -p -S -50 -t "\${pane:?${paneName} pane not found}"`;
}

export function buildTmuxPaneSystemPrompt(templates: PaneTemplate[]): string {
  const inspectablePanes = templates.filter((template) => template.kind !== "agent");
  const rightmostLookup =
    "right=$(tmux list-panes -t \"$TMUX_PANE\" -F '#{pane_left} #{pane_id}' | sort -rn | head -1 | cut -d\" \" -f2)";
  const splitNewColumn = "tmux split-window -d -h -l 35% -c \"$PWD\" -t \"$TMUX_PANE\" -P -F '#{pane_id}'";
  const splitBelowColumn = "tmux split-window -d -v -l 50% -c \"$PWD\" -t \"$right\" -P -F '#{pane_id}'";
  const sendKeysCommand = "tmux send-keys -t %7 -l -- 'your-command'; tmux send-keys -t %7 C-m";

  return [
    "You are running inside a webmux-managed tmux window, in the pane the user is looking at.",
    ...(inspectablePanes.length > 0
      ? [
          "",
          "These sibling panes are labelled and can be inspected without interrupting them:",
          ...inspectablePanes.map((template) =>
            `- \`${template.id}\` (${template.kind}): \`${paneCaptureCommand(template.id)}\``
          ),
        ]
      : []),
    "",
    "You can add panes to this window — useful for a long-lived process (dev server, log tail, watcher) that the user should be able to watch, instead of blocking a tool call or backgrounding it invisibly.",
    "",
    "New panes belong in the window's right-hand column, so your own pane is resized at most once no matter how many you add. Find the rightmost pane, then split accordingly:",
    `- \`${rightmostLookup}\``,
    `- If \`$right\` is your own pane there is no right-hand column yet, so start one: \`${splitNewColumn}\``,
    `- Otherwise stack underneath the column that already exists: \`${splitBelowColumn}\``,
    "- Never split your own pane vertically: you would give up half your height, and again on every later pane.",
    "",
    `Either split prints the new pane's id, e.g. \`%7\`. Type the command into that pane rather than launching it as the pane's own process: \`${sendKeysCommand}\``,
    "- Never pass the command to `split-window` itself. It then becomes the pane's process, and tmux destroys the pane — along with everything it printed — the moment that process exits or is interrupted, so a crash takes its own stack trace with it. A pane left running its shell survives, and `tmux capture-pane -p -S -50 -t %7` still reads back the failure.",
    "- `-d` leaves the focus where it is, so the user's cursor is not yanked into the new pane.",
    "",
    "Always address panes by pane id (`%7`) or by the label lookup shown above, never by pane index — indexes shift whenever a pane is added or removed.",
  ].join("\n");
}

export function planSessionLayout(
  projectRoot: string,
  branch: string,
  worktreeId: string,
  templates: PaneTemplate[],
  ctx: SessionLayoutContext,
): SessionLayoutPlan {
  if (templates.length === 0) {
    throw new Error("At least one pane template is required");
  }

  const panes = templates.map((template, index) => {
    const startupCommand = resolvePaneStartupCommand(template, ctx);
    return {
      id: template.id,
      index,
      kind: template.kind,
      cwd: resolvePaneCwd(template, ctx),
      ...(startupCommand ? { startupCommand } : {}),
      focus: template.focus === true,
      ...(index > 0
        ? {
            split: template.split ?? "right",
            ...(template.sizePct !== undefined ? { sizePct: template.sizePct } : {}),
          }
        : {}),
    };
  });

  const focusPaneIndex = panes.find((pane) => pane.focus)?.index ?? 0;

  return {
    sessionName: buildProjectSessionName(projectRoot),
    windowName: buildWorktreeWindowName(branch),
    worktreeId,
    shellCommand: ctx.paneCommands.shell,
    panes,
    focusPaneIndex,
  };
}

export function isWorktreeOpen(
  tmux: TmuxGateway,
  projectRoot: string,
  branch: string,
): boolean {
  const sessionName = buildProjectSessionName(projectRoot);
  const windowName = buildWorktreeWindowName(branch);
  return tmux.hasWindow(sessionName, windowName);
}

export function ensureSessionLayout(
  tmux: TmuxGateway,
  plan: SessionLayoutPlan,
): void {
  const rootPane = plan.panes[0];
  tmux.ensureServer();
  tmux.ensureSession(plan.sessionName, rootPane.cwd);

  if (tmux.hasWindow(plan.sessionName, plan.windowName)) {
    tmux.killWindow(plan.sessionName, plan.windowName);
  }

  tmux.createWindow({
    sessionName: plan.sessionName,
    windowName: plan.windowName,
    cwd: rootPane.cwd,
    command: plan.shellCommand,
  });
  tmux.setWindowOption(plan.sessionName, plan.windowName, "pane-base-index", "0");
  tmux.setWindowOption(plan.sessionName, plan.windowName, "automatic-rename", "off");
  tmux.setWindowOption(plan.sessionName, plan.windowName, "allow-rename", "off");
  // Stable identity: the window name tracks the branch and drifts on rename, this does not.
  tmux.setWindowOption(plan.sessionName, plan.windowName, WM_WORKTREE_ID_OPTION, plan.worktreeId);
  tmux.setWindowOption(plan.sessionName, plan.windowName, WM_WINDOW_ROLE_OPTION, "main");

  for (const pane of plan.panes.slice(1)) {
    const target = `${plan.sessionName}:${plan.windowName}.${pane.index - 1}`;
    tmux.splitWindow({
      target,
      split: pane.split ?? "right",
      sizePct: pane.sizePct,
      cwd: pane.cwd,
      command: plan.shellCommand,
    });
  }

  // Label every pane before anything can renumber it: indexes are only trustworthy here, while the
  // layout is exactly as planned. From now on panes are addressed through this label.
  for (const pane of plan.panes) {
    tmux.setPaneOption(
      `${plan.sessionName}:${plan.windowName}.${pane.index}`,
      WM_PANE_ID_OPTION,
      pane.id,
    );
  }

  for (const pane of plan.panes) {
    if (!pane.startupCommand) continue;
    tmux.runCommand(`${plan.sessionName}:${plan.windowName}.${pane.index}`, pane.startupCommand);
  }

  tmux.selectPane(`${plan.sessionName}:${plan.windowName}.${plan.focusPaneIndex}`);
}
