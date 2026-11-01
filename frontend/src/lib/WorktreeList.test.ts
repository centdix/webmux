import { cleanup, fireEvent, render, screen, within } from "@testing-library/svelte";
import type { ComponentProps } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorktreeList from "./WorktreeList.svelte";
import type { WorktreeInfo, WorktreeListRow, WorktreeListSection } from "./types";

function createWorktree(branch: string, project = "webmux"): WorktreeInfo {
  return {
    project,
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

function createSection(rows: WorktreeListRow[], overrides: Partial<WorktreeListSection> = {}): WorktreeListSection {
  return { prefix: "webmux", name: "webmux", error: null, collapsed: false, rows, emptyMessage: null, ...overrides };
}

type ListProps = ComponentProps<typeof WorktreeList>;

function listProps(overrides: Partial<ListProps> = {}): ListProps {
  return {
    sections: [],
    selected: null,
    removing: new Set<string>(),
    initializing: new Set<string>(),
    archiving: new Set<string>(),
    postingLinear: new Set<string>(),
    notified: new Set<string>(),
    favorites: new Set<string>(),
    onselect: vi.fn(),
    onclose: vi.fn(),
    onarchive: vi.fn(),
    oncreatesubworktree: vi.fn(),
    onremove: vi.fn(),
    oneditprofile: vi.fn(),
    ontogglefavorite: vi.fn(),
    ontogglecollapsed: vi.fn(),
    ...overrides,
  };
}

function renderList(overrides: Partial<ListProps> = {}): ReturnType<typeof render> {
  return render(WorktreeList, { props: listProps(overrides) });
}

describe("WorktreeList", () => {
  afterEach(() => cleanup());

  it("calls onremove without selecting the row when the remove button is clicked", async () => {
    const onselect = vi.fn();
    const onremove = vi.fn();

    const { container } = renderList({
      sections: [createSection([createRow(createWorktree("feature/list-actions"))])],
      onselect,
      onremove,
    });

    await fireEvent.click(within(container).getByRole("button", { name: /actions for feature\/list-actions/i }));
    await fireEvent.click(within(container).getByRole("button", { name: "Remove" }));

    expect(onremove).toHaveBeenCalledWith({ project: "webmux", branch: "feature/list-actions" });
    expect(onselect).not.toHaveBeenCalled();
  });

  it("disables row actions while a worktree is being removed", () => {
    const { container } = renderList({
      sections: [createSection([createRow(createWorktree("feature/list-removing"))])],
      removing: new Set(["webmux:feature/list-removing"]),
    });

    expect(screen.getByText("feature/list-removing").closest("button")).toBeDisabled();
    expect(within(container).getByRole("button", { name: /actions for feature\/list-removing/i })).toBeDisabled();
  });

  it("shows a three-dot menu with row actions", async () => {
    const onarchive = vi.fn();

    renderList({
      sections: [createSection([createRow(createWorktree("feature/menu-actions"))])],
      onarchive,
    });

    await fireEvent.click(screen.getByRole("button", { name: /actions for feature\/menu-actions/i }));

    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Archive" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Merge" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove" })).toBeInTheDocument();

    await fireEvent.click(screen.getByRole("button", { name: "Archive" }));
    expect(onarchive).toHaveBeenCalledWith({ project: "webmux", branch: "feature/menu-actions" });
  });

  it("calls oncreatesubworktree with the row branch from the menu", async () => {
    const oncreatesubworktree = vi.fn();

    renderList({
      sections: [createSection([createRow(createWorktree("feature/sub-base"))])],
      oncreatesubworktree,
    });

    await fireEvent.click(screen.getByRole("button", { name: /actions for feature\/sub-base/i }));
    await fireEvent.click(screen.getByRole("button", { name: "Create sub-worktree" }));

    expect(oncreatesubworktree).toHaveBeenCalledWith({ project: "webmux", branch: "feature/sub-base" });
  });

  it("toggles favorites with the always-visible star button without selecting the row", async () => {
    const onselect = vi.fn();
    const ontogglefavorite = vi.fn();

    renderList({
      sections: [createSection([createRow(createWorktree("feature/fav")), createRow(createWorktree("feature/plain"))])],
      favorites: new Set<string>(["webmux:feature/fav"]),
      onselect,
      ontogglefavorite,
    });

    const remove = screen.getByRole("button", { name: "Remove feature/fav from favorites" });
    const add = screen.getByRole("button", { name: "Add feature/plain to favorites" });
    expect(remove.getAttribute("aria-pressed")).toBe("true");
    expect(add.getAttribute("aria-pressed")).toBe("false");

    await fireEvent.click(remove);
    expect(ontogglefavorite).toHaveBeenCalledWith({ project: "webmux", branch: "feature/fav" });

    await fireEvent.click(add);
    expect(ontogglefavorite).toHaveBeenCalledWith({ project: "webmux", branch: "feature/plain" });
    expect(onselect).not.toHaveBeenCalled();
  });

  it("renders labels as the primary row name with the branch below", () => {
    renderList({
      sections: [createSection([createRow({ ...createWorktree("feature/random-fallback"), label: "Search ranking" })])],
    });

    expect(screen.getByText("Search ranking")).toBeInTheDocument();
    expect(screen.getByText("feature/random-fallback")).toBeInTheDocument();
  });

  it("places archived and closed row badges below the worktree name", () => {
    renderList({
      sections: [createSection([
          createRow({
            ...createWorktree("feature/very-long-archived-closed-name"),
            archived: true,
            mux: "",
          }),
        ])],
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
    renderList({
      sections: [createSection([createRow(createWorktree("feature/archiving"))])],
      archiving: new Set<string>(["webmux:feature/archiving"]),
    });

    await fireEvent.click(screen.getByRole("button", { name: /actions for feature\/archiving/i }));

    expect(screen.getByRole("button", { name: "Archive" })).toBeDisabled();
  });
  it("lists every project in the given order, each under its own header", () => {
    renderList({
      sections: [
        createSection([createRow(createWorktree("main"))]),
        createSection([createRow(createWorktree("main", "images")), createRow(createWorktree("feat/img", "images"))], {
          prefix: "images",
          name: "Images",
        }),
      ],
    });

    const headers = screen.getAllByRole("button", { expanded: true });
    expect(headers.map((header) => header.textContent?.replace(/\s+/g, " ").trim())).toEqual(["webmux 1", "Images 2"]);
    const images = screen.getByRole("region", { name: "Images" });
    expect(within(images).getByRole("button", { name: /^feat\/img\b/ })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "webmux" })).queryByText("feat/img")).not.toBeInTheDocument();
  });

  it("highlights and acts on rows by project, so equal branches stay distinct", async () => {
    const onselect = vi.fn();
    const ontogglefavorite = vi.fn();
    renderList({
      sections: [
        createSection([createRow(createWorktree("main"))]),
        createSection([createRow(createWorktree("main", "images"))], { prefix: "images", name: "Images" }),
      ],
      selected: { project: "images", branch: "main" },
      favorites: new Set(["webmux:main"]),
      onselect,
      ontogglefavorite,
    });

    const images = screen.getByRole("region", { name: "Images" });
    const webmux = screen.getByRole("region", { name: "webmux" });
    expect(within(images).getByRole("button", { name: /^main\b/ })).toHaveClass("bg-active");
    expect(within(webmux).getByRole("button", { name: /^main\b/ })).not.toHaveClass("bg-active");
    expect(within(webmux).getByRole("button", { name: "Remove main from favorites" })).toBeInTheDocument();

    await fireEvent.click(within(webmux).getByRole("button", { name: /^main\b/ }));
    await fireEvent.click(within(images).getByRole("button", { name: "Add main to favorites" }));

    expect(onselect).toHaveBeenCalledWith({ project: "webmux", branch: "main" });
    expect(ontogglefavorite).toHaveBeenCalledWith({ project: "images", branch: "main" });
  });

  it("hides a collapsed project's rows and toggles it from its header", async () => {
    const ontogglecollapsed = vi.fn();
    renderList({
      sections: [createSection([createRow(createWorktree("feature/hidden"))], { collapsed: true })],
      ontogglecollapsed,
    });

    expect(screen.queryByText("feature/hidden")).not.toBeInTheDocument();
    const header = screen.getByRole("button", { name: /^webmux/ });
    expect(header).toHaveAttribute("aria-expanded", "false");

    await fireEvent.click(header);
    expect(ontogglecollapsed).toHaveBeenCalledWith("webmux");
  });

  it("shows a project's fetch error and empty message under its header", () => {
    renderList({
      sections: [
        createSection([createRow(createWorktree("stale"))], { error: "git exploded" }),
        createSection([], { prefix: "images", name: "Images", emptyMessage: "No worktrees found." }),
      ],
    });

    expect(within(screen.getByRole("region", { name: "webmux" })).getByText("Failed to load worktrees: git exploded"))
      .toBeInTheDocument();
    expect(screen.getByText("stale")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Images" })).getByText("No worktrees found.")).toBeInTheDocument();
  });

  it("shows the empty message when no project is listed", () => {
    renderList({ emptyMessage: 'No matches for "zzz".' });

    expect(screen.getByText('No matches for "zzz".')).toBeInTheDocument();
  });
});
