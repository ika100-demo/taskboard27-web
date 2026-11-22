import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { CreateResult, CreateTaskInput, ListResult, Task } from "@/lib/tasks/types";

const TITLE_MESSAGE = "Enter a title of 1 to 200 characters";
const LOAD_ERROR = "Tasks could not be loaded. Try again later.";
const SAVE_ERROR = "The task could not be saved. Try again.";

const t1: Task = { id: "id-1", title: "Water plants", due_date: "2026-12-01" };
const t2: Task = { id: "id-2", title: "Call mum", due_date: null };

async function setup(initial: ListResult, result: CreateResult | (() => Promise<CreateResult>)) {
  const { TaskBoard } = await import("@/app/_components/task-board");
  const createAction = vi.fn(async (input: CreateTaskInput): Promise<CreateResult> => (input && typeof result === "function" ? result() : result));
  render(<TaskBoard initial={initial} createAction={createAction} />);
  return { createAction };
}

function listArea() {
  return screen.getByRole("region", { name: "Your tasks" });
}

function fill(title: string, date?: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: title } });
  if (date !== undefined) fireEvent.change(screen.getByLabelText("Due date (optional)"), { target: { value: date } });
}

function submit() {
  fireEvent.click(screen.getByRole("button", { name: "Add task" }));
}

describe("TaskList", () => {
  it("AC-001.1 renders each task with its title and due date or No due date, in the given order", async () => {
    const { TaskList } = await import("@/app/_components/task-list");
    render(<TaskList result={{ ok: true, tasks: [t1, t2] }} />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText("Water plants")).toBeInTheDocument();
    expect(within(items[0]).getByText("2026-12-01")).toBeInTheDocument();
    expect(within(items[1]).getByText("Call mum")).toBeInTheDocument();
    expect(within(items[1]).getByText("No due date")).toBeInTheDocument();
  });

  it("AC-001.1 shows No tasks yet for an empty list", async () => {
    const { TaskList } = await import("@/app/_components/task-list");
    render(<TaskList result={{ ok: true, tasks: [] }} />);
    expect(screen.getByText("No tasks yet")).toBeInTheDocument();
    expect(screen.queryByRole("listitem")).not.toBeInTheDocument();
  });

  it("AC-001.5 shows the load error when the list could not be loaded", async () => {
    const { TaskList } = await import("@/app/_components/task-list");
    render(<TaskList result={{ ok: false }} />);
    expect(screen.getByText(LOAD_ERROR)).toBeInTheDocument();
    expect(screen.queryByText("No tasks yet")).not.toBeInTheDocument();
  });
});

describe("TaskBoard", () => {
  it("AC-001.1 lists the initial tasks below the form in an Your tasks region", async () => {
    await setup({ ok: true, tasks: [t1, t2] }, { kind: "created", task: t1 });
    expect(screen.getByRole("region", { name: "Add a task" })).toBeInTheDocument();
    expect(within(listArea()).getAllByRole("listitem")).toHaveLength(2);
    const form = screen.getByRole("region", { name: "Add a task" });
    expect(form.compareDocumentPosition(listArea()) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("AC-001.5 shows the load error in the list area and still shows the form", async () => {
    await setup({ ok: false }, { kind: "created", task: t1 });
    expect(within(listArea()).getByText(LOAD_ERROR)).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Title" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add task" })).toBeInTheDocument();
  });

  it("AC-001.2 sends the trimmed title and date, appends the returned task and empties the form", async () => {
    const created: Task = { id: "id-3", title: "Buy milk", due_date: "2026-12-24" };
    const { createAction } = await setup({ ok: true, tasks: [t1] }, { kind: "created", task: created });
    fill("  Buy milk  ", "2026-12-24");
    submit();
    await waitFor(() => expect(within(listArea()).getAllByRole("listitem")).toHaveLength(2));
    expect(createAction).toHaveBeenCalledTimes(1);
    expect(createAction).toHaveBeenCalledWith({ title: "Buy milk", due_date: "2026-12-24" });
    const items = within(listArea()).getAllByRole("listitem");
    expect(within(items[1]).getByText("Buy milk")).toBeInTheDocument();
    expect(within(items[1]).getByText("2026-12-24")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("");
    expect(screen.getByLabelText("Due date (optional)")).toHaveValue("");
  });

  it("AC-001.2 sends due_date null when no date is picked and replaces No tasks yet", async () => {
    const created: Task = { id: "id-3", title: "Buy milk", due_date: null };
    const { createAction } = await setup({ ok: true, tasks: [] }, { kind: "created", task: created });
    fill("Buy milk");
    submit();
    await waitFor(() => expect(within(listArea()).getAllByRole("listitem")).toHaveLength(1));
    expect(createAction).toHaveBeenCalledWith({ title: "Buy milk", due_date: null });
    expect(within(listArea()).queryByText("No tasks yet")).not.toBeInTheDocument();
    expect(within(listArea()).getByText("No due date")).toBeInTheDocument();
  });

  it("AC-001.3 shows the title message and calls nothing for an empty, blank or too long title, keeping the values", async () => {
    const { createAction } = await setup({ ok: true, tasks: [t1] }, { kind: "created", task: t2 });
    for (const title of ["", "    ", "a".repeat(201)]) {
      fill(title, "2026-12-24");
      submit();
      const input = screen.getByRole("textbox", { name: "Title" });
      await waitFor(() => expect(screen.getByText(TITLE_MESSAGE)).toBeInTheDocument());
      expect(input).toHaveAttribute("aria-invalid", "true");
      expect(input).toHaveValue(title);
      expect(screen.getByLabelText("Due date (optional)")).toHaveValue("2026-12-24");
    }
    expect(createAction).not.toHaveBeenCalled();
    expect(within(listArea()).getAllByRole("listitem")).toHaveLength(1);
  });

  it("AC-001.4 shows the msg of a 422 title item at the title field and keeps the values", async () => {
    await setup(
      { ok: true, tasks: [t1] },
      { kind: "field-error", field: "title", message: "Title already taken" },
    );
    fill("Buy milk", "2026-12-24");
    submit();
    const message = await screen.findByText("Title already taken");
    const input = screen.getByRole("textbox", { name: "Title" });
    expect(message.closest("#task-title-error")).not.toBeNull();
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAttribute("aria-describedby", "task-title-error");
    expect(screen.queryByText(TITLE_MESSAGE)).not.toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Buy milk");
    expect(screen.getByLabelText("Due date (optional)")).toHaveValue("2026-12-24");
    expect(within(listArea()).getAllByRole("listitem")).toHaveLength(1);
  });

  it("AC-001.6 shows the limit message in the form for a 409 and keeps values and list", async () => {
    await setup({ ok: true, tasks: [t1] }, { kind: "form-error", message: "Task limit of 1000 reached." });
    fill("Buy milk", "2026-12-24");
    submit();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Task limit of 1000 reached.");
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Buy milk");
    expect(screen.getByLabelText("Due date (optional)")).toHaveValue("2026-12-24");
    expect(within(listArea()).getAllByRole("listitem")).toHaveLength(1);
  });

  it("AC-001.6 shows the save error in the form for any other failure and keeps values and list", async () => {
    await setup({ ok: true, tasks: [] }, { kind: "form-error", message: SAVE_ERROR });
    fill("Buy milk", "2026-12-24");
    submit();
    expect(await screen.findByRole("alert")).toHaveTextContent(SAVE_ERROR);
    expect(screen.getByRole("textbox", { name: "Title" })).toHaveValue("Buy milk");
    expect(screen.getByLabelText("Due date (optional)")).toHaveValue("2026-12-24");
    expect(within(listArea()).getByText("No tasks yet")).toBeInTheDocument();
  });

  it("AC-001.6 clears an earlier message when the next submit succeeds", async () => {
    const created: Task = { id: "id-3", title: "Buy milk", due_date: null };
    const results: CreateResult[] = [{ kind: "form-error", message: SAVE_ERROR }, { kind: "created", task: created }];
    await setup({ ok: true, tasks: [] }, async () => results.shift() as CreateResult);
    fill("Buy milk");
    submit();
    await screen.findByRole("alert");
    submit();
    await waitFor(() => expect(within(listArea()).getAllByRole("listitem")).toHaveLength(1));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
