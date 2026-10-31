import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/svelte";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./App.svelte", async () => ({ default: (await import("./test-fixtures/AppProbe.svelte")).default }));

import Root from "./Root.svelte";

let requested: string[] = [];

function stubFetch(projects: string[]): void {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.pathname : new URL(input.url).pathname;
      requested.push(url);
      const body = url === "/api/projects"
        ? { projects: projects.map((prefix) => ({ prefix, name: prefix, path: `/repos/${prefix}`, active: false })) }
        : {};
      return new Response(JSON.stringify(body), { headers: { "content-type": "application/json" } });
    }),
  );
}

describe("Root", () => {
  beforeEach(() => {
    requested = [];
    stubFetch(["alpha", "beta"]);
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    localStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("remounts App against the new project's API when switching", async () => {
    render(Root, { initial: { kind: "project", prefix: "alpha" } });
    expect(await screen.findByText("mounted alpha")).toBeInTheDocument();
    await waitFor(() => expect(requested).toContain("/api/projects/alpha/config"));

    await fireEvent.click(screen.getByText("to beta"));

    expect(await screen.findByText("mounted beta")).toBeInTheDocument();
    await waitFor(() => expect(requested).toContain("/api/projects/beta/config"));
    expect(localStorage.getItem("wt-last-project")).toBe("beta");
    expect(window.location.pathname).toBe("/");
  });

  it("shows the empty state and clears the hash when no project is registered", async () => {
    localStorage.setItem("wt-last-project", "gone");
    window.history.replaceState(null, "", "/#gone/feat");

    render(Root, { initial: { kind: "none" } });

    expect(await screen.findByText("No projects yet")).toBeInTheDocument();
    expect(window.location.hash).toBe("");
    expect(localStorage.getItem("wt-last-project")).toBeNull();
  });

  it("shows a retryable error, keeping the hash and last project, when projects fail to load", async () => {
    localStorage.setItem("wt-last-project", "beta");
    window.history.replaceState(null, "", "/#beta/feat");

    render(Root, { initial: { kind: "error", message: "hub unreachable" } });

    expect(await screen.findByText("hub unreachable")).toBeInTheDocument();
    expect(screen.queryByText("No projects yet")).not.toBeInTheDocument();
    expect(window.location.hash).toBe("#beta/feat");
    expect(localStorage.getItem("wt-last-project")).toBe("beta");

    await fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByText("mounted beta")).toBeInTheDocument();
  });
});
