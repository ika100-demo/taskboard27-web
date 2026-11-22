"use server";

import { postTask } from "@/lib/tasks/api";
import { TITLE_MESSAGE } from "@/lib/tasks/messages";
import type { CreateResult, CreateTaskInput } from "@/lib/tasks/types";
import { validateTitle } from "@/lib/tasks/validation";

export async function createTask(input: CreateTaskInput): Promise<CreateResult> {
  if (validateTitle(input?.title) !== null) {
    return { kind: "field-error", field: "title", message: TITLE_MESSAGE };
  }
  return postTask({ title: input.title.trim(), due_date: input.due_date || null });
}
