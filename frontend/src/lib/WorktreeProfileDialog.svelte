<script lang="ts">
  import type { ProfileConfig } from "./types";
  import BaseDialog from "./BaseDialog.svelte";
  import Btn from "./Btn.svelte";

  let {
    branch,
    profiles,
    currentProfile,
    isOpen,
    loading = false,
    error = "",
    onconfirm,
    oncancel,
  }: {
    branch: string;
    profiles: ProfileConfig[];
    currentProfile: string | null;
    isOpen: boolean;
    loading?: boolean;
    error?: string;
    onconfirm: (profile: string) => void;
    oncancel: () => void;
  } = $props();

  let selected = $state<string | null>(null);
  let selectedProfile = $derived(selected ?? currentProfile ?? "");
  let canSave = $derived(!loading && selectedProfile.length > 0 && selectedProfile !== currentProfile);
</script>

<BaseDialog onclose={oncancel}>
  <form onsubmit={(event: SubmitEvent) => { event.preventDefault(); if (canSave) onconfirm(selectedProfile); }}>
    <h2 class="text-base mb-1">Worktree profile</h2>
    <p class="text-[11px] text-muted mb-4">{branch}</p>
    <div class="flex flex-col gap-2 mb-4">
      {#each profiles as profileOption (profileOption.name)}
        <label
          class="flex items-center gap-2.5 p-2.5 rounded-lg border cursor-pointer text-[13px] transition-colors
            {selectedProfile === profileOption.name
            ? 'border-accent bg-accent/10'
            : 'border-edge hover:bg-hover'}"
        >
          <input
            type="radio"
            name="worktree-profile"
            value={profileOption.name}
            checked={selectedProfile === profileOption.name}
            onchange={() => (selected = profileOption.name)}
            disabled={loading}
            class="accent-[var(--accent)]"
          />
          {profileOption.name}
        </label>
      {/each}
    </div>
    <p class="text-[11px] text-muted mb-4">
      {isOpen
        ? "Switching restarts the session with the new pane layout and commands. The agent conversation is resumed."
        : "The new layout and commands apply the next time this worktree is opened."}
    </p>
    {#if error}<p class="text-[12px] text-danger mb-4 -mt-2 whitespace-pre-wrap">{error}</p>{/if}
    <div class="flex justify-end gap-2">
      <Btn type="button" onclick={oncancel} disabled={loading}>Cancel</Btn>
      <Btn type="submit" variant="cta" class="flex items-center gap-1.5" disabled={!canSave}
        >{#if loading}<span class="spinner"></span>{/if} Switch</Btn
      >
    </div>
  </form>
</BaseDialog>
