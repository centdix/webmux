<script lang="ts">
  import Toggle from "./Toggle.svelte";

  let {
    title,
    description,
    checked,
    disabled = false,
    ontoggle,
    "aria-label": ariaLabel,
  }: {
    title: string;
    description: string;
    checked: boolean;
    disabled?: boolean;
    ontoggle: (enabled: boolean) => void;
    "aria-label": string;
  } = $props();
</script>

<div class="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-edge bg-surface">
  <div>
    <span class="text-[13px] text-primary">{title}</span>
    <p class="text-[11px] text-muted mt-0.5">{description}</p>
  </div>

  <Toggle {checked} {disabled} {ontoggle} aria-label={ariaLabel} />
</div>
