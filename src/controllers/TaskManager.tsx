// src/controllers/TaskManager.tsx
import { useState } from "react";

export interface Task {
  id: string;
  description: string;
}

export function useTaskManager(initialTasks: Task[]) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);

  function nextTask() {
    setCurrentTaskIndex((i) => Math.min(i + 1, tasks.length - 1));
  }

  function prevTask() {
    setCurrentTaskIndex((i) => Math.max(i - 1, 0));
  }

  function currentTask(): Task | null {
    return tasks[currentTaskIndex] ?? null;
  }

  return {
    tasks,
    currentTask,
    currentTaskIndex,
    setTasks,
    nextTask,
    prevTask,
  };
}
