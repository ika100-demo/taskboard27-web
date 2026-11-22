---
spec_id: 001-task-list-and-create-form-on-the-start
shape: web-nextjs
spec_hash: 8545247fa6a9
summary: Server-rendered task list and a create form on the start page, backed by the Task API through a Server Action
tasks:
  - id: t1
    title: Task types, messages, title validation and response mapping
    files: [lib/tasks/types.ts, lib/tasks/messages.ts, lib/tasks/validation.ts, lib/tasks/responses.ts]
    covers: [AC-001.1, AC-001.3, AC-001.4, AC-001.5, AC-001.6]
    parallel_safe: true
    depends_on: []
    done: true
  - id: t2
    title: Server-side Task API client and createTask Server Action
    files: [lib/tasks/api.ts, app/actions.ts, docs/env-vars.md]
    covers: [AC-001.1, AC-001.2, AC-001.4, AC-001.5, AC-001.6]
    parallel_safe: true
    depends_on: [t1]
    done: true
  - id: t3
    title: TaskBoard, TaskForm and TaskList client components and contract adapter
    files: [app/_components/task-board.tsx, app/_components/task-form.tsx, app/_components/task-list.tsx, app/_components/icons.tsx, app/globals.css, tests/contract/adapter.ts]
    covers: [AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.6]
    parallel_safe: true
    depends_on: [t1]
    done: true
  - id: t4
    title: Dynamic start page wiring list and form, template content removed
    files: [app/page.tsx, app/_components/feature-card.tsx, app/_components/icons.tsx, tests/page.test.tsx, e2e/home.spec.ts, e2e/smoke.spec.ts]
    covers: [AC-001.1, AC-001.2, AC-001.5]
    parallel_safe: true
    depends_on: [t2, t3]
---

# Plan — 001 Task list and create form on the start page

The contract, module signatures and DOM the tests rely on are in [design.md](design.md). Levels: t1 → t2, t3 → t4.

## t1 — Task types, messages, title validation and response mapping

**Files:** lib/tasks/types.ts, lib/tasks/messages.ts, lib/tasks/validation.ts, lib/tasks/responses.ts
**Covers:** AC-001.1, AC-001.3, AC-001.4, AC-001.5, AC-001.6
**Goal:** the pure, framework-free core that every other task imports: the types, the exact texts, the title rule, and the mapping from an HTTP answer to a `ListResult` or `CreateResult`.

**Implementation notes:**
- Write the types and constants exactly as in design.md (Types, Messages).
- `validateTitle`: it must be a string, trim it, count characters with `[...s].length`, and accept 1..200. `validateCreate` wraps it into `{ title: TITLE_MESSAGE }` or `{}`, and a missing `title` key is invalid.
- `isTask` checks `id`/`title` as strings and `due_date` as a string or null.
- `interpretList` and `interpretCreate` follow the table in design.md. `loc` is matched by its last element when it is an array, and by its value when it is a string. The first title item's `msg` is used verbatim.
- No imports from `next/*` or `react`, because the modules must load in a client bundle and in vitest.

**Done when:** the acceptance tests for validation (AC-001.3) and for response mapping (AC-001.4, AC-001.5, AC-001.6 at the function level) pass, and `devbox run quality` is clean.

## t2 — Server-side Task API client and createTask Server Action

**Files:** lib/tasks/api.ts, app/actions.ts, docs/env-vars.md
**Covers:** AC-001.1, AC-001.2, AC-001.4, AC-001.5, AC-001.6
**Goal:** the only code that talks to the Task API: `listTasks()` and `postTask()` over `fetch`, plus the `createTask` Server Action that re-validates the title before it calls `postTask`.

**Implementation notes:**
- Read `process.env.TASKBOARD27_API_URL` per call and strip a trailing `/`. When it is unset, log `logger.error` and return `{ ok: false }` or `SAVE_ERROR` without fetching.
- `fetch(url, { cache: "no-store", signal: AbortSignal.timeout(API_TIMEOUT_MS), headers })` with no retry. `POST` sends exactly `{"title", "due_date"}`.
- Parse the body with `res.json()` inside a try. A parse failure means `body = undefined`, and the result is passed to `interpretList` or `interpretCreate`. A thrown fetch (connection, abort, timeout) becomes `{ ok: false }` or `SAVE_ERROR`. Neither function ever throws.
- Log every failure with `logger.warn` (method, path, status, reason) and never the title.
- `app/actions.ts` starts with `"use server"`. `createTask` returns the `TITLE_MESSAGE` field-error without a fetch when `validateTitle` fails. Otherwise it sends the trimmed title, with `due_date: input.due_date || null`.
- `docs/env-vars.md` gets a "Task API" table with `TASKBOARD27_API_URL` (no default; set by the gitops entry to `http://taskboard27-api`; server-side only, never `NEXT_PUBLIC_`; unset means the list and saves show their error messages).

**Done when:** the acceptance tests that drive `listTasks`/`postTask`/`createTask` with a stubbed `globalThis.fetch` pass. These cover the request shape (AC-001.2), statuses, non-JSON bodies, network errors and the timeout (AC-001.4, AC-001.5, AC-001.6), and that an invalid title sends no request.

## t3 — TaskBoard, TaskForm and TaskList client components and contract adapter

**Files:** app/_components/task-board.tsx, app/_components/task-form.tsx, app/_components/task-list.tsx, app/_components/icons.tsx, app/globals.css, tests/contract/adapter.ts
**Covers:** AC-001.1, AC-001.2, AC-001.3, AC-001.4, AC-001.5, AC-001.6
**Goal:** the interactive part of the start page as ux.md specifies it, testable on its own because the create function is a prop.

**Implementation notes:**
- `TaskBoard` (`"use client"`) holds `ListResult` in state, initialised from `initial`. `onCreated` appends to `tasks` only when `ok`, so a load-error view stays as it is. It renders the `Add a task` section with `TaskForm` and the `Your tasks` section with `TaskList`, plus the hidden `Task added` live region.
- `TaskForm` uses controlled inputs and `onSubmit` with `preventDefault`. It clears both messages, runs `validateTitle`, and calls `createAction` only when the title is valid, inside `useTransition`. A pending ref blocks double submits.
- Results: `created` clears the fields, calls `onCreated` and focuses Title. `field-error` shows the message at Title and focuses Title. `form-error` shows `role="alert"` and keeps focus on the button. Values are kept on every error.
- Attributes as in design.md "DOM the tests can rely on": ids, `aria-invalid`/`aria-describedby`, `aria-live`, `aria-busy`/`aria-disabled`, and no `required`/`maxlength`.
- `TaskList` renders a `<ul>` with title and `<time dateTime>` or `No due date`, otherwise `No tasks yet` or `LOAD_ERROR` in a `<p>`.
- Add `WarningIcon` (Lucide triangle-alert, `aria-hidden`) to `icons.tsx` and keep the existing icons, because `app/page.tsx` still imports them until t4.
- `globals.css`: styles for the form, the field-error state (a thicker border, not only colour), the message, the list (the date is right-aligned when wide and wraps when narrow, long titles wrap), and `.visually-hidden`. Keep AA contrast in both themes.
- Wire `tests/contract/adapter.ts` as in design.md (Contract adapter).

**Done when:** `tests/contract.test.ts` passes (all `001-persistent-tasks-and-web-task-list:*` cases), the component-level acceptance tests for AC-001.1 to AC-001.6 pass, and `devbox run quality` is clean.

## t4 — Dynamic start page wiring list and form, template content removed

**Files:** app/page.tsx, app/_components/feature-card.tsx, app/_components/icons.tsx, tests/page.test.tsx, e2e/home.spec.ts, e2e/smoke.spec.ts
**Covers:** AC-001.1, AC-001.2, AC-001.5
**Goal:** `/` becomes the task page, fetched fresh on every request, and the template's landing page goes away together with the tests that asserted it.

**Implementation notes:**
- `app/page.tsx`: `export const dynamic = "force-dynamic"`. `async HomePage()` awaits `listTasks()` and renders `<main id="main-content">` with h1 `Tasks` and `<TaskBoard initial={result} createAction={createTask} />`. Remove the hero, "What's included" and "Get started" sections.
- Delete `app/_components/feature-card.tsx`. Remove the icons nobody imports any more from `icons.tsx`, keeping `WarningIcon` and the licence notice.
- Rewrite `tests/page.test.tsx` for the new page: render `await HomePage()` with `fetch` stubbed. Check the main landmark id, the single h1 `Tasks`, the h2 order `Add a task` then `Your tasks`, and the load-error view when fetch rejects.
- Rewrite `e2e/home.spec.ts`: keep the landmark, 404, health and phone-width checks, and replace the `taskboard27-web` heading and `Check health` link assertions, which no longer exist.
- `e2e/smoke.spec.ts`: keep the root check, and add a read-only `@smoke` test that the `Your tasks` region is shown and does not contain `Tasks could not be loaded. Try again later.`. No `@writes` test (design.md Decisions).

**Done when:** the page-level acceptance tests for AC-001.1, AC-001.2 and AC-001.5 pass, `tests/page.test.tsx` and `devbox run e2e` pass, and `devbox run ci` is green (coverage at least 80% on `app/**`).
