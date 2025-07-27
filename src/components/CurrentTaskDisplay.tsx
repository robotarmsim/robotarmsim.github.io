// CurrentTaskDisplay.tsx
import React from 'react';

interface CurrentTaskDisplayProps {
  task: string | null;
  index?: number;
  total?: number;
}

export const CurrentTaskDisplay: React.FC<CurrentTaskDisplayProps> = ({ task, index, total }) => {
  if (!task) return <div className="task-display">No task loaded</div>;

  return (
    <div className="task-display">
      <h2>Current Task</h2>
      <p>{task}</p>
      {typeof index === 'number' && typeof total === 'number' && (
        <p>
          Task {index + 1} of {total}
        </p>
      )}
    </div>
  );
};
