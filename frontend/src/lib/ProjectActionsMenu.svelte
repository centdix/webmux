<script lang="ts">
  import { dismissible } from "./dismissible";
  import MenuItem from "./MenuItem.svelte";
  import { ideLabelForUrl } from "./utils";
  import type { ProjectRepo } from "./types";

  let {
    name,
    repos,
    onopen,
    oncreate,
    onpull,
    onremove,
  }: {
    name: string;
    /** The project's own repo first, then its linked repos. */
    repos: ProjectRepo[];
    /** The menu opened: a chance to load what its items need. */
    onopen: () => void;
    oncreate: () => void;
    onpull: (repo: ProjectRepo) => void;
    onremove: () => void;
  } = $props();

  let open = $state(false);

  function toggle(): void {
    open = !open;
    if (open) onopen();
  }

  function run(action: () => void): void {
    open = false;
    action();
  }
</script>

<span
  class="relative shrink-0 flex items-center pr-1 {open
    ? ''
    : 'md:opacity-0 md:group-hover/header:opacity-100 md:focus-within:opacity-100'}"
>
  <button
    type="button"
    class="w-6 h-6 rounded flex items-center justify-center text-muted hover:text-primary hover:bg-surface cursor-pointer"
    title="New worktree in {name}"
    aria-label="New worktree in {name}"
    onclick={oncreate}
  >
    <span class="text-base leading-none" aria-hidden="true">+</span>
  </button>
  <span class="contents" {@attach open && dismissible(() => (open = false))}>
    <button
      type="button"
      class="w-6 h-6 rounded flex items-center justify-center text-muted hover:text-primary hover:bg-surface cursor-pointer"
      title="Project actions"
      aria-label="Actions for {name}"
      aria-expanded={open}
      onclick={toggle}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="5" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="12" cy="19" r="1" />
      </svg>
    </button>
    {#if open}
      <div
        class="absolute top-7 right-1 z-20 min-w-40 rounded-md border border-edge bg-surface shadow-lg p-1 font-normal"
        data-popup-menu
      >
        <MenuItem onclick={() => run(oncreate)}>New worktree</MenuItem>
        {#each repos as repo (repo.repo)}
          <MenuItem onclick={() => run(() => onpull(repo))}>Pull {repo.label}</MenuItem>
        {/each}
        {#each repos as repo (repo.repo)}
          {#if repo.ideUrl}
            <MenuItem href={repo.ideUrl} onclick={() => (open = false)}>
              {repo.repo === null ? "Open" : `Open ${repo.repo}`} in {ideLabelForUrl(repo.ideUrl)}
            </MenuItem>
          {/if}
        {/each}
        <div class="my-1 border-t border-edge"></div>
        <MenuItem danger onclick={() => run(onremove)}>Remove project</MenuItem>
      </div>
    {/if}
  </span>
</span>
