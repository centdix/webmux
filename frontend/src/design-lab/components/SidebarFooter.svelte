<script lang="ts">
  import IconBtn from "./IconBtn.svelte";
</script>

<!-- Add project + one discreet entry for shortcuts/settings instead of a permanent hint block. -->
<div class="flex shrink-0 items-center gap-1 border-t border-edge px-2 py-1.5">
  <button
    type="button"
    class="flex flex-1 cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-xs text-muted hover:bg-hover hover:text-primary"
  ><span class="text-sm leading-none" aria-hidden="true">+</span> Add project</button>
  <IconBtn icon="help" label="Keyboard shortcuts" onclick={() => {}} />
  <IconBtn icon="gear" label="Settings" onclick={() => {}} />
</div>
