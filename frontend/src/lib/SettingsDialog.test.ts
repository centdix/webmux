import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SettingsDialog from "./SettingsDialog.svelte";
import { ProjectCache } from "./project-cache.svelte";
import type { AgentDetails, AgentSummary, AppConfig } from "./types";

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

import { createAgent, deleteAgent, fetchAgents, projectApi, validateAgent } from "./api";

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

function createAgentSummary(overrides: Partial<AgentSummary> = {}): AgentSummary {
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
    expect(within(section("Image Generator")).getByRole("button", { name: "Image Generator" }))
      .toHaveAttribute("aria-expanded", "true");
    expect(within(section("webmux")).queryByRole("switch")).not.toBeInTheDocument();
    await waitFor(() => expect(fetchAgents).toHaveBeenCalledWith("images"));
    expect(fetchAgents).not.toHaveBeenCalledWith("webmux");
  });

  it("loads a collapsed project's config and agents when it is expanded", async () => {
    renderDialog();
    await waitFor(() => expect(fetchAgents).toHaveBeenCalledWith("webmux"));
    expect(imagesApi.fetchConfig).not.toHaveBeenCalled();

    await fireEvent.click(within(section("Image Generator")).getByRole("button", { name: "Image Generator" }));

    await waitFor(() => expect(imagesApi.fetchConfig).toHaveBeenCalledTimes(1));
    expect(fetchAgents).toHaveBeenCalledWith("images");
  });

  it("shows each project's own toggle values", async () => {
    vi.mocked(imagesApi.fetchConfig).mockResolvedValue(
      createConfig({ linearAutoCreateWorktrees: true, autoRemoveOnMerge: true }),
    );
    renderDialog();
    await fireEvent.click(within(section("Image Generator")).getByRole("button", { name: "Image Generator" }));

    const images = section("Image Generator");
    await waitFor(() =>
      expect(within(images).getByRole("switch", { name: "Auto-create worktrees for Linear tickets" }))
        .toHaveAttribute("aria-checked", "true"),
    );
    expect(within(images).getByRole("switch", { name: "Auto-remove worktrees on PR merge" }))
      .toHaveAttribute("aria-checked", "true");
    const webmux = section("webmux");
    expect(within(webmux).getByRole("switch", { name: "Auto-create worktrees for Linear tickets" }))
      .toHaveAttribute("aria-checked", "false");
  });

  it("saves Linear auto-create on the section's project and updates only its cached config", async () => {
    vi.mocked(imagesApi.setLinearAutoCreate).mockResolvedValue({ ok: true, enabled: true });
    const configs = renderDialog({ activeProject: "images" });
    configs.ensure("webmux");
    const toggle = within(section("Image Generator")).getByRole("switch", { name: "Auto-create worktrees for Linear tickets" });
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
    const toggle = within(section("Image Generator")).getByRole("switch", { name: "Auto-remove worktrees on PR merge" });
    await waitFor(() => expect(toggle).not.toBeDisabled());

    await fireEvent.click(toggle);

    expect(imagesApi.setAutoRemoveOnMerge).toHaveBeenCalledWith({ body: { enabled: true } });
    expect(webmuxApi.setAutoRemoveOnMerge).not.toHaveBeenCalled();
    await waitFor(() => expect(configs.get("images")?.autoRemoveOnMerge).toBe(true));
    await waitFor(() => expect(configs.get("webmux")).toBeDefined());
    expect(configs.get("webmux")?.autoRemoveOnMerge).toBe(false);
  });

  it("shows only custom agents in the list", async () => {
    vi.mocked(fetchAgents).mockResolvedValue([BUILTIN_CLAUDE, createAgentDetails()]);

    renderDialog();

    await screen.findByText("Gemini CLI");
    expect(screen.queryByText("Claude")).not.toBeInTheDocument();
    expect(screen.getByText('gemini --prompt "${PROMPT}"')).toBeInTheDocument();
  });

  it("shows an empty state when no custom agents are configured", async () => {
    vi.mocked(fetchAgents).mockResolvedValue([BUILTIN_CLAUDE]);

    renderDialog();

    expect(await screen.findByText("No custom agents setup")).toBeInTheDocument();
    expect(screen.queryByText("Claude")).not.toBeInTheDocument();
  });

  it("validates, creates, and deletes custom agents in the section's project and refreshes its config", async () => {
    vi.mocked(fetchAgents)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([createAgentDetails()])
      .mockResolvedValueOnce([]);
    vi.mocked(createAgent).mockResolvedValue({ agent: createAgentDetails() });
    vi.mocked(validateAgent).mockResolvedValue({ normalizedId: "gemini-cli", warnings: [] });
    vi.mocked(deleteAgent).mockResolvedValue();
    vi.mocked(imagesApi.fetchConfig)
      .mockResolvedValueOnce(createConfig({ agents: [] }))
      .mockResolvedValueOnce(createConfig({ agents: [createAgentSummary()] }))
      .mockResolvedValueOnce(createConfig({ agents: [] }));

    const configs = renderDialog({ activeProject: "images" });
    const images = section("Image Generator");

    await within(images).findByText("No custom agents setup");
    await fireEvent.click(within(images).getByRole("button", { name: "Add agent" }));
    await fireEvent.input(screen.getByLabelText("Agent name"), { target: { value: "Gemini CLI" } });
    await fireEvent.input(screen.getByLabelText("Start command"), { target: { value: 'gemini --prompt "${PROMPT}"' } });
    await fireEvent.click(screen.getByRole("button", { name: "Test" }));

    await waitFor(() => {
      expect(validateAgent).toHaveBeenCalledWith("images", {
        label: "Gemini CLI",
        startCommand: 'gemini --prompt "${PROMPT}"',
      });
    });
    expect(await screen.findByText("Configuration looks good.")).toBeInTheDocument();

    const editor = screen.getByLabelText("Agent name").closest("dialog");
    if (!editor) throw new Error("agent editor not open");
    await fireEvent.click(within(editor).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(createAgent).toHaveBeenCalledWith("images", {
        label: "Gemini CLI",
        startCommand: 'gemini --prompt "${PROMPT}"',
      });
    });
    await waitFor(() => expect(configs.get("images")?.agents).toEqual([createAgentSummary()]));

    await fireEvent.click(await within(images).findByRole("button", { name: "Delete" }));
    await fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => {
      expect(deleteAgent).toHaveBeenCalledWith("images", "gemini");
    });
    await waitFor(() => expect(configs.get("images")?.agents).toEqual([]));
    expect(webmuxApi.fetchConfig).not.toHaveBeenCalled();
  });
});
