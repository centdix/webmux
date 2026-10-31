import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ProjectSummary } from "./types";

vi.mock("./api", () => ({
  fetchProjects: vi.fn(),
  removeProject: vi.fn(),
  setUpProject: vi.fn(),
}));

import ProjectSwitcher from "./ProjectSwitcher.svelte";
import { fetchProjects, removeProject, setUpProject } from "./api";

function project(prefix: string): ProjectSummary {
  return { prefix, name: prefix, path: `/repos/${prefix}`, active: false };
}

async function openMenu(): Promise<void> {
  await fireEvent.click(screen.getByTitle("Switch project"));
  await screen.findByText("/repos/beta");
}

describe("ProjectSwitcher", () => {
  beforeEach(() => {
    vi.mocked(fetchProjects).mockResolvedValue([project("alpha"), project("beta")]);
    vi.mocked(removeProject).mockResolvedValue(undefined);
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("switches project in memory without navigating", async () => {
    const onSwitch = vi.fn();
    render(ProjectSwitcher, { current: "alpha", onSwitch });
    await openMenu();

    await fireEvent.click(screen.getByText("/repos/beta"));

    expect(onSwitch).toHaveBeenCalledWith("beta");
    expect(window.location.pathname).toBe("/");
  });

  it("does nothing when picking the current project", async () => {
    const onSwitch = vi.fn();
    render(ProjectSwitcher, { current: "alpha", onSwitch });
    await openMenu();

    await fireEvent.click(screen.getByText("/repos/alpha"));

    expect(onSwitch).not.toHaveBeenCalled();
  });

  it("switches to the added project", async () => {
    vi.mocked(setUpProject).mockResolvedValue({ prefix: "gamma" });
    const onSwitch = vi.fn();
    render(ProjectSwitcher, { current: "alpha", onSwitch });
    await openMenu();

    await fireEvent.input(screen.getByPlaceholderText("Path to a git repo…"), { target: { value: "/repos/gamma" } });
    await fireEvent.click(screen.getByText("Add"));

    await waitFor(() => expect(onSwitch).toHaveBeenCalledWith("gamma"));
  });

  it("moves to another project when the current one is removed", async () => {
    const onSwitch = vi.fn();
    render(ProjectSwitcher, { current: "alpha", onSwitch });
    await openMenu();
    vi.mocked(fetchProjects).mockResolvedValue([project("beta")]);

    await fireEvent.click(screen.getAllByTitle("Remove project")[0]);

    await waitFor(() => expect(onSwitch).toHaveBeenCalledWith("beta"));
    expect(removeProject).toHaveBeenCalledWith("alpha");
  });

  it("falls back to the empty state when the last project is removed", async () => {
    vi.mocked(fetchProjects).mockResolvedValue([project("alpha")]);
    const onSwitch = vi.fn();
    render(ProjectSwitcher, { current: "alpha", onSwitch });
    await fireEvent.click(screen.getByTitle("Switch project"));
    await screen.findByText("/repos/alpha");
    vi.mocked(fetchProjects).mockResolvedValue([]);

    await fireEvent.click(screen.getByTitle("Remove project"));

    await waitFor(() => expect(onSwitch).toHaveBeenCalledWith(null));
  });

  it("stays put when removing another project", async () => {
    const onSwitch = vi.fn();
    render(ProjectSwitcher, { current: "alpha", onSwitch });
    await openMenu();
    vi.mocked(fetchProjects).mockResolvedValue([project("alpha")]);

    await fireEvent.click(screen.getAllByTitle("Remove project")[1]);

    await waitFor(() => expect(removeProject).toHaveBeenCalledWith("beta"));
    expect(onSwitch).not.toHaveBeenCalled();
  });
});
