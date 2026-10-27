import { isRecord } from "../lib/type-guards";
import type { InitAgentStreamEvent, InitAgentStreamState } from "./types";

export interface CommandHookConfig {
  type: "command";
  command: string;
  async?: boolean;
  timeout?: number;
}

export interface HookMatcherConfig {
  matcher?: string;
  hooks: CommandHookConfig[];
}

export interface HookConfigFile {
  hooks: Record<string, HookMatcherConfig[]>;
}

export interface StampedSession {
  sessionId: string;
  mtimeMs: number;
}

export function home(): string {
  const value = Bun.env.HOME;
  if (!value) throw new Error("HOME is required to resolve agent sessions");
  return value;
}

export function newestFirst(sessions: StampedSession[]): string[] {
  return sessions.sort((left, right) => right.mtimeMs - left.mtimeMs).map((entry) => entry.sessionId);
}

export function quoteShell(value: string): string {
  return `'${value.replaceAll("'", "'\\''")}'`;
}

export function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

export function closeAssistant(state: InitAgentStreamState): InitAgentStreamEvent[] {
  if (!state.assistantSnapshot) return [];
  state.assistantSnapshot = "";
  return [{ kind: "assistant_done", text: "" }];
}

export function streamSnapshot(
  state: InitAgentStreamState,
  snapshot: string,
): InitAgentStreamEvent[] {
  if (!snapshot) return [];

  if (!state.assistantSnapshot) {
    state.assistantSnapshot = snapshot;
    return [{ kind: "assistant_delta", text: snapshot }];
  }

  if (snapshot === state.assistantSnapshot) return [];

  if (snapshot.startsWith(state.assistantSnapshot)) {
    const delta = snapshot.slice(state.assistantSnapshot.length);
    state.assistantSnapshot = snapshot;
    return delta ? [{ kind: "assistant_delta", text: delta }] : [];
  }

  state.assistantSnapshot = snapshot;
  return [
    { kind: "assistant_done", text: "" },
    { kind: "assistant_delta", text: snapshot },
  ];
}

export function emitStatus(state: InitAgentStreamState, text: string | null): InitAgentStreamEvent[] {
  const status = text?.trim();
  if (!status || status === state.lastStatus) return [];
  state.lastStatus = status;
  return [...closeAssistant(state), { kind: "status", text: status }];
}

export function emitWarning(state: InitAgentStreamState, text: string | null): InitAgentStreamEvent[] {
  const warning = text?.trim();
  if (!warning) return [];
  return [...closeAssistant(state), { kind: "warning", text: warning }];
}

export function extractTextBlocks(value: unknown): string {
  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    return value.map((entry) => extractTextBlocks(entry)).filter((entry) => entry.length > 0).join("");
  }

  if (!isRecord(value)) return "";

  if (value.type === "text" && typeof value.text === "string") {
    return value.text;
  }

  if (typeof value.output_text === "string") return value.output_text;
  if (typeof value.text === "string") return value.text;
  if (typeof value.delta === "string") return value.delta;
  if (Array.isArray(value.content)) return extractTextBlocks(value.content);
  if (Array.isArray(value.contents)) return extractTextBlocks(value.contents);
  if (Array.isArray(value.parts)) return extractTextBlocks(value.parts);
  if (Array.isArray(value.output)) return extractTextBlocks(value.output);

  return "";
}

export function extractCommandText(value: unknown): string | null {
  if (typeof value === "string" && value.trim().length > 0) return value.trim();
  if (Array.isArray(value) && value.every((entry) => typeof entry === "string")) {
    return value.join(" ").trim() || null;
  }
  return null;
}

export function truncateText(text: string, limit = 120): string {
  return text.length > limit ? `${text.slice(0, limit - 3)}...` : text;
}

export function extractStructuredMessage(raw: Record<string, unknown>): string | null {
  const candidates: unknown[] = [
    raw.message,
    raw.result,
    raw.item,
    raw.output,
    raw.content,
    raw.text,
    raw.response,
  ];

  for (const candidate of candidates) {
    const text = extractTextBlocks(candidate).trim();
    if (text) return text;
  }

  return null;
}
