import { cleanup, fireEvent, render, screen, within } from "@testing-library/svelte";
import type { ComponentProps } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import WorktreeList from "./WorktreeList.svelte";
import type { PrEntry, ProjectListRows, WorktreeInfo, WorktreeListRow } from "./types";

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

function rowsOf(active: WorktreeInfo[], archived: WorktreeInfo[] = []): ProjectListRows {
  return { active: active.map((worktree) => createRow(worktree)), archived: archived.map((worktree) => createRow(worktree)) };
}

function createPr(overrides: Partial<PrEntry> = {}): PrEntry {
  return {
    repo: "org/repo",
    number: 7,
    state: "open",
    url: "https://github.com/org/repo/pull/7",
    updatedAt: "",
    ciStatus: "success",
    ciChecks: [],
    comments: [],
    isDraft: false,
    ...overrides,
  };
}

type ListProps = ComponentProps<typeof WorktreeList>;

function listProps(overrides: Partial<ListProps> = {}): ListProps {
  return {
    rows: rowsOf([]),
    showArchived: false,
    query: "",
    error: null,
    selected: null,
    removing: new Set<string>(),
    initializing: new Set<string>(),
    archiving: new Set<string>(),
    postingLinear: new Set<string>(),
    notified: new Set<string>(),
    favorites: new Set<string>(),
    onselect: vi.fn(),
    ontogglearchived: vi.fn(),
    onretry: vi.fn(),
    oncreate: vi.fn(),
    onopen: vi.fn(),
    onclose: vi.fn(),
    onarchive: vi.fn(),
    oncreatesubworktree: vi.fn(),
    onremove: vi.fn(),
    oneditlabel: vi.fn(),
    oneditprofile: vi.fn(),
    ontogglefavorite: vi.fn(),
    ...overrides,
  };
}

function renderList(overrides: Partial<ListProps> = {}): ReturnType<typeof render> {
  return render(WorktreeList, { props: listProps(overrides) });
}

function row(name: string): HTMLElement {
  return screen.getByRole("button", { name: new RegExp(`^${name}\\b`) });
}

async function openRowMenu(name: string): Promise<HTMLElement> {
  await fireEvent.contextMenu(row(name));
  return screen.getByRole("menu", { name });
}

describe("WorktreeList", () => {
  afterEach(() => cleanup());

  it("shows the ⋯ actions button on the selected row only", () => {
    renderList({
      rows: rowsOf([createWorktree("feature/a"), createWorktree("feature/b")]),
      selected: { project: "webmux", branch: "feature/b" },
    });

    expect(screen.queryByRole("button", { name: "Actions for feature/a" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actions for feature/b" })).toBeInTheDocument();
    expect(row("feature/b")).toHaveAttribute("aria-current", "true");
    expect(row("feature/a")).not.toHaveAttribute("aria-current");
  });

  it("removes from the ⋯ menu without selecting the row", async () => {
    const onselect = vi.fn();
    const onremove = vi.fn();
    renderList({
      rows: rowsOf([createWorktree("feature/list-actions")]),
      selected: { project: "webmux", branch: "feature/list-actions" },
      onselect,
      onremove,
    });

    await fireEvent.click(screen.getByRole("button", { name: "Actions for feature/list-actions" }));
    await fireEvent.click(within(screen.getByRole("menu")).getByRole("button", { name: "Remove" }));

    expect(onremove).toHaveBeenCalledWith({ project: "webmux", branch: "feature/list-actions" });
    expect(onselect).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens the row's context menu on right-click, with every row action", async () => {
    const onarchive = vi.fn();
    renderList({ rows: rowsOf([createWorktree("feature/menu-actions")]), onarchive });

    const menu = await openRowMenu("feature/menu-actions");
    const labels = within(menu).getAllByRole("button").map((button) => button.textContent?.trim());
    expect(labels).toEqual([
      "Close",
      "Add to favorites",
      "Edit label…",
      "Change profile…",
      "Create sub-worktree",
      "Archive",
      "Remove",
    ]);

    await fireEvent.click(within(menu).getByRole("button", { name: "Archive" }));
    expect(onarchive).toHaveBeenCalledWith({ project: "webmux", branch: "feature/menu-actions" });
  });

  it("drops the menu when its row leaves the list, so it does not come back with it", async () => {
    const rows = rowsOf([createWorktree("feature/a"), createWorktree("feature/b")]);
    const { rerender } = renderList({ rows });

    await openRowMenu("feature/a");
    await rerender({ rows: rowsOf([createWorktree("feature/b")]) });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await rerender({ rows });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("offers Open instead of Close on a closed worktree", async () => {
    const onopen = vi.fn();
    renderList({ rows: rowsOf([{ ...createWorktree("feature/closed"), mux: "" }]), onopen });

    const menu = await openRowMenu("feature/closed");
    expect(within(menu).queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
    await fireEvent.click(within(menu).getByRole("button", { name: "Open" }));

    expect(onopen).toHaveBeenCalledWith({ project: "webmux", branch: "feature/closed" });
  });

  it("acts on the row's own project from the menu", async () => {
    const oncreatesubworktree = vi.fn();
    const oneditlabel = vi.fn();
    const onposttolinear = vi.fn();
    renderList({ rows: rowsOf([createWorktree("feature/sub-base", "images")]), oncreatesubworktree, oneditlabel, onposttolinear });

    await fireEvent.click(within(await openRowMenu("feature/sub-base")).getByRole("button", { name: "Create sub-worktree" }));
    await fireEvent.click(within(await openRowMenu("feature/sub-base")).getByRole("button", { name: "Edit label…" }));
    await fireEvent.click(
      within(await openRowMenu("feature/sub-base")).getByRole("button", { name: "Post conversation to ENG-42" }),
    );

    const ref = { project: "images", branch: "feature/sub-base" };
    expect(oncreatesubworktree).toHaveBeenCalledWith(ref);
    expect(oneditlabel).toHaveBeenCalledWith(ref);
    expect(onposttolinear).toHaveBeenCalledWith(ref);
  });

  it("toggles favorites from the menu and marks favorite rows with a star", async () => {
    const ontogglefavorite = vi.fn();
    renderList({
      rows: rowsOf([createWorktree("feature/fav"), createWorktree("feature/plain")]),
      favorites: new Set<string>(["webmux:feature/fav"]),
      ontogglefavorite,
    });

    expect(within(row("feature/fav")).getByText("★")).toBeInTheDocument();
    expect(within(row("feature/plain")).queryByText("★")).not.toBeInTheDocument();

    await fireEvent.click(within(await openRowMenu("feature/fav")).getByRole("button", { name: "Remove from favorites" }));
    expect(ontogglefavorite).toHaveBeenCalledWith({ project: "webmux", branch: "feature/fav" });
    await fireEvent.click(within(await openRowMenu("feature/plain")).getByRole("button", { name: "Add to favorites" }));
    expect(ontogglefavorite).toHaveBeenCalledWith({ project: "webmux", branch: "feature/plain" });
  });

  it("disables a row and its actions while it is being removed", () => {
    renderList({
      rows: rowsOf([createWorktree("feature/list-removing")]),
      selected: { project: "webmux", branch: "feature/list-removing" },
      removing: new Set(["webmux:feature/list-removing"]),
    });

    expect(row("feature/list-removing")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Actions for feature/list-removing" })).toBeDisabled();
  });

  it("disables the archive action while the row is archiving", async () => {
    renderList({
      rows: rowsOf([createWorktree("feature/archiving")]),
      archiving: new Set<string>(["webmux:feature/archiving"]),
    });

    expect(within(await openRowMenu("feature/archiving")).getByRole("button", { name: "Archive" })).toBeDisabled();
  });

  it("names a row by its label, keeping the branch in its tooltip", () => {
    renderList({ rows: rowsOf([{ ...createWorktree("feature/random-fallback"), label: "Search ranking" }]) });

    const button = row("Search ranking");
    expect(button.getAttribute("title")).toContain("feature/random-fallback");
    expect(screen.queryByText("feature/random-fallback")).not.toBeInTheDocument();
  });

  it("shows one status glyph per row, the most urgent state first", () => {
    renderList({
      rows: rowsOf([
        { ...createWorktree("feature/waiting"), agent: "waiting" },
        { ...createWorktree("feature/unread"), agent: "done" },
        { ...createWorktree("feature/closed"), mux: "" },
        { ...createWorktree("feature/creating"), creating: true },
      ]),
      notified: new Set(["webmux:feature/unread"]),
    });

    const attentions = screen.getAllByRole("button").map((button) => button.querySelector("[data-attention]")?.getAttribute("data-attention"));
    expect(attentions).toEqual(["waiting", "unread", "closed", "creating"]);
  });

  it("marks a PR only when it asks for action or can be cleaned up", () => {
    renderList({
      rows: rowsOf([
        { ...createWorktree("feature/failing"), prs: [createPr({ ciStatus: "failed" })] },
        { ...createWorktree("feature/draft"), prs: [createPr({ isDraft: true })] },
        { ...createWorktree("feature/merged"), prs: [createPr({ state: "merged" })] },
      ]),
    });

    expect(row("feature/failing").querySelector("[data-pr-signal]")).toHaveAttribute("data-pr-signal", "ci-failed");
    expect(row("feature/draft").querySelector("[data-pr-signal]")).toBeNull();
    expect(row("feature/merged").querySelector("[data-pr-signal]")).toHaveAttribute("data-pr-signal", "merged");
  });

  it("nests sub-worktrees under their parent", () => {
    render(WorktreeList, {
      props: listProps({ rows: { active: [createRow(createWorktree("main")), createRow(createWorktree("feature/child"), 1)], archived: [] } }),
    });

    expect(row("feature/child").style.paddingLeft).toBe("20px");
    expect(row("main").style.paddingLeft).toBe("6px");
  });

  it("folds archived worktrees at the bottom and unfolds them on demand", async () => {
    const ontogglearchived = vi.fn();
    const { rerender } = renderList({
      rows: rowsOf([createWorktree("feature/active")], [{ ...createWorktree("feature/old"), archived: true }]),
      ontogglearchived,
    });

    const toggle = screen.getByRole("button", { name: /Archived \(1\)/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("feature/old")).not.toBeInTheDocument();
    await fireEvent.click(toggle);
    expect(ontogglearchived).toHaveBeenCalledTimes(1);

    await rerender({ showArchived: true });
    expect(within(screen.getByRole("list", { name: "Archived worktrees" })).getByText("feature/old")).toBeInTheDocument();
  });

  it("shows the project's load error with a Retry", async () => {
    const onretry = vi.fn();
    renderList({ rows: rowsOf([createWorktree("stale")]), error: "git exploded", onretry });

    expect(screen.getByText("Couldn't load worktrees")).toBeInTheDocument();
    expect(screen.getByText("git exploded")).toBeInTheDocument();
    expect(screen.getByText("stale")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onretry).toHaveBeenCalledTimes(1);
  });

  it("offers a new worktree when the project has none", async () => {
    const oncreate = vi.fn();
    renderList({ oncreate });

    expect(screen.getByText("No worktrees yet.")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "New worktree" }));
    expect(oncreate).toHaveBeenCalledTimes(1);
  });

  it("says when a search matches nothing active", () => {
    renderList({ query: "zzz", rows: rowsOf([], [{ ...createWorktree("zzz-old"), archived: true }]) });

    expect(screen.getByText('No active matches for "zzz".')).toBeInTheDocument();
  });
});
