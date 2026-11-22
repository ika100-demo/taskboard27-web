import { describe, expect, it } from "vitest";

const TITLE_MESSAGE = "Enter a title of 1 to 200 characters";

async function validation() {
  return await import("@/lib/tasks/validation");
}
async function responses() {
  return await import("@/lib/tasks/responses");
}

const task = { id: "1b4e28ba-2fa1-11d2-883f-0016d3cca427", title: "Buy milk", due_date: "2026-12-01" };

describe("validation", () => {
  it("AC-001.3 rejects an empty title, spaces only and a missing title", async () => {
    const { validateTitle, validateCreate } = await validation();
    expect(validateTitle("")).toBe(TITLE_MESSAGE);
    expect(validateTitle("    ")).toBe(TITLE_MESSAGE);
    expect(validateTitle(undefined)).toBe(TITLE_MESSAGE);
    expect(validateCreate({})).toEqual({ title: TITLE_MESSAGE });
    expect(validateCreate({ title: "  " })).toEqual({ title: TITLE_MESSAGE });
  });

  it("AC-001.3 counts 200 characters after trimming as the maximum", async () => {
    const { validateTitle, validateCreate } = await validation();
    expect(validateTitle("a".repeat(200))).toBeNull();
    expect(validateTitle(`  ${"a".repeat(200)}  `)).toBeNull();
    expect(validateTitle("a".repeat(201))).toBe(TITLE_MESSAGE);
    expect(validateTitle("😀".repeat(200))).toBeNull();
    expect(validateTitle("😀".repeat(201))).toBe(TITLE_MESSAGE);
    expect(validateCreate({ title: "Buy milk" })).toEqual({});
  });
});

describe("interpretList", () => {
  it("AC-001.1 keeps the order the API returned", async () => {
    const { interpretList } = await responses();
    const second = { ...task, id: "2", title: "Second", due_date: null };
    expect(interpretList(200, [task, second])).toEqual({ ok: true, tasks: [task, second] });
    expect(interpretList(200, [])).toEqual({ ok: true, tasks: [] });
  });

  it("AC-001.5 fails for anything but 200 with an array of tasks", async () => {
    const { interpretList } = await responses();
    expect(interpretList(503, { detail: "task storage unavailable" })).toEqual({ ok: false });
    expect(interpretList(500, [])).toEqual({ ok: false });
    expect(interpretList(200, undefined)).toEqual({ ok: false });
    expect(interpretList(200, { tasks: [] })).toEqual({ ok: false });
    expect(interpretList(200, [{ id: 1 }])).toEqual({ ok: false });
  });
});

describe("interpretCreate", () => {
  it("AC-001.2 maps 201 with a task to created", async () => {
    const { interpretCreate } = await responses();
    expect(interpretCreate(201, task)).toEqual({ kind: "created", task });
  });

  it("AC-001.4 shows the msg of a 422 title item, matching loc by its last element or value", async () => {
    const { interpretCreate } = await responses();
    const expected = { kind: "field-error", field: "title", message: "Enter a title of 1 to 200 characters" };
    const item = { type: "title-max", loc: ["body", "title"], msg: "Enter a title of 1 to 200 characters", input: "x" };
    expect(interpretCreate(422, { detail: [item] })).toEqual(expected);
    expect(interpretCreate(422, { detail: [{ ...item, loc: "title" }] })).toEqual(expected);
    const due = { type: "date", loc: ["body", "due_date"], msg: "bad date", input: "x" };
    expect(interpretCreate(422, { detail: [due, item] })).toEqual(expected);
  });

  it("AC-001.4 uses the first title item verbatim", async () => {
    const { interpretCreate } = await responses();
    const result = interpretCreate(422, {
      detail: [
        { type: "a", loc: ["body", "title"], msg: "first", input: "" },
        { type: "b", loc: ["body", "title"], msg: "second", input: "" },
      ],
    });
    expect(result).toEqual({ kind: "field-error", field: "title", message: "first" });
  });

  it("AC-001.6 maps 409 to the limit message", async () => {
    const { interpretCreate } = await responses();
    expect(interpretCreate(409, { detail: "task limit of 1000 reached" })).toEqual({
      kind: "form-error",
      message: "Task limit of 1000 reached.",
    });
  });

  it("AC-001.6 maps every other answer to the save error", async () => {
    const { interpretCreate } = await responses();
    const save = { kind: "form-error", message: "The task could not be saved. Try again." };
    expect(interpretCreate(503, { detail: "task storage unavailable" })).toEqual(save);
    expect(interpretCreate(500, undefined)).toEqual(save);
    expect(interpretCreate(418, {})).toEqual(save);
    expect(interpretCreate(201, { nope: true })).toEqual(save);
    expect(interpretCreate(422, { detail: [{ type: "date", loc: ["body", "due_date"], msg: "x", input: "y" }] })).toEqual(save);
    expect(interpretCreate(422, undefined)).toEqual(save);
  });
});
