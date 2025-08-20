import React from 'react';

interface CSVOptionsProps {
  randomOrder: boolean;
  setRandomOrder: (enabled: boolean) => void;
  showProgress: boolean;
  setShowProgress: (enabled: boolean) => void;
  interruptionEnabled: boolean;
  setInterruptionEnabled: (enabled: boolean) => void;
  interruptionInterval: number;
  setInterruptionInterval: (n: number) => void;
}

const CSVOptions: React.FC<CSVOptionsProps> = ({
  randomOrder,
  setRandomOrder,
  showProgress,
  setShowProgress,
  interruptionEnabled,
  setInterruptionEnabled,
  interruptionInterval,
  setInterruptionInterval,
}) => (
  <div className="csv-options">
    <h4>Options</h4>

    <label>
      <input
        type="checkbox"
        checked={randomOrder}
        onChange={e => setRandomOrder(e.target.checked)}
      />
      Random Order
    </label>

    <label>
      <input
        type="checkbox"
        checked={interruptionEnabled}
        onChange={e => setInterruptionEnabled(e.target.checked)}
      />
      Add Interruptions
    </label>

    {interruptionEnabled && (
      <label>
        Interval (tasks):
        <input
          type="number"
          min="1"
          value={interruptionInterval}
          onChange={e => setInterruptionInterval(Number(e.target.value))}
          style={{ width: '4rem', marginLeft: '0.5rem' }}
        />
      </label>
    )}

    <label>
      <input
        type="checkbox"
        checked={showProgress}
        onChange={e => setShowProgress(e.target.checked)}
      />
      Show Progress
    </label>
  </div>
);

export default CSVOptions;