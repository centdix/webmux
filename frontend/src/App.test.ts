import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import type {
  AgentsUiWorktreeConversationResponse,
  AppConfig,
  AppNotification,
  LinearIssuesResponse,
  ProjectWorktreeList,
  WorktreeInfo,
} from "./lib/types";

const { MockFitAddon, MockTerminal, MockWebSocket } = vi.hoisted(() => {
  class MockFitAddon {
    static instances: MockFitAddon[] = [];

    fit = vi.fn();

    constructor() {
      MockFitAddon.instances.push(this);
    }
  }

  class MockTerminal {
    static instances: MockTerminal[] = [];

    options: { theme?: unknown } = {};
    cols = 80;
    rows = 24;
    modes = { mouseTrackingMode: "none" };
    parser = { registerOscHandler: vi.fn(() => true) };
    loadAddon = vi.fn();
    onSelectionChange = vi.fn();
    attachCustomKeyEventHandler = vi.fn();
    focus = vi.fn();
    writeln = vi.fn();
    write = vi.fn();
    clearSelection = vi.fn();
    dispose = vi.fn();

    constructor(_options: unknown) {
      MockTerminal.instances.push(this);
    }

    open(container: HTMLElement): void {
      const xterm = document.createElement("div");
      xterm.className = "xterm";
      const viewport = document.createElement("div");
      viewport.className = "xterm-viewport";
      xterm.appendChild(viewport);
      container.appendChild(xterm);
    }

    onData(_handler: (data: string) => void): void {}

    getSelection(): string {
      return "";
    }

    hasSelection(): boolean {
      return false;
    }
  }

  class MockWebSocket {
    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;
    static instances: MockWebSocket[] = [];

    readonly url: string;
    readyState = MockWebSocket.CONNECTING;
    sent: string[] = [];
    onopen: ((event: Event) => void) | null = null;
    onmessage: ((event: MessageEvent<string>) => void) | null = null;
    onclose: ((event: CloseEvent) => void) | null = null;
    onerror: ((event: Event) => void) | null = null;

    constructor(url: string | URL) {
      this.url = String(url);
      MockWebSocket.instances.push(this);
    }

    send(data: string): void {
      this.sent.push(data);
    }

    close(): void {
      this.readyState = MockWebSocket.CLOSED;
    }
  }

  return { MockFitAddon, MockTerminal, MockWebSocket };
});

vi.mock("@xterm/xterm", () => ({ Terminal: MockTerminal }));
vi.mock("@xterm/addon-fit", () => ({ FitAddon: MockFitAddon }));
vi.mock("@xterm/addon-web-links", () => ({
  WebLinksAddon: class MockWebLinksAddon {},
}));

// The dashboard polls every project at once; most tests only need one, so
// `fetchWorktrees` stands in for that project's slice of the hub listing.
const { fetchWorktrees, otherProjects } = vi.hoisted(() => ({
  fetchWorktrees: vi.fn<() => Promise<WorktreeInfo[]>>(),
  otherProjects: { list: [] as ProjectWorktreeList[] },
}));

vi.mock("./lib/api", () => {
  const client = {
    closeWorktree: vi.fn(),
    createWorktree: vi.fn(),
    fetchAvailableBranches: vi.fn(),
    fetchBaseBranches: vi.fn(),
    fetchCiLogs: vi.fn(),
    fetchConfig: vi.fn(),
    fetchWorktreeDiff: vi.fn(),
    fetchLinearIssues: vi.fn(),
    openWorktree: vi.fn(),
    pullMain: vi.fn(),
    removeWorktree: vi.fn(),
    setWorktreeArchived: vi.fn(),
    sendWorktreePrompt: vi.fn(),
  };
  return {
    projectApi: vi.fn(() => client),
    attachWorktreeConversation: vi.fn(),
    connectWorktreeConversationStream: vi.fn(),
    dismissNotification: vi.fn(),
    fetchWorktreeConversationHistory: vi.fn(),
    fetchAllProjectWorktrees: vi.fn(async (): Promise<ProjectWorktreeList[]> => [
      { prefix: "webmux", name: "webmux", worktrees: await fetchWorktrees(), error: null },
      ...otherProjects.list,
    ]),
    interruptWorktreeConversation: vi.fn(),
    refreshWorktreeAgentTerminal: vi.fn(),
    sendWorktreeConversationMessage: vi.fn(),
    setWorktreeLabel: vi.fn(),
    setWorktreeProfile: vi.fn(),
    postWorktreeToLinear: vi.fn(),
    subscribeNotifications: vi.fn(),
    terminalSocketUrl: vi.fn(() => "ws://localhost/ws"),
    uploadFiles: vi.fn(),
    fetchProjects: vi.fn(async () => []),
    fetchInstances: vi.fn(async () => []),
    setUpProject: vi.fn(),
    removeProject: vi.fn(),
  };
});

import App from "./App.svelte";
import {
  attachWorktreeConversation,
  connectWorktreeConversationStream,
  dismissNotification,
  fetchAllProjectWorktrees,
  fetchProjects,
  postWorktreeToLinear,
  projectApi,
  refreshWorktreeAgentTerminal,
  removeProject,
  setUpProject,
  setWorktreeLabel,
  setWorktreeProfile,
  subscribeNotifications,
} from "./lib/api";
import { WEB_CHAT_UI_STORAGE_KEY } from "./lib/utils";
import { WorktreeSelection } from "./lib/worktree-selection.svelte";

const PROJECT = "webmux";
const api = projectApi(PROJECT);

function renderApp(project = PROJECT): { onNoProjects: Mock<() => void> } {
  const onNoProjects = vi.fn<() => void>();
  render(App, { props: { selection: new WorktreeSelection(project), onNoProjects } });
  return { onNoProjects };
}

/** Project whose client served a call of `method` (the first or the latest):
 *  every client call is `projectApi(project).method(...)`, so it's the
 *  `projectApi` call just before. */
function projectOfCall<T extends (...args: never[]) => unknown>(
  method: T,
  which: "first" | "last",
): string | undefined {
  const orders = vi.mocked(method).mock.invocationCallOrder;
  const order = (which === "first" ? orders[0] : orders.at(-1)) ?? 0;
  const { calls, invocationCallOrder } = vi.mocked(projectApi).mock;
  const index = invocationCallOrder.findLastIndex((callOrder) => callOrder < order);
  return calls[index]?.[0];
}

function projectOfFirstCall<T extends (...args: never[]) => unknown>(method: T): string | undefined {
  return projectOfCall(method, "first");
}

function projectOfLastCall<T extends (...args: never[]) => unknown>(method: T): string | undefined {
  return projectOfCall(method, "last");
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason?: unknown) => void;
}

class MockNotification {
  static permission: NotificationPermission = "denied";

  static requestPermission = vi.fn(async () => "denied" as const);

  constructor(_title: string, _options?: NotificationOptions) {}
}

const originalMatchMedia = window.matchMedia;
const originalNotification = globalThis.Notification;
const originalDialogShowModal = HTMLDialogElement.prototype.showModal;
const originalDialogClose = HTMLDialogElement.prototype.close;
const originalWebSocket = globalThis.WebSocket;
const originalResizeObserver = globalThis.ResizeObserver;
const originalRequestAnimationFrame = globalThis.requestAnimationFrame;

class MockResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function createConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    name: "repo",
    startupEnvs: {},
    profiles: [{ name: "default" }],
    agents: [
      {
        id: "claude",
        label: "Claude",
        kind: "builtin",
        capabilities: {
          terminal: true,
          inAppChat: true,
          conversationHistory: true,
          interrupt: true,
          resume: true,
        },
      },
      {
        id: "codex",
        label: "Codex",
        kind: "builtin",
        capabilities: {
          terminal: true,
          inAppChat: true,
          conversationHistory: true,
          interrupt: true,
          resume: true,
        },
      },
    ],
    defaultProfileName: "default",
    defaultAgentId: "claude",
    autoName: false,
    linearCreateTicketOption: false,
    linkedRepos: [],
    linearAutoCreateWorktrees: false,
    autoRemoveOnMerge: false,
    projectDir: "/repo",
    mainBranch: "main",
    ide: "cursor",
    ...overrides,
  };
}

function createWorktree(
  branch: string,
  overrides: Partial<WorktreeInfo> = {},
): WorktreeInfo {
  return {
    project: PROJECT,
    branch,
    label: null,
    archived: false,
    agent: "waiting",
    mux: "",
    path: `/repo/__worktrees/${branch}`,
    dir: `/repo/__worktrees/${branch}`,
    dirty: false,
    unpushed: false,
    status: "idle",
    elapsed: "1m",
    profile: null,
    agentName: null,
    agentLabel: null,
    agentTerminalStale: false,
    services: [],
    paneCount: 1,
    prs: [],
    linearIssue: null,
    creating: false,
    creationPhase: null,
    source: "ui",
    oneshot: null,
    tabs: [],
    activeTabId: null,
    ...overrides,
  };
}

function createLinearIssuesResponse(
  overrides: Partial<LinearIssuesResponse> = {},
): LinearIssuesResponse {
  return {
    availability: "ready",
    issues: [],
    ...overrides,
  };
}

function createConversationResponse(
  worktree: WorktreeInfo,
): AgentsUiWorktreeConversationResponse {
  return {
    worktree: {
      branch: worktree.branch,
      path: worktree.path,
      archived: worktree.archived,
      profile: worktree.profile,
      agentName: worktree.agentName,
      agentLabel: worktree.agentLabel,
      agentTerminalStale: worktree.agentTerminalStale,
      mux: worktree.mux === "✓",
      status: worktree.status,
      dirty: worktree.dirty,
      unpushed: worktree.unpushed,
      services: worktree.services,
      prs: worktree.prs,
      creating: worktree.creating,
      creationPhase: worktree.creationPhase,
      conversation: null,
    },
    conversation: {
      provider: worktree.agentName === "codex" ? "codexAppServer" : "claudeCode",
      conversationId: worktree.agentName === "codex" ? "thread-1" : "session-1",
      cwd: worktree.path,
      running: false,
      activeTurnId: null,
      messages: [],
    },
  };
}

function createAppNotification(
  overrides: Partial<AppNotification> = {},
): AppNotification {
  return {
    id: 1,
    project: "webmux",
    branch: "feature/toast",
    type: "runtime_error",
    message: "Notification text",
    url: "https://example.com/notifications/1",
    timestamp: Date.UTC(2026, 3, 9, 11, 30, 0),
    ...overrides,
  };
}

function setupBrowserMocks(): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
  Object.defineProperty(globalThis, "Notification", {
    configurable: true,
    writable: true,
    value: MockNotification,
  });
  Object.defineProperty(globalThis, "WebSocket", {
    configurable: true,
    writable: true,
    value: MockWebSocket,
  });
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: MockResizeObserver,
  });
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    writable: true,
    value: (callback: FrameRequestCallback) => {
      callback(0);
      return 0;
    },
  });
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement): void {
    this.open = true;
  });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement): void {
    this.open = false;
  });
}

function restoreBrowserMocks(): void {
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: originalMatchMedia,
  });
  Object.defineProperty(globalThis, "Notification", {
    configurable: true,
    writable: true,
    value: originalNotification,
  });
  Object.defineProperty(globalThis, "WebSocket", {
    configurable: true,
    writable: true,
    value: originalWebSocket,
  });
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    writable: true,
    value: originalResizeObserver,
  });
  Object.defineProperty(globalThis, "requestAnimationFrame", {
    configurable: true,
    writable: true,
    value: originalRequestAnimationFrame,
  });
  HTMLDialogElement.prototype.showModal = originalDialogShowModal;
  HTMLDialogElement.prototype.close = originalDialogClose;
}

async function openCreateDialogAndSubmit(branch: string): Promise<void> {
  await fireEvent.click(screen.getByTitle("New Worktree (Cmd+K)"));
  await screen.findByText("New Worktree");
  await fireEvent.input(screen.getByLabelText(/Branch name/i), {
    target: { value: branch },
  });
  await fireEvent.click(screen.getByRole("button", { name: "Create" }));
}

async function openCreateDialogWithBaseAndSubmit(branch: string, baseBranch: string): Promise<void> {
  await fireEvent.click(screen.getByTitle("New Worktree (Cmd+K)"));
  await screen.findByText("New Worktree");
  await fireEvent.input(screen.getByLabelText(/Branch name/i), {
    target: { value: branch },
  });
  await fireEvent.click(screen.getByRole("button", { name: "Base branch" }));
  await fireEvent.click(await screen.findByRole("button", { name: baseBranch }));
  await fireEvent.click(screen.getByRole("button", { name: "Create" }));
}

describe("App create selection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    otherProjects.list = [];
    vi.mocked(fetchProjects).mockResolvedValue([]);
    MockTerminal.instances = [];
    MockFitAddon.instances = [];
    MockWebSocket.instances = [];
    cleanup();
    localStorage.clear();
    setupBrowserMocks();

    vi.mocked(api.fetchConfig).mockResolvedValue(createConfig());
    vi.mocked(fetchWorktrees).mockResolvedValue([]);
    vi.mocked(api.fetchAvailableBranches).mockResolvedValue({ branches: [] });
    vi.mocked(api.fetchBaseBranches).mockResolvedValue({ branches: [] });
    vi.mocked(api.fetchLinearIssues).mockResolvedValue(createLinearIssuesResponse());
    vi.mocked(api.fetchWorktreeDiff).mockResolvedValue({
      uncommitted: "",
      uncommittedTruncated: false,
      gitStatus: "",
      unpushedCommits: [],
    });
    vi.mocked(subscribeNotifications).mockReturnValue(() => {});
    vi.mocked(api.openWorktree).mockResolvedValue({ ok: true });
    vi.mocked(api.closeWorktree).mockResolvedValue({ ok: true });
    vi.mocked(api.removeWorktree).mockResolvedValue({ ok: true });
    vi.mocked(api.setWorktreeArchived).mockResolvedValue({ ok: true, archived: true });
    vi.mocked(api.pullMain).mockResolvedValue({ status: "updated" });
    vi.mocked(dismissNotification).mockResolvedValue(undefined);
    vi.mocked(api.fetchCiLogs).mockResolvedValue({ logs: "" });
    vi.mocked(api.sendWorktreePrompt).mockResolvedValue({ ok: true });
    vi.mocked(connectWorktreeConversationStream).mockReturnValue(() => {});
    vi.mocked(refreshWorktreeAgentTerminal).mockResolvedValue(undefined);
    vi.mocked(setWorktreeLabel).mockResolvedValue(null);
    vi.mocked(setWorktreeProfile).mockResolvedValue({ profile: "full", restarted: true });
    vi.mocked(postWorktreeToLinear).mockResolvedValue({
      ok: true,
      issueId: "ENG-42",
      issueUrl: "https://linear.app/example/issue/ENG-42",
      commentUrl: null,
      attachmentUrl: "https://linear.app/attachment/x",
    });
  });

  afterEach(() => {
    cleanup();
    restoreBrowserMocks();
    window.history.replaceState(null, "", "/");
  });

  it("mirrors the selected worktree into the hash and the project's storage key", async () => {
    vi.mocked(fetchWorktrees).mockResolvedValue([createWorktree("main"), createWorktree("feature/x")]);

    renderApp();

    await screen.findByTitle("main");
    await waitFor(() => expect(window.location.hash).toBe(`#${PROJECT}/main`));

    await fireEvent.click(screen.getByRole("button", { name: /^feature\/x\b/i }));

    await screen.findByTitle("feature/x");
    expect(window.location.hash).toBe(`#${PROJECT}/feature/x`);
    expect(localStorage.getItem(`wt-last-selected-worktree:${PROJECT}`)).toBe("feature/x");
  });

  it("selects the hash branch over the saved selection at mount", async () => {
    localStorage.setItem(`wt-last-selected-worktree:${PROJECT}`, "feature/saved");
    window.history.replaceState(null, "", `/#${PROJECT}/feature/hash`);
    vi.mocked(fetchWorktrees).mockResolvedValue([createWorktree("feature/saved"), createWorktree("feature/hash")]);

    renderApp();

    expect(await screen.findByTitle("feature/hash")).toBeInTheDocument();
    expect(window.location.hash).toBe(`#${PROJECT}/feature/hash`);
  });

  it("ignores a hash that targets another project", async () => {
    localStorage.setItem(`wt-last-selected-worktree:${PROJECT}`, "feature/saved");
    window.history.replaceState(null, "", "/#other/feature/hash");
    vi.mocked(fetchWorktrees).mockResolvedValue([createWorktree("feature/hash"), createWorktree("feature/saved")]);

    renderApp();

    expect(await screen.findByTitle("feature/saved")).toBeInTheDocument();
    expect(window.location.hash).toBe(`#${PROJECT}/feature/saved`);
  });

  it("does not restore a selection saved for another project", async () => {
    localStorage.setItem("wt-last-selected-worktree:other", "feature/b");
    vi.mocked(fetchWorktrees).mockResolvedValue([createWorktree("feature/a"), createWorktree("feature/b")]);

    renderApp();

    expect(await screen.findByTitle("feature/a")).toBeInTheDocument();
  });

  it("refetches the config when moving back to a project, keeping the cached one meanwhile", async () => {
    otherProjects.list = [{
      prefix: "images",
      name: "images",
      worktrees: [createWorktree("feature/img", { project: "images" })],
      error: null,
    }];
    vi.mocked(fetchWorktrees).mockResolvedValue([createWorktree("feature/web")]);
    localStorage.setItem(`wt-last-selected-worktree:${PROJECT}`, "feature/web");
    const edited = deferred<AppConfig>();
    vi.mocked(api.fetchConfig)
      .mockResolvedValueOnce(createConfig({ name: "repo" }))
      .mockResolvedValueOnce(createConfig({ name: "images" }))
      .mockReturnValueOnce(edited.promise);

    renderApp();
    await waitFor(() => expect(document.title).toBe("repo - Dashboard"));
    await fireEvent.click(await screen.findByRole("button", { name: /^feature\/img\b/i }));
    await waitFor(() => expect(document.title).toBe("images - Dashboard"));
    await fireEvent.click(screen.getByRole("button", { name: /^feature\/web\b/i }));

    expect(document.title).toBe("repo - Dashboard");
    expect(api.fetchConfig).toHaveBeenCalledTimes(3);
    edited.resolve(createConfig({ name: "repo edited" }));
    await waitFor(() => expect(document.title).toBe("repo edited - Dashboard"));
  });

  it("retries a failed config load on a later poll", async () => {
    vi.mocked(api.fetchConfig).mockRejectedValueOnce(new Error("offline"));
    const startedAt = Date.now();
    const now = vi.spyOn(Date, "now");

    renderApp();
    await waitFor(() => expect(api.fetchConfig).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(fetchAllProjectWorktrees).toHaveBeenCalled());
    expect(document.title).toBe("Dev Dashboard");

    now.mockReturnValue(startedAt + 120_000);
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(document.title).toBe("repo - Dashboard"));
    now.mockRestore();
  });

  it("selects a worktree of another project from its notification toast", async () => {
    let onNotification: ((notification: AppNotification) => void) | undefined;
    otherProjects.list = [{
      prefix: "images",
      name: "images",
      worktrees: [createWorktree("main", { project: "images" }), createWorktree("feature/img", { project: "images" })],
      error: null,
    }];
    vi.mocked(fetchWorktrees).mockResolvedValue([createWorktree("main"), createWorktree("feature/img")]);
    vi.mocked(subscribeNotifications).mockImplementation((handleNotification) => {
      onNotification = handleNotification;
      return () => {};
    });

    renderApp();
    await screen.findByTitle("main");
    onNotification?.(createAppNotification({ id: 1, project: "images", branch: "feature/img", message: "Images done" }));
    onNotification?.(createAppNotification({ id: 1, project: PROJECT, branch: "main", message: "Webmux done" }));

    expect(await screen.findByText("Images done")).toBeInTheDocument();
    expect(screen.getByText("Webmux done")).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Images done" }));

    expect(await screen.findByTitle("feature/img")).toBeInTheDocument();
    expect(window.location.hash).toBe("#images/feature/img");
    expect(screen.queryByText("Images done")).not.toBeInTheDocument();
    expect(screen.getByText("Webmux done")).toBeInTheDocument();
    expect(dismissNotification).toHaveBeenCalledWith(expect.objectContaining({ project: "images", id: 1 }));
  });

  it("moves the selection when the selected worktree disappears from the poll", async () => {
    vi.mocked(fetchWorktrees)
      .mockResolvedValueOnce([createWorktree("main"), createWorktree("feature/gone")])
      .mockResolvedValue([createWorktree("main")]);
    localStorage.setItem(`wt-last-selected-worktree:${PROJECT}`, "feature/gone");

    renderApp();
    await screen.findByTitle("feature/gone");
    await fireEvent.click(screen.getByRole("button", { name: "Open Session" }));

    expect(await screen.findByTitle("main")).toBeInTheDocument();
    expect(localStorage.getItem(`wt-last-selected-worktree:${PROJECT}`)).toBe("main");
  });

  it("shows a project's fetch error in the sidebar", async () => {
    vi.mocked(fetchAllProjectWorktrees).mockResolvedValueOnce([
      { prefix: PROJECT, name: PROJECT, worktrees: [], error: "git exploded" },
    ]);

    renderApp();

    expect(await screen.findByText("Failed to load worktrees: git exploded")).toBeInTheDocument();
  });

  it("keeps the saved selection when the project's first poll fails", async () => {
    localStorage.setItem(`wt-last-selected-worktree:${PROJECT}`, "feature/saved");
    vi.mocked(fetchAllProjectWorktrees).mockResolvedValueOnce([
      { prefix: PROJECT, name: PROJECT, worktrees: [], error: "git exploded" },
    ]);
    const selection = new WorktreeSelection(PROJECT);

    render(App, { props: { selection, onNoProjects: vi.fn() } });

    expect(await screen.findByText("Failed to load worktrees: git exploded")).toBeInTheDocument();
    expect(selection.selected).toEqual({ project: PROJECT, branch: "feature/saved" });
    expect(window.location.hash).toBe(`#${PROJECT}/feature/saved`);
    expect(localStorage.getItem(`wt-last-selected-worktree:${PROJECT}`)).toBe("feature/saved");
  });

  it("drops the pending auto-select of a create once the user selects another project's worktree", async () => {
    otherProjects.list = [{
      prefix: "images",
      name: "images",
      worktrees: [createWorktree("feature/img", { project: "images" })],
      error: null,
    }];
    vi.mocked(fetchProjects).mockResolvedValue([
      { prefix: PROJECT, name: PROJECT, path: "/repos/webmux", active: true },
      { prefix: "images", name: "images", path: "/repos/images", active: false },
    ]);
    const creatingWorktree = createWorktree("feature/new", { creating: true, creationPhase: "creating_worktree" });
    const createResult = deferred<{ primaryBranch: string; branches: string[] }>();
    vi.mocked(fetchWorktrees)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([creatingWorktree])
      .mockResolvedValue([createWorktree("feature/new")]);
    vi.mocked(api.createWorktree).mockReturnValueOnce(createResult.promise);

    renderApp();
    await screen.findByText("Select a worktree");
    await openCreateDialogAndSubmit("feature/new");
    await waitFor(() => expect(fetchWorktrees).toHaveBeenCalledTimes(2));

    await fireEvent.click(screen.getByRole("button", { name: /^feature\/img\b/i }));
    expect(await screen.findByTitle("feature/img")).toBeInTheDocument();

    createResult.resolve({ primaryBranch: "feature/new", branches: ["feature/new"] });
    await waitFor(() => expect(fetchWorktrees).toHaveBeenCalledTimes(3));
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.getByTitle("feature/img")).toBeInTheDocument();
    expect(window.location.hash).toBe("#images/feature/img");
  });

  function projectSectionNames(): string[] {
    return screen.getAllByRole("region").map((region) => region.getAttribute("aria-label") ?? "");
  }

  function useThreeProjects(): void {
    otherProjects.list = [
      {
        prefix: "images",
        name: "images",
        worktrees: [createWorktree("main", { project: "images" }), createWorktree("feature/img", { project: "images" })],
        error: null,
      },
      { prefix: "docs", name: "docs", worktrees: [createWorktree("feature/doc", { project: "docs" })], error: null },
    ];
    vi.mocked(fetchWorktrees).mockResolvedValue([createWorktree("main"), createWorktree("feature/web")]);
  }

  it("lists every project under its header, in a stable order whatever is selected", async () => {
    useThreeProjects();

    renderApp();
    await screen.findByTitle("main");
    expect(projectSectionNames()).toEqual(["webmux", "images", "docs"]);

    const images = screen.getByRole("region", { name: "images" });
    await fireEvent.click(within(images).getByRole("button", { name: /^feature\/img\b/i }));

    expect(await screen.findByTitle("feature/img")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
    expect(window.location.hash).toBe("#images/feature/img");
    expect(projectSectionNames()).toEqual(["webmux", "images", "docs"]);
    expect(within(screen.getByRole("region", { name: "webmux" })).getByRole("button", { name: /^feature\/web\b/i }))
      .toBeInTheDocument();
  });

  it("moves through every project's rows with Cmd+Up/Down", async () => {
    useThreeProjects();
    localStorage.setItem(`wt-last-selected-worktree:${PROJECT}`, "feature/web");

    renderApp();
    await screen.findByTitle("feature/web");

    await fireEvent.keyDown(window, { key: "ArrowDown", metaKey: true });
    await waitFor(() => expect(window.location.hash).toBe("#images/main"));
    await fireEvent.keyDown(window, { key: "ArrowDown", metaKey: true });
    await fireEvent.keyDown(window, { key: "ArrowDown", metaKey: true });
    await waitFor(() => expect(window.location.hash).toBe("#docs/feature/doc"));
    await fireEvent.keyDown(window, { key: "ArrowUp", metaKey: true });
    await waitFor(() => expect(window.location.hash).toBe("#images/feature/img"));
  });

  it("collapses a project from its header and keeps it collapsed after a remount", async () => {
    useThreeProjects();

    renderApp();
    await screen.findByTitle("main");
    const header = within(screen.getByRole("region", { name: "images" })).getByRole("button", { name: /^images/ });
    await fireEvent.click(header);

    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /^feature\/img\b/i })).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem("wt-collapsed-projects") ?? "[]")).toEqual(["images"]);

    cleanup();
    renderApp();
    await screen.findByTitle("main");
    expect(within(screen.getByRole("region", { name: "images" })).getByRole("button", { name: /^images/ }))
      .toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: /^feature\/doc\b/i })).toBeInTheDocument();
  });

  it("searches every project and hides those without a match", async () => {
    useThreeProjects();

    renderApp();
    await screen.findByTitle("main");
    await fireEvent.input(screen.getByLabelText("Search worktrees"), { target: { value: "doc" } });

    expect(projectSectionNames()).toEqual(["docs"]);
    expect(screen.getByRole("button", { name: /^feature\/doc\b/i })).toBeInTheDocument();

    await fireEvent.input(screen.getByLabelText("Search worktrees"), { target: { value: "nothing-matches" } });
    expect(screen.queryAllByRole("region")).toEqual([]);
    expect(screen.getByText('No matches for "nothing-matches".')).toBeInTheDocument();
  });

  it("creates a sub-worktree in the parent row's project", async () => {
    useThreeProjects();
    vi.mocked(api.createWorktree).mockResolvedValue({ primaryBranch: "feature/doc-child", branches: ["feature/doc-child"] });

    renderApp();
    await screen.findByTitle("main");
    const docs = screen.getByRole("region", { name: "docs" });
    await fireEvent.click(within(docs).getByRole("button", { name: /actions for feature\/doc/i }));
    await fireEvent.click(within(docs).getByRole("button", { name: "Create sub-worktree" }));
    expect(await screen.findByText("New Sub-Worktree")).toBeInTheDocument();
    await fireEvent.input(screen.getByLabelText(/Branch name/i), { target: { value: "feature/doc-child" } });
    await fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(api.createWorktree).toHaveBeenCalled());
    expect(projectOfFirstCall(api.createWorktree)).toBe("docs");
  });

  it("opens the sub-worktree dialog only once the row's project config has loaded", async () => {
    useThreeProjects();
    const docsConfig = deferred<AppConfig>();
    vi.mocked(api.fetchConfig).mockImplementation(() =>
      vi.mocked(projectApi).mock.lastCall?.[0] === "docs" ? docsConfig.promise : Promise.resolve(createConfig()),
    );

    renderApp();
    await screen.findByTitle("main");
    const docs = screen.getByRole("region", { name: "docs" });
    await fireEvent.click(within(docs).getByRole("button", { name: /actions for feature\/doc/i }));
    await fireEvent.click(within(docs).getByRole("button", { name: "Create sub-worktree" }));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText("New Sub-Worktree")).not.toBeInTheDocument();

    docsConfig.resolve(createConfig({ startupEnvs: { DOCS_ENV: "preview" } }));

    expect(await screen.findByText("New Sub-Worktree")).toBeInTheDocument();
    expect(screen.getByLabelText("DOCS_ENV")).toHaveValue("preview");
  });

  it("drops a pending sub-worktree dialog with a toast when its project config fails to load", async () => {
    useThreeProjects();
    vi.mocked(api.fetchConfig).mockImplementation(() =>
      vi.mocked(projectApi).mock.lastCall?.[0] === "docs"
        ? Promise.reject(new Error("offline"))
        : Promise.resolve(createConfig()),
    );

    renderApp();
    await screen.findByTitle("main");
    const docs = screen.getByRole("region", { name: "docs" });
    await fireEvent.click(within(docs).getByRole("button", { name: /actions for feature\/doc/i }));
    await fireEvent.click(within(docs).getByRole("button", { name: "Create sub-worktree" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Failed to load the docs config: offline");
    expect(screen.queryByText("New Sub-Worktree")).not.toBeInTheDocument();
  });

  it("closes, archives and removes another project's row through that project's API", async () => {
    useThreeProjects();
    otherProjects.list[1] = {
      ...otherProjects.list[1]!,
      worktrees: [createWorktree("feature/doc", { project: "docs", mux: "✓" })],
    };

    renderApp();
    await screen.findByTitle("main");
    async function runRowAction(label: string): Promise<void> {
      const docs = screen.getByRole("region", { name: "docs" });
      await fireEvent.click(within(docs).getByRole("button", { name: /actions for feature\/doc/i }));
      await fireEvent.click(within(docs).getByRole("button", { name: label }));
    }

    await runRowAction("Close");
    await waitFor(() => expect(api.closeWorktree).toHaveBeenCalledWith({ params: { name: "feature/doc" } }));
    expect(projectOfFirstCall(api.closeWorktree)).toBe("docs");

    await runRowAction("Archive");
    await waitFor(() => expect(api.setWorktreeArchived).toHaveBeenCalled());
    expect(projectOfFirstCall(api.setWorktreeArchived)).toBe("docs");

    await runRowAction("Remove");
    const dialog = await screen.findByRole("dialog");
    expect(dialog).toHaveTextContent('Remove worktree "feature/doc" from docs?');
    await fireEvent.click(within(dialog).getByRole("button", { name: "Remove" }));
    await waitFor(() => expect(api.removeWorktree).toHaveBeenCalledWith({ params: { name: "feature/doc" } }));
    expect(projectOfFirstCall(api.removeWorktree)).toBe("docs");
  });

  it("expands a collapsed project when the restored selection lands in it", async () => {
    useThreeProjects();
    localStorage.setItem("wt-collapsed-projects", JSON.stringify([PROJECT, "docs"]));
    localStorage.setItem(`wt-last-selected-worktree:${PROJECT}`, "feature/web");

    renderApp();

    expect(await screen.findByTitle("feature/web")).toBeInTheDocument();
    const header = within(screen.getByRole("region", { name: PROJECT })).getByRole("button", { name: /^webmux/ });
    await waitFor(() => expect(header).toHaveAttribute("aria-expanded", "true"));
    expect(screen.getByRole("button", { name: /^feature\/web\b/i })).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "docs" })).getByRole("button", { name: /^docs/ }))
      .toHaveAttribute("aria-expanded", "false");
  });

  async function selectThenCollapse(project: string, branch: string): Promise<void> {
    const region = screen.getByRole("region", { name: project });
    await fireEvent.click(within(region).getByRole("button", { name: new RegExp(`^${branch}\\b`, "i") }));
    await waitFor(() => expect(window.location.hash).toBe(`#${project}/${branch}`));
    await fireEvent.click(within(region).getByRole("button", { name: new RegExp(`^${project}`) }));
    expect(within(region).queryByRole("button", { name: new RegExp(`^${branch}\\b`, "i") })).not.toBeInTheDocument();
  }

  it("steps from a selection the user collapsed to the rows around its project", async () => {
    useThreeProjects();

    renderApp();
    await screen.findByTitle("main");
    await selectThenCollapse("images", "main");

    await fireEvent.keyDown(window, { key: "ArrowUp", metaKey: true });
    await waitFor(() => expect(window.location.hash).toBe(`#${PROJECT}/feature/web`));
    expect(within(screen.getByRole("region", { name: "images" })).getByRole("button", { name: /^images/ }))
      .toHaveAttribute("aria-expanded", "false");

    await selectThenCollapse("webmux", "feature/web");
    await fireEvent.keyDown(window, { key: "ArrowDown", metaKey: true });
    await waitFor(() => expect(window.location.hash).toBe("#docs/feature/doc"));
  });

  it("selects the row above a removed worktree hidden in a collapsed project", async () => {
    useThreeProjects();

    renderApp();
    await screen.findByTitle("main");
    await selectThenCollapse("images", "main");

    await fireEvent.keyDown(window, { key: "d", metaKey: true });
    await fireEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(api.removeWorktree).toHaveBeenCalledWith({ params: { name: "main" } }));
    await waitFor(() => expect(window.location.hash).toBe(`#${PROJECT}/feature/web`));
  });

  it("keeps the current selection when a new worktree is created from an existing selection", async () => {
    const existingWorktree = createWorktree("main");
    const creatingWorktree = createWorktree("feature/new", {
      creating: true,
      creationPhase: "creating_worktree",
    });
    const newWorktree = createWorktree("feature/new");
    const createResult = deferred<{ primaryBranch: string; branches: string[] }>();

    vi.mocked(fetchWorktrees)
      .mockResolvedValueOnce([existingWorktree])
      .mockResolvedValueOnce([existingWorktree, creatingWorktree])
      .mockResolvedValueOnce([existingWorktree, newWorktree])
      .mockResolvedValue([existingWorktree, newWorktree]);
    vi.mocked(api.createWorktree).mockReturnValueOnce(createResult.promise);

    renderApp();

    await screen.findByTitle("main");

    await openCreateDialogAndSubmit("feature/new");

    await waitFor(() => {
      expect(fetchWorktrees).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByRole("button", { name: /^feature\/new\b/i })).toBeInTheDocument();
    expect(screen.getByTitle("main")).toBeInTheDocument();
    expect(screen.queryByTitle("feature/new")).not.toBeInTheDocument();

    createResult.resolve({ primaryBranch: "feature/new", branches: ["feature/new"] });

    await waitFor(() => {
      expect(fetchWorktrees).toHaveBeenCalledTimes(3);
    });
    expect(screen.getByTitle("main")).toBeInTheDocument();
    expect(screen.queryByTitle("feature/new")).not.toBeInTheDocument();
  });

  it("selects the new worktree when nothing was selected before creation", async () => {
    const creatingWorktree = createWorktree("feature/new", {
      creating: true,
      creationPhase: "creating_worktree",
    });
    const newWorktree = createWorktree("feature/new");
    const createResult = deferred<{ primaryBranch: string; branches: string[] }>();

    vi.mocked(fetchWorktrees)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([creatingWorktree])
      .mockResolvedValueOnce([newWorktree])
      .mockResolvedValue([newWorktree]);
    vi.mocked(api.createWorktree).mockReturnValueOnce(createResult.promise);

    renderApp();

    await screen.findByText("Select a worktree");

    await openCreateDialogAndSubmit("feature/new");
    createResult.resolve({ primaryBranch: "feature/new", branches: ["feature/new"] });

    await waitFor(() => {
      expect(fetchWorktrees).toHaveBeenCalledTimes(3);
    });
    expect(screen.getByTitle("feature/new")).toBeInTheDocument();
  });

  it("shows an error toast when worktree creation fails", async () => {
    vi.mocked(fetchWorktrees).mockResolvedValue([]);
    vi.mocked(api.createWorktree).mockRejectedValueOnce(new Error("branch exists"));

    renderApp();

    await screen.findByText("Select a worktree");
    await openCreateDialogAndSubmit("feature/new");

    const toast = await screen.findByRole("alert");
    expect(toast).toHaveTextContent("Failed to create: branch exists");
  });

  it("dismisses notification toasts through the notification API", async () => {
    let onNotification: ((notification: AppNotification) => void) | undefined;

    vi.mocked(fetchWorktrees).mockResolvedValue([]);
    vi.mocked(subscribeNotifications).mockImplementation((handleNotification) => {
      onNotification = handleNotification;
      return () => {};
    });

    renderApp();

    await screen.findByText("Select a worktree");
    onNotification?.(createAppNotification({ id: 42, project: "images", message: "Background error" }));

    const toast = await screen.findByRole("alert");
    const dismissButton = Array.from(toast.querySelectorAll("button")).find(
      (button) => button.textContent === "\u00d7",
    );

    expect(dismissButton).toBeDefined();
    await fireEvent.click(dismissButton!);

    expect(dismissNotification).toHaveBeenCalledWith(expect.objectContaining({ project: "images", id: 42 }));
  });

  it("shows a success toast when pulling main succeeds", async () => {
    vi.mocked(api.fetchConfig).mockResolvedValue(createConfig({
      projectDir: "/repo",
      mainBranch: "main",
    }));
    vi.mocked(fetchWorktrees).mockResolvedValue([]);
    vi.mocked(api.pullMain).mockResolvedValueOnce({ status: "updated" });

    renderApp();

    await screen.findByText("Select a worktree");
    await fireEvent.click(await screen.findByRole("button", { name: `Actions for ${PROJECT}` }));
    await fireEvent.click(screen.getByRole("button", { name: "Pull main" }));
    await fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Pull" }));

    expect(api.pullMain).toHaveBeenCalledWith({ body: {} });
    expect(await screen.findByRole("alert")).toHaveTextContent('Pulled latest "main" from remote');
  });

  describe("project actions", () => {
    function useImagesProject(worktrees: WorktreeInfo[] = [createWorktree("feature/img", { project: "images" })]): void {
      otherProjects.list = [{ prefix: "images", name: "images", worktrees, error: null }];
    }

    async function openProjectMenu(name: string): Promise<void> {
      await fireEvent.click(await screen.findByRole("button", { name: `Actions for ${name}` }));
    }

    async function submitCreate(branch: string): Promise<void> {
      await screen.findByText("New Worktree");
      await fireEvent.input(screen.getByLabelText(/Branch name/i), { target: { value: branch } });
      await fireEvent.click(screen.getByRole("button", { name: "Create" }));
      await waitFor(() => expect(api.createWorktree).toHaveBeenCalled());
    }

    beforeEach(() => {
      vi.mocked(fetchWorktrees).mockResolvedValue([createWorktree("feature/web")]);
      vi.mocked(api.createWorktree).mockResolvedValue({ primaryBranch: "feature/new", branches: ["feature/new"] });
    });

    it("creates a worktree in the header's project from its + button and its menu", async () => {
      useImagesProject();
      renderApp();

      await fireEvent.click(await screen.findByRole("button", { name: "New worktree in images" }));
      await submitCreate("feature/plus");
      expect(projectOfLastCall(api.createWorktree)).toBe("images");

      await openProjectMenu("images");
      await fireEvent.click(screen.getByRole("button", { name: "New worktree" }));
      await submitCreate("feature/menu");
      expect(projectOfLastCall(api.createWorktree)).toBe("images");
    });

    function headerBar(name: string): HTMLElement {
      const bar = screen.getByRole("region", { name }).querySelector<HTMLElement>("[data-project-header-bar]");
      if (!bar) throw new Error(`no header bar for ${name}`);
      return bar;
    }

    it("raises an open menu's header above the following sticky headers", async () => {
      useImagesProject();
      renderApp();

      await openProjectMenu(PROJECT);

      expect(headerBar(PROJECT)).toHaveClass("has-[[data-popup-menu]]:z-10");
      expect(headerBar(PROJECT).matches(":has([data-popup-menu])")).toBe(true);
      expect(headerBar("images").matches(":has([data-popup-menu])")).toBe(false);
    });

    it("keeps a single menu open across header and row menus", async () => {
      useImagesProject();
      renderApp();

      await openProjectMenu(PROJECT);
      await openProjectMenu("images");
      expect(screen.getAllByRole("button", { name: "Remove project" })).toHaveLength(1);
      expect(headerBar("images").matches(":has([data-popup-menu])")).toBe(true);

      await fireEvent.click(screen.getByRole("button", { name: "Actions for feature/web" }));
      expect(screen.queryByRole("button", { name: "Remove project" })).not.toBeInTheDocument();
      const webmux = screen.getByRole("region", { name: PROJECT });
      expect(within(webmux).getByRole("button", { name: "Archive" })).toBeInTheDocument();

      await openProjectMenu(PROJECT);
      expect(within(webmux).queryByRole("button", { name: "Archive" })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Remove project" })).toBeInTheDocument();
    });

    it("closes an open menu when another header's + is clicked", async () => {
      useImagesProject();
      renderApp();

      await openProjectMenu(PROJECT);
      await fireEvent.click(screen.getByRole("button", { name: "New worktree in images" }));

      expect(screen.queryByRole("button", { name: "Remove project" })).not.toBeInTheDocument();
      expect(await screen.findByText("New Worktree")).toBeInTheDocument();
    });

    it("pulls the header's project and opens it in the IDE", async () => {
      useImagesProject();
      vi.mocked(api.fetchConfig).mockResolvedValue(createConfig({
        projectDir: "/repos/images",
        mainBranch: "trunk",
        linkedRepos: [{ alias: "shared", dir: "/repos/shared" }],
      }));
      renderApp();

      await openProjectMenu("images");
      expect(await screen.findByRole("link", { name: "Open in Cursor" })).toHaveAttribute("href", "cursor://file/repos/images");
      expect(screen.getByRole("link", { name: "Open shared in Cursor" })).toHaveAttribute("href", "cursor://file/repos/shared");
      await fireEvent.click(screen.getByRole("button", { name: "Pull trunk" }));
      await fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Pull" }));

      await waitFor(() => expect(api.pullMain).toHaveBeenCalledWith({ body: {} }));
      expect(projectOfLastCall(api.pullMain)).toBe("images");

      await openProjectMenu("images");
      await fireEvent.click(screen.getByRole("button", { name: "Pull shared" }));
      await fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Pull" }));

      await waitFor(() => expect(api.pullMain).toHaveBeenCalledWith({ body: { repo: "shared" } }));
      expect(projectOfLastCall(api.pullMain)).toBe("images");
    });

    it("creates with Cmd+K in the selected worktree's project", async () => {
      useImagesProject();
      renderApp();

      await fireEvent.click(await screen.findByRole("button", { name: /^feature\/img\b/i }));
      await fireEvent.keyDown(window, { key: "k", metaKey: true });
      await submitCreate("feature/cmdk");

      expect(projectOfLastCall(api.createWorktree)).toBe("images");
    });

    it("creates with Cmd+K in the first project when nothing is selected", async () => {
      useImagesProject([]);
      renderApp("images");

      await screen.findByText("Select a worktree");
      await screen.findByRole("region", { name: "images" });
      await fireEvent.keyDown(window, { key: "k", metaKey: true });
      await submitCreate("feature/cmdk");

      expect(projectOfLastCall(api.createWorktree)).toBe(PROJECT);
    });

    it("adds a project, which then shows under its header", async () => {
      vi.mocked(setUpProject).mockImplementation(async () => {
        useImagesProject();
        return { prefix: "images" };
      });
      renderApp();
      await screen.findByRole("region", { name: PROJECT });

      await fireEvent.click(screen.getByRole("button", { name: "Add project" }));
      await fireEvent.input(screen.getByLabelText("Path to a git repo"), { target: { value: "/repos/images" } });
      await fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Add" }));

      expect(setUpProject).toHaveBeenCalledWith("/repos/images", expect.any(Function));
      expect(await screen.findByRole("region", { name: "images" })).toBeInTheDocument();
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("removes a project after confirming and moves the selection off it", async () => {
      useImagesProject();
      vi.mocked(removeProject).mockImplementation(async () => {
        otherProjects.list = [];
      });
      vi.mocked(fetchProjects).mockResolvedValue([{ prefix: PROJECT, name: PROJECT, path: "/repo", active: true }]);
      const { onNoProjects } = renderApp();
      await fireEvent.click(await screen.findByRole("button", { name: /^feature\/img\b/i }));
      expect(await screen.findByTitle("feature/img")).toBeInTheDocument();

      await openProjectMenu("images");
      await fireEvent.click(screen.getByRole("button", { name: "Remove project" }));
      expect(removeProject).not.toHaveBeenCalled();
      await fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove" }));

      expect(removeProject).toHaveBeenCalledWith("images");
      await waitFor(() => expect(screen.queryByRole("region", { name: "images" })).not.toBeInTheDocument());
      expect(await screen.findByTitle("feature/web")).toBeInTheDocument();
      expect(window.location.hash).toBe(`#${PROJECT}/feature/web`);
      expect(onNoProjects).not.toHaveBeenCalled();
    });

    it("keeps the selection when removing another project", async () => {
      useImagesProject();
      vi.mocked(removeProject).mockImplementation(async () => {
        otherProjects.list = [];
      });
      vi.mocked(fetchProjects).mockResolvedValue([{ prefix: PROJECT, name: PROJECT, path: "/repo", active: true }]);
      renderApp();
      await fireEvent.click(await screen.findByRole("button", { name: /^feature\/web\b/i }));
      expect(await screen.findByTitle("feature/web")).toBeInTheDocument();

      await openProjectMenu("images");
      await fireEvent.click(screen.getByRole("button", { name: "Remove project" }));
      await fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove" }));

      await waitFor(() => expect(screen.queryByRole("region", { name: "images" })).not.toBeInTheDocument());
      expect(screen.getByTitle("feature/web")).toBeInTheDocument();
      expect(window.location.hash).toBe(`#${PROJECT}/feature/web`);
    });

    it("falls back to the empty state once the last project is removed", async () => {
      vi.mocked(removeProject).mockResolvedValue(undefined);
      vi.mocked(fetchProjects).mockResolvedValue([]);
      const { onNoProjects } = renderApp();

      await openProjectMenu(PROJECT);
      await fireEvent.click(screen.getByRole("button", { name: "Remove project" }));
      await fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove" }));

      await waitFor(() => expect(onNoProjects).toHaveBeenCalledTimes(1));
    });

    it("keeps the dialog open with the error when removing fails", async () => {
      vi.mocked(removeProject).mockRejectedValue(new Error("registry locked"));
      const { onNoProjects } = renderApp();

      await openProjectMenu(PROJECT);
      await fireEvent.click(screen.getByRole("button", { name: "Remove project" }));
      await fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Remove" }));

      expect(await within(screen.getByRole("dialog")).findByText("registry locked")).toBeInTheDocument();
      expect(fetchProjects).not.toHaveBeenCalled();
      expect(onNoProjects).not.toHaveBeenCalled();
    });
  });

  it("selects the primary paired worktree when Both is created without a prior selection", async () => {
    const creatingClaude = createWorktree("claude-feature/new", {
      creating: true,
      creationPhase: "creating_worktree",
    });
    const creatingCodex = createWorktree("codex-feature/new", {
      creating: true,
      creationPhase: "creating_worktree",
    });
    const createdClaude = createWorktree("claude-feature/new");
    const createdCodex = createWorktree("codex-feature/new");
    const createResult = deferred<{ primaryBranch: string; branches: string[] }>();

    vi.mocked(fetchWorktrees)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([creatingClaude, creatingCodex])
      .mockResolvedValueOnce([createdClaude, createdCodex])
      .mockResolvedValue([createdClaude, createdCodex]);
    vi.mocked(api.createWorktree).mockReturnValueOnce(createResult.promise);

    renderApp();

    await screen.findByText("Select a worktree");

    await fireEvent.click(screen.getByTitle("New Worktree (Cmd+K)"));
    await screen.findByText("New Worktree");
    await fireEvent.click(screen.getByRole("switch", { name: /enable multiple agent selection/i }));
    await fireEvent.click(screen.getByRole("checkbox", { name: "Codex" }));
    await fireEvent.input(screen.getByLabelText(/Branch name/i), {
      target: { value: "feature/new" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Create" }));

    createResult.resolve({
      primaryBranch: "claude-feature/new",
      branches: ["claude-feature/new", "codex-feature/new"],
    });

    await waitFor(() => {
      expect(fetchWorktrees).toHaveBeenCalledTimes(3);
    });
    expect(screen.getByTitle("claude-feature/new")).toBeInTheDocument();
  });

  it("hides archived worktrees until the archived toggle is enabled", async () => {
    vi.mocked(fetchWorktrees).mockResolvedValue([
      createWorktree("feature/active"),
      createWorktree("feature/archived", { archived: true }),
    ]);

    renderApp();

    await screen.findByRole("button", { name: /^feature\/active\b/i });
    expect(screen.queryByRole("button", { name: /feature\/archived/i })).not.toBeInTheDocument();

    await fireEvent.click(screen.getByRole("switch", { name: /show archived worktrees/i }));

    expect(
      await screen.findByRole("button", { name: /^feature\/archived\b/i }),
    ).toBeInTheDocument();
  });

  it("keeps the current selection while filtering the worktree list", async () => {
    vi.mocked(fetchWorktrees).mockResolvedValue([
      createWorktree("main"),
      createWorktree("feature/alpha"),
      createWorktree("feature/beta"),
    ]);

    renderApp();

    const searchInput = await screen.findByRole("searchbox", { name: /search worktrees/i });
    await screen.findByTitle("main");

    await fireEvent.focus(searchInput);
    await fireEvent.input(searchInput, { target: { value: "feature" } });

    expect(screen.getByTitle("main")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^main\b/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^feature\/alpha\b/i })).toBeInTheDocument();
  });

  it("clears the worktree search from the trailing clear button", async () => {
    vi.mocked(fetchWorktrees).mockResolvedValue([
      createWorktree("feature/alpha"),
      createWorktree("feature/beta"),
    ]);

    renderApp();

    const searchInput = await screen.findByRole("searchbox", { name: /search worktrees/i });
    await fireEvent.input(searchInput, { target: { value: "alpha" } });
    expect(searchInput).toHaveValue("alpha");

    await fireEvent.click(screen.getByRole("button", { name: /clear worktree search/i }));

    expect(searchInput).toHaveValue("");
  });

  it("archives the selected worktree through the API", async () => {
    vi.mocked(fetchWorktrees)
      .mockResolvedValueOnce([createWorktree("feature/active")])
      .mockResolvedValueOnce([createWorktree("feature/active", { archived: true })])
      .mockResolvedValue([createWorktree("feature/active", { archived: true })]);

    renderApp();

    await screen.findByTitle("feature/active");
    await fireEvent.click(screen.getByRole("button", { name: "Archive" }));

    await waitFor(() => {
      expect(api.setWorktreeArchived).toHaveBeenCalledWith({
        params: { name: "feature/active" },
        body: { archived: true },
      });
    });
  });

  it("reconnects the visible terminal after refreshing a stale terminal", async () => {
    localStorage.setItem(`wt-last-selected-worktree:${PROJECT}`, "feature/active");
    const staleWorktree = createWorktree("feature/active", {
      mux: "✓",
      agentName: "codex",
      agentLabel: "Codex",
      agentTerminalStale: true,
    });
    const refreshedWorktree = createWorktree("feature/active", {
      mux: "✓",
      agentName: "codex",
      agentLabel: "Codex",
      agentTerminalStale: false,
    });

    vi.mocked(fetchWorktrees)
      .mockResolvedValueOnce([staleWorktree])
      .mockResolvedValueOnce([refreshedWorktree])
      .mockResolvedValue([refreshedWorktree]);

    renderApp();

    await screen.findByText("Terminal stale");
    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(1);
    });

    await fireEvent.click(screen.getByRole("button", { name: "Refresh" }));

    await waitFor(() => {
      expect(refreshWorktreeAgentTerminal).toHaveBeenCalledWith(PROJECT, "feature/active");
    });
    await waitFor(() => {
      expect(MockWebSocket.instances).toHaveLength(2);
    });
    expect(MockWebSocket.instances[0]?.readyState).toBe(MockWebSocket.CLOSED);
  });

  it("edits the selected worktree label from the header", async () => {
    vi.mocked(fetchWorktrees).mockResolvedValue([createWorktree("feature/active")]);
    vi.mocked(setWorktreeLabel).mockResolvedValue("Search ranking");

    renderApp();

    await screen.findByTitle("feature/active");
    await fireEvent.click(screen.getByRole("button", { name: "Edit workspace label" }));
    await fireEvent.input(screen.getByLabelText("Label"), {
      target: { value: "Search ranking" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(setWorktreeLabel).toHaveBeenCalledWith(PROJECT, "feature/active", "Search ranking");
    });
    expect(screen.getAllByText("Search ranking").length).toBeGreaterThan(0);
  });

  it("switches a worktree to another profile from the sidebar row menu", async () => {
    vi.mocked(api.fetchConfig).mockResolvedValue(createConfig({
      profiles: [{ name: "slim" }, { name: "full" }],
      defaultProfileName: "slim",
    }));
    vi.mocked(fetchWorktrees).mockResolvedValue([
      createWorktree("feature/active", { profile: "slim", mux: "✓" }),
    ]);

    renderApp();

    await screen.findByTitle("feature/active");
    await fireEvent.click(screen.getByRole("button", { name: /actions for feature\/active/i }));
    await fireEvent.click(screen.getByRole("button", { name: "Change profile…" }));
    await fireEvent.click(screen.getByRole("radio", { name: "full" }));
    await fireEvent.click(screen.getByRole("button", { name: "Switch" }));

    await waitFor(() => {
      expect(setWorktreeProfile).toHaveBeenCalledWith(PROJECT, "feature/active", "full");
    });
  });

  it("shows a setup message in the Linear panel when LINEAR_API_KEY is missing", async () => {
    vi.mocked(fetchWorktrees).mockResolvedValue([]);
    vi.mocked(api.fetchLinearIssues).mockResolvedValue(
      createLinearIssuesResponse({ availability: "missing_api_key" }),
    );

    renderApp();

    const toggle = await screen.findByRole("button", { name: /linear/i });
    expect(toggle).toBeInTheDocument();

    await fireEvent.click(toggle);

    expect(
      await screen.findByText((_, element) =>
        element?.textContent === "Set LINEAR_API_KEY to show your assigned Linear issues here.",
      ),
    ).toBeInTheDocument();
  });

  it("shows an empty-state message in the Linear panel when Linear is ready but has no issues", async () => {
    vi.mocked(fetchWorktrees).mockResolvedValue([]);
    vi.mocked(api.fetchLinearIssues).mockResolvedValue(
      createLinearIssuesResponse({ availability: "ready", issues: [] }),
    );

    renderApp();

    const toggle = await screen.findByRole("button", { name: /linear/i });
    expect(toggle).toBeInTheDocument();

    await fireEvent.click(toggle);

    expect(
      await screen.findByText("No assigned Linear issues right now."),
    ).toBeInTheDocument();
  });

  it("shows the web chat UI on desktop when the local setting is enabled", async () => {
    const worktree = createWorktree("feature/chat", {
      mux: "✓",
      agentName: "claude",
      agentLabel: "Claude",
    });
    localStorage.setItem(WEB_CHAT_UI_STORAGE_KEY, "true");
    vi.mocked(fetchWorktrees).mockResolvedValue([worktree]);
    vi.mocked(attachWorktreeConversation).mockResolvedValue(createConversationResponse(worktree));

    renderApp();

    expect(await screen.findByRole("textbox", { name: "Message" })).toBeInTheDocument();
    expect(attachWorktreeConversation).toHaveBeenCalledWith(PROJECT, "feature/chat");
  });

  it("does not show the stale terminal banner in the web chat UI", async () => {
    const worktree = createWorktree("feature/chat-stale-terminal", {
      mux: "✓",
      agentName: "codex",
      agentLabel: "Codex",
      agentTerminalStale: true,
    });
    localStorage.setItem(WEB_CHAT_UI_STORAGE_KEY, "true");
    vi.mocked(fetchWorktrees).mockResolvedValue([worktree]);
    vi.mocked(attachWorktreeConversation).mockResolvedValue(createConversationResponse(worktree));

    renderApp();

    expect(await screen.findByRole("textbox", { name: "Message" })).toBeInTheDocument();
    expect(screen.queryByText("Terminal stale")).not.toBeInTheDocument();
  });

  it("hides the Linear ticket option when disabled in config", async () => {
    vi.mocked(fetchWorktrees).mockResolvedValue([]);

    renderApp();

    await fireEvent.click(screen.getByTitle("New Worktree (Cmd+K)"));
    await screen.findByText("New Worktree");

    expect(screen.queryByRole("switch", { name: /create linear ticket/i })).not.toBeInTheDocument();
  });

  it("submits Linear ticket creation when the option is enabled", async () => {
    vi.mocked(api.fetchConfig).mockResolvedValue(createConfig({
      linearCreateTicketOption: true,
    }));
    vi.mocked(fetchWorktrees).mockResolvedValue([]);
    vi.mocked(api.createWorktree).mockResolvedValue({
      primaryBranch: "eng-123-new-flow",
      branches: ["eng-123-new-flow"],
    });

    renderApp();

    await fireEvent.click(screen.getByTitle("New Worktree (Cmd+K)"));
    await screen.findByText("New Worktree");

    const linearToggle = screen.getByRole("switch", { name: /create linear ticket/i });
    await fireEvent.click(linearToggle);

    const createButton = screen.getByRole("button", { name: "Create" });
    expect(createButton).toBeDisabled();
    expect(screen.getByLabelText(/Branch name/i)).toBeDisabled();

    await fireEvent.input(screen.getByLabelText(/Prompt/i), {
      target: { value: "Implement the new flow" },
    });
    await fireEvent.input(screen.getByLabelText(/Team key/i), {
      target: { value: "ENG" },
    });
    await fireEvent.input(screen.getByLabelText(/Linear ticket title/i), {
      target: { value: "Ship Linear-backed worktree creation" },
    });
    await waitFor(() => {
      expect(createButton).not.toBeDisabled();
    });
    await fireEvent.click(createButton);

    await waitFor(() => {
      expect(api.createWorktree).toHaveBeenCalledWith({
        body: {
          mode: "new",
          profile: "default",
          agents: ["claude"],
          prompt: "Implement the new flow",
          createLinearTicket: true,
          linearTeamKey: "ENG",
          linearTitle: "Ship Linear-backed worktree creation",
        },
      });
    });
  });

  it("shows prefixed branch previews when multiple agents are selected", async () => {
    vi.mocked(fetchWorktrees).mockResolvedValue([]);

    renderApp();

    await fireEvent.click(screen.getByTitle("New Worktree (Cmd+K)"));
    await screen.findByText("New Worktree");

    await fireEvent.click(screen.getByRole("switch", { name: /enable multiple agent selection/i }));
    await fireEvent.click(screen.getByRole("checkbox", { name: "Codex" }));
    await fireEvent.input(screen.getByLabelText(/Branch name/i), {
      target: { value: "feature/new" },
    });

    expect(screen.getByText("claude-feature/new")).toBeInTheDocument();
    expect(screen.getByText("codex-feature/new")).toBeInTheDocument();
  });

  it("submits multi-agent worktree creation when multiple agents are selected", async () => {
    vi.mocked(fetchWorktrees).mockResolvedValue([]);
    vi.mocked(api.createWorktree).mockResolvedValue({
      primaryBranch: "claude-feature/new",
      branches: ["claude-feature/new", "codex-feature/new"],
    });

    renderApp();

    await fireEvent.click(screen.getByTitle("New Worktree (Cmd+K)"));
    await screen.findByText("New Worktree");

    await fireEvent.click(screen.getByRole("switch", { name: /enable multiple agent selection/i }));
    await fireEvent.click(screen.getByRole("checkbox", { name: "Codex" }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Use existing branch" })).not.toBeInTheDocument();
    });

    await fireEvent.input(screen.getByLabelText(/Branch name/i), {
      target: { value: "feature/new" },
    });
    await fireEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(api.createWorktree).toHaveBeenCalledWith({
        body: {
          mode: "new",
          branch: "feature/new",
          profile: "default",
          agents: ["claude", "codex"],
        },
      });
    });
  });

  it("submits an explicit base branch when provided", async () => {
    vi.mocked(fetchWorktrees).mockResolvedValue([]);
    vi.mocked(api.fetchBaseBranches).mockResolvedValue({ branches: [{ name: "release/base" }] });
    vi.mocked(api.createWorktree).mockResolvedValue({
      primaryBranch: "feature/from-release",
      branches: ["feature/from-release"],
    });

    renderApp();

    await openCreateDialogWithBaseAndSubmit("feature/from-release", "release/base");

    await waitFor(() => {
      expect(api.createWorktree).toHaveBeenCalledWith({
        body: {
          mode: "new",
          branch: "feature/from-release",
          baseBranch: "release/base",
          profile: "default",
          agents: ["claude"],
        },
      });
    });
  });

  it("caches branch lists across dialog openings and only fetches each mode once", async () => {
    vi.mocked(fetchWorktrees).mockResolvedValue([]);
    vi.mocked(api.fetchAvailableBranches)
      .mockResolvedValueOnce({ branches: [{ name: "feature/local-only" }] })
      .mockResolvedValueOnce({ branches: [{ name: "feature/local-only" }, { name: "feature/remote-only" }] });
    vi.mocked(api.fetchBaseBranches).mockResolvedValue({ branches: [{ name: "main" }] });

    renderApp();

    await fireEvent.click(screen.getByTitle("New Worktree (Cmd+K)"));
    await screen.findByText("New Worktree");

    await waitFor(() => {
      expect(api.fetchAvailableBranches).toHaveBeenCalledTimes(1);
      expect(api.fetchAvailableBranches).toHaveBeenCalledWith({ query: { includeRemote: false } });
      expect(api.fetchBaseBranches).toHaveBeenCalledTimes(1);
    });

    await fireEvent.click(screen.getByRole("button", { name: "Use existing branch" }));
    await fireEvent.click(await screen.findByRole("switch", { name: /include remote branches/i }));

    await waitFor(() => {
      expect(api.fetchAvailableBranches).toHaveBeenCalledTimes(2);
      expect(api.fetchAvailableBranches).toHaveBeenLastCalledWith({ query: { includeRemote: true } });
    });

    await fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await fireEvent.click(screen.getByTitle("New Worktree (Cmd+K)"));
    await screen.findByText("New Worktree");

    await waitFor(() => {
      expect(api.fetchAvailableBranches).toHaveBeenCalledTimes(2);
      expect(api.fetchBaseBranches).toHaveBeenCalledTimes(1);
    });

    await fireEvent.click(screen.getByRole("button", { name: "Use existing branch" }));
    await fireEvent.click(await screen.findByRole("switch", { name: /include remote branches/i }));

    await waitFor(() => {
      expect(api.fetchAvailableBranches).toHaveBeenCalledTimes(2);
      expect(api.fetchBaseBranches).toHaveBeenCalledTimes(1);
    });
  });

  it("keeps the current branch list visible while remote branches are loading", async () => {
    const remoteBranches = deferred<Array<{ name: string }>>();

    vi.mocked(fetchWorktrees).mockResolvedValue([]);
    vi.mocked(api.fetchAvailableBranches)
      .mockResolvedValueOnce({ branches: [{ name: "feature/local-only" }] })
      .mockReturnValueOnce(remoteBranches.promise.then((branches) => ({ branches })));

    renderApp();

    await fireEvent.click(screen.getByTitle("New Worktree (Cmd+K)"));
    await screen.findByText("New Worktree");
    await fireEvent.click(screen.getByRole("button", { name: "Use existing branch" }));

    expect(await screen.findByRole("button", { name: "feature/local-only" })).toBeInTheDocument();

    await fireEvent.click(await screen.findByRole("switch", { name: /include remote branches/i }));

    expect(screen.getByRole("button", { name: "feature/local-only" })).toBeInTheDocument();
    expect(screen.getByText("Updating...")).toBeInTheDocument();

    remoteBranches.resolve([{ name: "feature/local-only" }, { name: "feature/remote-only" }]);

    expect(await screen.findByRole("button", { name: "feature/remote-only" })).toBeInTheDocument();
  });

  it("posts directly to the linked Linear issue via the row menu confirm dialog", async () => {
    const linkedWorktree = createWorktree("feature/linked", {
      mux: "✓",
      linearIssue: {
        identifier: "ENG-42",
        url: "https://linear.app/example/issue/ENG-42",
        state: { name: "In Progress", color: "#5e6ad2", type: "started" },
      },
    });
    vi.mocked(fetchWorktrees).mockResolvedValue([linkedWorktree]);

    renderApp();

    await screen.findByTitle("feature/linked");

    await fireEvent.click(screen.getByRole("button", { name: /actions for feature\/linked/i }));
    await fireEvent.click(screen.getByRole("button", { name: "Post conversation to ENG-42" }));

    const dialog = await screen.findByRole("dialog");
    await fireEvent.click(within(dialog).getByRole("button", { name: "Post" }));

    await waitFor(() => {
      expect(postWorktreeToLinear).toHaveBeenCalledTimes(1);
    });
    expect(postWorktreeToLinear).toHaveBeenCalledWith(PROJECT, "feature/linked", {
      kind: "issue",
      issueId: "ENG-42",
    });
    expect(screen.queryByText("Post to Linear")).not.toBeInTheDocument();
  });

  it("disables the linked-issue menu item while a post is in flight", async () => {
    const linkedWorktree = createWorktree("feature/linked", {
      mux: "✓",
      linearIssue: {
        identifier: "ENG-42",
        url: "https://linear.app/example/issue/ENG-42",
        state: { name: "In Progress", color: "#5e6ad2", type: "started" },
      },
    });
    vi.mocked(fetchWorktrees).mockResolvedValue([linkedWorktree]);
    const pending = deferred<{
      ok: true;
      issueId: string;
      issueUrl: string;
      commentUrl: string | null;
      attachmentUrl: string;
    }>();
    vi.mocked(postWorktreeToLinear).mockReturnValueOnce(pending.promise);

    renderApp();

    await screen.findByTitle("feature/linked");

    await fireEvent.click(screen.getByRole("button", { name: /actions for feature\/linked/i }));
    await fireEvent.click(screen.getByRole("button", { name: "Post conversation to ENG-42" }));
    const dialog = await screen.findByRole("dialog");
    await fireEvent.click(within(dialog).getByRole("button", { name: "Post" }));

    await waitFor(() => {
      expect(postWorktreeToLinear).toHaveBeenCalledTimes(1);
    });

    await fireEvent.click(screen.getByRole("button", { name: /actions for feature\/linked/i }));
    const pendingMenuItem = await screen.findByRole("button", { name: "Posting to Linear…" });
    expect(pendingMenuItem).toBeDisabled();
    await fireEvent.click(pendingMenuItem);
    expect(postWorktreeToLinear).toHaveBeenCalledTimes(1);

    pending.resolve({
      ok: true,
      issueId: "ENG-42",
      issueUrl: "https://linear.app/example/issue/ENG-42",
      commentUrl: null,
      attachmentUrl: "https://linear.app/attachment/x",
    });
  });
});
