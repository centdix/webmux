import { beforeEach, describe, expect, it } from "vitest";
import {
  LAST_SELECTED_WORKTREE_STORAGE_KEY,
  WEB_CHAT_UI_STORAGE_KEY,
  ideLabelForUrl,
  loadSavedSelectedWorktree,
  loadUseWebChatUi,
  makeIdeUrl,
  resolveSelectedBranch,
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

  it("stores and clears the last selected worktree", () => {
    saveSelectedWorktree("feature/last-used");

    expect(loadSavedSelectedWorktree()).toBe("feature/last-used");
    expect(localStorage.getItem(LAST_SELECTED_WORKTREE_STORAGE_KEY)).toBe("feature/last-used");

    saveSelectedWorktree(null);

    expect(loadSavedSelectedWorktree()).toBeNull();
    expect(localStorage.getItem(LAST_SELECTED_WORKTREE_STORAGE_KEY)).toBeNull();
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
