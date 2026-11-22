"use client";

import { useRef, useState, useTransition } from "react";
import type { FormEvent } from "react";

import { TITLE_MESSAGE } from "@/lib/tasks/messages";
import type { CreateResult, CreateTaskInput, Task } from "@/lib/tasks/types";
import { validateTitle } from "@/lib/tasks/validation";

import { WarningIcon } from "./icons";

export type TaskFormProps = {
  createAction: (input: CreateTaskInput) => Promise<CreateResult>;
  onCreated: (task: Task) => void;
};

export function TaskForm({ createAction, onCreated }: TaskFormProps) {
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const titleRef = useRef<HTMLInputElement>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    setFieldError(null);
    setFormError(null);
    if (validateTitle(title) !== null) {
      setFieldError(TITLE_MESSAGE);
      titleRef.current?.focus();
      return;
    }
    busy.current = true;
    const input: CreateTaskInput = { title: title.trim(), due_date: dueDate === "" ? null : dueDate };
    startTransition(async () => {
      try {
        const result = await createAction(input);
        if (result.kind === "created") {
          setTitle("");
          setDueDate("");
          onCreated(result.task);
          titleRef.current?.focus();
        } else if (result.kind === "field-error") {
          setFieldError(result.message);
          titleRef.current?.focus();
        } else {
          setFormError(result.message);
        }
      } finally {
        busy.current = false;
      }
    });
  }

  return (
    <form className="task-form" onSubmit={onSubmit} aria-busy={pending} noValidate>
      <label className="field-label" htmlFor="task-title">
        Title
      </label>
      <input
        ref={titleRef}
        id="task-title"
        name="title"
        type="text"
        className="field-input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        aria-invalid={fieldError ? true : undefined}
        aria-describedby={fieldError ? "task-title-error" : undefined}
      />
      <div aria-live="polite">
        {fieldError ? (
          <p id="task-title-error" className="field-message">
            <WarningIcon />
            {fieldError}
          </p>
        ) : null}
      </div>
      <label className="field-label" htmlFor="task-due-date">
        Due date (optional)
      </label>
      <input
        id="task-due-date"
        name="due_date"
        type="date"
        className="field-input"
        value={dueDate}
        onChange={(e) => setDueDate(e.target.value)}
      />
      <button type="submit" className="btn btn-primary" aria-disabled={pending}>
        Add task
      </button>
      {formError ? (
        <p role="alert" className="form-message">
          <WarningIcon />
          {formError}
        </p>
      ) : null}
    </form>
  );
}
