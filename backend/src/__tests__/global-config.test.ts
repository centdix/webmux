import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadGlobalCustomAgents, writeGlobalCustomAgents } from "../adapters/global-config";

describe("global config custom agents", () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  async function configPath(): Promise<string> {
    const dir = await mkdtemp(join(tmpdir(), "webmux-global-config-"));
    tempDirs.push(dir);
    return join(dir, "webmux", "config.yaml");
  }

  it("treats a missing file as no custom agents", async () => {
    expect(loadGlobalCustomAgents(await configPath())).toEqual({});
  });

  it("reads valid agents and drops incomplete ones", async () => {
    const path = await configPath();
    await Bun.write(path, [
      "agents:",
      "  gemini:",
      "    label: Gemini CLI",
      "    startCommand: gemini --prompt \"${PROMPT}\"",
      "    resumeCommand: gemini resume --last",
      "  broken:",
      "    label: Broken",
      "",
    ].join("\n"));

    expect(loadGlobalCustomAgents(path)).toEqual({
      gemini: {
        label: "Gemini CLI",
        startCommand: 'gemini --prompt "${PROMPT}"',
        resumeCommand: "gemini resume --last",
      },
    });
  });

  it("writes agents (creating the directory) and keeps other top-level keys", async () => {
    const path = await configPath();
    await writeGlobalCustomAgents(path, { gemini: { label: "Gemini CLI", startCommand: "gemini" } });
    expect(loadGlobalCustomAgents(path)).toEqual({ gemini: { label: "Gemini CLI", startCommand: "gemini" } });

    await Bun.write(path, `other: kept\n${await Bun.file(path).text()}`);
    await writeGlobalCustomAgents(path, {});

    expect(await Bun.file(path).text()).toBe("other: kept\n");
    expect(loadGlobalCustomAgents(path)).toEqual({});
  });
});
