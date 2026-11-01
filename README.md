# webmux

A web dashboard for managing parallel AI coding agents. webmux owns git worktree lifecycle, tmux layout, agent runtime events, service health monitoring, and sandbox containers directly, and now also ships a separate mobile-friendly chat UI for checking in on worktrees away from your desktop.

![webmux demo](https://github.com/windmill-labs/webmux/raw/main/site/static/videos/demo.gif)

## Features

### Create & Manage Worktrees

![create worktree](https://github.com/windmill-labs/webmux/raw/main/site/static/videos/create.gif)

Spin up new worktrees with one click. Pick a profile, type a prompt, and webmux creates the worktree, starts the agent, and begins streaming output. Changed your mind about the profile? Switch it later from the worktree menu (or `webmux profile <branch> <profile>`) — the session restarts with the new pane layout and commands, resuming the agent conversation. Merge or remove worktrees when you're done.

### Embedded Terminals

View and interact with your agents directly in the browser. Each worktree gets its own terminal session, streamed live via WebSocket. You can watch agents work, send prompts, and switch between worktrees instantly — no need to juggle tmux windows manually.

### Mobile-Friendly Agents Chat

webmux also serves a second, simplified agents UI on a separate port. It is primarily meant to give you a much better mobile UX: a worktree list, a simple chat screen, and quick access to service and PR badges without trying to squeeze a full terminal dashboard onto a phone.

### PR, CI & Comments

![PR and CI](https://github.com/windmill-labs/webmux/raw/main/site/static/videos/ci.gif)

See pull request status, CI check results, and review comments right next to each worktree. No more switching to GitHub to check if your agent's PR passed CI.

### Service Health Monitoring

![service health](https://github.com/windmill-labs/webmux/raw/main/site/static/videos/health.gif)

Track dev server ports across worktrees. Servers started with `PORT=$(webmux port <label>) <cmd>` get a port no other worktree holds, and the dashboard shows a live link for each one while it listens.

### Docker Sandbox Mode


Run agents in isolated Docker containers for untrusted or experimental work. webmux manages the container lifecycle and volume mounts automatically.

Containers use host networking (`--network host`): a dev server in the container listens directly on the host, and the `webmux` CLI is mounted into the container so agents can run `webmux port <label>` there too. On macOS this needs Docker Desktop 4.34 or later with *Settings → Resources → Network → Enable host networking* turned on (signed in; not compatible with Enhanced Container Isolation), or OrbStack, which supports it natively. webmux can't detect the setting, so it logs a reminder when it launches a container on macOS.

### Linear Integration

![linear integration](https://github.com/windmill-labs/webmux/raw/main/site/static/videos/linear.gif)

See your assigned Linear issues alongside your worktrees. Webmux matches branches to issues automatically, so you can browse your backlog, pick an issue, and spin up a worktree for it in one click.

**Auto-create from labels.** When the server polls your assigned Linear issues, it acts on two labels:

- **`webmux`** — auto-creates a worktree for the issue, seeded with the issue title + description as the agent prompt.
- **`webmux_oneshot`** — launches the issue via `webmux oneshot` (autonomous run; auto-closes the session and posts the conversation back to the Linear issue when the agent terminates or opens a PR). When both labels are present, `webmux_oneshot` wins.

Each issue is processed once while it stays in Todo + labeled. Remove the label and re-add it to retrigger.

When the auto-create watcher picks up a `webmux_oneshot` issue, it posts a structured comment on the Linear issue (prefix `` **Webmux pickup — branch `<branch>`** ``) so external automation can track when the autonomous run starts. (Regular `webmux` pickups are user-driven and skip the comment.)

The watcher polls every 60 seconds by default. Override with `LINEAR_AUTO_CREATE_POLL_INTERVAL_MS` (milliseconds) in `~/.config/webmux/.env`.

**Setup — `LINEAR_API_KEY`.** Everything above needs a [Linear API key](https://linear.app/settings/account/security) in the server's environment. webmux runs as a single machine-wide service started from your home directory, so put the key in `~/.config/webmux/.env` — a `KEY=value` file the server loads at startup regardless of which directory it runs from, so it survives `webmux update`:

```bash
mkdir -p ~/.config/webmux
echo 'LINEAR_API_KEY=lin_api_...' >> ~/.config/webmux/.env
chmod 600 ~/.config/webmux/.env
webmux service restart
```

Your assigned issues appear in the dashboard once the service restarts.

## Quick Start

```bash
# 1. Install prerequisites
sudo apt install tmux           # or: brew install tmux
sudo apt install python3        # or: brew install python
curl -fsSL https://bun.sh/install | bash

# 2. Install webmux
bun install -g webmux

# 3. Set up your project
cd /path/to/your/project
webmux init                     # creates .webmux.yaml (the only per-project step)

# 4. Start the dashboard
webmux serve                         # dashboard on http://localhost:5111
```

The primary dashboard remains the best desktop experience. On mobile, the same dashboard swaps the embedded terminal for a chat view on open Codex and Claude worktrees.

### One dashboard, many projects

You don't run a separate webmux per project. A single `webmux serve` serves **every project you've added, on one dashboard and one port** — each addressed by its own prefix (`/#<prefix>` in the dashboard, `/api/projects/<prefix>/...` in the API). The only per-project requirement is a `.webmux.yaml` in the repo (created by `webmux init`); webmux auto-loads it.

- The repo you launch `webmux serve` in is served automatically — but only for that session. It isn't written to `~/.webmux/projects.json`, so it isn't remembered across restarts unless you `webmux project add` it.
- Add a project with "Add project" (the `+`) at the bottom of the project rail, then pick it in the rail to see its worktrees. The `+` next to the project name creates a worktree in it; its actions menu pulls its linked repos, opens it in your IDE, or removes it.
- Or manage them from the CLI:

```bash
webmux project ls                 # list projects the dashboard is serving
webmux project add ~/code/other   # add another project (persists; must have a .webmux.yaml)
webmux project rm other           # remove by prefix
```

Projects added with `webmux project add` are remembered in `~/.webmux/projects.json` and reloaded on the next start. Run webmux as a single service per machine with `webmux service install`.

## Prerequisites

| Tool | Purpose |
|------|---------|
| [**bun**](https://bun.sh) | Runtime |
| **python3** | Per-worktree hook/event helper runtime |
| **tmux** | Terminal multiplexer |
| **git** | Worktree management |
| **gh** | PR and CI status (optional) |
| **docker** | Sandbox profile only (optional) |

## Configuration

webmux uses a project config file in the project root, plus an optional local overlay:

- **`.webmux.yaml`** — Worktree root, pane layout, profiles, linked repos, and Docker sandbox settings.
- **`.webmux.local.yaml`** — Optional local-only overlay for additional `profiles` and `lifecycleHooks`, and the recommended place to override per-developer settings like `workspace.ide`. Profiles are additive, conflicting profile names are replaced by the local definition, and local lifecycle hook commands run after the project-level command for the same hook.

<details>
<summary><strong>.webmux.yaml example</strong></summary>

```yaml
name: My Project

workspace:
  mainBranch: main
  worktreeRoot: __worktrees
  defaultAgent: claude
  autoPull:
    enabled: true
    intervalSeconds: 300

profiles:
  default:
    runtime: host
    yolo: false
    envPassthrough: []
    panes:
      - id: agent
        kind: agent
        focus: true
      - id: frontend
        kind: command
        split: right
        workingDir: frontend
        command: PORT=$(webmux port web) npm run dev

  sandbox:
    runtime: docker
    yolo: true
    image: my-sandbox
    envPassthrough:
      - AWS_ACCESS_KEY_ID
      - AWS_SECRET_ACCESS_KEY
    mounts:
      - hostPath: ~/.codex
        guestPath: /root/.codex
        writable: true
      - hostPath: ~/.local/share/opencode
        guestPath: /root/.local/share/opencode
        writable: true
      - hostPath: ~/.pi
        guestPath: /root/.pi
        writable: true
    systemPrompt: >
      You are running inside a sandboxed container.

Custom sandbox images should make `claude`, `codex`, `opencode`, or `pi` available on the container's normal `PATH` (for example with `ENV PATH=/your/tool/bin:$PATH`). webmux does not rely on login-shell dotfiles like `.bashrc` to discover agent binaries inside the container.

integrations:
  github:
    autoRemoveOnMerge: true
    linkedRepos:
      - repo: myorg/related-service
        alias: svc

startupEnvs:
  NODE_ENV: development

auto_name:
  model: claude-3-5-haiku-latest
  system_prompt: >
    Generate a concise git branch name from the task description.
    Return only the branch name in lowercase kebab-case.

lifecycleHooks:
  postCreate: scripts/post-create.sh
  preRemove: scripts/pre-remove.sh
```

</details>

For fresh agents using a host profile, webmux automatically includes capture commands for configured command and shell panes in the agent system prompt. Every fresh agent — host or Docker, plus chat-mode Claude in the dashboard — is also told to get server ports from `webmux port <label>`. Custom agents receive this combined system prompt through `${SYSTEM_PROMPT}` in their start command, so reference that placeholder to pass it on. Profile `systemPrompt` values only need to contain project-specific guidance.

<details>
<summary><strong>.webmux.yaml full schema</strong></summary>

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | no | Project name shown in sidebar and browser tab |
| `workspace.mainBranch` | string | no | Base branch used for new worktrees |
| `workspace.worktreeRoot` | string | no | Relative or absolute directory for managed worktrees |
| `workspace.defaultAgent` | string | no | Default agent for new worktrees: `claude`, `codex`, `opencode`, or `pi` |
| `workspace.ide` | string | no | Editor used by the "Open in..." button: `cursor` or `vscode` (default: `cursor`) |
| `workspace.autoPull.enabled` | boolean | no | Periodically fetch and fast-forward merge the main branch (default: `false`) |
| `workspace.autoPull.intervalSeconds` | number | no | Seconds between auto-pull attempts (default: `300`, minimum: `30`) |
| `profiles.<name>.runtime` | string | yes | `host` or `docker` |
| `profiles.<name>.yolo` | boolean | no | Enables `--dangerously-skip-permissions` for Claude, `--yolo` for Codex, `--auto` for opencode (pi has no permission prompts, so it ignores it) |
| `profiles.<name>.panes[]` | array | yes | Pane layout for that profile |
| `profiles.<name>.panes[].kind` | string | yes | `agent`, `shell`, or `command` |
| `profiles.<name>.panes[].command` | string | yes (for `command`) | Startup command run inside the pane |
| `profiles.<name>.panes[].workingDir` | string | no | Directory to `cd` into before running a command pane startup command |
| `profiles.default.systemPrompt` | string | no | Agent system prompt; `${VAR}` placeholders expanded at runtime |
| `profiles.default.envPassthrough` | string[] | no | Env vars passed to the agent process |
| `profiles.sandbox.image` | string | yes (if used) | Docker image for containers |
| `profiles.sandbox.systemPrompt` | string | no | Agent system prompt for sandbox |
| `profiles.sandbox.envPassthrough` | string[] | no | Host env vars forwarded into the container |
| `profiles.sandbox.mounts[].hostPath` | string | yes | Host path to mount (`~` expands to `$HOME`) |
| `profiles.sandbox.mounts[].guestPath` | string | no | Container mount path (defaults to `hostPath`) |
| `profiles.sandbox.mounts[].writable` | boolean | no | `true` for read-write; omit or `false` for read-only |
| `integrations.github.autoRemoveOnMerge` | boolean | no | Automatically remove worktrees when their PR is merged (default: `false`) |
| `integrations.github.linkedRepos[].repo` | string | yes | GitHub repo slug (e.g. `org/repo`) |
| `integrations.github.linkedRepos[].alias` | string | no | Short label for the UI |
| `startupEnvs.<KEY>` | string or boolean | no | Extra env vars materialized into worktree runtime env |
| `auto_name.model` | string | no | Model used to generate the branch name when the branch field is left empty; supports Anthropic (`claude-*`), Gemini (`gemini-*`), and OpenAI (`gpt-*`, `chatgpt-*`, `o*`) models |
| `auto_name.system_prompt` | string | no | System prompt sent to the auto-name model |
| `lifecycleHooks.postCreate` | string | no | Shell command run after a managed worktree is created and its runtime env is materialized, but before the tmux session/panes are started |
| `lifecycleHooks.preRemove` | string | no | Shell command run before a managed worktree is removed |

</details>

Lifecycle hooks run with the worktree as `cwd` and receive the same computed runtime env that the managed panes will use, including `startupEnvs` and `WEBMUX_*` metadata.

### Custom agents

Besides the built-in `claude`, `codex`, `opencode`, and `pi` agents, you can define your own terminal agents. Custom agents are machine-wide: they live in `~/.config/webmux/config.yaml` and every project the server serves can launch them. Manage them from **Settings → Agents** in the dashboard, or edit the file directly (restart the server to pick up manual edits):

```yaml
# ~/.config/webmux/config.yaml
agents:
  gemini-cli:
    label: Gemini CLI
    startCommand: gemini --prompt "${PROMPT}"
    resumeCommand: gemini --resume latest   # optional
```

`startCommand` and `resumeCommand` can reference `${PROMPT}`, `${SYSTEM_PROMPT}`, `${WORKTREE_PATH}`, `${REPO_PATH}`, `${BRANCH}`, and `${PROFILE}`. Without a `resumeCommand`, reopening a worktree restarts the agent fresh. An `agents:` section in `.webmux.yaml` or `.webmux.local.yaml` is ignored — move it to the global file. Worktrees started on a former project-local custom agent fail to open with `Unknown agent` until you recreate that agent globally under the same id.

### Dev server ports

webmux hands out dev server ports on demand instead of from config. Run a server as `PORT=$(webmux port <label>) <cmd>` in a command pane, a hook or an agent shell:

```bash
webmux port web                  # print a free port for "web" in this worktree
webmux port web --keep           # same, but never release it for being idle
webmux port web --port 5173      # register a port the tool picked itself
webmux port ls                   # list this worktree's ports (and which are kept)
webmux port rm web               # release it
```

- Ports come from 4100–4999 and are never held by two worktrees at once. The same label returns the same port.
- The dashboard links each port while something listens on it.
- A port nothing has listened on for 5 minutes is released, unless it was registered with `--keep`. Use `--keep` for ports that must stay stable, such as ones written to `.env` or used in OAuth callbacks.
- Removing a worktree releases all its ports.
- Docker sandboxes use host networking, so `webmux port` works the same inside them. On macOS this needs Docker Desktop with host networking enabled, or OrbStack (see [Docker Sandbox Mode](#docker-sandbox-mode)).

When `auto_name` is enabled, `webmux` calls the provider API directly with structured output and uses `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, or `OPENAI_API_KEY` based on the configured model.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Cmd+Up/Down` | Navigate between worktrees |
| `Cmd+K` | Create new worktree |
| `Cmd+M` | Merge selected worktree |
| `Cmd+D` | Remove selected worktree |
