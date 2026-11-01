import type { IdeKind, PrEntry, ProjectInitPhase, WorktreeCreationPhase, WorktreeInfo } from "./types";
import { THEME_KEYS, getTheme } from "./themes";
import { worktreeKey } from "./worktree-ref";
import type { ThemeKey } from "./themes";

export const SSH_STORAGE_KEY = "wt-ssh-host";
export const THEME_STORAGE_KEY = "wt-theme";
export const LAST_SELECTED_WORKTREE_STORAGE_KEY = "wt-last-selected-worktree";
export const SIDEBAR_WIDTH_STORAGE_KEY = "wt-sidebar-width";
export const WEB_CHAT_UI_STORAGE_KEY = "wt-use-web-chat-ui";
/** Legacy favorites (`<key>:<project>` or unscoped `<key>` → branches), migrated on load. */
export const FAVORITE_WORKTREES_STORAGE_KEY = "wt-favorite-worktrees";
export const FAVORITE_WORKTREE_KEYS_STORAGE_KEY = "wt-favorite-worktree-keys";
export const LAST_PROJECT_STORAGE_KEY = "wt-last-project";
export const COLLAPSED_PROJECTS_STORAGE_KEY = "wt-collapsed-projects";
const DEFAULT_SIDEBAR_WIDTH = 220;

export function prLabel(pr: Pick<PrEntry, "repo" | "number">): string {
  return pr.repo ? `${pr.repo} #${pr.number}` : `PR #${pr.number}`;
}

export function isDraftPr(pr: Pick<PrEntry, "state" | "isDraft">): boolean {
  return pr.state === "open" && pr.isDraft;
}

export function prStateTextClass(pr: Pick<PrEntry, "state" | "isDraft">): string {
  if (pr.state === "merged") return "text-merged";
  if (pr.state === "closed") return "text-danger";
  if (isDraftPr(pr)) return "text-muted";
  return "text-primary";
}

export function prBadgeClass(pr: Pick<PrEntry, "state" | "isDraft">): string {
  if (pr.state === "merged") return "bg-merged/20 text-merged";
  if (pr.state === "closed") return "bg-danger/20 text-danger";
  if (isDraftPr(pr)) return "bg-muted/20 text-muted";
  if (pr.state === "open") return "bg-success/20 text-success";
  return "bg-muted/20 text-muted";
}

export function ciStatusTextClass(ciStatus: PrEntry["ciStatus"]): string {
  if (ciStatus === "failed") return "text-danger";
  if (ciStatus === "success") return "text-success";
  if (ciStatus === "pending") return "text-warning";
  return "text-muted";
}

export function ciStatusDotClass(ciStatus: PrEntry["ciStatus"]): string {
  if (ciStatus === "failed") return "bg-danger";
  if (ciStatus === "success") return "bg-success";
  if (ciStatus === "pending") return "bg-warning animate-pulse";
  return "bg-muted";
}

export function prStatusShellClass(pr: Pick<PrEntry, "ciChecks" | "ciStatus" | "state">): string {
  if (pr.ciChecks.length > 0) {
    if (pr.ciStatus === "failed") return "border-danger/40 bg-danger/5";
    if (pr.ciStatus === "pending") return "border-warning/40 bg-warning/5";
    if (pr.ciStatus === "success") return "border-success/30 bg-success/5";
  }
  if (pr.state === "merged") return "border-merged/35 bg-merged/8";
  if (pr.state === "closed") return "border-danger/35 bg-danger/5";
  return "border-edge bg-surface";
}

const IDES: Record<IdeKind, { scheme: string; label: string }> = {
  cursor: { scheme: "cursor", label: "Cursor" },
  vscode: { scheme: "vscode", label: "VS Code" },
};

export function ideLabel(ide: IdeKind): string {
  return IDES[ide].label;
}

export function makeIdeUrl(
  dir: string | null | undefined,
  sshHost: string | null,
  ide: IdeKind,
): string | null {
  if (!dir) return null;
  const scheme = IDES[ide].scheme;
  if (sshHost) return `${scheme}://vscode-remote/ssh-remote+${sshHost}${dir}`;
  return `${scheme}://file${dir}`;
}

export function ideLabelForUrl(url: string): string {
  const scheme = url.split(":", 1)[0];
  const entry = Object.values(IDES).find((ide) => ide.scheme === scheme);
  return entry ? entry.label : IDES.cursor.label;
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function searchMatch(needle: string, haystack: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

export function loadSavedTheme(): ThemeKey {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored && (THEME_KEYS as readonly string[]).includes(stored)) return stored as ThemeKey;
  return "github-dark";
}

function projectStorageKey(baseKey: string, projectPrefix: string): string {
  return projectPrefix ? `${baseKey}:${projectPrefix}` : baseKey;
}

function loadStoredString(key: string): string | null {
  const stored = localStorage.getItem(key)?.trim();
  return stored ? stored : null;
}

function saveStoredString(key: string, value: string | null): void {
  if (value) {
    localStorage.setItem(key, value);
    return;
  }
  localStorage.removeItem(key);
}

export function loadLastProject(): string | null {
  return loadStoredString(LAST_PROJECT_STORAGE_KEY);
}

export function saveLastProject(projectPrefix: string | null): void {
  saveStoredString(LAST_PROJECT_STORAGE_KEY, projectPrefix);
}

export function loadSavedSelectedWorktree(projectPrefix: string): string | null {
  const key = projectStorageKey(LAST_SELECTED_WORKTREE_STORAGE_KEY, projectPrefix);
  const saved = loadStoredString(key);
  if (saved || key === LAST_SELECTED_WORKTREE_STORAGE_KEY) return saved;
  // One-time migration of the pre-multi-project unscoped selection.
  const legacy = loadStoredString(LAST_SELECTED_WORKTREE_STORAGE_KEY);
  localStorage.removeItem(LAST_SELECTED_WORKTREE_STORAGE_KEY);
  saveStoredString(key, legacy);
  return legacy;
}

export function saveSelectedWorktree(projectPrefix: string, branch: string | null): void {
  saveStoredString(projectStorageKey(LAST_SELECTED_WORKTREE_STORAGE_KEY, projectPrefix), branch);
}

function parseStringArray(stored: string | null): string[] {
  if (!stored) return [];
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

/** Favorites of every project, as `worktreeKey`s. The first load folds the
 *  per-project branch lists (`wt-favorite-worktrees:<project>`) into it, and
 *  the pre-multi-project unscoped list into `currentProject`. */
export function loadFavoriteWorktreeKeys(currentProject: string): Set<string> {
  const keys = new Set(parseStringArray(localStorage.getItem(FAVORITE_WORKTREE_KEYS_STORAGE_KEY)));
  const legacyPrefix = `${FAVORITE_WORKTREES_STORAGE_KEY}:`;
  const legacyKeys = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
    .filter((key): key is string =>
      key !== null && (key.startsWith(legacyPrefix) || (key === FAVORITE_WORKTREES_STORAGE_KEY && currentProject !== ""))
    );
  if (legacyKeys.length === 0) return keys;
  for (const legacyKey of legacyKeys) {
    const project = legacyKey === FAVORITE_WORKTREES_STORAGE_KEY ? currentProject : legacyKey.slice(legacyPrefix.length);
    for (const branch of parseStringArray(localStorage.getItem(legacyKey))) {
      keys.add(worktreeKey({ project, branch }));
    }
    localStorage.removeItem(legacyKey);
  }
  saveFavoriteWorktreeKeys(keys);
  return keys;
}

function saveStringSet(key: string, values: ReadonlySet<string>): void {
  if (values.size === 0) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify([...values]));
}

export function saveFavoriteWorktreeKeys(keys: ReadonlySet<string>): void {
  saveStringSet(FAVORITE_WORKTREE_KEYS_STORAGE_KEY, keys);
}

/** Prefixes of the projects collapsed in the sidebar. */
export function loadCollapsedProjects(): Set<string> {
  return new Set(parseStringArray(localStorage.getItem(COLLAPSED_PROJECTS_STORAGE_KEY)));
}

export function saveCollapsedProjects(prefixes: ReadonlySet<string>): void {
  saveStringSet(COLLAPSED_PROJECTS_STORAGE_KEY, prefixes);
}

export function applyTheme(key: ThemeKey): void {
  const theme = getTheme(key);
  const root = document.documentElement;
  for (const [name, value] of Object.entries(theme.colors)) {
    root.style.setProperty(`--color-${name}`, value);
  }
  localStorage.setItem(THEME_STORAGE_KEY, key);
}

export function loadSavedSidebarWidth(): number {
  const stored = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
  if (stored) {
    const n = parseInt(stored, 10);
    if (!Number.isNaN(n) && n > 0) return n;
  }
  return DEFAULT_SIDEBAR_WIDTH;
}

export function saveSidebarWidth(width: number): void {
  localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(Math.round(width)));
}

export function loadUseWebChatUi(): boolean {
  return localStorage.getItem(WEB_CHAT_UI_STORAGE_KEY) === "true";
}

export function saveUseWebChatUi(enabled: boolean): void {
  if (enabled) {
    localStorage.setItem(WEB_CHAT_UI_STORAGE_KEY, "true");
    return;
  }

  localStorage.removeItem(WEB_CHAT_UI_STORAGE_KEY);
}

export function worktreeCreationPhaseLabel(phase: WorktreeCreationPhase | null): string {
  switch (phase) {
    case "creating_worktree":
      return "Creating worktree";
    case "preparing_runtime":
      return "Preparing runtime";
    case "running_post_create_hook":
      return "Running post-create hook";
    case "starting_session":
      return "Starting session";
    case "reconciling":
      return "Reconciling";
    default:
      return "Creating";
  }
}

export function projectInitPhaseLabel(phase: ProjectInitPhase | null): string {
  switch (phase) {
    case "creating_config":
      return "Creating .webmux.yaml";
    case "analyzing":
      return "Analyzing project structure";
    case "ready":
      return "Project ready";
    case "failed":
      return "Setup failed";
    default:
      return "Setting up";
  }
}

export function resolveSelectedBranch(
  selectedBranch: string | null,
  selectedWorktree: Pick<WorktreeInfo, "branch"> | undefined,
  selectableWorktrees: Array<Pick<WorktreeInfo, "branch" | "mux">>,
  hasLoadedWorktrees: boolean,
): string | null {
  if (selectedBranch && selectedWorktree) return selectedBranch;
  if (!hasLoadedWorktrees) return selectedBranch;
  if (selectableWorktrees.length === 0) return null;

  const open = selectableWorktrees.find((worktree) => worktree.mux === "✓");
  return (open ?? selectableWorktrees[0]).branch;
}
