# Verification — 001 Task list and create form on the start page

**Result:** pass
**Commit:** 4426e14 · **Base:** 64c90a7 · **Trace:** 6/6 criteria named by tests

| Criterion | Verdict | Tests | Implementation | Notes |
|---|---|---|---|---|
| AC-001.1 | met | `tests/page.test.tsx::AC-001.1 owns the main landmark and lists the API's tasks in order below the form`, `::AC-001.1 shows No tasks yet for an empty list`, `::AC-001.1 fetches the list on every page request`; `tests/task-board.test.tsx::AC-001.1 renders each task with its title and due date or No due date, in the given order`; `tests/tasks-api.test.ts::AC-001.1 calls GET /tasks without caching and returns the tasks in API order`; `tests/tasks-core.test.ts::AC-001.1 keeps the order the API returned`; `e2e/smoke.spec.ts::AC-001.1 the task list loads from the Task API @smoke` | `app/page.tsx:5` (`force-dynamic`), `app/page.tsx:8`; `lib/tasks/api.ts:28` (`no-store`), `lib/tasks/api.ts:45`; `lib/tasks/responses.ts:14`; `app/_components/task-list.tsx:8-23` | order, title, `YYYY-MM-DD` in `<time>` / `No due date`, `No tasks yet`, form above list, two requests → two fetches all asserted |
| AC-001.2 | met | `tests/tasks-api.test.ts::AC-001.2 sends POST /tasks with exactly the title and due_date as JSON`, `::AC-001.2 posts the trimmed title and turns an empty due date into null`; `tests/task-board.test.tsx::AC-001.2 sends the trimmed title and date, appends the returned task and empties the form`, `::AC-001.2 sends due_date null when no date is picked and replaces No tasks yet`; `tests/tasks-core.test.ts::AC-001.2 maps 201 with a task to created` | `lib/tasks/api.ts:31`; `app/actions.ts:12`; `app/_components/task-form.tsx:27,37-45`; `app/_components/task-board.tsx:20-23` | client-side `preventDefault` (no reload); persistence after reload is the API's part, the web side re-fetches on every request (AC-001.1 test) |
| AC-001.3 | met | `tests/task-board.test.tsx::AC-001.3 shows the title message and calls nothing for an empty, blank or too long title, keeping the values`; `tests/tasks-api.test.ts::AC-001.3 sends no request for an empty, blank or too long title`; `tests/tasks-core.test.ts::AC-001.3 rejects ...`, `::AC-001.3 counts 200 characters after trimming as the maximum`; `e2e/home.spec.ts::AC-001.3 an empty title shows the message ...` | `lib/tasks/validation.ts:6-10`; `app/_components/task-form.tsx:31-35`; `app/actions.ts:9-11`; no `required`/`maxlength`, `noValidate` at `task-form.tsx:59` | boundaries 200/201 incl. astral characters; values kept; createAction and fetch not called |
| AC-001.4 | met | `tests/tasks-core.test.ts::AC-001.4 shows the msg of a 422 title item, matching loc by its last element or value`, `::AC-001.4 uses the first title item verbatim`; `tests/tasks-api.test.ts::AC-001.4 maps a 422 title item to a field error`; `tests/task-board.test.tsx::AC-001.4 shows the msg of a 422 title item at the title field and keeps the values` | `lib/tasks/responses.ts:21-43`; `app/_components/task-form.tsx:46-48,71-81` | message verbatim in `#task-title-error`, `aria-describedby` set, values kept |
| AC-001.5 | met | `tests/page.test.tsx::AC-001.5 shows the load error in the list area and still shows the form when the API fails`, `::AC-001.5 shows the load error when the API is unreachable`; `tests/tasks-api.test.ts::AC-001.5 returns ok:false for a non-200 answer, a non-JSON body, a network error and a timeout`, `::AC-001.5 aborts the call at 5000 ms and not before ...`, `::AC-001.5 returns ok:false without fetching when the API URL is unset`; `tests/tasks-core.test.ts::AC-001.5 fails for anything but 200 with an array of tasks`; `tests/task-board.test.tsx::AC-001.5 shows the load error ...` (x2); `e2e/home.spec.ts::AC-001.5 home page renders ...` | `lib/tasks/api.ts:6,29,40-55`; `lib/tasks/responses.ts:14-19`; `app/_components/task-list.tsx:7` | 5 s boundary asserted (4999 ms not aborted, 5000 ms aborted) |
| AC-001.6 | met | `tests/tasks-core.test.ts::AC-001.6 maps 409 to the limit message`, `::AC-001.6 maps every other answer to the save error`; `tests/tasks-api.test.ts::AC-001.6 maps 409 ...`, `::AC-001.6 maps 503, a non-JSON body, a network error and a timeout to the save error, without retry`, `::AC-001.6 aborts the create call at 5000 ms ...`; `tests/task-board.test.tsx::AC-001.6 shows the limit message ...`, `::AC-001.6 shows the save error ...`, `::AC-001.6 clears an earlier message ...` | `lib/tasks/responses.ts:44-45`; `lib/tasks/api.ts:61-75`; `app/_components/task-form.tsx:49-51,96-101` | 409, 503, 500, 418, 422 without title item, unreachable, timeout covered; values and list unchanged asserted; one call per submit (no retry) |

Observations (no verdict change):

- `e2e/home.spec.ts::AC-001.5 home page renders ...` checks only that the form and list area are present, not the load error text (its comment says so); AC-001.5's load-error outcome is asserted by `tests/page.test.tsx`.
- `e2e/smoke.spec.ts::AC-001.1 ...` asserts the `Your tasks` region is shown without the load error; it would also pass with an empty region. AC-001.1 is not a `(smoke)` criterion and is fully asserted by the unit tests; asserting "a list or `No tasks yet`" would make the smoke check stronger.
- The h1 `Tasks` carries no `section-title`/`hero-title` class (ux.md S1 item 2); cosmetic, no criterion affected.

## Non-goals

The spec lists none. No template-owned layout (`SiteHeader`, `SiteFooter`, skip link, `app/layout.tsx`) was changed; only the page's own landing content was replaced, as ux.md S1 asks. No `NEXT_PUBLIC_*` variable; the browser never calls the Task API (`app/actions.ts:1` `"use server"`, `lib/tasks/api.ts` imported only by `app/page.tsx` and `app/actions.ts`). ✔

## Deviations from the plan

- `tests/task-board.test.tsx`, `tests/tasks-api.test.ts`, `tests/tasks-core.test.ts` are in no task's `files`: acceptance tests from the red phase; acceptable. Since the review commit `9e08786`, only a type-only cast in `tests/task-board.test.tsx:15` changed.
- `contract/001-persistent-tasks-and-web-task-list.json`: written by `/component:spec --from-plan`; acceptable.
- `docs/backlog.md`: generated by `cplat spec index`; acceptable (it shows status `approved` while spec.md says `building`, the next index run refreshes it).
- `.secrets.baseline.json`: baselines the contract's `commit` field (`805e05a...`, a git SHA, line 2); a true false positive; acceptable.
- All tasks t1 to t4 are `done: true`. Every screen and state of ux.md is built (list states empty/error/success/after-add including the load-error-kept case at `task-board.tsx:21`; form states saving `aria-busy`/`aria-disabled`, success, invalid, rejected, limit, save failed; focus rules at `task-form.tsx:33,45,48`). None.

## Contract

Matches `design.md`: types, messages, `validateTitle`/`validateCreate`, `interpretList`/`interpretCreate`, `listTasks`/`postTask` (`Accept`, `Content-Type`, `no-store`, `AbortSignal.timeout(5000)`, trailing `/` tolerated, URL read per call), `createTask`, component props, contract adapter as specified. ✔

## Mutation check (report only)

Skipped: no mutation check for shape web-nextjs yet.
