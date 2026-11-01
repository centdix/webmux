import { fetchProjects, projectApi, removeProject } from "./api";
import type { ProjectRepo, ProjectSummary, ToastInput } from "./types";
import { errorMessage } from "./utils";

export interface PullTarget {
  project: string;
  repo: ProjectRepo;
}

/** The confirm-then-pull flow of a project's repo (its own or a linked one).
 *  A failed fast-forward offers a force pull on the next confirm. */
export class ProjectPull {
  target = $state<PullTarget | null>(null);
  loading = $state(false);
  error = $state("");
  force = $state(false);
  readonly #toast: (toast: ToastInput) => void;

  constructor(toast: (toast: ToastInput) => void) {
    this.#toast = toast;
  }

  start(target: PullTarget): void {
    this.target = target;
    this.force = false;
    this.error = "";
  }

  cancel(): void {
    this.target = null;
    this.force = false;
  }

  async confirm(): Promise<void> {
    const target = this.target;
    if (!target || this.loading) return;
    const { label, repo } = target.repo;
    this.loading = true;
    this.error = "";
    try {
      const result = await projectApi(target.project).pullMain({
        body: { ...(this.force ? { force: true } : {}), ...(repo ? { repo } : {}) },
      });
      if (result.status === "updated" || result.status === "already_up_to_date") {
        if (this.target === target) this.cancel();
        this.#toast({
          tone: result.status === "updated" ? "success" : "info",
          message: result.status === "updated"
            ? `Pulled latest "${label}" from remote`
            : `"${label}" is already up to date`,
        });
      } else if (this.target !== target) {
        return;
      } else if (result.status === "merge_failed" && !this.force) {
        this.force = true;
        this.error = `Fast-forward failed: ${result.error ?? "unknown error"}.\nForce pull will reset it to match remote.`;
      } else {
        this.error = result.error ?? result.status;
      }
    } catch (err) {
      if (this.target === target) this.error = errorMessage(err);
    } finally {
      this.loading = false;
    }
  }
}

export interface RemovalTarget {
  prefix: string;
  name: string;
}

/** The confirm-then-remove flow of a project. `onRemoved` gets the projects
 *  still registered; a failed removal or reload keeps the dialog open with
 *  the error, so it never reads as "no projects left". */
export class ProjectRemoval {
  target = $state<RemovalTarget | null>(null);
  loading = $state(false);
  error = $state("");
  readonly #onRemoved: (prefix: string, remaining: ProjectSummary[]) => void;

  constructor(onRemoved: (prefix: string, remaining: ProjectSummary[]) => void) {
    this.#onRemoved = onRemoved;
  }

  start(target: RemovalTarget): void {
    this.target = target;
    this.error = "";
  }

  cancel(): void {
    this.target = null;
  }

  async confirm(): Promise<void> {
    const target = this.target;
    if (!target || this.loading) return;
    this.loading = true;
    this.error = "";
    try {
      await removeProject(target.prefix);
      const remaining = await fetchProjects();
      this.target = null;
      this.#onRemoved(target.prefix, remaining);
    } catch (err) {
      this.error = errorMessage(err);
    } finally {
      this.loading = false;
    }
  }
}
