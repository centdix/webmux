import { fireEvent, render, screen, within } from "@testing-library/svelte";
import { describe, expect, it, vi } from "vitest";
import WorktreeList from "./WorktreeList.svelte";
import type { WorktreeInfo, WorktreeListRow } from "./types";

function createWorktree(branch: string): WorktreeInfo {
  return {
    project: "webmux",
    branch,
    label: null,
    archived: false,
    agent: "claude",
    mux: "✓",
    path: `/tmp/${branch}`,
    dir: `/tmp/${branch}`,
    dirty: false,
    unpushed: false,
    status: "running",
    elapsed: "1m",
    profile: null,
    agentName: null,
    agentLabel: null,
    agentTerminalStale: false,
    services: [],
    paneCount: 1,
    prs: [],
    linearIssue: {
      identifier: "ENG-42",
      url: "https://linear.app/example/issue/ENG-42",
      state: {
        name: "In Progress",
        color: "#5e6ad2",
        type: "started",
      },
    },
    creating: false,
    creationPhase: null,
    source: "ui",
    oneshot: null,
    tabs: [],
    activeTabId: null,
  };
}

function createRow(worktree: WorktreeInfo, depth = 0): WorktreeListRow {
  return { worktree, depth };
}

describe("WorktreeList", () => {
  it("calls onremove without selecting the row when the remove button is clicked", async () => {
    const onselect = vi.fn();
    const onremove = vi.fn();

    const { container } = render(WorktreeList, {
      props: {
        rows: [createRow(createWorktree("feature/list-actions"))],
        selected: null,
        removing: new Set<string>(),
        initializing: new Set<string>(),
        archiving: new Set<string>(),
        postingLinear: new Set<string>(),
        notifiedBranches: new Set<string>(),
        favorites: new Set<string>(),
        onselect,
        onclose: vi.fn(),
        onarchive: vi.fn(),
        oncreatesubworktree: vi.fn(),
        onremove,
        oneditprofile: vi.fn(),
        ontogglefavorite: vi.fn(),
      },
    });

    await fireEvent.click(within(container).getByRole("button", { name: /actions for feature\/list-actions/i }));
    await fireEvent.click(within(container).getByRole("button", { name: "Remove" }));

    expect(onremove).toHaveBeenCalledWith("feature/list-actions");
    expect(onselect).not.toHaveBeenCalled();
  });

  it("disables row actions while a worktree is being removed", () => {
    const { container } = render(WorktreeList, {
      props: {
        rows: [createRow(createWorktree("feature/list-removing"))],
        selected: null,
        removing: new Set(["feature/list-removing"]),
        initializing: new Set<string>(),
        archiving: new Set<string>(),
        postingLinear: new Set<string>(),
        notifiedBranches: new Set<string>(),
        favorites: new Set<string>(),
        onselect: vi.fn(),
        onclose: vi.fn(),
        onarchive: vi.fn(),
        oncreatesubworktree: vi.fn(),
        onremove: vi.fn(),
        oneditprofile: vi.fn(),
        ontogglefavorite: vi.fn(),
      },
    });

    expect(screen.getByText("feature/list-removing").closest("button")).toBeDisabled();
    expect(within(container).getByRole("button", { name: /actions for feature\/list-removing/i })).toBeDisabled();
  });

  it("shows a three-dot menu with row actions", async () => {
    const onarchive = vi.fn();

    render(WorktreeList, {
      props: {
        rows: [createRow(createWorktree("feature/menu-actions"))],
        selected: null,
        removing: new Set<string>(),
        initializing: new Set<string>(),
        archiving: new Set<string>(),
        postingLinear: new Set<string>(),
        notifiedBranches: new Set<string>(),
        favorites: new Set<string>(),
        onselect: vi.fn(),
        onclose: vi.fn(),
        onarchive,
        oncreatesubworktree: vi.fn(),
        onremove: vi.fn(),
        oneditprofile: vi.fn(),
        ontogglefavorite: vi.fn(),
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: /actions for feature\/menu-actions/i }));

    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Merge" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(onarchive).toHaveBeenCalledWith("feature/menu-actions");
  });

  it("calls oncreatesubworktree with the row branch from the menu", async () => {
    const oncreatesubworktree = vi.fn();

    render(WorktreeList, {
      props: {
        rows: [createRow(createWorktree("feature/sub-base"))],
        selected: null,
        removing: new Set<string>(),
        initializing: new Set<string>(),
        archiving: new Set<string>(),
        postingLinear: new Set<string>(),
        notifiedBranches: new Set<string>(),
        favorites: new Set<string>(),
        onselect: vi.fn(),
        onclose: vi.fn(),
        onarchive: vi.fn(),
        oncreatesubworktree,
        onremove: vi.fn(),
        oneditprofile: vi.fn(),
        ontogglefavorite: vi.fn(),
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: /actions for feature\/sub-base/i }));
    await fireEvent.click(screen.getByRole("button", { name: "Create sub-worktree" }));

    expect(oncreatesubworktree).toHaveBeenCalledWith("feature/sub-base");
  });

  it("toggles favorites with the always-visible star button without selecting the row", async () => {
    const onselect = vi.fn();
    const ontogglefavorite = vi.fn();

    render(WorktreeList, {
      props: {
        rows: [createRow(createWorktree("feature/fav")), createRow(createWorktree("feature/plain"))],
        selected: null,
        removing: new Set<string>(),
        initializing: new Set<string>(),
        archiving: new Set<string>(),
        postingLinear: new Set<string>(),
        notifiedBranches: new Set<string>(),
        favorites: new Set<string>(["feature/fav"]),
        onselect,
        onclose: vi.fn(),
        onarchive: vi.fn(),
        oncreatesubworktree: vi.fn(),
        onremove: vi.fn(),
        oneditprofile: vi.fn(),
        ontogglefavorite,
      },
    });

    const remove = screen.getByRole("button", { name: "Remove feature/fav from favorites" });
    const add = screen.getByRole("button", { name: "Add feature/plain to favorites" });
    expect(remove.getAttribute("aria-pressed")).toBe("true");
    expect(add.getAttribute("aria-pressed")).toBe("false");

    await fireEvent.click(remove);
    expect(ontogglefavorite).toHaveBeenCalledWith("feature/fav");

    await fireEvent.click(add);
    expect(ontogglefavorite).toHaveBeenCalledWith("feature/plain");
    expect(onselect).not.toHaveBeenCalled();
  });

  it("renders labels as the primary row name with the branch below", () => {
    render(WorktreeList, {
      props: {
        rows: [createRow({ ...createWorktree("feature/random-fallback"), label: "Search ranking" })],
        selected: null,
        removing: new Set<string>(),
        initializing: new Set<string>(),
        archiving: new Set<string>(),
        postingLinear: new Set<string>(),
        notifiedBranches: new Set<string>(),
        favorites: new Set<string>(),
        onselect: vi.fn(),
        onclose: vi.fn(),
        onarchive: vi.fn(),
        oncreatesubworktree: vi.fn(),
        onremove: vi.fn(),
        oneditprofile: vi.fn(),
        ontogglefavorite: vi.fn(),
      },
    });

    expect(screen.getByText("Search ranking")).toBeInTheDocument();
    expect(screen.getByText("feature/random-fallback")).toBeInTheDocument();
  });

  it("places archived and closed row badges below the worktree name", () => {
    render(WorktreeList, {
      props: {
        rows: [
          createRow({
            ...createWorktree("feature/very-long-archived-closed-name"),
            archived: true,
            mux: "",
          }),
        ],
        selected: null,
        removing: new Set<string>(),
        initializing: new Set<string>(),
        archiving: new Set<string>(),
        postingLinear: new Set<string>(),
        notifiedBranches: new Set<string>(),
        favorites: new Set<string>(),
        onselect: vi.fn(),
        onclose: vi.fn(),
        onarchive: vi.fn(),
        oncreatesubworktree: vi.fn(),
        onremove: vi.fn(),
        oneditprofile: vi.fn(),
        ontogglefavorite: vi.fn(),
      },
    });

    const name = screen.getByText("feature/very-long-archived-closed-name");
    const archived = screen.getByText("archived");
    const closed = screen.getByText("closed");
    const nameRow = name.closest("[data-worktree-name-row]");
    const badgeRow = archived.closest("[data-worktree-badge-row]");

    if (!nameRow || !badgeRow) {
      throw new Error("Expected separate name and badge rows");
    }

    expect(nameRow).not.toContainElement(archived);
    expect(badgeRow).toContainElement(archived);
    expect(badgeRow).toContainElement(closed);
  });

  it("disables the archive action while the row is archiving", async () => {
    render(WorktreeList, {
      props: {
        rows: [createRow(createWorktree("feature/archiving"))],
        selected: null,
        removing: new Set<string>(),
        initializing: new Set<string>(),
        archiving: new Set<string>(["feature/archiving"]),
        postingLinear: new Set<string>(),
        notifiedBranches: new Set<string>(),
        favorites: new Set<string>(),
        onselect: vi.fn(),
        onclose: vi.fn(),
        onarchive: vi.fn(),
        oncreatesubworktree: vi.fn(),
        onremove: vi.fn(),
        oneditprofile: vi.fn(),
        ontogglefavorite: vi.fn(),
      },
    });

    await fireEvent.click(screen.getByRole("button", { name: /actions for feature\/archiving/i }));

    expect(screen.getByRole("button", { name: "Archive" })).toBeDisabled();
  });
});
