<script lang="ts">
  import { THEMES, getTheme, type ThemeKey } from "../lib/themes";
  import { applyTheme, loadSavedTheme } from "../lib/utils";
  import { MOCK_FAVORITES, MOCK_NOTIFIED, MOCK_PROJECTS } from "./mock";
  import { allWorktrees, worktreeKey } from "./lab";
  import { VARIANTS } from "./variants";
  import FakeMain from "./components/FakeMain.svelte";

  // `?theme=nord&narrow=1&only=b` pins the lab state (screenshots, links).
  const params = new URLSearchParams(location.search);
  let theme = $state<ThemeKey>(getTheme(params.get("theme") ?? loadSavedTheme()).key);
  let narrow = $state(params.get("narrow") === "1");
  let only = $state(params.get("only"));
  let selected = $state<Record<string, string | null>>(
    Object.fromEntries(VARIANTS.map((v) => [v.id, worktreeKey({ project: "webmux", branch: "fix-terminal-test-kills-live-tmux" })])),
  );

  $effect(() => applyTheme(theme));

  let shown = $derived(VARIANTS.filter((v) => !only || v.id === only));
  let byKey = $derived(new Map(allWorktrees(MOCK_PROJECTS).map((wt) => [worktreeKey(wt), wt])));
  let width = $derived(narrow ? 248 : 296);
</script>

<div class="min-h-dvh bg-surface text-primary">
  <header class="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-edge bg-topbar px-5 py-3">
    <h1 class="text-sm font-semibold">Sidebar design lab</h1>
    <span class="text-xs text-muted">Same mock data in every variant. Right-click rows and project names, use ↑/↓ inside a list.</span>
    <div class="ml-auto flex flex-wrap items-center gap-3 text-xs">
      <div class="flex items-center gap-1">
        <button type="button" class="cursor-pointer rounded px-2 py-1 {only === null ? 'bg-active text-primary' : 'text-muted hover:bg-hover'}" onclick={() => (only = null)}>All</button>
        {#each VARIANTS as v (v.id)}
          <button type="button" class="cursor-pointer rounded px-2 py-1 {only === v.id ? 'bg-active text-primary' : 'text-muted hover:bg-hover'}" onclick={() => (only = v.id)}>{v.id.toUpperCase()}</button>
        {/each}
      </div>
      <label class="flex items-center gap-1.5 text-muted">
        Theme
        <select bind:value={theme} class="h-7 rounded-md border border-edge bg-surface px-1.5 text-primary">
          {#each THEMES as t (t.key)}<option value={t.key}>{t.label}</option>{/each}
        </select>
      </label>
      <label class="flex cursor-pointer items-center gap-1.5 text-muted">
        <input type="checkbox" bind:checked={narrow} /> Narrow ({width}px)
      </label>
    </div>
  </header>

  <main class="flex flex-wrap items-start gap-6 p-5">
    {#each shown as v (v.id)}
      {@const Variant = v.component}
      <section class="flex flex-col gap-3" style="width:{width + 340}px" data-variant={v.id}>
        <div class="flex flex-col gap-1.5 text-xs">
          <h2 class="text-sm font-semibold"><span class="text-accent">{v.id.toUpperCase()}.</span> {v.name}</h2>
          <p class="text-muted">{v.concept}</p>
          <dl class="grid grid-cols-[84px_1fr] gap-x-2 gap-y-1">
            <dt class="text-muted">At a glance</dt><dd>{v.glance}</dd>
            <dt class="text-muted">Actions</dt><dd>{v.actions}</dd>
            <dt class="text-success">Pros</dt><dd>{v.pros}</dd>
            <dt class="text-danger">Cons</dt><dd>{v.cons}</dd>
          </dl>
        </div>
        <div class="flex h-[720px] overflow-hidden rounded-lg border border-edge shadow-lg">
          <aside class="shrink-0 border-r border-edge" style="width:{width}px">
            <Variant projects={MOCK_PROJECTS} notified={MOCK_NOTIFIED} favorites={MOCK_FAVORITES} bind:selected={selected[v.id]} />
          </aside>
          <FakeMain worktree={byKey.get(selected[v.id] ?? "") ?? null} />
        </div>
      </section>
    {/each}
  </main>
</div>
