import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import type { ComponentProps } from "svelte";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProjectActionsMenu from "./ProjectActionsMenu.svelte";
import type { ProjectRepo } from "./types";

type MenuProps = ComponentProps<typeof ProjectActionsMenu>;

const ownRepo: ProjectRepo = { repo: null, label: "main", ideUrl: "cursor://file/repos/app" };
const linkedRepo: ProjectRepo = { repo: "shared", label: "shared", ideUrl: null };

function renderMenu(overrides: Partial<MenuProps> = {}): MenuProps {
  const props: MenuProps = {
    name: "app",
    repos: [ownRepo, linkedRepo],
    showShortcuts: true,
    onopen: vi.fn(),
    oncreate: vi.fn(),
    onpull: vi.fn(),
    onremove: vi.fn(),
    ...overrides,
  };
  render(ProjectActionsMenu, { props });
  return props;
}

async function openMenu(): Promise<void> {
  await fireEvent.click(screen.getByRole("button", { name: "Actions for app" }));
}

describe("ProjectActionsMenu", () => {
  afterEach(() => cleanup());

  it("creates a worktree from the + button without opening the menu", async () => {
    const props = renderMenu();

    await fireEvent.click(screen.getByRole("button", { name: "New worktree in app" }));

    expect(props.oncreate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Remove project" })).not.toBeInTheDocument();
  });

  it("mentions Cmd+K on the + button only where there is a keyboard", () => {
    renderMenu();
    expect(screen.getByRole("button", { name: "New worktree in app" })).toHaveAttribute("title", "New worktree (Cmd+K)");
    cleanup();

    renderMenu({ showShortcuts: false });
    expect(screen.getByRole("button", { name: "New worktree in app" })).toHaveAttribute("title", "New worktree in app");
  });

  it("reports opening and runs each item, closing the menu", async () => {
    const props = renderMenu();

    await openMenu();
    expect(props.onopen).toHaveBeenCalledTimes(1);
    await fireEvent.click(screen.getByRole("button", { name: "Pull shared" }));
    expect(props.onpull).toHaveBeenCalledWith(linkedRepo);
    expect(screen.queryByRole("button", { name: "Pull main" })).not.toBeInTheDocument();

    expect(screen.queryByRole("button", { name: "New worktree" })).not.toBeInTheDocument();

    await openMenu();
    await fireEvent.click(screen.getByRole("button", { name: "Remove project" }));
    expect(props.onremove).toHaveBeenCalledTimes(1);
  });

  it("links only the repos with an IDE URL", async () => {
    renderMenu();

    await openMenu();

    expect(screen.getByRole("link", { name: "Open in Cursor" })).toHaveAttribute("href", "cursor://file/repos/app");
    expect(screen.queryByRole("link", { name: /Open shared/ })).not.toBeInTheDocument();
  });

  it("closes on an outside click or Escape", async () => {
    renderMenu();

    await openMenu();
    await fireEvent.click(document.body);
    expect(screen.queryByRole("button", { name: "Remove project" })).not.toBeInTheDocument();

    await openMenu();
    await fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("button", { name: "Remove project" })).not.toBeInTheDocument();
  });
});
