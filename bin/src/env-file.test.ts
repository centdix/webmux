import { describe, expect, it } from "bun:test";
import { applyEnvText } from "./env-file";

describe("applyEnvText", () => {
  it("loads missing keys and reports them", () => {
    const env: Record<string, string | undefined> = {};
    expect(applyEnvText("A=1\nB=\"two\"\n", env)).toEqual(["A", "B"]);
    expect(env).toEqual({ A: "1", B: "two" });
  });

  it("keeps an already-set value but still reports its key", () => {
    // What Bun's own .env auto-load leaves behind before webmux reads the file.
    const env: Record<string, string | undefined> = { SECRET: "s3cr3t" };
    expect(applyEnvText("SECRET=s3cr3t\n", env)).toEqual(["SECRET"]);
    expect(env.SECRET).toBe("s3cr3t");
  });

  it("does not let the file override a value set elsewhere", () => {
    const env: Record<string, string | undefined> = { PORT: "5111" };
    applyEnvText("PORT=9999\n", env);
    expect(env.PORT).toBe("5111");
  });

  it("skips comments, blank lines and lines without '='", () => {
    const env: Record<string, string | undefined> = {};
    expect(applyEnvText("# c\n\nnot a pair\nK=v\n", env)).toEqual(["K"]);
  });
});
