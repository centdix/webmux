export interface ProjectCacheOptions {
  /** A project is loaded again once its last attempt is older than this. */
  maxAgeMs: number;
  onError?: (project: string, err: unknown) => void;
}

/** Per-project data (config, Linear issues…) loaded on demand and kept, so
 *  moving between projects shows what was already fetched. */
export class ProjectCache<T> {
  #values = $state.raw<Record<string, T>>({});
  readonly #attemptedAt = new Map<string, number>();
  readonly #load: (project: string) => Promise<T>;
  readonly #options: ProjectCacheOptions;

  constructor(load: (project: string) => Promise<T>, options: ProjectCacheOptions) {
    this.#load = load;
    this.#options = options;
  }

  get(project: string): T | undefined {
    return this.#values[project];
  }

  /** Load `project` unless it was attempted within `maxAgeMs`; a failed
   *  attempt also counts, so errors don't turn into a request loop. */
  ensure(project: string): void {
    const attemptedAt = this.#attemptedAt.get(project);
    const now = Date.now();
    if (attemptedAt !== undefined && now - attemptedAt < this.#options.maxAgeMs) return;
    this.#attemptedAt.set(project, now);
    this.#load(project)
      .then((value) => this.#set(project, value))
      .catch((err: unknown) => this.#options.onError?.(project, err));
  }

  /** Make the next `ensure` load again. */
  invalidate(project: string): void {
    this.#attemptedAt.delete(project);
  }

  update(project: string, change: (value: T) => T): void {
    const value = this.#values[project];
    if (value !== undefined) this.#set(project, change(value));
  }

  #set(project: string, value: T): void {
    this.#values = { ...this.#values, [project]: value };
  }
}
