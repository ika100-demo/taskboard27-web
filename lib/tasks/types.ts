export interface Task {
  id: string;
  title: string;
  due_date: string | null;
}
export interface CreateTaskInput {
  title: string;
  due_date: string | null;
}
export type ListResult = { ok: true; tasks: Task[] } | { ok: false };
export type CreateResult =
  | { kind: "created"; task: Task }
  | { kind: "field-error"; field: "title"; message: string }
  | { kind: "form-error"; message: string };
