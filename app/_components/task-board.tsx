"use client";

import { useState } from "react";

import { TASK_ADDED } from "@/lib/tasks/messages";
import type { CreateResult, CreateTaskInput, ListResult, Task } from "@/lib/tasks/types";

import { TaskForm } from "./task-form";
import { TaskList } from "./task-list";

export type TaskBoardProps = {
  initial: ListResult;
  createAction: (input: CreateTaskInput) => Promise<CreateResult>;
};

export function TaskBoard({ initial, createAction }: TaskBoardProps) {
  const [list, setList] = useState<ListResult>(initial);
  const [announce, setAnnounce] = useState("");

  function onCreated(task: Task) {
    setList((current) => (current.ok ? { ok: true, tasks: [...current.tasks, task] } : current));
    setAnnounce(TASK_ADDED);
  }

  return (
    <>
      <section className="section" aria-labelledby="add-task-heading">
        <div className="section-head">
          <h2 id="add-task-heading" className="section-title">
            Add a task
          </h2>
        </div>
        <TaskForm createAction={createAction} onCreated={onCreated} />
      </section>
      <section className="section" aria-labelledby="your-tasks-heading">
        <div className="section-head">
          <h2 id="your-tasks-heading" className="section-title">
            Your tasks
          </h2>
        </div>
        <TaskList result={list} />
      </section>
      <div aria-live="polite" className="visually-hidden">
        {announce}
      </div>
    </>
  );
}
