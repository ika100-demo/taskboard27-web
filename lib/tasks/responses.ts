import { LIMIT_MESSAGE, SAVE_ERROR } from "./messages";
import type { CreateResult, ListResult, Task } from "./types";

export function isTask(v: unknown): v is Task {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    (typeof o.due_date === "string" || o.due_date === null)
  );
}

export function interpretList(status: number, body: unknown): ListResult {
  if (status === 200 && Array.isArray(body) && body.every(isTask)) {
    return { ok: true, tasks: body };
  }
  return { ok: false };
}

function isTitleLoc(loc: unknown): boolean {
  if (Array.isArray(loc)) return loc[loc.length - 1] === "title";
  return loc === "title";
}

function titleMessage(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const detail = (body as Record<string, unknown>).detail;
  if (!Array.isArray(detail)) return undefined;
  for (const item of detail) {
    if (typeof item !== "object" || item === null) continue;
    const { loc, msg } = item as Record<string, unknown>;
    if (isTitleLoc(loc) && typeof msg === "string") return msg;
  }
  return undefined;
}

export function interpretCreate(status: number, body: unknown): CreateResult {
  if (status === 201 && isTask(body)) return { kind: "created", task: body };
  if (status === 422) {
    const message = titleMessage(body);
    if (message !== undefined) return { kind: "field-error", field: "title", message };
  }
  if (status === 409) return { kind: "form-error", message: LIMIT_MESSAGE };
  return { kind: "form-error", message: SAVE_ERROR };
}
