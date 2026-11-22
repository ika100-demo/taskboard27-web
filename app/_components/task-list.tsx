import { EMPTY_LIST, LOAD_ERROR, NO_DUE_DATE } from "@/lib/tasks/messages";
import type { ListResult } from "@/lib/tasks/types";

export type TaskListProps = { result: ListResult };

export function TaskList({ result }: TaskListProps) {
  if (!result.ok) return <p>{LOAD_ERROR}</p>;
  if (result.tasks.length === 0) return <p>{EMPTY_LIST}</p>;
  return (
    <ul className="card task-list">
      {result.tasks.map((task) => (
        <li key={task.id} className="task-item">
          <span className="task-title">{task.title}</span>
          {task.due_date ? (
            <time className="task-due" dateTime={task.due_date}>
              {task.due_date}
            </time>
          ) : (
            <span className="task-due">{NO_DUE_DATE}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
