<script lang="ts">
  import type { ThemeKey } from "./themes";
  import { SSH_STORAGE_KEY, applyTheme, ideLabel } from "./utils";
  import { THEMES } from "./themes";
  import BaseDialog from "./BaseDialog.svelte";
  import Btn from "./Btn.svelte";
  import SettingToggle from "./SettingToggle.svelte";
  import CustomAgentsSection from "./CustomAgentsSection.svelte";
  import ProjectSettingsSection from "./ProjectSettingsSection.svelte";
  import type { ProjectCache } from "./project-cache.svelte";
  import type { AppConfig, IdeKind, ProjectWorktreeList } from "./types";

  const FORM_ID = "settings-global-form";

  let {
    projects,
    activeProject,
    configs,
    currentTheme,
    useWebChatUi,
    ide,
    onthemechange,
    onwebchatuichange,
    onsave,
    onclose,
  }: {
    /** One section each, in this order; the active one starts expanded. */
    projects: Pick<ProjectWorktreeList, "prefix" | "name">[];
    activeProject: string;
    configs: ProjectCache<AppConfig>;
    currentTheme: ThemeKey;
    useWebChatUi: boolean;
    ide: IdeKind;
    onthemechange: (key: ThemeKey) => void;
    onwebchatuichange: (enabled: boolean) => void;
    onsave: (sshHost: string) => void;
    onclose: () => void;
  } = $props();

  let sshHost = $state(localStorage.getItem(SSH_STORAGE_KEY) ?? "");

  function handleSave(): void {
    const trimmed = sshHost.trim();
    if (trimmed) {
      localStorage.setItem(SSH_STORAGE_KEY, trimmed);
    } else {
      localStorage.removeItem(SSH_STORAGE_KEY);
    }
    onsave(trimmed);
  }

  function selectTheme(key: ThemeKey): void {
    applyTheme(key);
    onthemechange(key);
  }
</script>

<BaseDialog {onclose} wide>
  <h2 class="text-base mb-4">Settings</h2>

  <form id={FORM_ID} onsubmit={(event) => { event.preventDefault(); handleSave(); }}>
    <div class="mb-5">
      <span class="block text-xs text-muted mb-2">Theme</span>
      <div class="grid grid-cols-2 gap-2">
        {#each THEMES as theme (theme.key)}
          <button
            type="button"
            class="flex items-center gap-2.5 px-3 py-2 rounded-md border cursor-pointer text-left text-[13px] transition-colors {currentTheme === theme.key
              ? 'border-accent bg-active text-primary'
              : 'border-edge bg-surface text-muted hover:bg-hover hover:text-primary'}"
            onclick={() => selectTheme(theme.key)}
          >
            <span class="shrink-0 flex gap-0.5">
              {#each [theme.colors.surface, theme.colors.accent, theme.colors.success, theme.colors.warning] as color}
                <span class="w-3 h-3 rounded-full border border-edge" style="background:{color}"></span>
              {/each}
            </span>
            <span>{theme.label}</span>
          </button>
        {/each}
      </div>
    </div>

    <div class="mb-5">
      <span class="block text-xs text-muted mb-2">Interface</span>
      <SettingToggle
        title="Use web chat UI"
        description="Show the in-app agent conversation instead of the terminal for supported agents."
        checked={useWebChatUi}
        ontoggle={onwebchatuichange}
        aria-label="Use web chat UI"
      />
    </div>

    <div class="mb-5">
      <label class="block text-xs text-muted mb-1.5" for="ssh-host">
        SSH Host <span class="opacity-60">(for "Open in {ideLabel(ide)}")</span>
      </label>
      <input
        id="ssh-host"
        type="text"
        class="w-full px-2.5 py-1.5 rounded-md border border-edge bg-surface text-primary text-[13px] placeholder:text-muted/50 outline-none focus:border-accent"
        placeholder="e.g. devbox or 10.0.0.5"
        bind:value={sshHost}
      />
      <p class="text-[11px] text-muted mt-1.5">
        Must match an entry in your local <code class="text-accent/80">~/.ssh/config</code>. Leave empty for local mode.
      </p>
    </div>
  </form>

  <CustomAgentsSection {configs} />

  <div class="mb-4">
    <span class="block text-xs text-muted mb-2">Projects</span>
    <div class="space-y-2">
      {#each projects as entry (entry.prefix)}
        <ProjectSettingsSection
          project={entry.prefix}
          name={entry.name}
          {configs}
          defaultExpanded={entry.prefix === activeProject}
        />
      {/each}
    </div>
  </div>

  <div class="flex justify-end gap-2">
    <Btn type="button" onclick={onclose}>Cancel</Btn>
    <Btn type="submit" form={FORM_ID} variant="cta">Save</Btn>
  </div>
</BaseDialog>
