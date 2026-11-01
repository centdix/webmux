import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import CustomAgentsSection from "./CustomAgentsSection.svelte";
import { ProjectCache } from "./project-cache.svelte";
import type { AgentDetails, AgentSummary, AppConfig } from "./types";

vi.mock("./api", () => ({
  fetchAgents: vi.fn(),
  createAgent: vi.fn(),
  updateAgent: vi.fn(),
  deleteAgent: vi.fn(),
  validateAgent: vi.fn(),
}));

import { createAgent, deleteAgent, fetchAgents, updateAgent, validateAgent } from "./api";

const originalDialogShowModal = HTMLDialogElement.prototype.showModal;
const originalDialogClose = HTMLDialogElement.prototype.close;

const CAPABILITIES: AgentSummary["capabilities"] = { terminal: true, inAppChat: false, conversationHistory: false, interrupt: false, resume: true };

const GEMINI: AgentDetails = {
  id: "gemini",
  label: "Gemini CLI",
  kind: "custom",
  capabilities: CAPABILITIES,
  startCommand: 'gemini --prompt "${PROMPT}"',
  resumeCommand: 'gemini resume --branch "${BRANCH}"',
};

const GEMINI_SUMMARY: AgentSummary = { id: "gemini", label: "Gemini CLI", kind: "custom", capabilities: CAPABILITIES };

const BUILTIN_CLAUDE: AgentDetails = {
  id: "claude",
  label: "Claude",
  kind: "builtin",
  capabilities: { terminal: true, inAppChat: true, conversationHistory: true, interrupt: true, resume: true },
  startCommand: null,
  resumeCommand: null,
};

function createConfig(agents: AgentSummary[]): AppConfig {
  return {
    name: "repo",
    profiles: [{ name: "default" }],
    agents,
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
  };
}

describe("CustomAgentsSection", () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function showModal() {
      this.setAttribute("open", "");
    };
    HTMLDialogElement.prototype.close = function close() {
      this.removeAttribute("open");
    };
  });

  afterEach(() => {
    HTMLDialogElement.prototype.showModal = originalDialogShowModal;
    HTMLDialogElement.prototype.close = originalDialogClose;
    cleanup();
    vi.clearAllMocks();
  });

  function renderSection(load: (project: string) => Promise<AppConfig> = async () => createConfig([])): ProjectCache<AppConfig> {
    const configs = new ProjectCache<AppConfig>(load, { maxAgeMs: 60_000 });
    render(CustomAgentsSection, { configs });
    return configs;
  }

  it("lists only custom agents and points at the global config file", async () => {
    vi.mocked(fetchAgents).mockResolvedValue([BUILTIN_CLAUDE, GEMINI]);

    renderSection();

    await screen.findByText("Gemini CLI");
    expect(screen.queryByText("Claude")).not.toBeInTheDocument();
    expect(screen.getByText('gemini --prompt "${PROMPT}"')).toBeInTheDocument();
    expect(screen.getByText("~/.config/webmux/config.yaml")).toBeInTheDocument();
  });

  it("shows an empty state when no custom agents are configured", async () => {
    vi.mocked(fetchAgents).mockResolvedValue([BUILTIN_CLAUDE]);

    renderSection();

    expect(await screen.findByText("No custom agents setup")).toBeInTheDocument();
  });

  it("validates, creates and deletes agents globally and reloads every loaded project's config", async () => {
    vi.mocked(fetchAgents)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([GEMINI])
      .mockResolvedValueOnce([]);
    vi.mocked(createAgent).mockResolvedValue({ agent: GEMINI });
    vi.mocked(validateAgent).mockResolvedValue({ normalizedId: "gemini-cli", warnings: [] });
    vi.mocked(deleteAgent).mockResolvedValue();
    let serverAgents: AgentSummary[] = [];
    const load = vi.fn(async () => createConfig(serverAgents));
    const configs = renderSection(load);
    configs.ensure("webmux");
    configs.ensure("images");

    await screen.findByText("No custom agents setup");
    await fireEvent.click(screen.getByRole("button", { name: "Add agent" }));
    await fireEvent.input(screen.getByLabelText("Agent name"), { target: { value: "Gemini CLI" } });
    await fireEvent.input(screen.getByLabelText("Start command"), { target: { value: 'gemini --prompt "${PROMPT}"' } });
    await fireEvent.click(screen.getByRole("button", { name: "Test" }));

    await waitFor(() => {
      expect(validateAgent).toHaveBeenCalledWith({ label: "Gemini CLI", startCommand: 'gemini --prompt "${PROMPT}"' });
    });
    expect(await screen.findByText("Configuration looks good.")).toBeInTheDocument();

    serverAgents = [GEMINI_SUMMARY];
    const editor = screen.getByLabelText("Agent name").closest("dialog");
    if (!editor) throw new Error("agent editor not open");
    await fireEvent.click(within(editor).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(createAgent).toHaveBeenCalledWith({ label: "Gemini CLI", startCommand: 'gemini --prompt "${PROMPT}"' });
    });
    await waitFor(() => expect(configs.get("webmux")?.agents).toEqual([GEMINI_SUMMARY]));
    expect(configs.get("images")?.agents).toEqual([GEMINI_SUMMARY]);

    serverAgents = [];
    await fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    await fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    await waitFor(() => expect(deleteAgent).toHaveBeenCalledWith("gemini"));
    await waitFor(() => expect(configs.get("webmux")?.agents).toEqual([]));
    expect(configs.get("images")?.agents).toEqual([]);
  });

  it("shows a failed delete and closes the confirmation", async () => {
    vi.mocked(fetchAgents).mockResolvedValue([GEMINI]);
    vi.mocked(deleteAgent).mockRejectedValue(new Error("Global config is not a YAML mapping"));

    renderSection();

    await fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    expect(screen.getByText('Delete agent "Gemini CLI"? It is shared by all projects.')).toBeInTheDocument();
    await fireEvent.click(screen.getByRole("button", { name: "Remove" }));

    expect(await screen.findByText("Global config is not a YAML mapping")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Remove" })).not.toBeInTheDocument();
  });

  it("edits an existing agent by id", async () => {
    vi.mocked(fetchAgents).mockResolvedValue([GEMINI]);
    vi.mocked(updateAgent).mockResolvedValue({ agent: GEMINI });

    renderSection();

    await fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
    await fireEvent.input(screen.getByLabelText("Start command"), { target: { value: "gemini2" } });
    const editor = screen.getByLabelText("Agent name").closest("dialog");
    if (!editor) throw new Error("agent editor not open");
    await fireEvent.click(within(editor).getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(updateAgent).toHaveBeenCalledWith("gemini", {
        label: "Gemini CLI",
        startCommand: "gemini2",
        resumeCommand: 'gemini resume --branch "${BRANCH}"',
      });
    });
  });
});
