import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SettingsDialog from "./SettingsDialog.svelte";
import { ProjectCache } from "./project-cache.svelte";
import type { AgentDetails, AppConfig } from "./types";

vi.mock("./api", () => {
  const clients = new Map<string, Record<string, ReturnType<typeof vi.fn>>>();
  return {
    projectApi: vi.fn((project: string) => {
      let client = clients.get(project);
      if (!client) {
        client = { fetchConfig: vi.fn(), setAutoRemoveOnMerge: vi.fn(), setLinearAutoCreate: vi.fn() };
        clients.set(project, client);
      }
      return client;
    }),
    fetchAgents: vi.fn(),
    createAgent: vi.fn(),
    updateAgent: vi.fn(),
    deleteAgent: vi.fn(),
    validateAgent: vi.fn(),
  };
});

import { fetchAgents, projectApi } from "./api";

const PROJECTS = [
  { prefix: "webmux", name: "webmux" },
  { prefix: "images", name: "Image Generator" },
];
const webmuxApi = projectApi("webmux");
const imagesApi = projectApi("images");

const originalDialogShowModal = HTMLDialogElement.prototype.showModal;
const originalDialogClose = HTMLDialogElement.prototype.close;

function createAgentDetails(overrides: Partial<AgentDetails> = {}): AgentDetails {
  return {
    id: "gemini",
    label: "Gemini CLI",
    kind: "custom",
    capabilities: {
      terminal: true,
      inAppChat: false,
      conversationHistory: false,
      interrupt: false,
      resume: true,
    },
    startCommand: 'gemini --prompt "${PROMPT}"',
    resumeCommand: 'gemini resume --branch "${BRANCH}"',
    ...overrides,
  };
}

function createConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    name: "repo",
    profiles: [{ name: "default" }],
    agents: [],
    defaultProfileName: "default",
    defaultAgentId: "claude",
    autoName: false,
    linearCreateTicketOption: false,
    startupEnvs: {},
    linkedRepos: [],
    linearAutoCreateWorktrees: false,
    autoRemoveOnMerge: false,
    projectDir: "/repo",
    mainBranch: "main",
    ide: "cursor",
    ...overrides,
  };
}

function newConfigs(): ProjectCache<AppConfig> {
  return new ProjectCache<AppConfig>((project) => projectApi(project).fetchConfig(), { maxAgeMs: 60_000 });
}

function renderDialog(
  overrides: { configs?: ProjectCache<AppConfig>; activeProject?: string; onwebchatuichange?: (enabled: boolean) => void } = {},
): ProjectCache<AppConfig> {
  const configs = overrides.configs ?? newConfigs();
  render(SettingsDialog, {
    projects: PROJECTS,
    activeProject: overrides.activeProject ?? "webmux",
    configs,
    currentTheme: "github-dark",
    useWebChatUi: false,
    ide: "cursor",
    onthemechange: vi.fn(),
    onwebchatuichange: overrides.onwebchatuichange ?? vi.fn(),
    onsave: vi.fn(),
    onclose: vi.fn(),
  });
  return configs;
}

function section(name: string): HTMLElement {
  return screen.getByRole("region", { name });
}

const BUILTIN_CLAUDE = createAgentDetails({
  id: "claude",
  label: "Claude",
  kind: "builtin",
  startCommand: null,
  resumeCommand: null,
  capabilities: { terminal: true, inAppChat: true, conversationHistory: true, interrupt: true, resume: true },
});

describe("SettingsDialog", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute("open");
    };
    vi.mocked(fetchAgents).mockResolvedValue([]);
    vi.mocked(webmuxApi.fetchConfig).mockResolvedValue(createConfig({ name: "webmux" }));
    vi.mocked(imagesApi.fetchConfig).mockResolvedValue(createConfig({ name: "images" }));
  });

  afterEach(() => {
    HTMLDialogElement.prototype.showModal = originalDialogShowModal;
    HTMLDialogElement.prototype.close = originalDialogClose;
    cleanup();
    vi.clearAllMocks();
  });

  it("reports web chat UI preference changes", async () => {
    const onwebchatuichange = vi.fn();

    renderDialog({ onwebchatuichange });

    await fireEvent.click(screen.getByRole("switch", { name: "Use web chat UI" }));

    expect(onwebchatuichange).toHaveBeenCalledWith(true);
  });

  it("lists a section per project and expands only the active one", async () => {
    renderDialog({ activeProject: "images" });

    expect(screen.getAllByRole("region").map((region) => region.getAttribute("aria-label"))).toEqual(["webmux", "Image Generator"]);
    expect(within(section("webmux")).getByRole("button", { name: "webmux" })).toHaveAttribute("aria-expanded", "false");
    const imagesHeader = within(section("Image Generator")).getByRole("button", { name: "Image Generator" });
    expect(imagesHeader).toHaveAttribute("aria-expanded", "true");
    const imagesBody = document.getElementById(imagesHeader.getAttribute("aria-controls") ?? "");
    expect(imagesBody).toContainElement(within(section("Image Generator")).getAllByRole("switch")[0]);
    expect(within(section("webmux")).queryByRole("switch")).not.toBeInTheDocument();
  });

  it("loads a collapsed project's config when it is expanded", async () => {
    renderDialog();
    await waitFor(() => expect(webmuxApi.fetchConfig).toHaveBeenCalledTimes(1));
    expect(imagesApi.fetchConfig).not.toHaveBeenCalled();

    await fireEvent.click(within(section("Image Generator")).getByRole("button", { name: "Image Generator" }));

    await waitFor(() => expect(imagesApi.fetchConfig).toHaveBeenCalledTimes(1));
  });

  it("shows custom agents once, globally, outside every project section", async () => {
    vi.mocked(fetchAgents).mockResolvedValue([BUILTIN_CLAUDE, createAgentDetails()]);

    renderDialog({ activeProject: "images" });

    await screen.findByText("Gemini CLI");
    expect(fetchAgents).toHaveBeenCalledTimes(1);
    expect(within(section("Image Generator")).queryByText("Gemini CLI")).not.toBeInTheDocument();
    expect(within(section("Image Generator")).queryByRole("button", { name: "Add agent" })).not.toBeInTheDocument();
  });

  it("shows each project's own toggle values", async () => {
    vi.mocked(imagesApi.fetchConfig).mockResolvedValue(
      createConfig({ linearAutoCreateWorktrees: true, autoRemoveOnMerge: true }),
    );
    renderDialog();
    await fireEvent.click(within(section("Image Generator")).getByRole("button", { name: "Image Generator" }));

    const images = section("Image Generator");
    await waitFor(() =>
      expect(within(images).getByRole("switch", { name: "Auto-create worktrees for Linear tickets in Image Generator" }))
        .toHaveAttribute("aria-checked", "true"),
    );
    expect(within(images).getByRole("switch", { name: "Auto-remove worktrees on PR merge in Image Generator" }))
      .toHaveAttribute("aria-checked", "true");
    const webmux = section("webmux");
    expect(within(webmux).getByRole("switch", { name: "Auto-create worktrees for Linear tickets in webmux" }))
      .toHaveAttribute("aria-checked", "false");
  });

  it("saves Linear auto-create on the section's project and updates only its cached config", async () => {
    vi.mocked(imagesApi.setLinearAutoCreate).mockResolvedValue({ ok: true, enabled: true });
    const configs = renderDialog({ activeProject: "images" });
    configs.ensure("webmux");
    const toggle = within(section("Image Generator")).getByRole("switch", { name: "Auto-create worktrees for Linear tickets in Image Generator" });
    await waitFor(() => expect(toggle).not.toBeDisabled());

    await fireEvent.click(toggle);

    expect(imagesApi.setLinearAutoCreate).toHaveBeenCalledWith({ body: { enabled: true } });
    expect(webmuxApi.setLinearAutoCreate).not.toHaveBeenCalled();
    await waitFor(() => expect(configs.get("images")?.linearAutoCreateWorktrees).toBe(true));
    await waitFor(() => expect(configs.get("webmux")).toBeDefined());
    expect(configs.get("webmux")?.linearAutoCreateWorktrees).toBe(false);
  });

  it("saves auto-remove on merge on the section's project and updates only its cached config", async () => {
    vi.mocked(imagesApi.setAutoRemoveOnMerge).mockResolvedValue({ ok: true, enabled: true });
    const configs = renderDialog({ activeProject: "images" });
    configs.ensure("webmux");
    const toggle = within(section("Image Generator")).getByRole("switch", { name: "Auto-remove worktrees on PR merge in Image Generator" });
    await waitFor(() => expect(toggle).not.toBeDisabled());

    await fireEvent.click(toggle);

    expect(imagesApi.setAutoRemoveOnMerge).toHaveBeenCalledWith({ body: { enabled: true } });
    expect(webmuxApi.setAutoRemoveOnMerge).not.toHaveBeenCalled();
    await waitFor(() => expect(configs.get("images")?.autoRemoveOnMerge).toBe(true));
    await waitFor(() => expect(configs.get("webmux")).toBeDefined());
    expect(configs.get("webmux")?.autoRemoveOnMerge).toBe(false);
  });

  it("shows an error and reverts a toggle whose save fails", async () => {
    vi.mocked(imagesApi.setAutoRemoveOnMerge).mockRejectedValue(new Error("config is read-only"));
    const configs = renderDialog({ activeProject: "images" });
    const images = section("Image Generator");
    const toggle = within(images).getByRole("switch", { name: "Auto-remove worktrees on PR merge in Image Generator" });
    await waitFor(() => expect(toggle).not.toBeDisabled());

    await fireEvent.click(toggle);

    expect(await within(images).findByText("config is read-only")).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(configs.get("images")?.autoRemoveOnMerge).toBe(false);
  });
});
