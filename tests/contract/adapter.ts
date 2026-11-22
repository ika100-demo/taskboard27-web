// Project-owned: wire this to your form so the contract check (tests/contract.test.ts) can drive it (spec 110).
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement } from "react";

import { TaskBoard } from "@/app/_components/task-board";
import type { ContractAdapter } from "@/lib/contract/engine";
import { interpretCreate } from "@/lib/tasks/responses";
import { validateCreate } from "@/lib/tasks/validation";

export const adapter: ContractAdapter = {
  base: () => ({ title: "Buy milk", due_date: null }),
  validate: (_, body) => validateCreate(body),
  showResponse: async (_, { status, body }) => {
    let settled = false;
    const createAction = async () => {
      const result = interpretCreate(status, body);
      settled = true;
      return result;
    };
    const { unmount } = render(createElement(TaskBoard, { initial: { ok: true, tasks: [] }, createAction }));
    try {
      fireEvent.change(screen.getByRole("textbox", { name: "Title" }), { target: { value: "Buy milk" } });
      fireEvent.click(screen.getByRole("button", { name: "Add task" }));
      await waitFor(() => {
        if (!settled) throw new Error("action not settled");
      });
      // wait for the state updates after the action to flush
      await waitFor(() => {
        if (screen.getByRole("button", { name: "Add task" }).getAttribute("aria-disabled") !== "false") {
          throw new Error("still saving");
        }
      });
      const field = document.getElementById("task-title-error");
      const alert = screen.queryByRole("alert")?.textContent?.trim();
      const fields: Record<string, string> = field ? { title: field.textContent?.trim() ?? "" } : {};
      return {
        fields,
        form: alert ? alert : undefined,
      };
    } finally {
      unmount();
    }
  },
};
