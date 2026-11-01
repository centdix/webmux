import "./app.css";
import Root from "./Root.svelte";
import { mount } from "svelte";
import { resolveInitialProject } from "./lib/api";

// Left over from the all-projects sidebar's folds.
try {
  localStorage.removeItem("wt-collapsed-projects");
} catch {}

async function start(): Promise<void> {
  const target = document.getElementById("app")!;
  // Pick the project before mounting, so the per-project API client has a
  // valid base. With no projects, Root mounts a guided empty state instead.
  const initial = await resolveInitialProject();
  mount(Root, { target, props: { initial } });
}

void start();
