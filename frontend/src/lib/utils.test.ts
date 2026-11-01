import { beforeEach, describe, expect, it } from "vitest";
import type { AppConfig, PrEntry } from "./types";
import {
  LAST_PROJECT_STORAGE_KEY,
  LAST_SELECTED_WORKTREE_STORAGE_KEY,
  WEB_CHAT_UI_STORAGE_KEY,
  FAVORITE_WORKTREES_STORAGE_KEY,
  FAVORITE_WORKTREE_KEYS_STORAGE_KEY,
  ideLabelForUrl,
  loadFavoriteWorktreeKeys,
  loadLastProject,
  loadSavedSelectedWorktree,
  loadUseWebChatUi,
  makeIdeUrl,
  projectRepos,
  resolveSelectedBranch,
  prBadgeClass,
  prStateTextClass,
  saveFavoriteWorktreeKeys,
  saveLastProject,
  saveSelectedWorktree,
  saveUseWebChatUi,
} from "./utils";

describe("worktree selection persistence", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("keeps the saved branch before the first successful worktree load", () => {
    expect(resolveSelectedBranch("feature/last-used", undefined, [], false)).toBe("feature/last-used");
  });

  it("keeps the current selection when that worktree still exists", () => {
    expect(
      resolveSelectedBranch(
        "feature/last-used",
        { branch: "feature/last-used" },
        [{ branch: "feature/last-used", mux: "✗" }],
        true,
      ),
    ).toBe("feature/last-used");
  });

  it("falls back to an open worktree when the saved branch is gone", () => {
    expect(
      resolveSelectedBranch(
        "feature/missing",
        undefined,
        [
          { branch: "feature/first", mux: "✗" },
          { branch: "feature/open", mux: "✓" },
        ],
        true,
      ),
    ).toBe("feature/open");
  });

  it("stores and clears the last selected worktree per project", () => {
    saveSelectedWorktree("proj-a", "feature/last-used");

    expect(loadSavedSelectedWorktree("proj-a")).toBe("feature/last-used");
    expect(loadSavedSelectedWorktree("proj-b")).toBeNull();
    expect(localStorage.getItem(`${LAST_SELECTED_WORKTREE_STORAGE_KEY}:proj-a`)).toBe("feature/last-used");

    saveSelectedWorktree("proj-a", null);

    expect(loadSavedSelectedWorktree("proj-a")).toBeNull();
    expect(localStorage.getItem(`${LAST_SELECTED_WORKTREE_STORAGE_KEY}:proj-a`)).toBeNull();
  });

  it("migrates the unscoped selection into the first project that loads it", () => {
    localStorage.setItem(LAST_SELECTED_WORKTREE_STORAGE_KEY, "feature/legacy");

    expect(loadSavedSelectedWorktree("proj-a")).toBe("feature/legacy");
    expect(localStorage.getItem(LAST_SELECTED_WORKTREE_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(`${LAST_SELECTED_WORKTREE_STORAGE_KEY}:proj-a`)).toBe("feature/legacy");
    expect(loadSavedSelectedWorktree("proj-b")).toBeNull();
  });

  it("keeps a scoped selection over the unscoped one", () => {
    saveSelectedWorktree("proj-a", "feature/scoped");
    localStorage.setItem(LAST_SELECTED_WORKTREE_STORAGE_KEY, "feature/legacy");

    expect(loadSavedSelectedWorktree("proj-a")).toBe("feature/scoped");
  });

  it("stores and clears the last opened project", () => {
    saveLastProject("proj-a");

    expect(loadLastProject()).toBe("proj-a");
    expect(localStorage.getItem(LAST_PROJECT_STORAGE_KEY)).toBe("proj-a");

    saveLastProject(null);

    expect(loadLastProject()).toBeNull();
  });

  it("stores favorites of every project by worktree key and clears them when empty", () => {
    saveFavoriteWorktreeKeys(new Set(["proj-a:feature/a", "proj-b:feature/a"]));

    expect(loadFavoriteWorktreeKeys("proj-a")).toEqual(new Set(["proj-a:feature/a", "proj-b:feature/a"]));

    saveFavoriteWorktreeKeys(new Set());

    expect(localStorage.getItem(FAVORITE_WORKTREE_KEYS_STORAGE_KEY)).toBeNull();
  });

  it("migrates the per-project favorites into worktree keys once", () => {
    localStorage.setItem(FAVORITE_WORKTREE_KEYS_STORAGE_KEY, JSON.stringify(["proj-c:main"]));
    localStorage.setItem(`${FAVORITE_WORKTREES_STORAGE_KEY}:proj-a`, JSON.stringify(["feature/a", "main"]));
    localStorage.setItem(`${FAVORITE_WORKTREES_STORAGE_KEY}:proj-b`, JSON.stringify(["main"]));

    const expected = new Set(["proj-c:main", "proj-a:feature/a", "proj-a:main", "proj-b:main"]);
    expect(loadFavoriteWorktreeKeys("proj-a")).toEqual(expected);
    expect(localStorage.getItem(`${FAVORITE_WORKTREES_STORAGE_KEY}:proj-a`)).toBeNull();
    expect(localStorage.getItem(`${FAVORITE_WORKTREES_STORAGE_KEY}:proj-b`)).toBeNull();
    expect(loadFavoriteWorktreeKeys("proj-a")).toEqual(expected);
  });

  it("migrates the unscoped legacy favorites into the current project once", () => {
    localStorage.setItem(FAVORITE_WORKTREES_STORAGE_KEY, JSON.stringify(["feature/x"]));

    expect(loadFavoriteWorktreeKeys("proj-a")).toEqual(new Set(["proj-a:feature/x"]));
    expect(localStorage.getItem(FAVORITE_WORKTREES_STORAGE_KEY)).toBeNull();
    expect(loadFavoriteWorktreeKeys("proj-b")).toEqual(new Set(["proj-a:feature/x"]));
  });

  it("ignores malformed favorite worktrees data", () => {
    localStorage.setItem(FAVORITE_WORKTREE_KEYS_STORAGE_KEY, "not json");
    localStorage.setItem(`${FAVORITE_WORKTREES_STORAGE_KEY}:proj-a`, "{");

    expect(loadFavoriteWorktreeKeys("proj-a")).toEqual(new Set());
  });

  it("stores and clears the web chat UI preference", () => {
    expect(loadUseWebChatUi()).toBe(false);

    saveUseWebChatUi(true);

    expect(loadUseWebChatUi()).toBe(true);
    expect(localStorage.getItem(WEB_CHAT_UI_STORAGE_KEY)).toBe("true");

    saveUseWebChatUi(false);

    expect(loadUseWebChatUi()).toBe(false);
    expect(localStorage.getItem(WEB_CHAT_UI_STORAGE_KEY)).toBeNull();
  });
});

describe("makeIdeUrl", () => {
  it("returns null when dir is falsy", () => {
    expect(makeIdeUrl(null, null, "cursor")).toBeNull();
    expect(makeIdeUrl(undefined, null, "vscode")).toBeNull();
  });

  it("builds a local cursor:// URL", () => {
    expect(makeIdeUrl("/tmp/repo", null, "cursor")).toBe("cursor://file/tmp/repo");
  });

  it("builds an ssh cursor:// URL", () => {
    expect(makeIdeUrl("/tmp/repo", "devbox", "cursor")).toBe(
      "cursor://vscode-remote/ssh-remote+devbox/tmp/repo",
    );
  });

  it("builds a local vscode:// URL", () => {
    expect(makeIdeUrl("/tmp/repo", null, "vscode")).toBe("vscode://file/tmp/repo");
  });

  it("builds an ssh vscode:// URL", () => {
    expect(makeIdeUrl("/tmp/repo", "devbox", "vscode")).toBe(
      "vscode://vscode-remote/ssh-remote+devbox/tmp/repo",
    );
  });
});

describe("projectRepos", () => {
  const config: AppConfig = {
    name: "repo",
    profiles: [],
    agents: [],
    defaultProfileName: "",
    defaultAgentId: "claude",
    autoName: false,
    linearCreateTicketOption: false,
    startupEnvs: {},
    linkedRepos: [{ alias: "shared", dir: "/repos/shared" }, { alias: "remote-only" }],
    linearAutoCreateWorktrees: false,
    autoRemoveOnMerge: false,
    projectDir: "/repos/app",
    mainBranch: "trunk",
    ide: "vscode",
  };

  it("lists the project's own repo, then its linked repos with a directory", () => {
    expect(projectRepos(config, "")).toEqual([
      { repo: null, label: "trunk", ideUrl: "vscode://file/repos/app" },
      { repo: "shared", label: "shared", ideUrl: "vscode://file/repos/shared" },
    ]);
  });

  it("only offers pulling main until the config loads", () => {
    expect(projectRepos(undefined, "")).toEqual([{ repo: null, label: "main", ideUrl: null }]);
  });
});

describe("ideLabelForUrl", () => {
  it("labels a cursor:// URL as Cursor", () => {
    expect(ideLabelForUrl("cursor://file/tmp/repo")).toBe("Cursor");
  });

  it("labels a vscode:// URL as VS Code", () => {
    expect(ideLabelForUrl("vscode://file/tmp/repo")).toBe("VS Code");
  });

  it("falls back to Cursor for an unrecognized scheme", () => {
    expect(ideLabelForUrl("foo://file/tmp/repo")).toBe("Cursor");
  });
});

describe("PR draft styling", () => {
  const pr = (over: Partial<PrEntry>): Pick<PrEntry, "state" | "isDraft"> => ({
    state: "open",
    isDraft: false,
    ...over,
  });

  it("mutes a draft PR and keeps a ready-for-review PR highlighted", () => {
    expect(prStateTextClass(pr({ isDraft: true }))).toBe("text-muted");
    expect(prStateTextClass(pr({}))).toBe("text-primary");
  });

  it("badges a draft PR as muted and a ready-for-review PR as open", () => {
    expect(prBadgeClass(pr({ isDraft: true }))).toBe("bg-muted/20 text-muted");
    expect(prBadgeClass(pr({}))).toBe("bg-success/20 text-success");
  });

  it("keeps merged and closed colors regardless of the draft flag", () => {
    expect(prBadgeClass(pr({ state: "merged", isDraft: true }))).toBe("bg-merged/20 text-merged");
    expect(prStateTextClass(pr({ state: "closed", isDraft: true }))).toBe("text-danger");
  });
});
