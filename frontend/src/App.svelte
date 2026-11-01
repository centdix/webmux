<script lang="ts">
  import { onMount, untrack, type Component } from "svelte";
  import WorktreeList from "./lib/WorktreeList.svelte";
  import TopBar from "./lib/TopBar.svelte";
  import Terminal from "./lib/Terminal.svelte";
  import ConfirmDialog from "./lib/ConfirmDialog.svelte";
  import CreateWorktreeDialog from "./lib/CreateWorktreeDialog.svelte";
  import SettingsDialog from "./lib/SettingsDialog.svelte";
  import CiDetailsDialog from "./lib/CiDetailsDialog.svelte";
  import CommentReviewDialog from "./lib/CommentReviewDialog.svelte";
  import PaneBar from "./lib/PaneBar.svelte";
  import ToastStack from "./lib/ToastStack.svelte";
  import LinearPanel from "./lib/LinearPanel.svelte";
  import LinearDetailDialog from "./lib/LinearDetailDialog.svelte";
  import LinearPostDialog from "./lib/LinearPostDialog.svelte";
  import MobileChatSurface from "./lib/MobileChatSurface.svelte";
  import WorktreeLabelDialog from "./lib/WorktreeLabelDialog.svelte";
  import WorktreeProfileDialog from "./lib/WorktreeProfileDialog.svelte";
  import ProjectActionsMenu from "./lib/ProjectActionsMenu.svelte";
  import ProjectRail from "./lib/ProjectRail.svelte";
  import Btn from "./lib/Btn.svelte";
  import AddProjectForm from "./lib/AddProjectForm.svelte";
  import BaseDialog from "./lib/BaseDialog.svelte";
  import MigrationBanner from "./lib/MigrationBanner.svelte";
  import type {
    AvailableBranch,
    AppConfig,
    AppNotification,
    CreateWorktreeRequest,
    DiffDialogProps,
    PrEntry,
    LinearIssue,
    LinearIssuesResponse,
    ProjectSummary,
    WorktreeInfo,
    WorktreeRef,
  } from "./lib/types";
  import {
    SSH_STORAGE_KEY,
    makeIdeUrl,
    errorMessage,
    worktreeCreationPhaseLabel,
    loadSavedTheme,
    resolveSelectedBranch,
    applyTheme,
    loadSavedSidebarWidth,
    saveSidebarWidth,
    clampSidebarWidth,
    MIN_SIDEBAR_WIDTH,
    MAX_SIDEBAR_WIDTH,
    loadUseWebChatUi,
    saveUseWebChatUi,
    loadFavoriteWorktreeKeys,
    saveFavoriteWorktreeKeys,
    projectRepos,
  } from "./lib/utils";
  import { buildProjectListRows, matchesWorktreeSearch } from "./lib/worktree-list";
  import { buildProjectRail } from "./lib/project-rail";
  import { supportsWorktreeChat, supportsWorktreeTabs } from "./lib/agent-capabilities";
  import { getTheme } from "./lib/themes";
  import type { ThemeKey } from "./lib/themes";
  import { setToastController } from "./lib/toast-context";
  import { projectApi, subscribeNotifications } from "./lib/api";
  import TabBar from "./lib/TabBar.svelte";
  import { parseWorktreeKey, sameWorktree, worktreeKey } from "./lib/worktree-ref";
  import {
    ACTIVE_CREATE_POLL_INTERVAL_MS,
    DEFAULT_POLL_INTERVAL_MS,
    WorktreesStore,
  } from "./lib/worktrees-store.svelte";
  import { neighborBranch, stepBranch, type WorktreeSelection } from "./lib/worktree-selection.svelte";
  import { readLocationHash, resolveHashTarget, writeLocationHash } from "./lib/project-location";
  import { WorktreeActions } from "./lib/worktree-actions.svelte";
  import { NotificationCenter } from "./lib/notifications.svelte";
  import { ProjectCache } from "./lib/project-cache.svelte";
  import { ProjectPull, ProjectRemoval } from "./lib/project-actions.svelte";

  let { selection, onNoProjects }: { selection: WorktreeSelection; onNoProjects: () => void } = $props();

  const DEFAULT_CONFIG: AppConfig = {
    name: "",
    profiles: [],
    agents: [],
    defaultProfileName: "",
    defaultAgentId: "claude",
    autoName: false,
    linearCreateTicketOption: false,
    startupEnvs: {},
    linkedRepos: [],
    linearAutoCreateWorktrees: false,
    autoRemoveOnMerge: false,
    projectDir: "",
    mainBranch: "",
    ide: "cursor",
  };
  const LINEAR_THROTTLE_MS = 300_000;
  const CONFIG_MAX_AGE_MS = 60_000;

  const configs = new ProjectCache<AppConfig>((p) => projectApi(p).fetchConfig(), {
    maxAgeMs: CONFIG_MAX_AGE_MS,
    // A create dialog waiting on this config would otherwise never open.
    onError: (p, err) => {
      if (!showCreateDialog || p !== createProject || configs.get(p)) return;
      closeCreateDialog();
      showToast({ tone: "error", message: `Failed to load the ${store.nameOf(p) ?? p} config: ${errorMessage(err)}` });
    },
  });
  const linear = new ProjectCache<LinearIssuesResponse>((p) => projectApi(p).fetchLinearIssues(), {
    maxAgeMs: LINEAR_THROTTLE_MS,
    onError: (_project, err) => console.warn("[linear]", err),
  });
  // Polls also pick up config edits and retry a failed config load.
  const store = new WorktreesStore(
    () => {
      linear.ensure(activeProject);
      configs.ensure(activeProject);
    },
    () => activeProject,
  );
  const notifications = new NotificationCenter();
  const showToast = notifications.show.bind(notifications);
  const actions = new WorktreeActions({
    store,
    toast: showToast,
    leave: selectNeighborOf,
    onBranchesChanged: invalidateBranchCaches,
  });
  const pull = new ProjectPull(showToast);
  const removal = new ProjectRemoval(handleProjectRemoved);

  /** The project chosen on the rail, which always holds the selected
   *  worktree: the sidebar lists it, and the main panel, its dialogs, the
   *  config they read, the Linear panel, Cmd+K and the poll focus target it. */
  let activeProject = $derived(selection.project);
  let config = $derived(configs.get(activeProject) ?? DEFAULT_CONFIG);
  let linearData = $derived(linear.get(activeProject));
  let linearIssues = $derived(linearData?.issues ?? []);
  let linearAvailability = $derived(linearData?.availability ?? "disabled");
  let hasLoadedWorktrees = $derived(store.hasLoaded(activeProject));
  let selectedBranch = $derived(selection.branch);
  // The boot project inherits the unscoped legacy favorites.
  let favoriteKeys = $state(untrack(() => loadFavoriteWorktreeKeys(selection.project)));

  function worktreeSupportsChat(worktree: WorktreeInfo | undefined): boolean {
    return supportsWorktreeChat(config.agents, worktree);
  }

  function worktreeSupportsTabs(worktree: WorktreeInfo | undefined): boolean {
    return supportsWorktreeTabs(config.agents, worktree);
  }

  /** A branch of the current project as a ref. */
  function refOf(branch: string): WorktreeRef {
    return { project: activeProject, branch };
  }

  let removeRef = $state<WorktreeRef | null>(null);
  let postToLinearRef = $state<WorktreeRef | null>(null);
  let postToLinkedConfirm = $state<{ ref: WorktreeRef; issueId: string } | null>(null);
  let labelRef = $state<WorktreeRef | null>(null);
  let labelLoading = $state(false);
  let labelError = $state("");
  let profileRef = $state<WorktreeRef | null>(null);
  let profileConfig = $derived((profileRef && configs.get(profileRef.project)) ?? DEFAULT_CONFIG);
  let profileLoading = $state(false);
  let profileError = $state("");
  let showCreateDialog = $state(false);
  /** Project the create dialog targets: the one it was opened for, or the
   *  parent's for a sub-worktree. */
  let createProject = $state("");
  let createConfig = $derived(configs.get(createProject) ?? DEFAULT_CONFIG);
  /** The dialog reads the profiles and startup envs once at mount, so it
   *  opens only once its project's config has loaded. */
  let createDialogOpen = $derived(showCreateDialog && configs.get(createProject) !== undefined);
  let showSettingsDialog = $state(false);
  let ciDetailsPr = $state<PrEntry | null>(null);
  let commentReviewPr = $state<PrEntry | null>(null);
  let showDiffDialog = $state(false);
  let DiffDialogComponent = $state<Component<DiffDialogProps> | null>(null);
  let showAddProjectDialog = $state(false);
  let pendingCreateCount = $state(0);
  let latestAutoSelectCreateId = -1;
  let nextCreateRequestId = 0;
  let nextAvailableBranchFetchId = 0;
  let nextBaseBranchFetchId = 0;
  let sshHost = $state(localStorage.getItem(SSH_STORAGE_KEY) ?? "");
  let currentTheme = $state<ThemeKey>(loadSavedTheme());
  let useWebChatUi = $state(loadUseWebChatUi());
  let terminalTheme = $derived(getTheme(currentTheme).terminal);
  let pendingCreate = $state<{ project: string; branchHint: string | null } | null>(null);
  let availableBranches = $state<AvailableBranch[]>([]);
  let availableBranchesLoading = $state(false);
  let availableBranchesError = $state<string | null>(null);
  let baseBranches = $state<AvailableBranch[]>([]);
  let baseBranchesLoading = $state(false);
  let baseBranchesError = $state<string | null>(null);
  let lockedBaseBranch = $state<string | null>(null);
  let includeRemoteBranches = $state(false);
  let searchQuery = $state("");
  let worktreeSearchInput = $state<HTMLInputElement | null>(null);
  let showArchivedWorktrees = $state(false);
  // Branch lists are per project: keyed `<project>:<local|remote>` / `<project>`.
  let availableBranchCache: Record<string, AvailableBranch[]> = {};
  let availableBranchRequests: Record<string, Promise<AvailableBranch[]>> = {};
  let baseBranchCache: Record<string, AvailableBranch[]> = {};
  let baseBranchRequests: Record<string, Promise<AvailableBranch[]>> = {};
  let diffDialogLoad: Promise<void> | null = null;

  let assignIssue = $state<LinearIssue | null>(null);
  /** The project is kept from when the details opened, so they create there even if the selection moves. */
  let detailIssue = $state<{ issue: LinearIssue; project: string } | null>(null);

  function getAvailableBranchCacheKey(targetProject: string, includeRemote: boolean): string {
    return `${targetProject}:${includeRemote ? "remote" : "local"}`;
  }

  function fetchAvailableBranchesCached(targetProject: string, includeRemote: boolean): Promise<AvailableBranch[]> {
    const key = getAvailableBranchCacheKey(targetProject, includeRemote);
    const cached = availableBranchCache[key];
    if (cached) return Promise.resolve(cached);

    const inFlight = availableBranchRequests[key];
    if (inFlight) return inFlight;

    const request = projectApi(targetProject).fetchAvailableBranches({ query: { includeRemote } })
      .then((data) => {
        availableBranchCache[key] = data.branches;
        return data.branches;
      })
      .finally(() => {
        delete availableBranchRequests[key];
      });

    availableBranchRequests[key] = request;
    return request;
  }

  function fetchBaseBranchesCached(targetProject: string): Promise<AvailableBranch[]> {
    const cached = baseBranchCache[targetProject];
    if (cached) return Promise.resolve(cached);
    const inFlight = baseBranchRequests[targetProject];
    if (inFlight) return inFlight;

    const request = projectApi(targetProject).fetchBaseBranches()
      .then((data) => {
        baseBranchCache[targetProject] = data.branches;
        return data.branches;
      })
      .finally(() => {
        delete baseBranchRequests[targetProject];
      });

    baseBranchRequests[targetProject] = request;
    return request;
  }

  function invalidateBranchCaches(): void {
    availableBranchCache = {};
    availableBranchRequests = {};
    baseBranchCache = {};
    baseBranchRequests = {};
    availableBranches = [];
    availableBranchesError = null;
    availableBranchesLoading = false;
    baseBranches = [];
    baseBranchesError = null;
    baseBranchesLoading = false;
  }

  function handleNotification(n: AppNotification): void {
    // Only suppress the unread dot when the user is actually looking at this
    // worktree (selected and tab visible); otherwise a finished run should still surface.
    const selected = selection.selected;
    const viewing = selected?.project === n.project && selected.branch === n.branch && !document.hidden;
    notifications.receive(n, viewing);
  }

  function ensureDiffDialogLoaded(): Promise<void> {
    if (DiffDialogComponent) return Promise.resolve();
    if (diffDialogLoad) return diffDialogLoad;

    diffDialogLoad = import("./lib/DiffDialog.svelte")
      .then(({ default: component }) => {
        DiffDialogComponent = component;
      })
      .finally(() => {
        diffDialogLoad = null;
      });

    return diffDialogLoad;
  }

  async function openDiffDialog(): Promise<void> {
    try {
      await ensureDiffDialogLoaded();
      showDiffDialog = true;
    } catch (err: unknown) {
      showToast({
        tone: "error",
        message: "Failed to load changes view.",
        detail: errorMessage(err),
      });
    }
  }

  function handleSelectToast(id: string): void {
    const toast = notifications.findToast(id);
    if (!toast || toast.source !== "notification") return;

    notifications.dismissToast(id);
    selectWorktree(toast.notification);
  }

  setToastController({
    show: showToast,
    info: (message, detail) => showToast({ tone: "info", message, ...(detail ? { detail } : {}) }),
    success: (message, detail) => showToast({ tone: "success", message, ...(detail ? { detail } : {}) }),
    error: (message, detail) => showToast({ tone: "error", message, ...(detail ? { detail } : {}) }),
  });

  // Sidebar resize
  const SIDEBAR_KEYBOARD_STEP = 10;
  let sidebarWidth = $state(loadSavedSidebarWidth());
  let isResizingSidebar = $state(false);

  function handleResizeStart(e: PointerEvent) {
    e.preventDefault();
    isResizingSidebar = true;
    const startX = e.clientX;
    const startWidth = sidebarWidth;

    function onPointerMove(ev: PointerEvent) {
      sidebarWidth = clampSidebarWidth(startWidth + ev.clientX - startX);
    }

    function onPointerUp() {
      isResizingSidebar = false;
      saveSidebarWidth(sidebarWidth);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  function handleResizeKeydown(e: KeyboardEvent) {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const delta = e.key === "ArrowRight" ? SIDEBAR_KEYBOARD_STEP : -SIDEBAR_KEYBOARD_STEP;
      sidebarWidth = clampSidebarWidth(sidebarWidth + delta);
      saveSidebarWidth(sidebarWidth);
    }
  }

  // Mobile state
  let isMobile = $state(false);
  let sidebarOpen = $state(false);
  let activePane = $state(0);
  let terminalRef:
    | {
        sendSelectPane: (pane: number) => void;
      }
    | undefined = $state();

  let trimmedWorktreeSearch = $derived(searchQuery.trim());
  let railItems = $derived(buildProjectRail(store.projects, notifications.unreadWorktrees));
  let activeProjectName = $derived(store.nameOf(activeProject) ?? activeProject);
  let listRows = $derived(
    buildProjectListRows(store.worktreesOf(activeProject), { query: trimmedWorktreeSearch, favorites: favoriteKeys }),
  );
  /** The current project's rows on screen, top to bottom: the order
   *  Cmd+Up/Down and the neighbor picked on remove follow. */
  let visibleWorktrees = $derived(
    [...listRows.active, ...(showArchivedWorktrees ? listRows.archived : [])].map((row) => row.worktree),
  );
  let visibleKeys = $derived(visibleWorktrees.map(worktreeKey));
  let navigableKeys = $derived(visibleKeys.filter((key) => !store.removing.keys.has(key)));
  let selectableWorktrees = $derived(visibleWorktrees.filter((w) => !store.removing.has(w)));
  let selectedWorktree = $derived(
    selection.selected && !store.removing.has(selection.selected) ? store.find(selection.selected) : undefined,
  );
  let selectedVisibleWorktree = $derived(
    selectedWorktree && visibleWorktrees.some((w) => w.branch === selectedWorktree.branch) ? selectedWorktree : undefined,
  );
  let labelWorktree = $derived(labelRef ? store.find(labelRef) : undefined);
  let profileWorktree = $derived(profileRef ? store.find(profileRef) : undefined);
  let canConnect = $derived(!!selectedBranch && selectedWorktree?.mux === "✓" && !selectedWorktree?.creating);
  let showWebChat = $derived(useWebChatUi && canConnect && worktreeSupportsChat(selectedWorktree));
  // Tabs are only meaningful for the built-in terminal agents that have a forkable session.
  let showTabBar = $derived(canConnect && !showWebChat && worktreeSupportsTabs(selectedWorktree));
  let isSelectedOpening = $derived(selectedBranch ? store.opening.has(refOf(selectedBranch)) : false);
  let isSelectedArchiving = $derived(selectedBranch ? store.archiving.has(refOf(selectedBranch)) : false);
  let isSelectedAgentTerminalRefreshing = $derived(
    selectedBranch ? store.refreshingAgentTerminal.has(refOf(selectedBranch)) : false,
  );
  let selectedTerminalKey = $derived(selectedBranch ? actions.terminalKey(refOf(selectedBranch)) : "");
  let pollIntervalMs = $derived(
    pendingCreateCount > 0 || store.hasCreating ? ACTIVE_CREATE_POLL_INTERVAL_MS : DEFAULT_POLL_INTERVAL_MS,
  );
  let showLinearPanel = $derived(linearAvailability !== "disabled");
  let linearCollapsed = $state(true);

  $effect(() => {
    const nextSelectedBranch = resolveSelectedBranch(
      selectedBranch,
      trimmedWorktreeSearch ? selectedWorktree : selectedVisibleWorktree,
      selectableWorktrees,
      hasLoadedWorktrees,
    );
    if (nextSelectedBranch !== selectedBranch) {
      selection.selectBranch(nextSelectedBranch);
    }
  });

  $effect(() => {
    const present = new Set(store.projects.flatMap((entry) => entry.worktrees.map(worktreeKey)));
    actions.pruneTerminalRevisions(present);
  });

  $effect(() => {
    if (pendingCreateCount === 0 || latestAutoSelectCreateId === -1 || !pendingCreate) return;
    const { project: createProject, branchHint } = pendingCreate;
    const candidates = store.worktreesOf(createProject);
    const creating = candidates.filter((w) => w.creating);
    const target = branchHint
      ? candidates.find((w) => w.branch === branchHint)
      : creating.length === 1
        ? creating[0]
        : undefined;
    if (!target) return;
    selectWorktree(target);
  });

  $effect(() => {
    store.setPollInterval(pollIntervalMs);
  });

  $effect(() => {
    selection.persist(selectedWorktree, hasLoadedWorktrees, selectableWorktrees.length > 0);
  });

  $effect(() => {
    // Entering a project reloads its config; the cached one shows meanwhile.
    configs.invalidate(activeProject);
    configs.ensure(activeProject);
  });

  $effect(() => {
    if (profileRef) configs.ensure(profileRef.project);
  });

  $effect(() => {
    if (showCreateDialog) configs.ensure(createProject);
  });

  $effect(() => {
    linear.ensure(activeProject);
  });

  $effect(() => {
    if (!showCreateDialog) return;

    const targetProject = createProject;
    const cached = availableBranchCache[getAvailableBranchCacheKey(targetProject, includeRemoteBranches)];
    if (cached) {
      availableBranches = cached;
      availableBranchesLoading = false;
      availableBranchesError = null;
      return;
    }

    const fetchId = ++nextAvailableBranchFetchId;
    availableBranchesLoading = true;
    availableBranchesError = null;

    fetchAvailableBranchesCached(targetProject, includeRemoteBranches)
      .then((branches) => {
        if (fetchId !== nextAvailableBranchFetchId) return;
        availableBranches = branches;
      })
      .catch((err: unknown) => {
        if (fetchId !== nextAvailableBranchFetchId) return;
        availableBranchesError = errorMessage(err);
      })
      .finally(() => {
        if (fetchId !== nextAvailableBranchFetchId) return;
        availableBranchesLoading = false;
      });
  });

  $effect(() => {
    if (!showCreateDialog) return;

    const targetProject = createProject;
    const cached = baseBranchCache[targetProject];
    if (cached) {
      baseBranches = cached;
      baseBranchesLoading = false;
      baseBranchesError = null;
      return;
    }

    const fetchId = ++nextBaseBranchFetchId;
    baseBranches = [];
    baseBranchesLoading = true;
    baseBranchesError = null;

    fetchBaseBranchesCached(targetProject)
      .then((branches) => {
        if (fetchId !== nextBaseBranchFetchId) return;
        baseBranches = branches;
      })
      .catch((err: unknown) => {
        if (fetchId !== nextBaseBranchFetchId) return;
        baseBranchesError = errorMessage(err);
      })
      .finally(() => {
        if (fetchId !== nextBaseBranchFetchId) return;
        baseBranchesLoading = false;
      });
  });

  $effect(() => {
    document.title = config.name ? `${config.name} - Dashboard` : "Dev Dashboard";
  });

  let paneBarPanes = $derived.by(() => {
    const count = selectedWorktree?.paneCount ?? 0;
    if (count < 2) return [];
    return Array.from({ length: count }, (_, i) => ({
      index: i,
      label: String(i + 1),
    }));
  });
  let showPaneBar = $derived(isMobile && canConnect && !showWebChat && paneBarPanes.length > 0);

  function openCreateDialog(targetProject: string, issue: LinearIssue | null = null): void {
    // The dialog waits on the config: retry a failed load now, not after the throttle.
    if (!configs.get(targetProject)) configs.invalidate(targetProject);
    createProject = targetProject;
    includeRemoteBranches = false;
    assignIssue = issue;
    lockedBaseBranch = null;
    showCreateDialog = true;
  }

  function openSubworktreeDialog(parent: WorktreeRef): void {
    openCreateDialog(parent.project);
    lockedBaseBranch = parent.branch;
  }

  function closeCreateDialog(): void {
    showCreateDialog = false;
    assignIssue = null;
    lockedBaseBranch = null;
  }

  /** The issue comes from the Linear panel, so it is created in its project. */
  function handleAssignIssue(issue: LinearIssue): void {
    openCreateDialog(activeProject, issue);
  }

  function handleAssignDetailIssue(issue: LinearIssue): void {
    if (!detailIssue) return;
    const targetProject = detailIssue.project;
    detailIssue = null;
    openCreateDialog(targetProject, issue);
  }

  async function handleCreate(request: CreateWorktreeRequest) {
    const targetProject = createProject;
    const requestId = nextCreateRequestId++;
    const shouldAutoSelectCreatedWorktree = selectedWorktree == null;
    const requestedAgentIds = request.agents && request.agents.length > 0
      ? request.agents
      : request.agent
        ? [request.agent]
        : [createConfig.defaultAgentId];
    const expectedCreatedCount = requestedAgentIds.length;
    if (shouldAutoSelectCreatedWorktree) {
      latestAutoSelectCreateId = requestId;
    }
    pendingCreateCount += expectedCreatedCount;
    if (shouldAutoSelectCreatedWorktree) {
      pendingCreate = {
        project: targetProject,
        branchHint: expectedCreatedCount > 1 ? null : request.branch ?? null,
      };
    }
    // When the dialog was opened from a LinearPanel click, route the create
    // through the `fromLinear` seed so the backend injects the issue header
    // and any prior webmux attachment as context.
    const finalRequest: CreateWorktreeRequest = assignIssue
      ? { ...request, fromLinear: { issueId: assignIssue.identifier } }
      : request;
    showCreateDialog = false;
    assignIssue = null;
    lockedBaseBranch = null;

    try {
      const createPromise = projectApi(targetProject).createWorktree({ body: finalRequest });
      void store.refresh();
      const result = await createPromise;
      if (shouldAutoSelectCreatedWorktree && requestId === latestAutoSelectCreateId) {
        pendingCreate = { project: targetProject, branchHint: result.primaryBranch };
      }
      invalidateBranchCaches();
      await store.refresh();
      if (request.createLinearTicket) {
        linear.invalidate(targetProject);
        linear.ensure(targetProject);
      }
      if (shouldAutoSelectCreatedWorktree && requestId === latestAutoSelectCreateId) {
        selectWorktree({ project: targetProject, branch: result.primaryBranch });
      }
    } catch (err) {
      showToast({ tone: "error", message: `Failed to create: ${errorMessage(err)}` });
    } finally {
      pendingCreateCount = Math.max(0, pendingCreateCount - expectedCreatedCount);
      if (shouldAutoSelectCreatedWorktree && requestId === latestAutoSelectCreateId) {
        pendingCreate = null;
        latestAutoSelectCreateId = -1;
      }
    }
  }

  /** The user moved elsewhere: a create in flight no longer steals the selection. */
  function cancelCreateAutoSelect(): void {
    pendingCreate = null;
    latestAutoSelectCreateId = -1;
  }

  function selectNeighborOf(ref: WorktreeRef): void {
    if (!sameWorktree(ref, selection.selected)) return;
    const neighbor = neighborBranch(visibleKeys, worktreeKey(ref), store.removing.keys);
    selection.select(neighbor ? parseWorktreeKey(neighbor) : null);
  }

  function revealWorktreeInFilters(ref: WorktreeRef): void {
    const worktree = store.find(ref);
    if (!worktree) return;
    if (worktree.archived) {
      showArchivedWorktrees = true;
    }
    if (trimmedWorktreeSearch && !matchesWorktreeSearch(worktree, trimmedWorktreeSearch)) {
      searchQuery = "";
    }
  }

  function toggleFavoriteWorktree(ref: WorktreeRef): void {
    const key = worktreeKey(ref);
    const next = new Set(favoriteKeys);
    if (!next.delete(key)) next.add(key);
    favoriteKeys = next;
    saveFavoriteWorktreeKeys(next);
  }

  /** Show a project's list (rail, Cmd+Shift+Up/Down) and reselect its last
   *  selected worktree, without remounting anything. */
  function switchToProject(prefix: string): void {
    if (pendingCreate && pendingCreate.project !== prefix) cancelCreateAutoSelect();
    selection.switchProject(prefix);
  }

  /** Select a worktree of any project (sidebar row, toast, bell): its project
   *  becomes current, without remounting anything. */
  function selectWorktree(ref: WorktreeRef): void {
    const target = { project: ref.project, branch: ref.branch };
    if (pendingCreate && pendingCreate.project !== target.project) cancelCreateAutoSelect();
    revealWorktreeInFilters(target);
    selection.select(target);
    notifications.markRead(target);
    if (isMobile) sidebarOpen = false;
  }

  function handleProjectAdded(): void {
    showAddProjectDialog = false;
    void store.refresh();
  }

  function handleProjectRemoved(prefix: string, remaining: ProjectSummary[]): void {
    const next = remaining[0]?.prefix;
    if (!next) {
      onNoProjects();
      return;
    }
    if (pendingCreate?.project === prefix) cancelCreateAutoSelect();
    // The selection can't stay on a removed project.
    if (activeProject === prefix) selection.switchProject(next);
    store.drop(prefix);
    configs.delete(prefix);
    linear.delete(prefix);
    void store.refresh();
  }

  async function handleRemove(): Promise<void> {
    const ref = removeRef;
    if (!ref) return;
    removeRef = null;
    await actions.remove(ref);
  }

  function openLabelDialog(ref: WorktreeRef): void {
    labelRef = { project: ref.project, branch: ref.branch };
    labelError = "";
  }

  async function handleLabelChange(label: string | null): Promise<void> {
    const ref = labelRef;
    if (!ref) return;

    labelLoading = true;
    labelError = "";
    try {
      await actions.setLabel(ref, label);
      labelRef = null;
    } catch (err) {
      labelError = errorMessage(err);
    } finally {
      labelLoading = false;
    }
  }

  function openProfileDialog(ref: WorktreeRef): void {
    profileRef = ref;
    profileError = "";
  }

  async function handleProfileChange(profile: string): Promise<void> {
    const ref = profileRef;
    if (!ref) return;

    profileLoading = true;
    profileError = "";
    try {
      await actions.setProfile(ref, profile);
      profileRef = null;
    } catch (err) {
      profileError = errorMessage(err);
    } finally {
      profileLoading = false;
    }
  }

  function openSelectedWorktree(): void {
    if (selectedBranch) void actions.open(refOf(selectedBranch));
  }

  function handlePostToLinear(ref: WorktreeRef): void {
    if (store.postingLinear.has(ref)) return;
    const worktree = store.find(ref);
    if (!worktree?.linearIssue) {
      // No linked issue → fall back to the create-new-issue dialog.
      postToLinearRef = ref;
      return;
    }
    // Linked worktree → confirm before posting; the endpoint is non-idempotent
    // and each call creates a fresh attachment + comment on the issue. Snapshot
    // the issue id now so a worktree refresh between click and confirm can't
    // render the dialog against missing state.
    postToLinkedConfirm = { ref, issueId: worktree.linearIssue.identifier };
  }

  function confirmPostToLinkedIssue(): void {
    const snapshot = postToLinkedConfirm;
    if (!snapshot) return;
    postToLinkedConfirm = null;
    void actions.postToLinkedIssue(snapshot.ref, snapshot.issueId);
  }

  function handleKeydown(e: KeyboardEvent) {
    // Ignore shortcuts when a dialog is open (let dialog handle its own keys)
    if (
      createDialogOpen || removeRef || pull.target || removal.target || showAddProjectDialog || postToLinkedConfirm
      || detailIssue || showSettingsDialog
    ) return;

    const mod = e.metaKey || e.ctrlKey;
    if (!mod) return;

    if ((e.key === "ArrowUp" || e.key === "ArrowDown") && e.shiftKey) {
      e.preventDefault();
      const prefixes = railItems.map((item) => item.prefix);
      const next = stepBranch(prefixes, activeProject, e.key === "ArrowUp" ? -1 : 1);
      if (next && next !== activeProject) switchToProject(next);
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const current = selection.selected ? worktreeKey(selection.selected) : null;
      const next = stepBranch(navigableKeys, current, e.key === "ArrowUp" ? -1 : 1);
      if (next !== current) selection.select(next ? parseWorktreeKey(next) : null);
    } else if (e.key === "k" || e.key === "K") {
      e.preventDefault();
      openCreateDialog(activeProject);
    } else if (e.key === "d" || e.key === "D") {
      e.preventDefault();
      if (selectedBranch) removeRef = refOf(selectedBranch);
    } else if (e.key === "Enter") {
      if (selectedWorktree && selectedWorktree.mux !== "✓" && !selectedWorktree.creating && !isSelectedOpening) {
        e.preventDefault();
        openSelectedWorktree();
      }
    }
  }

  function handlePaneSelect(pane: number) {
    activePane = pane;
    terminalRef?.sendSelectPane(pane);
  }

  /** The app writes the hash with `replaceState`, which fires no
   *  `hashchange`, so this only sees the user's edits and same-tab links. */
  function handleHashChange(): void {
    const target = resolveHashTarget(
      readLocationHash(),
      (prefix) => store.projects.some((entry) => entry.prefix === prefix),
      (ref) => store.find(ref) !== undefined,
    );
    if (target?.kind === "worktree") selectWorktree(target.ref);
    else if (target?.kind === "project") selection.switchProject(target.project);
    // An unknown target keeps the selection; the hash goes back to naming it.
    writeLocationHash(selection.project, selection.branch);
  }

  onMount(() => {
    applyTheme(currentTheme);
    const stopPolling = store.startPolling();
    window.addEventListener("keydown", handleKeydown);
    window.addEventListener("hashchange", handleHashChange);
    const unsubNotifications = subscribeNotifications(
      handleNotification,
      (dismissal) => notifications.removeDismissed(dismissal),
      (n) => notifications.receiveInitial(n),
    );
    // Request notification permission (no-op if already granted/denied)
    if (Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }

    const mq = window.matchMedia("(max-width: 768px)");
    isMobile = mq.matches;
    if (isMobile) sidebarOpen = true;
    function onMqChange(e: MediaQueryListEvent): void {
      isMobile = e.matches;
    }
    mq.addEventListener("change", onMqChange);

    return () => {
      stopPolling();
      window.removeEventListener("keydown", handleKeydown);
      window.removeEventListener("hashchange", handleHashChange);
      mq.removeEventListener("change", onMqChange);
      unsubNotifications();
    };
  });
</script>

<div class="flex h-dvh bg-surface text-primary {isResizingSidebar ? 'select-none' : ''}" style={isResizingSidebar ? 'cursor: col-resize' : ''}>
  <!-- Sidebar: fixed overlay on mobile, static on desktop -->
  {#if !isMobile || sidebarOpen}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    {#if isMobile}
      <div
        class="fixed inset-0 bg-black/50 z-40"
        onclick={() => (sidebarOpen = false)}
        onkeydown={(e) => {
          if (e.key === "Escape") sidebarOpen = false;
        }}
      ></div>
    {/if}
    <aside
      class="{isMobile
        ? 'fixed inset-0 z-50 w-full'
        : ''} bg-sidebar border-r border-edge flex overflow-hidden shrink-0"
      style={isMobile ? '' : `width: ${sidebarWidth}px`}
    >
      <ProjectRail
        items={railItems}
        current={activeProject}
        showShortcuts={!isMobile}
        onselect={switchToProject}
        onaddproject={() => (showAddProjectDialog = true)}
        onsettings={() => (showSettingsDialog = true)}
      />
      <div class="flex min-w-0 flex-1 flex-col">
        <div class="flex flex-col gap-2 px-2.5 pt-3 pb-2">
          <div class="flex items-center gap-1">
            <h1 class="min-w-0 flex-1 truncate text-sm font-semibold" title={activeProjectName}>{activeProjectName}</h1>
            <ProjectActionsMenu
              name={activeProjectName}
              repos={projectRepos(configs.get(activeProject), sshHost)}
              onopen={() => configs.ensure(activeProject)}
              oncreate={() => openCreateDialog(activeProject)}
              onpull={(repo) => pull.start({ project: activeProject, repo })}
              onremove={() => removal.start({ prefix: activeProject, name: activeProjectName })}
            />
            {#if isMobile}
              <button
                type="button"
                class="h-6 w-6 shrink-0 rounded flex items-center justify-center text-muted hover:text-primary hover:bg-hover cursor-pointer"
                onclick={() => (sidebarOpen = false)}
                title="Close sidebar"
                aria-label="Close sidebar">&times;</button
              >
            {/if}
          </div>
          <div class="relative">
            <svg
              class="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-muted"
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              aria-hidden="true"><circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" /></svg
            >
            <input
              type="search"
              bind:this={worktreeSearchInput}
              bind:value={searchQuery}
              class="w-full h-7 rounded-md border border-edge bg-surface pl-7 pr-6 text-xs text-primary placeholder:text-muted focus:outline-none focus:border-accent"
              placeholder="Search worktrees"
              aria-label="Search worktrees"
            />
            {#if trimmedWorktreeSearch}
              <button
                type="button"
                class="absolute top-1/2 right-1 -translate-y-1/2 h-4 w-4 flex items-center justify-center rounded text-muted hover:text-primary"
                onclick={() => {
                  searchQuery = "";
                  worktreeSearchInput?.focus();
                }}
                aria-label="Clear worktree search"
              >&times;</button>
            {/if}
          </div>
        </div>
        <WorktreeList
          rows={listRows}
          showArchived={showArchivedWorktrees}
          query={trimmedWorktreeSearch}
          error={store.errorOf(activeProject)}
          selected={selection.selected}
          removing={store.removing.keys}
          initializing={store.opening.keys}
          archiving={store.archiving.keys}
          postingLinear={store.postingLinear.keys}
          notified={notifications.unreadWorktrees}
          favorites={favoriteKeys}
          {isMobile}
          onselect={selectWorktree}
          ontogglearchived={() => (showArchivedWorktrees = !showArchivedWorktrees)}
          onretry={() => void store.refresh()}
          oncreate={() => openCreateDialog(activeProject)}
          onopen={(ref) => void actions.open(ref)}
          onclose={(ref) => void actions.close(ref)}
          onarchive={(ref) => void actions.toggleArchived(ref)}
          onremove={(ref) => (removeRef = ref)}
          oneditlabel={openLabelDialog}
          oneditprofile={openProfileDialog}
          oncreatesubworktree={openSubworktreeDialog}
          ontogglefavorite={toggleFavoriteWorktree}
          onposttolinear={handlePostToLinear}
        />
        {#if showLinearPanel}
          <LinearPanel
            projectName={activeProjectName}
            issues={linearIssues}
            availability={linearAvailability}
            onassign={handleAssignIssue}
            onselect={(issue) => (detailIssue = { issue, project: activeProject })}
            bind:collapsed={linearCollapsed}
          />
        {/if}
      </div>
    </aside>
    {#if !isMobile}
      <!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (focusable ARIA separator used for keyboard-resizable sidebar) -->
      <div
        class="w-1 shrink-0 cursor-col-resize hover:bg-accent/50 transition-colors"
        class:bg-accent={isResizingSidebar}
        onpointerdown={handleResizeStart}
        onkeydown={handleResizeKeydown}
        role="separator"
        aria-label="Resize sidebar"
        aria-orientation="vertical"
        aria-valuenow={sidebarWidth}
        aria-valuemin={MIN_SIDEBAR_WIDTH}
        aria-valuemax={MAX_SIDEBAR_WIDTH}
        tabindex="0"
      ></div>
    {/if}
  {/if}

  <main class="flex-1 min-w-0 flex flex-col overflow-hidden">
    <MigrationBanner />
    <TopBar
      name={selectedWorktree?.branch ?? null}
      worktree={selectedWorktree}
      {sshHost}
      ide={config.ide}
      linkedRepos={config.linkedRepos ?? []}
      {isMobile}
      notificationHistory={notifications.history}
      unreadCount={notifications.unreadCount}
      ontogglesidebar={() => (sidebarOpen = !sidebarOpen)}
      onclose={() => {
        if (selectedBranch) void actions.close(refOf(selectedBranch));
      }}
      onarchive={() => {
        if (selectedBranch) void actions.toggleArchived(refOf(selectedBranch));
      }}
      onremove={() => {
        if (selectedBranch) removeRef = refOf(selectedBranch);
      }}
      oneditlabel={() => {
        if (selectedWorktree) openLabelDialog(selectedWorktree);
      }}
      onsettings={() => (showSettingsDialog = true)}
      ondirtyclick={openDiffDialog}
      onCiClick={(pr) => (ciDetailsPr = pr)}
      onReviewsClick={(pr) => (commentReviewPr = pr)}
      onbellopen={() => notifications.markAllSeen()}
      onnotificationselect={selectWorktree}
      archiving={isSelectedArchiving}
    />

    {#if showWebChat}
      {#key selectedTerminalKey}
        <MobileChatSurface
          project={activeProject}
          worktree={selectedWorktree!}
          onConversationMessageSent={() => void store.refresh()}
        />
      {/key}
    {:else if canConnect}
      {#if showTabBar && selectedWorktree}
        <TabBar
          tabs={selectedWorktree.tabs}
          activeTabId={selectedWorktree.activeTabId}
          busy={actions.tabBusy}
          oncreate={() => {
            if (selectedBranch) void actions.createTab(refOf(selectedBranch));
          }}
          onselect={(tabId) => {
            if (selectedBranch) void actions.selectTab(refOf(selectedBranch), tabId);
          }}
          ondelete={(tabId) => {
            if (selectedBranch) void actions.deleteTab(refOf(selectedBranch), tabId);
          }}
        />
      {/if}
      {#key selectedTerminalKey}
        <Terminal
          project={activeProject}
          worktree={selectedBranch!}
          {isMobile}
          initialPane={isMobile ? activePane : undefined}
          {terminalTheme}
          agentTerminalStale={selectedWorktree?.agentTerminalStale ?? false}
          refreshingAgentTerminal={isSelectedAgentTerminalRefreshing}
          onrefreshagentterminal={() => {
            if (selectedBranch) void actions.refreshAgentTerminal(refOf(selectedBranch));
          }}
          bind:this={terminalRef}
        />
      {/key}
    {:else if selectedWorktree?.creating}
      <div class="flex-1 flex items-center justify-center px-6">
        <div class="flex flex-col items-center gap-3 text-center">
          <span class="spinner" style="width: 24px; height: 24px; border-width: 2px;"></span>
          <div>
            <p class="text-sm text-primary font-medium">{selectedWorktree.label ?? selectedWorktree.branch}</p>
            {#if selectedWorktree.label}
              <p class="text-[10px] text-muted">{selectedWorktree.branch}</p>
            {/if}
          </div>
          <p class="text-xs text-muted">{worktreeCreationPhaseLabel(selectedWorktree.creationPhase)}</p>
        </div>
      </div>
    {:else if selectedWorktree}
      <div class="flex-1 flex items-center justify-center px-6">
        <div class="flex flex-col items-center gap-4 text-center">
          <div>
            <p class="text-sm text-primary font-medium">{selectedWorktree.label ?? selectedWorktree.branch}</p>
            {#if selectedWorktree.label}
              <p class="text-[10px] text-muted">{selectedWorktree.branch}</p>
            {/if}
          </div>
          <div class="flex flex-col items-center gap-1">
            {#if selectedWorktree.profile}
              <span class="text-xs text-muted">Profile: {selectedWorktree.profile}</span>
            {/if}
            {#if selectedWorktree.agentLabel ?? selectedWorktree.agentName}
              <span class="text-xs text-muted">Agent: {selectedWorktree.agentLabel ?? selectedWorktree.agentName}</span>
            {/if}
            {#if selectedWorktree.agentName && !worktreeSupportsChat(selectedWorktree)}
              <span class="text-xs text-muted">This agent runs in the terminal only.</span>
            {/if}
          </div>
          <button
            class="mt-2 px-5 py-2 rounded-md bg-accent text-white text-sm font-medium cursor-pointer border-none hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            onclick={openSelectedWorktree}
            disabled={isSelectedOpening}
          >
            {#if isSelectedOpening}
              <span class="spinner" style="width: 14px; height: 14px; border-width: 1.5px;"></span>
              Opening...
            {:else}
              Open Session
            {/if}
          </button>
        </div>
      </div>
    {:else}
      <div class="flex-1 flex flex-col items-center justify-center gap-3 text-muted text-sm">
        {#if hasLoadedWorktrees && store.worktreesOf(activeProject).length === 0 && store.errorOf(activeProject) === null}
          <p>No worktrees in {activeProjectName} yet</p>
          <Btn variant="accent-outline" onclick={() => openCreateDialog(activeProject)}>New worktree</Btn>
        {:else}
          <p>Select a worktree from the sidebar to connect</p>
        {/if}
      </div>
    {/if}

    {#if showPaneBar}
      <PaneBar {activePane} panes={paneBarPanes} onselect={handlePaneSelect} />
    {/if}
  </main>
</div>

{#if createDialogOpen}
  <CreateWorktreeDialog
    profiles={createConfig.profiles}
    agents={createConfig.agents}
    defaultProfileName={createConfig.defaultProfileName}
    defaultAgentId={createConfig.defaultAgentId}
    autoNameEnabled={createConfig.autoName}
    initialBranch={assignIssue?.branchName ?? ""}
    initialPrompt={assignIssue ? `${assignIssue.title}${assignIssue.description ? '\n\n' + assignIssue.description : ''}` : ""}
    bind:includeRemoteBranches
    {availableBranches}
    {availableBranchesLoading}
    {availableBranchesError}
    {baseBranches}
    {baseBranchesLoading}
    {baseBranchesError}
    {lockedBaseBranch}
    startupEnvs={createConfig.startupEnvs ?? {}}
    linearCreateTicketOption={createConfig.linearCreateTicketOption}
    openedFromLinearIssue={assignIssue !== null}
    oncreate={handleCreate}
    oncancel={closeCreateDialog}
  />
{/if}

{#if labelRef && labelWorktree}
  <WorktreeLabelDialog
    branch={labelWorktree.branch}
    initialLabel={labelWorktree.label}
    loading={labelLoading}
    error={labelError}
    onconfirm={(label) => { void handleLabelChange(label); }}
    onclear={() => { void handleLabelChange(null); }}
    oncancel={() => {
      labelRef = null;
      labelError = "";
    }}
  />
{/if}

{#if profileRef && profileWorktree}
  <WorktreeProfileDialog
    branch={profileWorktree.branch}
    profiles={profileConfig.profiles}
    currentProfile={profileWorktree.profile}
    isOpen={profileWorktree.mux === "✓"}
    loading={profileLoading}
    error={profileError}
    onconfirm={(profile) => { void handleProfileChange(profile); }}
    oncancel={() => {
      profileRef = null;
      profileError = "";
    }}
  />
{/if}

{#if removeRef}
  <ConfirmDialog
    message={`Remove worktree "${removeRef.branch}" from ${store.nameOf(removeRef.project) ?? removeRef.project}? This action cannot be undone.`}
    onconfirm={handleRemove}
    oncancel={() => (removeRef = null)}
  />
{/if}

{#if pull.target}
  {@const label = pull.target.repo.label}
  <ConfirmDialog
    message={pull.force
      ? `Force pull "${label}"? This will discard any local commits on it.`
      : `Pull latest "${label}" from remote?`}
    confirmLabel={pull.force ? "Force Pull" : "Pull"}
    variant={pull.force ? "danger" : "accent"}
    loading={pull.loading}
    error={pull.error}
    onconfirm={() => void pull.confirm()}
    oncancel={() => pull.cancel()}
  />
{/if}

{#if removal.target}
  <ConfirmDialog
    message={`Remove project "${removal.target.name}" from webmux? Its repo and worktrees stay on disk.`}
    loading={removal.loading}
    error={removal.error}
    onconfirm={() => void removal.confirm()}
    oncancel={() => removal.cancel()}
  />
{/if}

{#if showAddProjectDialog}
  <BaseDialog onclose={() => (showAddProjectDialog = false)}>
    <h2 class="text-base mb-4">Add project</h2>
    <AddProjectForm onadded={handleProjectAdded} />
  </BaseDialog>
{/if}

{#if showSettingsDialog}
  <SettingsDialog
    projects={store.projects}
    {activeProject}
    {configs}
    {currentTheme}
    {useWebChatUi}
    ide={config.ide}
    onthemechange={(key) => (currentTheme = key)}
    onwebchatuichange={(enabled) => {
      useWebChatUi = enabled;
      saveUseWebChatUi(enabled);
    }}
    onsave={(host) => {
      sshHost = host;
      showSettingsDialog = false;
    }}
    onclose={() => (showSettingsDialog = false)}
  />
{/if}

{#if ciDetailsPr}
  <CiDetailsDialog
    project={activeProject}
    pr={ciDetailsPr}
    branch={selectedWorktree?.branch ?? ""}
    onclose={() => (ciDetailsPr = null)}
    onfixsuccess={() => {
      ciDetailsPr = null;
    }}
  />
{/if}

{#if commentReviewPr}
  <CommentReviewDialog
    project={activeProject}
    pr={commentReviewPr}
    branch={selectedWorktree?.branch ?? ""}
    onclose={() => (commentReviewPr = null)}
    onsendsuccess={() => {
      commentReviewPr = null;
    }}
  />
{/if}

{#if showDiffDialog && selectedBranch && DiffDialogComponent}
  <DiffDialogComponent
    project={activeProject}
    branch={selectedBranch}
    ideUrl={makeIdeUrl(selectedWorktree?.dir, sshHost, config.ide)}
    onclose={() => (showDiffDialog = false)}
  />
{/if}

{#if detailIssue}
  <LinearDetailDialog
    issue={detailIssue.issue}
    onassign={handleAssignDetailIssue}
    onclose={() => (detailIssue = null)}
  />
{/if}

{#if postToLinearRef}
  {@const ref = postToLinearRef}
  <LinearPostDialog
    branch={ref.branch}
    onsubmit={async (target) => {
      await actions.postToLinear(ref, target);
    }}
    onclose={() => (postToLinearRef = null)}
  />
{/if}

{#if postToLinkedConfirm}
  <ConfirmDialog
    message={`Post conversation to ${postToLinkedConfirm.issueId}? This creates a new attachment and comment on the issue.`}
    confirmLabel="Post"
    variant="accent"
    onconfirm={confirmPostToLinkedIssue}
    oncancel={() => (postToLinkedConfirm = null)}
  />
{/if}

<ToastStack
  toasts={notifications.toasts}
  ondismiss={(id) => notifications.dismissToast(id)}
  onselect={handleSelectToast}
/>
