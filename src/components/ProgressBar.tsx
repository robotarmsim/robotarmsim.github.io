// ProgressBar.tsx
import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ current, total }) => {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div className="w-full bg-gray-200 rounded h-4 mt-2">
      <div
        className="bg-green-500 h-full rounded"
        style={{ width: `${percent}%` }}
      ></div>
    </div>
  );
};
