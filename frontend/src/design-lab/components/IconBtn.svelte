<script lang="ts">
  let {
    icon,
    label,
    onclick,
    class: className = "",
  }: {
    icon: "plus" | "more" | "help" | "gear";
    label: string;
    onclick: (event: MouseEvent) => void;
    class?: string;
  } = $props();
</script>

<button
  type="button"
  class="inline-flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-muted hover:bg-hover hover:text-primary {className}"
  title={label}
  aria-label={label}
  onclick={(event) => {
    event.stopPropagation();
    onclick(event);
  }}
>
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true">
    {#if icon === "plus"}
      <path d="M8 3v10M3 8h10" />
    {:else if icon === "more"}
      <circle cx="3.5" cy="8" r=".9" fill="currentColor" /><circle cx="8" cy="8" r=".9" fill="currentColor" /><circle cx="12.5" cy="8" r=".9" fill="currentColor" />
    {:else if icon === "help"}
      <circle cx="8" cy="8" r="6" /><path d="M6.3 6.3a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1M8 11.3v.1" />
    {:else}
      <circle cx="8" cy="8" r="2" /><path d="M8 1.8v1.7M8 12.5v1.7M1.8 8h1.7M12.5 8h1.7M3.6 3.6l1.2 1.2M11.2 11.2l1.2 1.2M3.6 12.4l1.2-1.2M11.2 4.8l1.2-1.2" />
    {/if}
  </svg>
</button>
