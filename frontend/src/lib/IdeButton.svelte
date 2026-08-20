<script lang="ts">
  import { ideLabelForUrl } from "./utils";

  let { url }: { url: string } = $props();

  let label = $derived(ideLabelForUrl(url));
</script>

<a
  href={url}
  class="shrink-0 text-[9px] px-1.5 py-0.5 rounded border border-accent/40 text-accent font-medium no-underline hover:opacity-80"
  title="Open in {label}"
>{label}</a>
