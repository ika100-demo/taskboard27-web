import { TITLE_MESSAGE } from "./messages";

export const TITLE_MAX = 200;

/** null when valid, else TITLE_MESSAGE. Valid = a string whose trimmed length is 1..200 characters. */
export function validateTitle(title: unknown): string | null {
  if (typeof title !== "string") return TITLE_MESSAGE;
  const length = [...title.trim()].length;
  return length >= 1 && length <= TITLE_MAX ? null : TITLE_MESSAGE;
}

/** Contract-shaped: {} when valid, else { title: TITLE_MESSAGE }. A missing title is invalid. */
export function validateCreate(body: Record<string, unknown>): Record<string, string> {
  const message = validateTitle(body.title);
  return message === null ? {} : { title: message };
}
