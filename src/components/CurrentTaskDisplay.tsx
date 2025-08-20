// /src/components/CurrentTaskDisplay.tsx
import React from 'react';

interface CurrentTaskDisplayProps {
  task: string | null;
  index: number;
  total: number;
  showProgress: boolean;
}

export const CurrentTaskDisplay: React.FC<CurrentTaskDisplayProps> = ({
  task,
  index,
  total,
  showProgress,
}) => {
  return (
    <div className="task-display">
      <h2>Current Task: {task || 'No task loaded'}</h2>
      {showProgress && (
        <p>
          Task {index + 1} of {total}
        </p>
      )}
    </div>
  );
};
