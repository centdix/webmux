<script lang="ts">
  import { projectInitials, projectTint } from "../lab";

  let {
    name,
    index,
    size = "md",
    error = false,
  }: {
    name: string;
    /** Project order, picks the tint. */
    index: number;
    size?: "sm" | "md";
    error?: boolean;
  } = $props();
</script>

<span
  class="inline-flex shrink-0 items-center justify-center font-semibold tracking-tight {size === 'sm'
    ? 'h-4 w-[22px] rounded text-[9px]'
    : 'h-8 w-8 rounded-lg text-[11px]'} {error ? 'bg-danger/15 text-danger' : projectTint(index)}"
  title={name}
  aria-hidden="true">{projectInitials(name)}</span
>
