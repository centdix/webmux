<script lang="ts">
  let {
    value = $bindable(""),
    placeholder = "Search worktrees",
    hint,
  }: { value?: string; placeholder?: string; hint?: string } = $props();
</script>

<div class="relative">
  <svg class="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-muted" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
    <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" />
  </svg>
  <input
    type="search"
    bind:value
    class="h-7 w-full rounded-md border border-edge bg-surface pr-7 pl-7 text-xs text-primary placeholder:text-muted focus:border-accent focus:outline-none"
    {placeholder}
    aria-label={placeholder}
  />
  {#if hint && !value}
    <kbd class="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2 rounded border border-edge px-1 text-[10px] leading-4 text-muted">{hint}</kbd>
  {/if}
</div>
