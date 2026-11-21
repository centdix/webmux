import { describe, expect, it } from "bun:test";
import { CreateWorktreeRequestSchema, NotificationIdParamsSchema, RunIdParamsSchema, WorktreeIdParamsSchema } from "@webmux/api-contract";
import { z } from "zod";
import { parseParams } from "../api-validation";

describe("parseParams", () => {
  it("decodes encoded path params before validation", () => {
    const parsed = parseParams({ id: "wt%3A1%2Fa" }, WorktreeIdParamsSchema);

    expect(parsed).toEqual({
      ok: true,
      data: { id: "wt:1/a" },
    });
  });

  it("parses numeric route params through the shared contract schemas", () => {
    const notification = parseParams({ id: "42" }, NotificationIdParamsSchema);
    const run = parseParams({ runId: "317" }, RunIdParamsSchema);

    expect(notification).toEqual({
      ok: true,
      data: { id: 42 },
    });
    expect(run).toEqual({
      ok: true,
      data: { runId: 317 },
    });
  });

  it("returns a 400 response for malformed path encoding", async () => {
    const parsed = parseParams({ id: "%E0%A4%A" }, WorktreeIdParamsSchema);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) throw new Error("Expected malformed path parameters to fail");

    expect(parsed.response.status).toBe(400);
    expect(await parsed.response.json()).toEqual({
      error: "Invalid path parameters: malformed encoding",
    });
  });

  it("mentions additional validation errors after the first one", async () => {
    const schema = z.object({
      first: z.string(),
      second: z.string(),
    });

    const parsed = parseParams({}, schema);

    expect(parsed.ok).toBe(false);
    if (parsed.ok) throw new Error("Expected validation to fail");

    expect(await parsed.response.json()).toEqual({
      error: "Invalid path parameters: first: Required (and 1 more error)",
    });
  });
});

describe("CreateWorktreeRequestSchema linearTeamKey", () => {
  it("uppercases and accepts a valid team key", () => {
    const parsed = CreateWorktreeRequestSchema.safeParse({
      createLinearTicket: true,
      linearTeamKey: "eng",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.linearTeamKey).toBe("ENG");
  });

  it("rejects an issue-shaped key like ENG-123", () => {
    const parsed = CreateWorktreeRequestSchema.safeParse({
      createLinearTicket: true,
      linearTeamKey: "ENG-123",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects non-alpha characters", () => {
    const parsed = CreateWorktreeRequestSchema.safeParse({
      createLinearTicket: true,
      linearTeamKey: "ENG2",
    });
    expect(parsed.success).toBe(false);
  });

  it("allows omitting linearTeamKey", () => {
    const parsed = CreateWorktreeRequestSchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.linearTeamKey).toBeUndefined();
  });
});

describe("CreateWorktreeRequestSchema worktreeId", () => {
  it("accepts a UUID and rejects anything else", () => {
    expect(CreateWorktreeRequestSchema.safeParse({ worktreeId: "0c8f7e2a-1b3d-4c5e-9f60-7a8b9c0d1e2f" }).success).toBe(true);
    expect(CreateWorktreeRequestSchema.safeParse({ worktreeId: "u-0123456789abcdef" }).success).toBe(false);
    expect(CreateWorktreeRequestSchema.safeParse({ worktreeId: "../escape" }).success).toBe(false);
  });
});
