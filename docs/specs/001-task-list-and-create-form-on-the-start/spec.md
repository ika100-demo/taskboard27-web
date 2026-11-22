---
spec_id: 001-task-list-and-create-form-on-the-start
title: Task list and create form on the start page
status: done
priority: P1
shape: web-nextjs
parent: ika100-demo/taskboard27-gitops:001-persistent-tasks-and-web-task-list
---

# 001 — Task list and create form on the start page

## Problem

The Task API keeps tasks only in its process memory today, so every restart or redeploy empties the board, and two running instances would each show different tasks. On top of that, the only way to see or add a task is to call the API by hand; the website shows no tasks at all. People who want to use taskboard27 to note what they have to do lose their tasks and have no screen to work on. Keeping tasks in a Postgres database and giving the website a task list with a create form makes the board usable by people, not only by API clients.

## System context

Slice of the system plan `001-persistent-tasks-and-web-task-list` in `ika100-demo/taskboard27-gitops` for `taskboard27-web` (web-nextjs). The system criteria and the contract below are binding: every criterion of this spec implements one of them and names it: `(system AC-<NNN>.<n>)`.

### System criteria

- **AC-001.5** Given tasks are stored, when a person opens the website's start page, then it lists every task oldest first, each showing its title and its due date as `YYYY-MM-DD` or the text `No due date`; with no tasks stored it shows the text `No tasks yet`.
- **AC-001.6** Given the website's start page is open, when a person enters the title `Buy milk`, optionally picks a due date, and presses `Add task`, then the task appears at the end of the list without a full page reload, the form is emptied, and after reloading the page the task is still listed with the same title and due date.
- **AC-001.7** Given the website's start page is open, when a person submits the form with an empty title, a title of only spaces, or a title longer than 200 characters after trimming, then the text `Enter a title of 1 to 200 characters` appears at the title field, the entered values stay in the form, and no task is created.
- **AC-001.8** Given the API is unreachable or answers an error, when a person opens the start page, then the list area shows `Tasks could not be loaded. Try again later.`; when a person submits a valid task and the API answers `409`, then the form shows `Task limit of 1000 reached.`, and for any other failure `The task could not be saved. Try again.`, in both cases keeping the entered values in the form.

### Contract

No authentication (A8). JSON in and out, `Content-Type: application/json`. Provider: `taskboard27-api`; consumer: `taskboard27-web`, which calls it server-side at `${TASKBOARD27_API_URL}` (`http://taskboard27-api` in the cluster).

**Task object** (every task in a response): `{"id": string (UUID), "title": string (trimmed, 1..200 characters), "due_date": "YYYY-MM-DD" | null}`. No other fields.

**`POST /tasks`**

Request body (object; unknown fields ignored):

| Field | Type | Rules |
|---|---|---|
| `title` | string, required | trimmed; after trimming 1..200 characters; stored trimmed |
| `due_date` | string or null, optional (default `null`) | exactly `YYYY-MM-DD` and a real calendar date; past dates accepted |

Responses:

- `201` → the created Task object; it is stored and every instance lists it from then on.
- `422` → validation failed, nothing stored. FastAPI's standard body: `{"detail": [{"type": string, "loc": ["body", "<field>"], "msg": string, "input": any}]}`. For the title rules below, `type` is the rule id (`title-required`, `title-min`, `title-max`) and `msg` is `"Enter a title of 1 to 200 characters"`. A title that is not a string, and every `due_date` failure, keep pydantic's own `type`/`msg`. Validation runs before the limit and storage checks.
- `409` → `{"detail": "task limit of 1000 reached"}`: 1000 tasks are already stored; nothing stored. The limit holds across instances (the count and the insert are serialised in the database).
- `503` → `{"detail": "task storage unavailable"}`: the database cannot be reached or does not answer in time; nothing stored.

**`GET /tasks`**

- `200` → JSON array of every stored Task object, oldest first (creation order, stable across instances and restarts); `[]` when none. Unpaginated, at most 1000 entries.
- `503` → `{"detail": "task storage unavailable"}`.

**`GET /ready`** → `200` when the database answers a trivial query, else `503` (the pod leaves the Service until it is reachable again). **`GET /health`** stays `200` while the process runs, independent of the database, so an outage does not restart pods.

**Website start page** (`GET /` on taskboard27-web): form above the list; title field, date input (`type="date"`, sends `YYYY-MM-DD` or `null`), button `Add task`; texts exactly as in A9.

### Rules

```yaml
rules:
  - id: title-required
    endpoint: POST /tasks
    field: title
    kind: required
    value: true
    provider: taskboard27-api
    consumers: [taskboard27-web]
  - id: title-min
    endpoint: POST /tasks
    field: title
    kind: min_length
    value: 1
    provider: taskboard27-api
    consumers: [taskboard27-web]
  - id: title-max
    endpoint: POST /tasks
    field: title
    kind: max_length
    value: 200
    provider: taskboard27-api
    consumers: [taskboard27-web]
```

Prose rules no tool checks: lengths count characters after trimming surrounding whitespace, so a title of only spaces violates `title-min`; `due_date` is a calendar date `YYYY-MM-DD` or `null`, which the website guarantees by its date input (A7), and the API keeps rejecting anything else with `422` on `due_date`.

### Errors

```yaml
errors:
  status: 422
  body:
    list: detail
    field: loc
    rule: type
    message: msg
  unlisted:
    message: "The task could not be saved. Try again."
```

`loc` is a path (`["body", "title"]`); a caller matches it by its last element. The website treats responses as follows: `422` with a `detail` item whose `loc` ends in `title` shows that item's `msg` at the title field; `409` shows `Task limit of 1000 reached.` on the form; every other answer of `POST /tasks` (`503`, `500`, a `422` without a title item, a body that is not JSON, any unlisted status) shows `The task could not be saved. Try again.` on the form. For `GET /tasks`, anything but `200` with a JSON array shows `Tasks could not be loaded. Try again later.` in the list area. In every failure case the entered form values stay.

### Timeouts

- Website → `GET /tasks` and `POST /tasks`: 5 seconds per call (connect plus response), no retry. On timeout or connection failure the website shows the load message (list) or the save message (form), as for any unlisted answer. A `POST` that timed out may still have been stored; the person sees it after a reload (no retry, so no duplicate is created by the website).
- API → Postgres: connect timeout 3 seconds, statement timeout 3 seconds; on either the request is answered `503 "task storage unavailable"`, so the API answers well inside the website's 5 seconds (within 6 seconds in the worst case of connect plus statement). `/ready` uses the same limits. When the database comes back, the next request reconnects; no restart of the API is needed.
- Website when the API is down or slow: the start page still renders (form plus load message) within about 5 seconds; `/api/ready` of the website does not depend on the API.

### Contract rules

Copy: `contract/001-persistent-tasks-and-web-task-list.json`, from plan `001-persistent-tasks-and-web-task-list` at `ika100-demo/taskboard27-gitops@805e05a`. The repo's contract check reads it.

| Rule | Endpoint | Field | Kind | Value | Status | Role |
|---|---|---|---|---|---|---|
| title-max | POST /tasks | title | max_length | 200 | 422 | consumer |
| title-min | POST /tasks | title | min_length | 1 | 422 | consumer |
| title-required | POST /tasks | title | required | True | 422 | consumer |

Errors: status 422; body `detail[]` of objects with `loc`, `type`, `msg`; responses the contract does not list: show "The task could not be saved. Try again.".

### Provided by the system

The gitops part of this plan wires these for this repo; rely on them, do not ask for them again:

- env `TASKBOARD27_API_URL=http://taskboard27-api`

### Notes for this repo

The browser never calls the Task API directly: the start page (server-rendered, dynamic) and the create action
run on the web server and call `${TASKBOARD27_API_URL}/tasks` (env var set by the gitops entry; document it in
docs/env-vars.md). No NEXT_PUBLIC_ variable for the API URL.

## Stories

<!-- As a <persona>, I want <goal>, so that <benefit>. -->

## Acceptance criteria

- **AC-001.1** Given the Task API's `GET /tasks` answers `200` with tasks, when a person opens the start page, then below the form it lists every task in the order the API returned (oldest first), each with its title and its `due_date` as `YYYY-MM-DD` or the text `No due date`; with `[]` it shows `No tasks yet`; the list is fetched on every page request, so a reload shows tasks created elsewhere (system AC-001.5)
- **AC-001.2** Given the start page is open, when a person enters the title `Buy milk`, optionally picks a due date in the date input, and presses `Add task`, then the website sends `POST /tasks` with `{"title": <trimmed title>, "due_date": "YYYY-MM-DD" or null}`, and on `201` the returned task appears at the end of the list without a full page reload and the form is emptied; after reloading the page the task is still listed with the same title and due date (system AC-001.6)
- **AC-001.3** Given the start page is open, when a person submits the form with an empty title, a title of only spaces, or a title longer than 200 characters after trimming, then `Enter a title of 1 to 200 characters` appears at the title field, the entered values stay in the form, and no request is sent to the Task API (system AC-001.7)
- **AC-001.4** Given a valid submit, when the Task API answers `422` with a `detail` item whose `loc` ends in `"title"`, then that item's `msg` appears at the title field and the entered values stay in the form (system AC-001.7)
- **AC-001.5** Given the Task API is unreachable, does not answer within 5 seconds, or answers `GET /tasks` with anything but `200` and a JSON array, when a person opens the start page, then the list area shows `Tasks could not be loaded. Try again later.` and the create form is still shown (system AC-001.8)
- **AC-001.6** Given a valid submit, when the Task API answers `409`, then the form shows `Task limit of 1000 reached.`; when it answers any other non-`201` status not covered above (including `503` and `500`), is unreachable or does not answer within 5 seconds, then the form shows `The task could not be saved. Try again.`; in both cases the entered values stay in the form and the list is unchanged (system AC-001.8)

## Non-goals

## Assumptions

<!-- Spec 149: decisions taken by default, approved with the spec. One bullet each: - **A1** <the decision> (other option: <…>; affects AC-…). A revised one is struck through (~~…~~), never deleted. -->

## Open questions

<!-- Only what may not be decided by default (spec 149): security or access, money, destroying or migrating data, or a request too ambiguous to build. Approval is refused while any is open. Strike answered ones (~~…~~) and fold the answer into the criteria. -->

<!-- Priority levels (spec 196) for the product-manager's PRIORITY line: P0 an outage, data loss, a security problem, or something that blocks all other work; P1 a normal bug or feature; the fallback when nothing signals urgency; P2 cosmetic, a convenience, or something with an easy workaround. A reason is "P<n>: <phrase>", one of: P0: outage, data loss, security problem, blocks all other work; P1: normal bug or feature; P2: cosmetic, convenience, easy workaround. -->

## Changelog

- 2026-11-22 created from the system plan, with its criteria (spec 147)
- 2026-11-22 approved
- 2026-11-22 building
- 2026-11-22 done
