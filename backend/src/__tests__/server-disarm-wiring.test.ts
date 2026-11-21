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

/** Source-level regression test: a worktree being created or removed is missing from (or about
 *  to leave) the runtime, so the name → id translation would answer 404. The busy guard must run
 *  first so those requests keep getting a 409. */
describe("server.ts busy guard before name resolution", () => {
  const serverPath = join(import.meta.dir, "..", "server.ts");

  it("checks the branch is not busy before resolving a terminal attach", async () => {
    const source = await Bun.file(serverPath).text();
    expect(source).toMatch(/ensureBranchNotBusy\(branch\);\s*const terminalWorktree = await resolveTerminalWorktree\(await resolveWorktreeIdByName\(branch\)\)/);
  });

  it("checks the branch is not busy before resolving a sent prompt", async () => {
    const source = await Bun.file(serverPath).text();
    expect(source).toMatch(/async function apiSendPrompt\(name: string, req: Request\): Promise<Response> \{\s*ensureBranchNotBusy\(name\);[\s\S]*?resolveWorktreeIdByName\(name\)/);
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
  ];

  it.each(expected)("%s resolves the id, then guards its branch", async (fn) => {
    const source = await Bun.file(serverPath).text();
    const pattern = new RegExp(
      `async function ${fn}\\(id: string(, req: Request)?\\): Promise<Response> \\{\\s*`
        + `const \\{ worktreeId, branch \\} = await resolveRouteWorktree\\(id\\);\\s*`
        + `(ensureBranchNotBusy|return withMutatingTab|return withRemovingBranch)\\(branch`,
    );
    expect(source).toMatch(pattern);
  });

  it.each(["apiPostWorktreeToLinear", "apiSyncWorktreePrs"])("%s resolves the id", async (fn) => {
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
