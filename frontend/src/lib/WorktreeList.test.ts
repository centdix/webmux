import { cleanup, fireEvent, render, screen, within } from "@testing-library/svelte";
import { tick, type ComponentProps } from "svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WorktreeList from "./WorktreeList.svelte";
import type { PendingCreationInfo, PrEntry, ProjectListRows, WorktreeInfo, WorktreeListRow } from "./types";

function createWorktree(branch: string, project = "webmux"): WorktreeInfo {
  return {
    project,
    id: `wt-${branch}`,
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

function createPending(id: string): PendingCreationInfo {
  return { project: "webmux", id, profile: "default", agentName: "claude", agentLabel: "Claude Code", phase: "naming_branch", source: "ui" };
}

function createRow(worktree: WorktreeInfo, depth = 0): WorktreeListRow {
  return { kind: "worktree", worktree, depth };
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

/** A controllable `(hover: none), (pointer: coarse)` media query: jsdom has no matchMedia. */
let touchDevice = false;
const touchListeners = new Set<(event: Event) => void>();

function setTouchDevice(value: boolean): void {
  touchDevice = value;
  for (const listener of touchListeners) listener(new Event("change"));
}

describe("WorktreeList", () => {
  beforeEach(() => {
    touchDevice = false;
    vi.stubGlobal("matchMedia", (query: string) => ({
      get matches(): boolean {
        return query === "(hover: none), (pointer: coarse)" && touchDevice;
      },
      media: query,
      addEventListener: (_type: string, listener: (event: Event) => void) => touchListeners.add(listener),
      removeEventListener: (_type: string, listener: (event: Event) => void) => touchListeners.delete(listener),
    }));
  });

  afterEach(() => {
    cleanup();
    touchListeners.clear();
    vi.unstubAllGlobals();
  });

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

  it("shows the ⋯ actions button on every row on mobile, where there is no right-click", () => {
    renderList({ rows: rowsOf([createWorktree("feature/a"), createWorktree("feature/b")]), isMobile: true });

    expect(screen.getByRole("button", { name: "Actions for feature/a" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actions for feature/b" })).toBeInTheDocument();
  });

  it("shows the ⋯ actions button on every row on a touch device, whatever its width", async () => {
    renderList({ rows: rowsOf([createWorktree("feature/a"), createWorktree("feature/b")]) });
    expect(screen.queryByRole("button", { name: "Actions for feature/a" })).not.toBeInTheDocument();

    setTouchDevice(true);
    await tick();

    expect(screen.getByRole("button", { name: "Actions for feature/a" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Actions for feature/b" })).toBeInTheDocument();
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
    await fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Remove" }));

    expect(onremove).toHaveBeenCalledWith({ project: "webmux", branch: "feature/list-actions" });
    expect(onselect).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("opens the row's context menu on right-click, with every row action", async () => {
    const onarchive = vi.fn();
    renderList({ rows: rowsOf([createWorktree("feature/menu-actions")]), onarchive });

    const menu = await openRowMenu("feature/menu-actions");
    const labels = within(menu).getAllByRole("menuitem").map((item) => item.textContent?.trim());
    expect(labels).toEqual([
      "Close",
      "Add to favorites",
      "Edit label…",
      "Change profile…",
      "Create sub-worktree",
      "Archive",
      "Remove",
    ]);

    await fireEvent.click(within(menu).getByRole("menuitem", { name: "Archive" }));
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

  it("keys rows by worktree id, so a row keeps its element when only its branch changes", async () => {
    const before = { ...createWorktree("feature/a"), id: "wt-stable" };
    const { rerender } = renderList({ rows: rowsOf([before]) });
    const element = row("feature/a");

    await rerender({ rows: rowsOf([{ ...before, branch: "feature/renamed" }]) });

    expect(row("feature/renamed")).toBe(element);
  });

  it("shows a creation still naming its branch as a row that cannot be selected and has no actions", async () => {
    const onselect = vi.fn();
    renderList({ rows: { active: [{ kind: "pending", pending: createPending("wt-new"), depth: 0 }], archived: [] }, onselect, isMobile: true });

    const button = screen.getByRole("button", { name: "Naming branch…" });
    expect(button).toBeDisabled();
    expect(button.getAttribute("title")).toBe("Claude Code · default\nNaming branch…");
    expect(button.querySelector('[data-attention="creating"]')).not.toBeNull();
    expect(screen.queryByRole("button", { name: /^Actions for/ })).not.toBeInTheDocument();
    expect(screen.queryByText("No worktrees yet.")).not.toBeInTheDocument();

    await fireEvent.click(button);
    await fireEvent.contextMenu(button);

    expect(onselect).not.toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("keeps a pending row's elements when its worktree arrives under the same id", async () => {
    const { rerender } = renderList({ rows: { active: [{ kind: "pending", pending: createPending("wt-new"), depth: 0 }], archived: [] } });
    const pendingButton = screen.getByRole("button", { name: "Naming branch…" });
    const pendingItem = pendingButton.closest("li");

    await rerender({
      rows: rowsOf([{ ...createWorktree("fix-login"), id: "wt-new", creating: true, creationPhase: "creating_worktree" }]),
    });

    const button = screen.getByRole("button", { name: "Creating worktree…" });
    expect(button).toBe(pendingButton);
    expect(button.closest("li")).toBe(pendingItem);
    expect(button).not.toBeDisabled();
    expect(pendingItem?.dataset.worktreeKey).toBe("webmux:fix-login");
  });

  it("opens at the pointer on right-click and under the row from the keyboard, keeping inside the viewport", async () => {
    renderList({ rows: rowsOf([createWorktree("feature/kbd")]) });
    vi.spyOn(row("feature/kbd"), "getBoundingClientRect").mockReturnValue(new DOMRect(30, 80, 200, 20));

    await fireEvent.contextMenu(row("feature/kbd"), { button: 2, clientX: 200, clientY: 300 });
    const menu = screen.getByRole("menu", { name: "feature/kbd" });
    expect(menu.style.left).toBe("200px");
    expect(menu.style.top).toBe("300px");

    const innerWidth = window.innerWidth;
    window.innerWidth = 150;
    await fireEvent(window, new Event("resize"));
    expect(menu.style.left).toBe("146px");
    window.innerWidth = innerWidth;

    await fireEvent.keyDown(document, { key: "Escape" });
    await fireEvent.contextMenu(row("feature/kbd"), { button: 0, shiftKey: true });
    expect(screen.getByRole("menu").style.left).toBe("30px");
    expect(screen.getByRole("menu").style.top).toBe("102px");
  });

  it("moves through the menu with the arrow keys and gives the focus back on Escape", async () => {
    renderList({ rows: rowsOf([{ ...createWorktree("feature/keys"), creating: true }]) });
    const creatingRow = screen.getByRole("button", { name: "Creating…" });
    creatingRow.focus();

    await fireEvent.contextMenu(creatingRow);
    const menu = screen.getByRole("menu", { name: "feature/keys" });
    expect(within(menu).getByText("feature/keys")).toHaveAttribute("role", "presentation");
    // Creating disables Close: focus starts on the first enabled item.
    expect(document.activeElement).toBe(within(menu).getByRole("menuitem", { name: "Add to favorites" }));
    await fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(within(menu).getByRole("menuitem", { name: "Edit label…" }));
    await fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(document.activeElement).toBe(within(menu).getByRole("menuitem", { name: "Remove" }));
    await fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(within(menu).getByRole("menuitem", { name: "Add to favorites" }));
    await fireEvent.keyDown(document.activeElement!, { key: "ArrowUp" });
    expect(document.activeElement).toBe(within(menu).getByRole("menuitem", { name: "Remove" }));
    await fireEvent.keyDown(document.activeElement!, { key: "Home" });
    expect(document.activeElement).toBe(within(menu).getByRole("menuitem", { name: "Add to favorites" }));

    await fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(creatingRow);
  });

  it("closes the ⋯ menu on a second click of ⋯", async () => {
    renderList({ rows: rowsOf([createWorktree("feature/toggle")]), selected: { project: "webmux", branch: "feature/toggle" } });
    const more = screen.getByRole("button", { name: "Actions for feature/toggle" });

    await fireEvent.click(more);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(more).toHaveAttribute("aria-expanded", "true");
    await fireEvent.click(more);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(more).toHaveAttribute("aria-expanded", "false");
  });

  it("offers Open instead of Close on a closed worktree", async () => {
    const onopen = vi.fn();
    renderList({ rows: rowsOf([{ ...createWorktree("feature/closed"), mux: "" }]), onopen });

    const menu = await openRowMenu("feature/closed");
    expect(within(menu).queryByRole("menuitem", { name: "Close" })).not.toBeInTheDocument();
    await fireEvent.click(within(menu).getByRole("menuitem", { name: "Open" }));

    expect(onopen).toHaveBeenCalledWith({ project: "webmux", branch: "feature/closed" });
  });

  it("acts on the row's own project from the menu", async () => {
    const oncreatesubworktree = vi.fn();
    const oneditlabel = vi.fn();
    const onposttolinear = vi.fn();
    renderList({ rows: rowsOf([createWorktree("feature/sub-base", "images")]), oncreatesubworktree, oneditlabel, onposttolinear });

    await fireEvent.click(within(await openRowMenu("feature/sub-base")).getByRole("menuitem", { name: "Create sub-worktree" }));
    await fireEvent.click(within(await openRowMenu("feature/sub-base")).getByRole("menuitem", { name: "Edit label…" }));
    await fireEvent.click(
      within(await openRowMenu("feature/sub-base")).getByRole("menuitem", { name: "Post conversation to ENG-42" }),
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

    await fireEvent.click(within(await openRowMenu("feature/fav")).getByRole("menuitem", { name: "Remove from favorites" }));
    expect(ontogglefavorite).toHaveBeenCalledWith({ project: "webmux", branch: "feature/fav" });
    await fireEvent.click(within(await openRowMenu("feature/plain")).getByRole("menuitem", { name: "Add to favorites" }));
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

    expect(within(await openRowMenu("feature/archiving")).getByRole("menuitem", { name: "Archive" })).toBeDisabled();
  });

  it("names a row by its label, keeping the branch in its tooltip", () => {
    renderList({ rows: rowsOf([{ ...createWorktree("feature/random-fallback"), label: "Search ranking" }]) });

    const button = row("Search ranking");
    expect(button.getAttribute("title")).toContain("feature/random-fallback");
    expect(screen.queryByText("feature/random-fallback")).not.toBeInTheDocument();
  });

  it("names a row by its creation phase while it is being created, keeping the branch in its tooltip", () => {
    renderList({ rows: rowsOf([{ ...createWorktree("feature/new"), creating: true, creationPhase: "running_post_create_hook" }]) });

    const button = screen.getByRole("button", { name: "Running post-create hook…" });
    expect(button.getAttribute("title")).toContain("feature/new");
    expect(screen.queryByText("feature/new")).not.toBeInTheDocument();
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

  it("marks every PR with its state only", () => {
    renderList({
      rows: rowsOf([
        { ...createWorktree("feature/failing"), prs: [createPr({ ciStatus: "failed" })] },
        { ...createWorktree("feature/draft"), prs: [createPr({ isDraft: true })] },
        { ...createWorktree("feature/merged"), prs: [createPr({ state: "merged" })] },
        createWorktree("feature/none"),
      ]),
    });

    expect(row("feature/failing").querySelector("[data-pr-state]")).toHaveAttribute("data-pr-state", "open");
    expect(row("feature/draft").querySelector("[data-pr-state]")).toHaveAttribute("data-pr-state", "draft");
    expect(row("feature/merged").querySelector("[data-pr-state]")).toHaveAttribute("data-pr-state", "merged");
    expect(row("feature/none").querySelector("[data-pr-state]")).toBeNull();
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
