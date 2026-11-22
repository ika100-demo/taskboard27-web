---
spec_id: 001-task-list-and-create-form-on-the-start
spec_hash: 8545247fa6a9
---

# UX — 001 Task list and create form on the start page

## Flows

The spec has no stories, so the flows follow the person's paths on the start page, one per outcome the criteria describe.

### F1 See the tasks

1. The person opens `/` (from a link, a bookmark or the header brand link). (AC-001.1, AC-001.5)
2. The server fetches `GET /tasks` on every request. Nothing is cached, so a reload shows tasks created elsewhere. (AC-001.1)
3. The page shows the form, with the task list below it in the order the API returned (oldest first). With `[]` the list area shows `No tasks yet`. (AC-001.1)
4. If the fetch fails, times out after 5 s or returns something other than a `200` JSON array, the list area shows `Tasks could not be loaded. Try again later.` The form is still shown and still works. (AC-001.5)

### F2 Add a task

1. The person types a title (for example `Buy milk`) into the **Title** field. (AC-001.2)
2. Optionally, the person picks a date in the **Due date** date input. (AC-001.2)
3. The person presses **Add task**, either by clicking it or by pressing Enter in a field. (AC-001.2)
4. The title is checked in the browser after trimming. It passes, so the submit goes to the server action, which sends `POST /tasks` with `{"title": <trimmed>, "due_date": "YYYY-MM-DD" | null}`. While the request runs, the button cannot be pressed again. (AC-001.2)
5. On `201`, the returned task is added at the end of the list without a full page reload. If the list showed `No tasks yet`, that text is replaced by the list. Both fields are emptied and focus goes back to **Title**. (AC-001.2)
6. When the person reloads, the task is still listed with the same title and due date (F1). (AC-001.2)

### F3 Invalid title

1. The person presses **Add task** with an empty title, a title of only spaces, or a title longer than 200 characters after trimming. (AC-001.3)
2. No request is sent. `Enter a title of 1 to 200 characters` appears at the **Title** field. Both fields keep what the person entered, and focus moves to **Title**. (AC-001.3)
3. The person corrects the title and presses **Add task** again, which continues at F2 step 4. The message is cleared on the next submit. (AC-001.3)

### F4 The API rejects the title

1. After a submit that passed step F2.4, the API answers `422` with a `detail` item whose `loc` ends in `"title"`. (AC-001.4)
2. That item's `msg` is shown word for word at the **Title** field. The values stay and focus moves to **Title**. (AC-001.4)

### F5 Save fails

1. After a valid submit, the API answers `409`. The form shows `Task limit of 1000 reached.` (AC-001.6)
2. For any other answer not covered in F2 or F4, the form shows `The task could not be saved. Try again.` This includes `503`, `500`, a `422` with no title item, a body that is not JSON, no connection, and no answer within 5 s. (AC-001.6)
3. In both cases the entered values stay, the list is unchanged and focus stays on **Add task**. The person can press **Add task** again. (AC-001.6)

## Screens

### S1 Start page: route `/`

**Purpose:** see every task and add one, on a single page. The template's hero, "What's included" and "Get started" sections are removed from this page. (AC-001.1 to AC-001.6)

**Layout:**

```
+---------------------------------------------------------------+
| [T] taskboard27-web                    Health  Ready  Metrics | <- SiteHeader (unchanged)
+---------------------------------------------------------------+
|  Tasks                                                (h1)    |
|                                                               |
|  Add a task                                           (h2)    |
|  Title                                                        |
|  [______________________________________________]             |
|  ! Enter a title of 1 to 200 characters   <- field message    |
|  Due date (optional)                                          |
|  [ yyyy-mm-dd  v ]                                            |
|  [ Add task ]                                                 |
|  ! The task could not be saved. Try again. <- form message    |
|                                                               |
|  Your tasks                                           (h2)    |
|  +---------------------------------------------------------+  |
|  | Buy milk                                   2026-12-01   |  |
|  | Call the plumber                           No due date  |  |
|  +---------------------------------------------------------+  |
+---------------------------------------------------------------+
| SiteFooter (unchanged)                                        |
+---------------------------------------------------------------+
```

**What the person sees, top to bottom:**

1. `SiteHeader` and the skip link, both from the layout and unchanged.
2. `<main id="main-content">` with the page heading `Tasks` (h1, class `section-title`, or `hero-title` at a smaller size).
3. The form section, headed `Add a task` (h2). It contains:
   - A text input labelled `Title`. It has no `required` and no `maxlength` attribute, so the browser's own bubbles never replace the spec's text, and a title over 200 characters can be typed and then rejected (AC-001.3).
   - Room for the field message, directly under the title input.
   - A date input labelled `Due date (optional)`, `type="date"`. Empty means `null`.
   - The `Add task` button (`btn btn-primary`, `type="submit"`).
   - Room for the form message, directly under the button.
4. The list section, headed `Your tasks` (h2). It holds one of three things: the task list (`<ul>`), `No tasks yet`, or the load error message. Each list item shows:
   - The title as plain text. Long titles wrap and are never cut off.
   - The due date, right-aligned on wide screens and on its own line on narrow ones. It is shown as `YYYY-MM-DD` in a `<time dateTime="YYYY-MM-DD">`, or as the text `No due date`.
5. `SiteFooter`, unchanged.

**What it reuses:** `RootLayout`, `SiteHeader`, `SiteFooter`, the skip link, and the classes `section`, `section-head`, `section-title`, `btn`, `btn-primary` and `card` (the list panel) from `app/globals.css`. `app/error.tsx` stays the fallback for unexpected render errors only. API failures never reach it, because they are shown in place (AC-001.5).

**New parts:** a task form (client component) and a task list. The architect decides how to split them into files.

## States

### S1 Start page: list area

| State | What the person reads | Criterion |
|---|---|---|
| Loading | No separate loading screen. The page is rendered on the server once `GET /tasks` has answered or 5 s have passed, so the person never sees a half-built list. | AC-001.1, AC-001.5 |
| Empty | `No tasks yet` | AC-001.1 |
| Error | `Tasks could not be loaded. Try again later.` The form is still shown above it. | AC-001.5 |
| Success | A list of tasks, each with its title and `YYYY-MM-DD` or `No due date`. | AC-001.1 |
| After a task is added | The new task appears as the last item. `No tasks yet` is replaced by a one-item list. If the list area showed the load error, it keeps the error and the save message is not shown. The task is saved and appears after a reload. | AC-001.2 |

### S1 Start page: form

| State | What the person reads | Criterion |
|---|---|---|
| Empty (initial) | `Title` and `Due date (optional)` are empty and `Add task` can be pressed. There are no messages. | AC-001.2 |
| Saving | `Add task` cannot be pressed (`aria-disabled`, `aria-busy` on the form) until the answer or the 5 s timeout. The label stays `Add task`. | AC-001.2, AC-001.6 |
| Success | Both fields are emptied and no message is shown. The new task is at the end of the list. | AC-001.2 |
| Title invalid (browser) | At the title field: `Enter a title of 1 to 200 characters`. Values are kept. | AC-001.3 |
| Title rejected (API 422) | At the title field: the API's `msg` word for word. Values are kept. | AC-001.4 |
| Limit reached (409) | On the form: `Task limit of 1000 reached.` Values are kept and the list is unchanged. | AC-001.6 |
| Save failed (other) | On the form: `The task could not be saved. Try again.` Values are kept and the list is unchanged. | AC-001.6 |

Only one message is shown at a time. Any new submit clears the previous field message and form message before it runs.

## Accessibility

### Headings

- `h1` `Tasks`.
- `h2` `Add a task` labels the form section (`aria-labelledby`).
- `h2` `Your tasks` labels the list section (`aria-labelledby`).
- The list area has no other headings.

### Keyboard order

1. Skip link.
2. Header brand and navigation links.
3. **Title**.
4. **Due date (optional)**, which takes the browser's native date-input keyboard handling.
5. **Add task**.
6. Footer links.

The task list items are not focusable, because they are not interactive. Enter in either field submits the form.

### Focus after each action

| Action | Where focus goes |
|---|---|
| Successful add | **Title**, which is now empty, so the next task can be typed at once. |
| Title invalid or rejected (AC-001.3, AC-001.4) | **Title**. |
| `409` or other save failure (AC-001.6) | Stays on **Add task**. The form message is announced (see below). |
| Initial page load | Not moved. |

### Labels and announcements

- **Title:** a visible `<label>` `Title`. While the field message is shown, the input has `aria-invalid="true"` and `aria-describedby` pointing at the message.
- **Due date:** a visible `<label>` `Due date (optional)`.
- **Button:** its accessible name is exactly `Add task`.
- **Field message:** an element with an id, referenced by the title input, inside an `aria-live="polite"` region.
- **Form message:** `role="alert"`, so it is announced when it appears.
- **List:** a `<ul>` inside the `Your tasks` section. The new item is added to the list, and a visually hidden polite live region says `Task added`. This is the one assistive text the spec does not fix, and it is never visible.
- **Load error and empty text:** plain paragraphs in the list section, readable in reading order.

### Messages do not rely on colour

- Every error is a full text sentence placed next to what it is about (the title field, or the form under the button). Each is preceded by a warning icon that has `aria-hidden="true"`.
- The title input in error also gets a thicker border, so its state does not rely on red alone.
- `No due date` is spelled out rather than shown as a blank or a dash.
- The page meets WCAG AA contrast in both the light and dark themes from `globals.css`.
