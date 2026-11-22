import { logger } from "@/lib/logger";
import { SAVE_ERROR } from "./messages";
import { interpretCreate, interpretList } from "./responses";
import type { CreateResult, CreateTaskInput, ListResult } from "./types";

export const API_TIMEOUT_MS = 5000;

const PATH = "/tasks";

function baseUrl(): string | undefined {
  const raw = process.env.TASKBOARD27_API_URL;
  if (!raw) return undefined;
  return raw.replace(/\/$/, "");
}

function fail(method: string, reason: string, status?: number): void {
  logger.warn("tasks api call failed", { method, path: PATH, ...(status !== undefined ? { status } : {}), reason });
}

type Outcome = { status: number; body: unknown } | { error: string };

async function call(method: "GET" | "POST", base: string, payload?: CreateTaskInput): Promise<Outcome> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (payload) headers["Content-Type"] = "application/json";
  try {
    const res = await fetch(`${base}${PATH}`, {
      method,
      cache: "no-store",
      signal: AbortSignal.timeout(API_TIMEOUT_MS),
      headers,
      ...(payload ? { body: JSON.stringify({ title: payload.title, due_date: payload.due_date }) } : {}),
    });
    let body: unknown;
    try {
      body = await res.json();
    } catch {
      body = undefined;
    }
    return { status: res.status, body };
  } catch (err) {
    return { error: err instanceof Error ? err.name : "unknown" };
  }
}

export async function listTasks(): Promise<ListResult> {
  const base = baseUrl();
  if (!base) {
    logger.error("TASKBOARD27_API_URL is not set");
    return { ok: false };
  }
  const out = await call("GET", base);
  if ("error" in out) {
    fail("GET", out.error);
    return { ok: false };
  }
  const result = interpretList(out.status, out.body);
  if (!result.ok) fail("GET", "unexpected response", out.status);
  return result;
}

export async function postTask(input: CreateTaskInput): Promise<CreateResult> {
  const base = baseUrl();
  if (!base) {
    logger.error("TASKBOARD27_API_URL is not set");
    return { kind: "form-error", message: SAVE_ERROR };
  }
  const out = await call("POST", base, input);
  if ("error" in out) {
    fail("POST", out.error);
    return { kind: "form-error", message: SAVE_ERROR };
  }
  const result = interpretCreate(out.status, out.body);
  if (result.kind !== "created") fail("POST", result.kind, out.status);
  return result;
}
