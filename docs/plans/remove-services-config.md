# Plan: remove the `services` config

Status: proposal, nothing implemented. Line numbers are from `1787e9a` (main after PR #19).

## TL;DR

- On the **host runtime with agent-started dev servers**, `webmux port` already covers what `services` does. It also fixes two things `services` gets wrong: ports are probed for bindability, and there is no slot arithmetic.
- Removing `services` **breaks three groups outright**. Each needs a small fix *before* the removal ships:
  1. **Docker profiles.** Ports are published with `-p` at `docker run`. Today that list comes from `services` (`adapters/docker.ts:107-120`). The `webmux` CLI is not in the sandbox image and calls `http://localhost:<port>` (`bin/src/shared.ts:82`), so `webmux port` can't run in a container. Even if it could, the port would not be published and the host-side probe would never see it. Without a fix, docker users lose dashboard ports entirely.
  2. **Ports that must stay stable for the worktree's lifetime** (`.env` written by `postCreate`, OAuth redirect URIs, bookmarked URLs). A registration expires after 5 minutes with nothing listening, and then another worktree can be given the port. `allocatedPorts` never expired.
  3. **Chat-mode Claude.** The streaming launch path passes only `profile.systemPrompt` (`services/claude-streaming-launch-service.ts:26`, used at `server.ts:848-892`). It never gets the `webmux port` block. Today it at least has `$PORT` in its env from `services`.
- Recommendation: **ship the gaps first (Stage 0), then deprecate (Stage 1, warn, keep working), then remove (Stage 2).** Do not ship a hard removal in one release.
- Release-please is configured without `bump-minor-pre-major` (`release-please-config.json`). A `feat!` / `BREAKING CHANGE` commit at 0.43.x would therefore cut **1.0.0**. Decide that on purpose (see Open questions).

---

## 1. Inventory

I verified each entry by reading the code. Hits for `ServiceConfig` and "services" in `bin/src/service.ts`, `bin/src/service-restart.ts`, `bin/src/migrate.ts` and `bin/src/webmux.ts:331-336` are about systemd/launchd **service units**. They are unrelated and are excluded. The ~40 test files that only import from `../services/...` are also excluded.

### 1.1 Types and config parsing

| Where | What |
|---|---|
| `backend/src/domain/config.ts:54-60` | `interface ServiceSpec { name, portEnv, portStart?, portStep?, urlTemplate? }` |
| `backend/src/domain/config.ts:107` | `ProjectConfig.services: ServiceSpec[]` |
| `backend/src/adapters/config.ts:22,26` | imports `ServiceSpec`, re-exports it as `ServiceConfig` (used only by `docker.ts`) |
| `backend/src/adapters/config.ts:76` | `DEFAULT_CONFIG.services: []` |
| `backend/src/adapters/config.ts:260-273` | `parseServices()`: drops entries without `name`/`portEnv`, keeps finite `portStart`/`portStep` and non-empty `urlTemplate` |
| `backend/src/adapters/config.ts:396` | `services: parseServices(parsed.services)` in the loader |
| `backend/src/adapters/config.ts:693-696` | `expandTemplate()`. Not service-specific, but `urlTemplate` is one of its two callers |

### 1.2 Allocation and persistence (`allocatedPorts`)

| Where | What |
|---|---|
| `backend/src/domain/policies.ts:1,88-118` | `allocateServicePorts(existingMetas, services)`. Uses the first service with `portStart` as the slot reference, takes the lowest free slot **starting at 1** (so `portStart` itself is never handed out), and returns `{ [portEnv]: start + slot*step }` |
| `backend/src/services/lifecycle-service.ts:944-947` | private `allocatePorts()`: reads every managed meta and calls the policy |
| `backend/src/services/lifecycle-service.ts:1026` | `initializeUnmanagedWorktree` allocates ports when adopting an unmanaged worktree |
| `backend/src/services/lifecycle-service.ts:1448` | create path allocates ports |
| `backend/src/services/worktree-service.ts:33,62,166,234` | `allocatedPorts?` option threaded into `initializeManagedWorktree` and written to meta |
| `backend/src/domain/model.ts:71` | `WorktreeMeta.allocatedPorts: Record<string, number>` (required) |
| `backend/src/adapters/fs.ts:23-26` | `stringifyAllocatedPorts()` |
| `backend/src/adapters/fs.ts:182-197` | `buildRuntimeEnvMap()` spreads `allocatedPorts` into the env **after** dotenv and `startupEnvValues` and **before** `extraEnv`/`WEBMUX_*`. So a service `portEnv` overrides a `.env.local` or `startupEnvs` value of the same name |
| `backend/src/adapters/fs.ts:288-305` | `normalizeWorktreeMeta()`. No `allocatedPorts` handling today; it is where an old-meta cleanup would go |

`buildRuntimeEnvMap` is the single funnel into every consumer of port env vars:
- `runtime.env` written at create (`worktree-service.ts:174-175`) and on every refresh (`lifecycle-service.ts:1053-1056`). Sourced by agent panes, shell panes and command panes (`buildManagedShellCommand`, `services/agent-service.ts:140-145`) and by docker exec panes.
- lifecycle hooks `postCreate` / `preRemove` (`lifecycle-service.ts:1320-1325, 1464-1469`). The hook process gets the env; the hook command is **not** templated.
- the chat-mode Claude env (`claude-streaming-launch-service.ts:22-24`).
- `expandTemplate` inputs: profile `systemPrompt` (`lifecycle-service.ts:1180-1182`) and `urlTemplate` (`reconciliation-service.ts:43-53,65`).

### 1.3 Templating of `${PORT_ENV}`: what actually expands

Checked against the code, because the docs promise more than the code does:

| Surface | Expanded by webmux? |
|---|---|
| profile `systemPrompt` | **Yes**, `expandTemplate(..., runtimeEnv)` at `lifecycle-service.ts:1181`, tmux launch only, `launchMode === "fresh"` only. Chat-mode Claude gets the **raw, unexpanded** string (`claude-streaming-launch-service.ts:26`) |
| `urlTemplate` | **Yes**, `reconciliation-service.ts:65` |
| `startupEnvs` values | **No.** `buildStartupEnvValues` only stringifies (`lifecycle-service.ts:927-942`). `renderEnvFile` single-quotes any value containing `$` (`fs.ts:28-31`), so `API_BASE_URL: http://localhost:${PORT}` reaches the shell as the literal string `http://localhost:${PORT}`. The starter template advertises this example anyway (`init-authoring.ts:439-440`). It is already broken, and removing `services` changes nothing here |
| `lifecycleHooks` commands | **No** template expansion. Hooks receive `$PORT` as a real env var and can use it at run time |
| pane `command` | **No** template expansion. Runs in a shell that has sourced `runtime.env`, so `$PORT` works as a shell variable (README example `FRONTEND_PORT=$FRONTEND_PORT npm run dev`) |

### 1.4 Dashboard state

| Where | What |
|---|---|
| `backend/src/services/reconciliation-service.ts:2,15` | imports `expandTemplate`, `buildRuntimeEnvMap`, used only by `buildServiceStates` |
| `backend/src/services/reconciliation-service.ts:31-77` | `buildServiceStates()`: builds a fake meta to get `runtimeEnv`, probes each configured service (shown even when **not** running, with `port` possibly `null`), then appends **only running** registrations whose label doesn't clash with a configured `name`. Registered URLs are hard-coded `http://localhost:${port}` |
| `backend/src/services/reconciliation-service.ts:256-267` | call site passes `allocatedPorts`, `startupEnvValues`, `branch`, `profile`, `agent`, `runtime`, all only to rebuild `runtimeEnv` |
| `backend/src/services/reconciliation-service.ts:124-125` | `portRegistrations?` is **optional** in deps |
| `backend/src/domain/model.ts:152-157` | `ServiceRuntimeState { name, port: number \| null, running, url: string \| null }` |
| `backend/src/domain/model.ts:238,268` | `services: ServiceRuntimeState[]` on runtime state and snapshot |
| `backend/src/services/project-runtime.ts:68,179-181`, `snapshot-service.ts:65,99`, `agents-ui-service.ts:25` | pass-through copies of `services`. **No change needed** |

### 1.5 Docker

| Where | What |
|---|---|
| `backend/src/adapters/docker.ts:8,55` | `LaunchContainerOpts.services: ServiceConfig[]` |
| `backend/src/adapters/docker.ts:95,107-120` | for each service: `runtimeEnv[svc.portEnv]` → `-p 127.0.0.1:<port>:<port>`, deduped. **This is the only port publishing docker gets** |
| `backend/src/services/lifecycle-service.ts:1126-1133` | `launchContainer({ ..., services: this.deps.config.services, runtimeEnv })` |
| `backend/src/services/lifecycle-service.ts:1186-1188` | the tmux/`webmux port` prompt block is added **only for `runtime === "host"`**. Docker agents never learn about `webmux port` |
| `sandbox-image/Dockerfile.sandbox` | installs bun and playwright, **not** `webmux` |
| `bin/src/shared.ts:78-82` | CLI talks to `http://localhost:<port>`. From inside a container that is the container, not the host (the control env uses `host.docker.internal`, `lifecycle-service.ts:60`, but the CLI does not) |

### 1.6 API contract, server, frontend

| Where | What |
|---|---|
| `packages/api-contract/src/schemas.ts:540-543` | `ServiceConfigSchema { name, portEnv }` |
| `packages/api-contract/src/schemas.ts:557` | `AppConfigSchema.services` |
| `packages/api-contract/src/schemas.ts:797` | `export type ServiceConfig` |
| `packages/api-contract/src/schemas.ts:239-244,371,430` | `ServiceStatusSchema` + snapshot `services`. **Keep**: this is the runtime status, not the config |
| `backend/src/server.ts:391,415` | `getFrontendConfig()` returns `services: config.services` |
| `frontend/src/lib/types.ts:63` | re-exports `ServiceConfig` (no other frontend import) |
| `frontend/src/App.svelte:83` | `createDefaultConfig()` sets `services: []` |
| `frontend/src/lib/RepoGroup.svelte:9,16,30-41`, `WorktreeList.svelte:304-311`, `TopBar.svelte:198`, `api.ts:75` | render runtime `ServiceStatus` only. **No frontend reads `AppConfig.services`.** When `url` is null, `RepoGroup` links to `window.location.hostname:<port>`, which works when the dashboard is opened remotely. Registered ports always send `localhost`, which doesn't |

### 1.7 CLI, init and the `$PORT` env var

| Where | What |
|---|---|
| `backend/src/services/init-authoring.ts:96,105,108-109` | agent-driven `webmux init` prompt tells the agent to write `services` and to pass port env vars to command panes |
| `backend/src/services/init-authoring.ts:303-314` | starter template `services:` block |
| `backend/src/services/init-authoring.ts:356-357` | commented pane example `command: PORT=$PORT ${devCommand}` ("webmux injects $PORT") |
| `backend/src/services/init-authoring.ts:439-440` | `startupEnvs` example `API_BASE_URL: http://localhost:\${PORT}` (doesn't work, see 1.3) |
| `bin/src/init.ts:298` | "adjust panes, ports, and profiles" next-step hint |
| `bin/src/webmux.ts:110-111` | **every** CLI command defaults the server port to `process.env.PORT` and treats it as explicit |
| `bin/src/webmux.ts:165-170` | PR #19 exempted only `webmux port` from that. In an agent shell where `services` exported `PORT=5121`, `webmux send` / `tab` / `list` still target 5121 and fail |
| `bin/src/worktree-commands.ts:181-192,393-456` | `port` command (help, parsing). No `services` dependency |

### 1.8 Docs, examples, site

| Where | What |
|---|---|
| `README.md:33` | feature blurb: "polls configured services" |
| `README.md:138-146,161,182` | example config `services`, `FRONTEND_PORT=$FRONTEND_PORT`, sandbox `systemPrompt` with `${PORT}` |
| `README.md:223-226` | config reference rows `services[].*` (`urlTemplate` is missing from the table) |
| `.webmux.example.yaml:23-46,74-75,166` | `services` block, `systemPrompt` with `${PORT}`, hook comment "receives … allocated ports" |
| `.webmux.yaml:12-20,51,86-93,103` | **this repo's own config**: `BE`/`FE` services. `full` and `sandbox` `systemPrompt`s interpolate `${PORT}`/`${FRONTEND_PORT}`. The `sandbox` (docker) profile runs both dev servers in command panes. `frontend/vite.config.ts:5,8` reads `PORT` (to proxy to the backend) and `FRONTEND_PORT` |
| `site/src/lib/docs.ts:47,289-295,333-343,478-510` | feature copy, two example configs, config reference rows |
| `site/src/lib/pages/DocsPage.svelte:275`, `HomePage.svelte:394` | prose mentioning services |
| README / site | **no documentation of `webmux port` at all.** The only user-facing docs are the CLI help and the agent prompt |

### 1.9 Tests

Tests that exercise `services` / `allocatedPorts` behaviour:
- `backend/src/__tests__/domain-policies.test.ts:3,10-45` (`allocateServicePorts`): delete.
- `backend/src/__tests__/docker.test.ts:26,209-235` (`-p` publishing from services): rewrite or delete with the docker decision.
- `backend/src/__tests__/lifecycle-service.test.ts:169,263-270,428,1497-1514,2188` (allocation at create, preserved across refresh/profile switch): delete the assertions and drop the fixture.
- `backend/src/__tests__/reconciliation-service.test.ts:251-256,291,375` (configured service with `urlTemplate`; "registered ports behind configured ones"): rewrite to registrations only.
- `backend/src/__tests__/worktree-storage.test.ts:225,379,396,549` (meta round-trip with `allocatedPorts`): change to "old meta with `allocatedPorts` still loads".
- `backend/src/__tests__/setup.test.ts:45-48,94` (config parse): change to "legacy `services` is ignored and warns".
- `backend/src/__tests__/init-authoring.test.ts:344` (template contains `urlTemplate`): flip.

Fixture-only churn (drop `services: []` from `ProjectConfig` literals or `allocatedPorts: {}` from metas): about 20 backend test files (`agent-chat-service`, `agent-registry`, `agents-ui-service`, `claude-conversation-service`, `claude-streaming-launch-service`, `native-terminal-service`, `oneshot-watcher-service`, `snapshot-service`, `tab-logic`, `worktree-conversation-service`, …), `bin/src/worktree-commands.test.ts:982`, and frontend tests that build an `AppConfig` (`App.test.ts`, `TopBar.test.ts`, `MobileChatSurface.test.ts`, `SettingsDialog.test.ts`, `WorktreeList.test.ts`, `WorktreeConversationPanel.test.ts`, `agent-capabilities.test.ts`, `worktree-list.test.ts`). The type checker finds all of them.

---

## 2. Target design

### Deleted
- `ServiceSpec`, `ProjectConfig.services`, `parseServices`, `ServiceConfig` re-export (`domain/config.ts`, `adapters/config.ts`).
- `allocateServicePorts` (`domain/policies.ts`) and `LifecycleService.allocatePorts`, plus the `allocatedPorts` arguments at `lifecycle-service.ts:1026,1448` and `worktree-service.ts`.
- `WorktreeMeta.allocatedPorts` and `stringifyAllocatedPorts`. `buildRuntimeEnvMap` becomes `{ ...dotenv, ...startupEnvValues, ...extraEnv, WEBMUX_* }`.
- `ServiceConfigSchema`, `AppConfig.services`, `ServiceConfig` type; `getFrontendConfig().services`; frontend `types.ts` re-export and the `App.svelte` default.
- `LaunchContainerOpts.services` and the `-p` loop. What replaces it depends on the docker decision (§4, Q1).

### Simplified
`buildServiceStates` no longer needs the config, a synthetic meta, `buildRuntimeEnvMap` or `expandTemplate`:

```ts
async function buildServiceStates(
  deps: Pick<ReconciliationServiceDependencies, "portProbe" | "portRegistrations">,
  input: { repoRoot: string; worktreeId: string },
): Promise<ServiceRuntimeState[]> {
  const states = await Promise.all(deps.portRegistrations.list(input.repoRoot, input.worktreeId)
    .map(async (entry) => ({
      name: entry.label,
      port: entry.port,
      running: await deps.portProbe.isListening(entry.port),
      url: null, // frontend falls back to the dashboard's own hostname
    })));
  return states.filter((service) => service.running);
}
```

- `portRegistrations` becomes **required** in `ReconciliationServiceDependencies` and `createWebmuxRuntime` options. Every real runtime passes it. The CLI's `createWebmuxRuntime` (`bin/src/worktree-commands.ts`) needs a check: if it reconciles without a registry it would show no services.
- `url: null` instead of `http://localhost:<port>` (see Q4). This makes registered ports work from a remote dashboard the way unconfigured `services` did.
- Keep the wire shape (`ServiceStatusSchema` with nullable `port`/`url`, `running`) to avoid frontend churn. Optionally tighten `ServiceRuntimeState.port` to `number` later. Not required.
- `expandTemplate` stays, with one caller (profile `systemPrompt`). `${WEBMUX_BRANCH}`, `startupEnvs` and dotenv values still expand.
- `normalizeWorktreeMeta` deletes a stray `allocatedPorts` key on read. That is cosmetic: the file is rewritten on the next meta write.

### Not changed
- Port registry, sweep, TTL, `PORT_RANGE_*`, `webmux port` CLI and endpoints, unless Stage 0 adds sticky registrations or removal cleanup.
- Profiles and pane templates (out of scope). Interactions are flagged below.

---

## 3. Implications for current users

| Scenario | Today | After removal | What the user does |
|---|---|---|---|
| **Command pane** runs `FRONTEND_PORT=$FRONTEND_PORT npm run dev` (README) or `bun run dev` reading `$PORT` (this repo's `full`/`sandbox`) | Pane starts at creation with a per-worktree port | `$PORT` is unset. The server falls back to its own default, so **every worktree binds the same port** and all but one fail | Rewrite to `PORT=$(webmux port be) FRONTEND_PORT=$(webmux port fe) bun run dev`. The same label returns the same port, so coupled services (vite proxying to `$PORT`) still agree. Host only. Works because panes start after meta is written and `resolveWorktreeId` reconciles first (`server.ts:1776-1779`). Verify in Stage 0 |
| **Agent shell** starts the dev server ad hoc | Agent may reuse the inherited `$PORT` and never register | Agent must call `webmux port` (prompt says so) | Nothing, if the agent follows the prompt (§4 R1) |
| **Hook** (`postCreate`/`preRemove`) reads `$PORT` | Real env var | Unset | Call `webmux port <label>` inside the hook. **But** nothing listens during `postCreate`, so the registration expires 5 minutes later unless a server starts. Needs sticky registrations (Q2) |
| **`startupEnvs`** with `${PORT}` | Already literal, never worked (§1.3) | Same | Docs fix only. Drop the starter example |
| **Port needed at creation** (`.env` written by `postCreate`, generated config, Docker Compose file) | Stable for the worktree's lifetime | Can be **re-issued to another worktree** after 5 minutes of nothing listening (e.g. overnight, while the worktree is closed). The file then points at a port another worktree owns | Needs sticky registrations (Q2), or the app reads the port at start time instead of from a file. **This is a real regression for this group** |
| **Fixed port** (OAuth callback registered at a provider) | `services` never gave a truly fixed port either (slot ≥ 1, step per worktree). Users already had to register a set of callback URLs | `webmux port web --port 4321` registers a specific port with cross-worktree conflict detection (409). Expires like any other registration, but `--port` re-registers the same number, so re-running it at start is idempotent | Use `--port`. Arguably better than before. Still gets TTL churn, which sticky fixes |
| **Docker/sandbox profile** | `-p 127.0.0.1:P:P` for each service port, `systemPrompt` tells the agent the ports | No publishing, no CLI in the container, no `webmux port` prompt for docker. **Dev servers inside the container are unreachable from the host browser** | No workaround without Stage 0 work (Q1). **Removing `services` is a plain regression for docker users** |
| **`urlTemplate` with a non-localhost host or a path** (`https://wt.example.dev/app`, `127.0.0.1` vs `localhost`) | Expanded per worktree | Gone. Link is `<dashboard host>:<port>` (with `url: null`) or `localhost:<port>` (today's registration behaviour) | No equivalent. Proposal in Q4: `webmux port web --path /app` or `--url`. The reverse-proxy case (custom host per worktree) is rare. I'd drop it unless someone asks |
| **Profile `systemPrompt` with `${PORT}`** (this repo, README, example yaml) | Expanded to the port | Expands to `""` silently: "backend is running on: ." | Delete those lines. The tmux prompt already teaches `webmux port`. Stage 1 warns when a profile `systemPrompt` references a service `portEnv` |
| **Existing worktree with `allocatedPorts` in meta** | Ports in `runtime.env` | Meta key ignored. `runtime.env` is rewritten without the ports on the next refresh/open (`lifecycle-service.ts:1053`). **Already-running panes keep the old `$PORT` until restarted.** The dashboard stops showing those services. The registry doesn't know those ports, so it can hand one to a new worktree while an old pane still listens on it. `canBind` rejects it while it is actually listening, so a real collision only happens after the old server stops and restarts | Restart the worktree's dev servers via `webmux port`. Optional: one-time import of `allocatedPorts` into the registry (Q5) |
| **`.env.local` sets `PORT`** | Overridden by the `services` value (`fs.ts:190` spreads after dotenv) | `.env.local` value wins | Behaviour change, probably the one users wanted |

---

## 4. Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | **Agents don't call `webmux port`**: they run `bun run dev` on the default port, collide, or the server is never shown | Medium. Prompt compliance is good for Claude and less reliable for others. With `services` gone, `$PORT` is no longer pre-set as a safety net | Collisions across worktrees; no dashboard link | Keep the prompt short and imperative (it is). Add a `webmux port` section to README/site so humans can tell the agent. Stage 0 fixes chat-mode/docker prompt gaps. Possible later step: a sweep that notices an unregistered listener in the worktree's process tree. Not proposed now |
| R2 | **`$PORT` collision in agent shells**: the CLI treats an inherited `PORT` as the webmux server port for every command except `port` (`bin/src/webmux.ts:110-111,165-170`) | Today: high whenever `services` exports `PORT`. After removal: **lower** (runtime.env no longer sets it), but still occurs if the agent does `export PORT=$(webmux port web)` and then calls `webmux send`, or if the tmux server inherited `PORT` from the environment of `webmux serve` | Agent's `webmux` CLI calls hit the dev server or fail | Stage 0: inside a managed shell (`WEBMUX_WORKTREE_ID` set), ignore inherited `PORT` for **all** commands, not just `port`; only `--port` or a dedicated `WEBMUX_PORT` pins it. Add CLI tests |
| R3 | **Non-Claude agents** | Low for codex/pi/opencode in tmux mode: all four builtins get the joined system prompt (`agents/claude.ts:47`, `codex.ts:45` via `developer_instructions`, `pi.ts:38`, `opencode.ts:42-51` via an instructions file). Medium for **custom agents**: they get it only if their `startCommand` uses `${SYSTEM_PROMPT}` (`agent-service.ts:12,30,47`). High for **chat-mode Claude** (gets no port block, §TL;DR) and **docker** (prompt is host-only, `lifecycle-service.ts:1186`) | Agent never learns the mechanism | Stage 0: add the port block to the chat-mode launch context. Docker per Q1. Note in the custom-agent docs that `${SYSTEM_PROMPT}` carries webmux instructions. Resumed sessions (`launchMode: "resume"`) get no webmux system prompt; whether the agent keeps the original depends on the agent. That is unchanged by this plan |
| R4 | **Docker runtime** loses port publishing | Certain if nothing is done | Sandbox dev servers unreachable from the host | Q1. Recommended smallest fix below |
| R5 | **Upgrades / old configs**: `services` silently ignored, `${PORT}` in prompts silently empty, command panes start on clashing default ports | Certain for every project using `services` (including this repo) | Confusing breakage with no error | Stage 1 warning ships at least one release before removal. After removal, keep a **load-time warning** (not an error) for a leftover `services` key for a few releases. Changelog entry with a before/after snippet |
| R6 | **Stale registrations / worktree removal**: registrations are keyed by `worktreeId` and released only by TTL. Removing a worktree doesn't free them | Low impact (5 min) | Ports held briefly after removal | Stage 0: release a worktree's registrations in the remove path |
| R7 | **Range exhaustion / overlap**: 4100–4999 is fixed; old `services` users may have `portStart` inside it (`setup.test.ts` uses 4100) | Low | `exhausted` 503, or an old pane's port re-issued (see §3) | `canBind` already skips listening ports. Document the range. Make it configurable only if someone asks |

---

## 5. Migration and rollout

**Recommendation: deprecate first, remove one or two releases later.** The removal itself is low-risk code-wise. The user-visible fallout (silent empty `${PORT}`, clashing default ports, docker) is not, and a warning costs almost nothing.

1. **Release N (Stage 0 + 1)**: gaps fixed. `services` still works. On config load, if `services` is non-empty, log once:
   `[config] "services" is deprecated and will be removed; use \`webmux port <label>\` in panes/agents instead. See <docs link>.`
   Also warn when a profile `systemPrompt` contains `${<portEnv>}`. `webmux init` stops generating `services`. Docs mark it deprecated and document `webmux port`. This repo's own `.webmux.yaml` migrates (it is the first real test of the guidance).
2. **Release N+1 or N+2 (Stage 2)**: removal. A leftover `services` key → same warning, saying "ignored" instead of "deprecated". **Not** a hard error: a config error blocks the server from starting, which is worse than a missing badge. Old metas load fine.
3. **Changelog**: release-please builds it from commit messages, so the removal commit needs a `BREAKING CHANGE:` footer with a migration snippet:
   ```yaml
   # before
   services: [{ name: web, portEnv: PORT, portStart: 3000, portStep: 10 }]
   panes: [{ kind: command, command: "npm run dev" }]
   # after
   panes: [{ kind: command, command: "PORT=$(webmux port web) npm run dev" }]
   ```
4. **Version**: pre-1.0 semver allows breaking changes in a minor. But release-please without `bump-minor-pre-major: true` turns a breaking commit at 0.43.x into **1.0.0**. Either set `bump-minor-pre-major: true` before the removal lands (→ 0.44/0.45), or accept 1.0.0 deliberately. Not a major version in spirit: config compatibility is "warn and ignore".

---

## 6. Staged implementation

Each stage ships on its own and keeps `bun test` + `bun run check` green.

### Stage 0: close the gaps (additive, no behaviour removed)
1. **Chat-mode prompt**: export the `webmux port` paragraph from `buildTmuxPaneSystemPrompt` as its own builder. Append it in `buildClaudeStreamingLaunchContext` (host only). *Tests*: `claude-streaming-launch-service.test.ts` asserts the block; `session-service` test asserts the tmux prompt still contains it.
2. **CLI `PORT` handling (R2)**: generalize `bin/src/webmux.ts:165-170` to "ignore inherited `PORT` when `WEBMUX_WORKTREE_ID` is set". *Tests*: `parseRootArgs` cases in `bin/src/webmux.test.ts` (or the existing CLI test file).
3. **Release on remove (R6)**: `PortRegistrationService.unregisterWorktree(projectDir, worktreeId)`, called from the remove path. *Tests*: service unit test plus a lifecycle remove test with a stub registry.
4. **Sticky registrations** (if Q2 = yes): `webmux port <label> --keep` sets `sticky: true`. `expireRegistrations` skips sticky entries, and they are released only by `rm` or worktree removal (step 3). *Tests*: domain `expireRegistrations`, CLI parse, endpoint schema.
5. **Docker** (per Q1, recommended option): see Q1. *Tests*: `docker.test.ts` publishes the reserved ports; lifecycle test registers them before `launchContainer`.
6. **`url: null` for registered ports** (if Q4 agrees). *Tests*: reconciliation test.
7. **Docs for `webmux port`** in README and site (none exist today).

### Stage 1: deprecate
1. Warning on load for non-empty `services` and for `${portEnv}` in profile `systemPrompt`s (`adapters/config.ts`). *Tests*: `setup.test.ts` or a config test asserts the warning, and that parsing is unchanged.
2. `init-authoring.ts`: drop `services` from the agent prompt (`:105`), rewrite `:108-109` to "command panes that start a server should use `PORT=$(webmux port <label>) <cmd>`". Replace the template block (`:303-314`) and the pane example (`:356-357`). Drop the broken `startupEnvs` example (`:439-440`). *Tests*: `init-authoring.test.ts:344` flips to assert `webmux port` guidance and no `services:`.
3. Docs: README, `.webmux.example.yaml`, `site/src/lib/docs.ts`, `DocsPage.svelte`, `HomePage.svelte` → mark `services` deprecated and show the `webmux port` equivalent.
4. Migrate this repo's `.webmux.yaml`: `full`/`sandbox` command panes use `webmux port be`/`fe`. Remove `${PORT}` lines from `systemPrompt`s. (The `sandbox` profile depends on Stage 0.5.)

### Stage 2: remove
1. Backend types and parsing: delete `ServiceSpec`, `services`, `parseServices`, `ServiceConfig`. Keep a `"services" in parsed` warning.
2. Allocation: delete `allocateServicePorts`, `allocatePorts`, `allocatedPorts` (meta type, `worktree-service.ts`, `buildRuntimeEnvMap`). Strip it in `normalizeWorktreeMeta`.
3. Reconciliation: replace `buildServiceStates` per §2. Make `portRegistrations` required.
4. Docker: delete the services loop (Stage 0.5 has already replaced it).
5. API contract, server, frontend: drop `ServiceConfigSchema`, `AppConfig.services`, `getFrontendConfig().services`, `types.ts` re-export, `App.svelte` default.
6. Tests:
   - Delete: `domain-policies.test.ts` `allocateServicePorts` suite; lifecycle allocation assertions (`:428,1497-1514,2188`); the docker services-publishing cases.
   - Rewrite: reconciliation "behind configured ones" (`:375`) → "running registrations only, idle ones hidden"; `setup.test.ts:94` → legacy key ignored and warns; `worktree-storage.test.ts:379-396` → legacy `allocatedPorts` meta loads and is stripped.
   - Fixture churn: remove `services: []` / `allocatedPorts: {}` everywhere the type checker complains.
7. Docs: remove the deprecated sections and config reference rows. Commit with a `BREAKING CHANGE:` footer.

---

## 7. Open questions for you

1. **Docker.** Pick one:
   - (a) **Recommended, smallest:** a docker-profile-only `ports: [be, fe]` label list. At container launch, webmux registers those labels sticky, publishes `-p 127.0.0.1:P:P`, and writes `WEBMUX_PORT_BE=…` into `runtime.env` so panes and the agent can use it. It touches profile config (out of scope), so it needs your call.
   - (b) Install the `webmux` CLI in the sandbox image, point it at `host.docker.internal`, and run containers with `--network host`. Panes then work like the host. But it depends on host networking, which not every Docker setup supports, and it gives up the loopback-only publishing.
   - (c) Accept that docker loses dashboard ports and publishing. Users add `-p` some other way. I don't recommend this.
2. **Sticky registrations**: add `--keep` (no TTL, released on `rm` or worktree removal) for the "port known at creation" and OAuth users? Without it, removing `services` regresses them. I recommend yes.
3. **Deprecation window**: one release or two? And leftover `services` after removal: warn-and-ignore (recommended) or hard error?
4. **Service URLs**: switch registered ports to `url: null` (dashboard-host-relative)? Recommended. And do we need a `--path`/`--url` flag to replace `urlTemplate`, or drop that capability?
5. **Existing `allocatedPorts`**: one-time import into the registry on upgrade (as labels from the old service names, so running servers keep their badges and their ports are protected), or just let them lapse? Import is ~30 lines and only matters during the upgrade window. I lean towards letting them lapse.
6. **Versioning**: set `bump-minor-pre-major: true`, or let the removal be 1.0.0?
7. **Custom agents**: is "use `${SYSTEM_PROMPT}` in your `startCommand`" an acceptable answer, or should webmux also expose the port instructions another way (e.g. an env var)?
