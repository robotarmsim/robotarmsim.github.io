import React from 'react';

interface ProgressPieProps {
  index: number; // currentRealIndex (0-based)
  total: number; // realTasks.length
  showProgress?: boolean;
  size?: number; // diameter in px
  strokeWidth?: number;
}

const ProgressPie: React.FC<ProgressPieProps> = ({
  index,
  total,
  showProgress = true,
  size = 56,
  strokeWidth = 6,
}) => {
  if (!showProgress || total <= 0) return null;

  // fraction complete (0..1). If index is current item among real tasks,
  // treat completed as index / total (so index 0 => 0% complete).
  const fractionComplete = Math.max(0, Math.min(1, total > 0 ? index / total : 0));

  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - fractionComplete);

  // remaining after the current task
  const remaining = Math.max(0, total - (index + 1));

  return (
    <div
      className="ml-4 flex items-center"
      aria-hidden={!showProgress}
      aria-label={`Progress: ${Math.round(fractionComplete * 100)}% complete, ${remaining} left`}
    >
      <div
        className="flex flex-col items-center justify-center rounded-full bg-white shadow-md p-1"
        style={{ width: size + 8, height: size + 8 }}
      >
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="block"
          role="img"
          aria-hidden="false"
        >
          <defs>
            <linearGradient id="progGrad" x1="0%" x2="100%">
              <stop offset="0%" stopColor="#7c3aed" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>
          </defs>

          {/* background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
            fill="none"
          />

          {/* progress arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke="url(#progGrad)"
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="transition-all duration-500 ease-out"
          />
        </svg>

        {/* center number / small label */}
        <div className="absolute text-center pointer-events-none" style={{ width: size }}>
          <div className="text-xs font-semibold leading-none">
            {remaining === 0 ? (
              <span className="text-green-600 text-[10px]">Done!</span>
            ) : (
              <span className="text-slate-800 text-sm">{remaining}</span>
            )}
          </div>
          <div className="text-[10px] text-slate-500 -mt-0.5">
            {remaining === 0 ? '' : 'left'}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressPie;
