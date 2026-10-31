import { afterEach, describe, expect, it } from "bun:test";
import { leakedProjectEnvKeys, stripProjectEnv } from "../adapters/project-env";

const original = process.env.WEBMUX_PROJECT_ENV_KEYS;

afterEach(() => {
  if (original === undefined) delete process.env.WEBMUX_PROJECT_ENV_KEYS;
  else process.env.WEBMUX_PROJECT_ENV_KEYS = original;
});

describe("leakedProjectEnvKeys", () => {
  it("returns only webmux's own PORT when no project env keys were loaded", () => {
    delete process.env.WEBMUX_PROJECT_ENV_KEYS;
    expect(leakedProjectEnvKeys()).toEqual(new Set(["PORT"]));
  });

  it("includes the listed keys plus the marker var itself, trimming blanks", () => {
    process.env.WEBMUX_PROJECT_ENV_KEYS = "SUPABASE_URL, SUPABASE_ANON_KEY ,";
    expect(leakedProjectEnvKeys()).toEqual(
      new Set(["PORT", "WEBMUX_PROJECT_ENV_KEYS", "SUPABASE_URL", "SUPABASE_ANON_KEY"]),
    );
  });
});

describe("stripProjectEnv", () => {
  it("removes the launch project's keys and the marker, keeping unrelated vars", () => {
    process.env.WEBMUX_PROJECT_ENV_KEYS = "SUPABASE_URL";
    const result = stripProjectEnv({
      SUPABASE_URL: "secret",
      WEBMUX_PROJECT_ENV_KEYS: "SUPABASE_URL",
      PATH: "/usr/bin",
      HOME: "/root",
      UNSET: undefined,
    });
    expect(result).toEqual({ PATH: "/usr/bin", HOME: "/root" });
  });

  it("drops webmux's own PORT and keeps every other defined var", () => {
    delete process.env.WEBMUX_PROJECT_ENV_KEYS;
    expect(stripProjectEnv({ A: "1", B: "2", C: undefined, PORT: "5111" })).toEqual({ A: "1", B: "2" });
  });
});
