<script lang="ts">
  import { dismissible } from "./dismissible";
  import MenuItem from "./MenuItem.svelte";
  import IconBtn from "./IconBtn.svelte";
  import { ideLabelForUrl } from "./utils";
  import type { ProjectRepo } from "./types";

  let {
    name,
    repos,
    showShortcuts,
    onopen,
    oncreate,
    onpull,
    onremove,
  }: {
    name: string;
    /** The project's own repo first, then its linked repos. */
    repos: ProjectRepo[];
    /** Mention the keyboard shortcut (desktop). */
    showShortcuts: boolean;
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

<span class="relative flex shrink-0 items-center">
  <IconBtn icon="plus" label="New worktree in {name}" title={showShortcuts ? "New worktree (Cmd+K)" : undefined} onclick={oncreate} />
  <span class="contents" {@attach open && dismissible(() => (open = false))}>
    <IconBtn icon="more" label="Actions for {name}" title="Project actions" aria-expanded={open} onclick={toggle} />
    {#if open}
      <div
        class="absolute top-7 right-1 z-20 min-w-40 rounded-md border border-edge bg-surface shadow-lg p-1 font-normal"
        data-popup-menu
      >
        {#each repos.filter((repo) => repo.repo !== null) as repo (repo.repo)}
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
