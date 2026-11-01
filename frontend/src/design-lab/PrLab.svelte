<script lang="ts">
  import { worktreeKey } from "./lab";
  import { PR_MOCK_FAVORITES, PR_MOCK_NOTIFIED, PR_MOCK_PROJECTS, PR_SCENARIOS } from "./mock-pr";
  import { PR_VARIANTS } from "./pr-variants";

  let { only }: { only: string | null } = $props();

  /** The app's default and minimum sidebar widths (rail included). */
  const WIDTHS = [268, 188];
  const FIRST = worktreeKey({ project: "webmux", branch: "fix-terminal-test-kills-live-tmux" });

  let selected = $state<Record<string, string | null>>(
    Object.fromEntries(PR_VARIANTS.flatMap((v) => WIDTHS.map((w) => [`${v.id}-${w}`, FIRST]))),
  );
  let shown = $derived(PR_VARIANTS.filter((v) => !only || v.id === only));
</script>

<div class="flex flex-col gap-5 p-5">
  <section class="flex max-w-[1180px] flex-wrap gap-x-10 gap-y-3 text-xs">
    <div class="flex max-w-[420px] flex-col gap-1.5">
      <h2 class="text-sm font-semibold">PR status per row</h2>
      <p class="text-muted">
        Each treatment in the shipped D sidebar, at the default (268px) and minimum (188px) width. Hover a PR mark for the full detail, click it to open the PR. Rows are sorted favourites first, like the app.
      </p>
      <p class="text-muted">
        <span class="text-primary">†</span> Review decision (approved / changes requested) and merge conflicts are mocked: <code class="text-primary">pr-service.ts</code> doesn't ask <code class="text-primary">gh pr list</code> for <code class="text-primary">reviewDecision</code> and <code class="text-primary">mergeable</code> yet. Everything else is real data.
      </p>
    </div>
    <dl class="grid grid-cols-[auto_1fr] content-start gap-x-4 gap-y-0.5">
      {#each PR_SCENARIOS as [row, scenario] (row)}
        <dt class="truncate font-mono text-[11px] text-muted">{row}</dt>
        <dd>{scenario}</dd>
      {/each}
    </dl>
  </section>

  <div class="flex flex-wrap items-start gap-x-8 gap-y-8">
    {#each shown as v (v.id)}
      {@const Variant = v.component}
      <section class="flex w-[468px] flex-col gap-3" data-pr-variant={v.id}>
        <div class="flex flex-col gap-1.5 text-xs">
          <h2 class="text-sm font-semibold"><span class="text-accent">{v.id}.</span> {v.name}</h2>
          <dl class="grid grid-cols-[76px_1fr] gap-x-2 gap-y-1">
            <dt class="text-muted">At a glance</dt><dd>{v.glance}</dd>
            <dt class="text-muted">Narrow</dt><dd>{v.narrow}</dd>
            <dt class="text-success">Pros</dt><dd>{v.pros}</dd>
            <dt class="text-danger">Cons</dt><dd>{v.cons}</dd>
          </dl>
        </div>
        <div class="flex items-start gap-3">
          {#each WIDTHS as width (width)}
            <div class="h-[740px] shrink-0 overflow-hidden rounded-lg border border-edge shadow-lg" style="width:{width}px" data-width={width}>
              <Variant projects={PR_MOCK_PROJECTS} notified={PR_MOCK_NOTIFIED} favorites={PR_MOCK_FAVORITES} bind:selected={selected[`${v.id}-${width}`]} />
            </div>
          {/each}
        </div>
      </section>
    {/each}
  </div>
</div>
