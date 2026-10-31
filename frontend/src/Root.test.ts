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

  it("switches project in memory without remounting App", async () => {
    render(Root, { initial: { kind: "project", prefix: "alpha" } });
    expect(await screen.findByText("current alpha")).toBeInTheDocument();
    expect(localStorage.getItem("wt-last-project")).toBe("alpha");

    await fireEvent.click(screen.getByText("to beta"));

    expect(await screen.findByText("current beta")).toBeInTheDocument();
    expect(screen.getByText("mounted alpha")).toBeInTheDocument();
    expect(localStorage.getItem("wt-last-project")).toBe("beta");
    expect(window.location.pathname).toBe("/");
  });

  it("falls back to the empty state when the last project goes away", async () => {
    window.history.replaceState(null, "", "/#alpha/feat");
    render(Root, { initial: { kind: "project", prefix: "alpha" } });
    await screen.findByText("current alpha");

    await fireEvent.click(screen.getByText("no projects"));

    expect(await screen.findByText("No projects yet")).toBeInTheDocument();
    expect(window.location.hash).toBe("");
    expect(localStorage.getItem("wt-last-project")).toBeNull();
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

    expect(await screen.findByText("current beta")).toBeInTheDocument();
  });
});
