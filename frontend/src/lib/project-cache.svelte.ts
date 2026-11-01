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
  /** Latest load per project; an older one resolving later is dropped. */
  readonly #latestLoad = new Map<string, number>();
  #nextLoad = 0;
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
    const token = ++this.#nextLoad;
    this.#latestLoad.set(project, token);
    this.#load(project)
      .then((value) => {
        if (this.#latestLoad.get(project) === token) this.#set(project, value);
      })
      .catch((err: unknown) => this.#options.onError?.(project, err));
  }

  /** Make the next `ensure` load again. */
  invalidate(project: string): void {
    this.#attemptedAt.delete(project);
  }

  /** Load every loaded (or loading) project again, e.g. after a change shared by all of them. */
  reloadLoaded(): void {
    for (const project of new Set([...Object.keys(this.#values), ...this.#latestLoad.keys()])) {
      this.invalidate(project);
      this.ensure(project);
    }
  }

  /** Forget a removed project, dropping any load still in flight. */
  delete(project: string): void {
    this.#attemptedAt.delete(project);
    this.#latestLoad.delete(project);
    const { [project]: _removed, ...rest } = this.#values;
    this.#values = rest;
  }

  /** Change a loaded value; a load still in flight would hold the older one, so it is dropped. */
  update(project: string, change: (value: T) => T): void {
    const value = this.#values[project];
    if (value === undefined) return;
    this.#latestLoad.delete(project);
    this.#set(project, change(value));
  }

  #set(project: string, value: T): void {
    this.#values = { ...this.#values, [project]: value };
  }
}
