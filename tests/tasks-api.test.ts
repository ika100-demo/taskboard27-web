import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const task = { id: "1b4e28ba-2fa1-11d2-883f-0016d3cca427", title: "Buy milk", due_date: "2026-12-01" };
const SAVE = { kind: "form-error", message: "The task could not be saved. Try again." };

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("TASKBOARD27_API_URL", "http://taskboard27-api");
});

// Runs `start` against a fetch that never answers. Node's AbortSignal.timeout ignores fake timers, so it is routed
// through the faked setTimeout; this holds for AbortSignal.timeout(5000) and for AbortController + setTimeout alike.
async function withFakeTimeout<T>(start: () => Promise<T>) {
  vi.useFakeTimers();
  vi.spyOn(AbortSignal, "timeout").mockImplementation((ms) => {
    const controller = new AbortController();
    setTimeout(() => controller.abort(new DOMException("timed out", "TimeoutError")), ms);
    return controller.signal;
  });
  let captured: AbortSignal | undefined;
  fetchMock.mockImplementation(
    (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        const s = init.signal as AbortSignal;
        captured = s;
        s.addEventListener("abort", () => reject(s.reason));
      }),
  );
  const pending = start();
  let elapsed = 0;
  return {
    signal: () => captured,
    // Advances the clock; returns the call's result once 5000 ms have passed, else undefined.
    settle: async (ms: number) => {
      await vi.advanceTimersByTimeAsync(ms);
      elapsed += ms;
      return elapsed >= 5000 ? await pending : undefined;
    },
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("listTasks", () => {
  it("AC-001.1 calls GET /tasks without caching and returns the tasks in API order", async () => {
    fetchMock.mockResolvedValue(json(200, [task]));
    const { listTasks } = await import("@/lib/tasks/api");
    expect(await listTasks()).toEqual({ ok: true, tasks: [task] });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("http://taskboard27-api/tasks");
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    expect(new Headers(init.headers).get("Accept")).toBe("application/json");
    expect(init.method ?? "GET").toBe("GET");
  });

  it("AC-001.1 tolerates a trailing slash on the base URL and reads it on every call", async () => {
    fetchMock.mockImplementation(async () => json(200, []));
    const { listTasks } = await import("@/lib/tasks/api");
    vi.stubEnv("TASKBOARD27_API_URL", "http://other/");
    await listTasks();
    expect(String(fetchMock.mock.calls[0][0])).toBe("http://other/tasks");
  });

  it("AC-001.5 returns ok:false for a non-200 answer, a non-JSON body, a network error and a timeout", async () => {
    const { listTasks } = await import("@/lib/tasks/api");
    fetchMock.mockResolvedValueOnce(json(503, { detail: "task storage unavailable" }));
    expect(await listTasks()).toEqual({ ok: false });
    fetchMock.mockResolvedValueOnce(new Response("<html>", { status: 200 }));
    expect(await listTasks()).toEqual({ ok: false });
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await listTasks()).toEqual({ ok: false });
    fetchMock.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));
    expect(await listTasks()).toEqual({ ok: false });
  });

  it("AC-001.5 returns ok:false without fetching when the API URL is unset", async () => {
    vi.stubEnv("TASKBOARD27_API_URL", "");
    const { listTasks } = await import("@/lib/tasks/api");
    expect(await listTasks()).toEqual({ ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("AC-001.5 aborts the call at 5000 ms and not before, and then reports ok:false", async () => {
    const { listTasks } = await import("@/lib/tasks/api");
    const { signal, settle } = await withFakeTimeout(() => listTasks());
    await settle(4999);
    expect(signal()?.aborted).toBe(false);
    expect(await settle(1)).toEqual({ ok: false });
    expect(signal()?.aborted).toBe(true);
  });
});

describe("postTask", () => {
  it("AC-001.2 sends POST /tasks with exactly the title and due_date as JSON", async () => {
    fetchMock.mockResolvedValue(json(201, task));
    const { postTask } = await import("@/lib/tasks/api");
    const result = await postTask({ title: "Buy milk", due_date: "2026-12-01" });
    expect(result).toEqual({ kind: "created", task });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("http://taskboard27-api/tasks");
    expect(init.method).toBe("POST");
    expect(init.cache).toBe("no-store");
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const headers = new Headers(init.headers);
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(headers.get("Accept")).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ title: "Buy milk", due_date: "2026-12-01" });
  });

  it("AC-001.4 maps a 422 title item to a field error", async () => {
    fetchMock.mockResolvedValue(
      json(422, { detail: [{ type: "title-max", loc: ["body", "title"], msg: "Enter a title of 1 to 200 characters", input: "x" }] }),
    );
    const { postTask } = await import("@/lib/tasks/api");
    expect(await postTask({ title: "x", due_date: null })).toEqual({
      kind: "field-error",
      field: "title",
      message: "Enter a title of 1 to 200 characters",
    });
  });

  it("AC-001.6 maps 409 to the limit message", async () => {
    fetchMock.mockResolvedValue(json(409, { detail: "task limit of 1000 reached" }));
    const { postTask } = await import("@/lib/tasks/api");
    expect(await postTask({ title: "x", due_date: null })).toEqual({ kind: "form-error", message: "Task limit of 1000 reached." });
  });

  it("AC-001.6 maps 503, a non-JSON body, a network error and a timeout to the save error, without retry", async () => {
    const { postTask } = await import("@/lib/tasks/api");
    fetchMock.mockResolvedValueOnce(json(503, { detail: "task storage unavailable" }));
    expect(await postTask({ title: "x", due_date: null })).toEqual(SAVE);
    fetchMock.mockResolvedValueOnce(new Response("oops", { status: 500 }));
    expect(await postTask({ title: "x", due_date: null })).toEqual(SAVE);
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));
    expect(await postTask({ title: "x", due_date: null })).toEqual(SAVE);
    fetchMock.mockRejectedValueOnce(new DOMException("timed out", "TimeoutError"));
    expect(await postTask({ title: "x", due_date: null })).toEqual(SAVE);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe("postTask timeout", () => {
  it("AC-001.6 aborts the create call at 5000 ms and not before, and then reports the save error", async () => {
    const { postTask } = await import("@/lib/tasks/api");
    const { signal, settle } = await withFakeTimeout(() => postTask({ title: "x", due_date: null }));
    await settle(4999);
    expect(signal()?.aborted).toBe(false);
    expect(await settle(1)).toEqual(SAVE);
    expect(signal()?.aborted).toBe(true);
  });
});

describe("createTask action", () => {
  it("AC-001.3 sends no request for an empty, blank or too long title", async () => {
    const { createTask } = await import("@/app/actions");
    for (const title of ["", "   ", "a".repeat(201)]) {
      expect(await createTask({ title, due_date: null })).toEqual({
        kind: "field-error",
        field: "title",
        message: "Enter a title of 1 to 200 characters",
      });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("AC-001.2 posts the trimmed title and turns an empty due date into null", async () => {
    fetchMock.mockResolvedValue(json(201, task));
    const { createTask } = await import("@/app/actions");
    expect(await createTask({ title: "  Buy milk  ", due_date: "" })).toEqual({ kind: "created", task });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ title: "Buy milk", due_date: null });
  });
});
