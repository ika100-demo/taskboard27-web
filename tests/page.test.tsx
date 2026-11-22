import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const tasks = [
  { id: "id-1", title: "Water plants", due_date: "2026-12-01" },
  { id: "id-2", title: "Call mum", due_date: null },
];

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("TASKBOARD27_API_URL", "http://taskboard27-api");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

async function renderPage() {
  const { default: HomePage } = await import("@/app/page");
  render(await HomePage());
  return within(screen.getByRole("main"));
}

describe("HomePage", () => {
  it("AC-001.1 owns the main landmark and lists the API's tasks in order below the form", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(tasks), { status: 200 }));
    const main = await renderPage();
    expect(screen.getByRole("main")).toHaveAttribute("id", "main-content");
    expect(main.getByRole("heading", { level: 1, name: "Tasks" })).toBeInTheDocument();
    expect(main.getByRole("button", { name: "Add task" })).toBeInTheDocument();
    const items = within(main.getByRole("region", { name: "Your tasks" })).getAllByRole("listitem");
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining("Water plants"),
      expect.stringContaining("Call mum"),
    ]);
    const form = main.getByRole("region", { name: "Add a task" });
    expect(form.compareDocumentPosition(main.getByRole("region", { name: "Your tasks" })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(items[0]).toHaveTextContent("2026-12-01");
    expect(items[1]).toHaveTextContent("No due date");
  });

  it("AC-001.1 shows No tasks yet for an empty list", async () => {
    fetchMock.mockResolvedValue(new Response("[]", { status: 200 }));
    const main = await renderPage();
    expect(within(main.getByRole("region", { name: "Your tasks" })).getByText("No tasks yet")).toBeInTheDocument();
  });

  it("AC-001.1 fetches the list on every page request", async () => {
    fetchMock.mockImplementation(async () => new Response("[]", { status: 200 }));
    const { default: HomePage, dynamic } = await import("@/app/page");
    expect(dynamic).toBe("force-dynamic");
    await HomePage();
    await HomePage();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("AC-001.5 shows the load error in the list area and still shows the form when the API fails", async () => {
    fetchMock.mockResolvedValue(new Response("{}", { status: 503 }));
    const main = await renderPage();
    expect(within(main.getByRole("region", { name: "Your tasks" })).getByText("Tasks could not be loaded. Try again later.")).toBeInTheDocument();
    expect(main.getByRole("textbox", { name: "Title" })).toBeInTheDocument();
    expect(main.getByRole("button", { name: "Add task" })).toBeInTheDocument();
  });

  it("AC-001.5 shows the load error when the API is unreachable", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    const main = await renderPage();
    expect(within(main.getByRole("region", { name: "Your tasks" })).getByText("Tasks could not be loaded. Try again later.")).toBeInTheDocument();
  });
});
