import { createTask } from "./actions";
import { TaskBoard } from "./_components/task-board";
import { listTasks } from "@/lib/tasks/api";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initial = await listTasks();
  return (
    <main id="main-content">
      <h1>Tasks</h1>
      <TaskBoard initial={initial} createAction={createTask} />
    </main>
  );
}
