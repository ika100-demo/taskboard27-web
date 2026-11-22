# Design — 001 Task list and create form on the start page

## Decisions

- The browser never calls the Task API. The start page is a dynamic Server Component that calls `GET /tasks` on every request. The create path is a Server Action (`app/actions.ts`) that calls `POST /tasks`. This follows the spec's "Notes for this repo", needs no `NEXT_PUBLIC_*` variable and no CORS, and keeps the API URL server-side.
- The mapping from an HTTP answer to what the person sees is pure and in one place (`lib/tasks/responses.ts`: `interpretList`, `interpretCreate`). The server code, the form and the contract adapter all use it, so the contract check exercises the same code the page runs.
- The client form gets its create function as a prop (`createAction`). The page passes the real Server Action; tests and `tests/contract/adapter.ts` pass a stub that returns `interpretCreate(status, body)`. That way the form can be tested without a network, a Next runtime or module mocks.
- Title validation (`lib/tasks/validation.ts`) runs in the browser before submit (AC-001.3: no request) and again in the Server Action, because nothing a client sends is trusted. Both use the same function and the same message.
- `loc` is matched by its last element when it is an array, and by its value when it is a string. The contract engine's response case sends `loc: "title"` and the API sends `["body", "title"]`, so both must work (AC-001.4).
- If `TASKBOARD27_API_URL` is unset, there is no default: every call counts as unreachable (load message or save message) and logs one `error` line. A silent localhost default would hide a missing gitops wiring.
- 5 s per call through `AbortSignal.timeout(5000)`, with no retry (spec, Timeouts). `/api/ready` stays independent of the API (spec, Timeouts).
- There is no `@writes` smoke test. The API has no delete, so every smoke run would leave a task behind, and the 1000-task limit would fill up over time. Instead a read-only smoke check confirms that the list loads, which shows the web-to-API wiring works in every environment.
- The template's landing content is removed (ux.md S1). `feature-card.tsx` and the unused icons are deleted, so the 80% coverage gate on `app/**` is not dragged down by dead code. A `WarningIcon` is added, because ux.md wants an `aria-hidden` warning icon on every message.
- No ADR: every choice here is local to this feature.

## Modules

| Module | Responsibility | New / changed |
|---|---|---|
| `lib/tasks/types.ts` | `Task`, `CreateTaskInput`, `ListResult`, `CreateResult` | new |
| `lib/tasks/messages.ts` | the exact user-visible texts | new |
| `lib/tasks/validation.ts` | `validateTitle`, `validateCreate` (contract-shaped) | new |
| `lib/tasks/responses.ts` | `isTask`, `interpretList`, `interpretCreate` (pure) | new |
| `lib/tasks/api.ts` | server-only HTTP client: `listTasks`, `postTask` | new |
| `app/actions.ts` | `"use server"` `createTask` | new |
| `app/_components/task-board.tsx` | `"use client"`: owns the task array, renders form + list | new |
| `app/_components/task-form.tsx` | `"use client"`: fields, validation, pending, messages, focus | new |
| `app/_components/task-list.tsx` | list / `No tasks yet` / load error | new |
| `app/_components/icons.tsx` | adds `WarningIcon`; later drops icons nobody uses | changed |
| `app/page.tsx` | dynamic start page: `listTasks()` then `<TaskBoard>` | changed |
| `app/globals.css` | form, field-error, task-list, visually-hidden styles | changed |
| `tests/contract/adapter.ts` | wires the contract check to `validateCreate` and `TaskBoard` | changed |
| `docs/env-vars.md` | documents `TASKBOARD27_API_URL` | changed |

## Contract

### Upstream (Task API, binding from the spec)

`GET ${TASKBOARD27_API_URL}/tasks` and `POST ${TASKBOARD27_API_URL}/tasks`, both with `Accept: application/json`, and `POST` also with `Content-Type: application/json`. The `POST` body is exactly `{"title": <trimmed title>, "due_date": "YYYY-MM-DD" | null}`. Each call is made with `cache: "no-store"` and `signal: AbortSignal.timeout(5000)`. A trailing `/` on the base URL is tolerated.

### Types (`lib/tasks/types.ts`)

```ts
export interface Task { id: string; title: string; due_date: string | null }
export interface CreateTaskInput { title: string; due_date: string | null }
export type ListResult = { ok: true; tasks: Task[] } | { ok: false };
export type CreateResult =
  | { kind: "created"; task: Task }
  | { kind: "field-error"; field: "title"; message: string }
  | { kind: "form-error"; message: string };
```

### Messages (`lib/tasks/messages.ts`)

```ts
export const TITLE_MESSAGE = "Enter a title of 1 to 200 characters";
export const LOAD_ERROR = "Tasks could not be loaded. Try again later.";
export const LIMIT_MESSAGE = "Task limit of 1000 reached.";
export const SAVE_ERROR = "The task could not be saved. Try again.";
export const EMPTY_LIST = "No tasks yet";
export const NO_DUE_DATE = "No due date";
export const TASK_ADDED = "Task added"; // visually hidden live region only
```

### Validation (`lib/tasks/validation.ts`, client-safe)

```ts
export const TITLE_MAX = 200;
/** null when valid, else TITLE_MESSAGE. Valid = a string whose trimmed length is 1..200 (in characters, not UTF-16 units: [...s].length). */
export function validateTitle(title: unknown): string | null;
/** Contract-shaped: {} when valid, else { title: TITLE_MESSAGE }. A missing title is invalid. */
export function validateCreate(body: Record<string, unknown>): Record<string, string>;
```

### Response mapping (`lib/tasks/responses.ts`, pure)

```ts
export function isTask(v: unknown): v is Task;   // id string, title string, due_date string|null
export function interpretList(status: number, body: unknown): ListResult;
//   200 and Array.isArray(body) and every item isTask -> { ok: true, tasks: body } (order kept)
//   anything else -> { ok: false }
export function interpretCreate(status: number, body: unknown): CreateResult;
//   201 and isTask(body)                                    -> created
//   422 and body.detail is an array with an item whose loc's
//       last element (array) or value (string) is "title"
//       and whose msg is a string                           -> field-error, message = that msg verbatim (first such item)
//   409                                                     -> form-error LIMIT_MESSAGE
//   anything else (incl. 201 with a non-Task body, 422 without a title item, 500, 503) -> form-error SAVE_ERROR
```

### Server-only client (`lib/tasks/api.ts`, `import "server-only"` is not used, so that vitest can import it; it is only imported by `app/page.tsx` and `app/actions.ts`)

```ts
export const API_TIMEOUT_MS = 5000;
export async function listTasks(): Promise<ListResult>;              // never throws
export async function postTask(input: CreateTaskInput): Promise<CreateResult>; // never throws
```

Both read `process.env.TASKBOARD27_API_URL` on every call, not at import time. A network error, an abort or timeout, or a body that is not JSON is passed to `interpret*` as `body = undefined`, or, when nothing was answered, becomes `{ ok: false }` or `SAVE_ERROR` directly. Each failure logs one `logger.warn("tasks api call failed", { method, path: "/tasks", status?, reason })`, and an unset URL logs `logger.error("TASKBOARD27_API_URL is not set")`. The log never contains the task title.

### Server Action (`app/actions.ts`)

```ts
"use server";
export async function createTask(input: CreateTaskInput): Promise<CreateResult>;
//   validateTitle(input.title) fails -> { kind: "field-error", field: "title", message: TITLE_MESSAGE } (no API call)
//   else postTask({ title: input.title.trim(), due_date: input.due_date || null })
```

### Components

```ts
// app/_components/task-board.tsx ("use client")
export function TaskBoard(props: { initial: ListResult; createAction: (input: CreateTaskInput) => Promise<CreateResult> }): JSX.Element;
// app/_components/task-form.tsx ("use client")
export function TaskForm(props: { createAction: (input: CreateTaskInput) => Promise<CreateResult>; onCreated: (task: Task) => void }): JSX.Element;
// app/_components/task-list.tsx
export function TaskList(props: { result: ListResult }): JSX.Element;
// app/page.tsx
export const dynamic = "force-dynamic";
export default async function HomePage(): Promise<JSX.Element>;   // await listTasks(); <TaskBoard initial={...} createAction={createTask} />
```

### DOM the tests can rely on (from ux.md)

- `main#main-content` holds the h1 `Tasks`, a `section` labelled by the h2 `Add a task` (role `region`, name `Add a task`), and a `section` labelled by the h2 `Your tasks` (role `region`, name `Your tasks`).
- The form has a textbox with the label `Title` and no `required` or `maxlength` attribute, a date input `type="date"` with the label `Due date (optional)`, and a button `type="submit"` named exactly `Add task`.
- Field message: `<p id="task-title-error">` inside an `aria-live="polite"` container directly under the title input. While it is shown, the input has `aria-invalid="true"` and `aria-describedby="task-title-error"`. The message is the full text, preceded by an `aria-hidden` `WarningIcon`.
- Form message: an element with `role="alert"` directly under the button.
- While saving, the button has `aria-disabled="true"` and the form `aria-busy="true"`, and a second submit is ignored.
- List: a `<ul>` in `Your tasks`, one `<li>` per task in API order. Each `<li>` holds the title text and either `<time dateTime="YYYY-MM-DD">YYYY-MM-DD</time>` or the text `No due date`. Otherwise the section holds a `<p>` with `No tasks yet` or with the load error.
- After `created`: the task is appended (a `No tasks yet` view becomes a one-item list), both fields are cleared, focus goes to Title, and a visually hidden `aria-live="polite"` region reads `Task added`. If the list area shows the load error, it keeps showing it (ux.md States).
- After `field-error`: the message is shown at Title, the values are kept and focus goes to Title. After `form-error`: the message is shown in the form `role="alert"`, the values are kept, the list is unchanged and focus stays on the button. Every submit clears both messages first.

### Contract adapter (`tests/contract/adapter.ts`)

- `base("POST /tasks")` returns `{ title: "Buy milk", due_date: null }`.
- `validate(_, body)` returns `validateCreate(body)`.
- `showResponse(_, { status, body })` renders `<TaskBoard initial={{ ok: true, tasks: [] }} createAction={async () => interpretCreate(status, body)} />`, types a valid title, presses `Add task`, waits for the action to settle, and returns `{ fields: { title: <field message text> } | {}, form: <role=alert text> | undefined }`.
