import { describe, expect, it } from "bun:test";
import { join } from "node:path";

/** Source-level regression test: every endpoint that represents "the human took
 *  over" must call `disarmOneshotIfArmed`. The unit tests for the watcher and
 *  lifecycle service prove disarm works in isolation, but they don't prove the
 *  wiring is in place. A future refactor that quietly removes one of these
 *  calls would silently break the disarm UX without breaking any test —
 *  hence this assertion on the source itself. */
describe("server.ts disarm-on-interaction wiring", () => {
  const expected = [
    "agents-send-message",
    "agents-interrupt",
    "send-prompt",
    "upload-files",
    "close-worktree",
    "archive-worktree",
    "merge-worktree",
    "terminal-ws-input",
    "terminal-ws-send-keys",
  ];

  const serverPath = join(import.meta.dir, "..", "server.ts");

  it.each(expected)("server.ts contains a disarmOneshotIfArmed(..., \"%s\") call", async (reason) => {
    const source = await Bun.file(serverPath).text();
    const pattern = new RegExp(`disarmOneshotIfArmed\\([^)]*"${reason}"`);
    expect(source).toMatch(pattern);
  });

  it("marks Codex app-server interrupts as terminal-stale after success", async () => {
    const source = await Bun.file(serverPath).text();
    const pattern = /if \(chatSupport\.data\.provider === "codex"\) \{[\s\S]*?interruptWorktreeConversation\(resolved\.worktree\)[\s\S]*?if \(!interruptResult\.ok\)[\s\S]*?setAgentTerminalStale\(resolved\.worktree, true\)[\s\S]*?jsonResponse\(interruptResult\.data\)/;
    expect(source).toMatch(pattern);
  });

  it("guards agent terminal refreshes against busy worktrees", async () => {
    const source = await Bun.file(serverPath).text();
    // The busy-guard is now provided by withMutatingTab (which calls
    // ensureBranchNotBusy internally) — see the serialization wiring test below.
    const pattern = /async function apiRefreshWorktreeAgentTerminal\(id: string\): Promise<Response> \{\s*const \{ worktreeId, branch \} = await resolveRouteWorktree\(id\);\s*return withMutatingTab\(branch[\s\S]*?lifecycleService\.refreshAgentTerminal\(worktreeId\)/;
    expect(source).toMatch(pattern);
  });
});

/** Source-level regression test: a worktree being created is missing from the runtime, so the
 *  terminal WebSocket must check its id with `resolveRouteWorktree` (409 while being created) and
 *  then `resolveTerminalWorktree` (409 while removed / tabs mutating) before attaching. */
describe("server.ts terminal WebSocket attaches by id", () => {
  const serverPath = join(import.meta.dir, "..", "server.ts");

  it("upgrades the terminal and agents WebSockets with the worktree id from the route", async () => {
    const source = await Bun.file(serverPath).text();
    expect(source).toMatch(/\[projectApiPaths\.streamTerminal\]: \(req, server\) => \{\s*const parsed = parseParams\(req\.params, WorktreeIdParamsSchema\);[\s\S]*?data: \{ kind: "terminal", prefix: instancePrefix, worktreeId,/);
    expect(source).toMatch(/\[projectApiPaths\.streamAgentsWorktreeConversation\]: \(req, server\) => \{\s*const parsed = parseParams\(req\.params, WorktreeIdParamsSchema\);[\s\S]*?data: \{ kind: "agents", prefix: instancePrefix, worktreeId,/);
  });

  it("resolves the route id before resolving the terminal attach target", async () => {
    const source = await Bun.file(serverPath).text();
    expect(source).toMatch(/const terminalWorktree = await resolveTerminalWorktree\(\(await resolveRouteWorktree\(worktreeId\)\)\.worktreeId\)/);
  });
});

/** Source-level regression test: routes addressed by worktree id check the id against the runtime
 *  (404 when unknown, 409 while still being created) and read the branch the busy guards key on
 *  from it, before doing anything else. */
describe("server.ts id routes resolve the worktree first", () => {
  const serverPath = join(import.meta.dir, "..", "server.ts");
  const expected = [
    "apiDeleteWorktree",
    "apiOpenWorktree",
    "apiGetNativeTerminalLaunch",
    "apiCloseWorktree",
    "apiRefreshWorktreeAgentTerminal",
    "apiSetWorktreeArchived",
    "apiSetWorktreeLabel",
    "apiSetWorktreeProfile",
    "apiMergeWorktree",
    "apiSendPrompt",
    "apiCreateWorktreeTab",
    "apiSelectWorktreeTab",
    "apiDeleteWorktreeTab",
  ];

  it.each(expected)("%s resolves the id, then guards its branch", async (fn) => {
    const source = await Bun.file(serverPath).text();
    const pattern = new RegExp(
      `async function ${fn}\\(id: string(, req: Request|, tabId: string)?\\): Promise<Response> \\{\\s*`
        + `const \\{ worktreeId, branch \\} = await resolveRouteWorktree\\(id\\);\\s*`
        + `(ensureBranchNotBusy|return withMutatingTab|return withRemovingBranch)\\(branch`,
    );
    expect(source).toMatch(pattern);
  });

  it.each([
    "apiPostWorktreeToLinear",
    "apiSyncWorktreePrs",
    "apiGetWorktreeDiff",
    "apiUploadFiles",
    "apiAttachAgentsWorktree",
    "apiGetAgentsWorktreeHistory",
    "apiSendAgentsWorktreeMessage",
    "apiInterruptAgentsWorktree",
  ])("%s resolves the id", async (fn) => {
    const source = await Bun.file(serverPath).text();
    expect(source).toMatch(new RegExp(`async function ${fn}\\(id: string[^)]*\\): Promise<Response> \\{[\\s\\S]*?await resolveRouteWorktree\\(id\\)`));
  });
});

/** Source-level regression test for tab-mutation serialization. open and
 *  agent-terminal refresh both rewrite the whole tabs array (via
 *  restoreWorktreeTabs), so they must hold the same per-branch lock as
 *  tab create/select/delete — otherwise a reopen racing a fork creation can
 *  clobber tab bookkeeping. A future refactor that drops the lock from one of
 *  these paths would silently reopen that race without failing any other test. */
describe("server.ts tab-mutation serialization wiring", () => {
  const serverPath = join(import.meta.dir, "..", "server.ts");
  const expected = [
    "apiCreateWorktreeTab",
    "apiSelectWorktreeTab",
    "apiDeleteWorktreeTab",
    "apiOpenWorktree",
    "apiRefreshWorktreeAgentTerminal",
  ];

  it.each(expected)("%s acquires the tab-mutation lock via withMutatingTab", async (fn) => {
    const source = await Bun.file(serverPath).text();
    const pattern = new RegExp(`async function ${fn}\\([^)]*\\): Promise<Response> \\{[\\s\\S]*?withMutatingTab\\(`);
    expect(source).toMatch(pattern);
  });
});
