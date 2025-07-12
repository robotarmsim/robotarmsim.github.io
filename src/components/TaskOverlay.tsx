// src/components/TaskOverlay.tsx
import React from 'react';

interface TaskOverlayProps {
  tasks: string[];
  currentIndex: number;
  onNext: () => void;
}

export const TaskOverlay: React.FC<TaskOverlayProps> = ({
  tasks,
  currentIndex,
  onNext
}) => {
  if (currentIndex >= tasks.length) return <div>All done!</div>;

  return (
    <div className="fixed top-4 left-4 bg-white p-4 shadow rounded">
      <p className="font-semibold">Task: {tasks[currentIndex]}</p>
      <button onClick={onNext} className="mt-2 px-2 py-1 bg-blue-600 text-white rounded">
        Next Task
      </button>
      <p className="text-sm mt-1">{currentIndex+1} / {tasks.length}</p>
    </div>
  );
};
