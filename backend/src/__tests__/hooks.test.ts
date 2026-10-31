import { afterEach, describe, expect, it } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BunLifecycleHookRunner } from "../adapters/hooks";

const originalPort = process.env.PORT;

afterEach(() => {
  if (originalPort === undefined) delete process.env.PORT;
  else process.env.PORT = originalPort;
});

describe("BunLifecycleHookRunner", () => {
  it("does not pass webmux's own PORT to hooks", async () => {
    const dir = mkdtempSync(join(tmpdir(), "webmux-hook-"));
    process.env.PORT = "5111";
    try {
      await new BunLifecycleHookRunner().run({
        name: "postCreate",
        command: "printf '%s' \"${PORT-unset}\" > port.txt",
        cwd: dir,
        env: { WEBMUX_WORKTREE_ID: "wt-1" },
      });
      expect(readFileSync(join(dir, "port.txt"), "utf8")).toBe("unset");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
