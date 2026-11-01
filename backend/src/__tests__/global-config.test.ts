import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadGlobalCustomAgents, readGlobalCustomAgents, writeGlobalCustomAgent } from "../adapters/global-config";

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
    expect(await writeGlobalCustomAgent(path, "gemini", { label: "Gemini CLI", startCommand: "gemini" }))
      .toEqual({ gemini: { label: "Gemini CLI", startCommand: "gemini" } });
    expect(loadGlobalCustomAgents(path)).toEqual({ gemini: { label: "Gemini CLI", startCommand: "gemini" } });

    await Bun.write(path, `other: kept\n${await Bun.file(path).text()}`);
    expect(await writeGlobalCustomAgent(path, "gemini", null)).toEqual({});

    expect(await Bun.file(path).text()).toBe("other: kept\n");
    expect(loadGlobalCustomAgents(path)).toEqual({});
    expect(await readdir(join(path, ".."))).toEqual(["config.yaml"]);
  });

  it("keeps agents hand-added to the file after it was loaded", async () => {
    const path = await configPath();
    await writeGlobalCustomAgent(path, "gemini", { label: "Gemini CLI", startCommand: "gemini" });
    await Bun.write(path, `${await Bun.file(path).text()}  manual:\n    label: Manual\n    startCommand: manual\n`);

    expect(await writeGlobalCustomAgent(path, "aider", { label: "Aider", startCommand: "aider" })).toEqual({
      gemini: { label: "Gemini CLI", startCommand: "gemini" },
      manual: { label: "Manual", startCommand: "manual" },
      aider: { label: "Aider", startCommand: "aider" },
    });
  });

  it("refuses to write over a file that cannot be parsed", async () => {
    const path = await configPath();
    const malformed = "other: [unclosed\nagents:\n  gemini: {\n";
    await Bun.write(path, malformed);

    expect(loadGlobalCustomAgents(path)).toEqual({});
    expect(() => readGlobalCustomAgents(path)).toThrow();
    await expect(writeGlobalCustomAgent(path, "aider", { label: "Aider", startCommand: "aider" })).rejects.toThrow();
    expect(await Bun.file(path).text()).toBe(malformed);
  });
});
