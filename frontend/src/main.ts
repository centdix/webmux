import "./app.css";
import Root from "./Root.svelte";
import { mount } from "svelte";
import { resolveInitialProject } from "./lib/api";

async function start(): Promise<void> {
  const target = document.getElementById("app")!;
  // Pick the project before mounting, so the per-project API client has a
  // valid base. With no projects, Root mounts a guided empty state instead.
  const initialProject = await resolveInitialProject();
  mount(Root, { target, props: { initialProject } });
}

void start();
