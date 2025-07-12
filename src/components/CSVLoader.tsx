// import React from 'react';
import { useRef, useState } from 'react';

interface CSVLoaderProps {
  testFlowManager: {
    loadTasks: (tasks: string[]) => void;
  };
  onTasksLoaded?: () => void;
}

export default function CSVLoader({ testFlowManager, onTasksLoaded }: CSVLoaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [shuffleOrder, setShuffleOrder] = useState(false);
  const [disabled, setDisabled] = useState(false);

  function parseCSV(text: string): string[] {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);
  }

  function shuffle(arr: string[]): string[] {
    return arr
      .map(v => ({ v, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map(({ v }) => v);
  }

  const handleFile = () => {
    const input = fileInputRef.current;
    if (!input || !input.files || input.files.length === 0) {
      alert('Please select a CSV file.');
      return;
    }
    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = e => {
      const rawText = e.target?.result;
      if (typeof rawText !== 'string') return;

      let tasks = parseCSV(rawText);
      if (shuffleOrder) tasks = shuffle(tasks);

      testFlowManager.loadTasks(tasks);
      if (onTasksLoaded) onTasksLoaded();

      setDisabled(true);
    };

    reader.readAsText(file);
  };

  return (
    <div>
      <input
        type="file"
        accept=".csv"
        ref={fileInputRef}
        disabled={disabled}
      />
      <label>
        <input
          type="checkbox"
          checked={shuffleOrder}
          disabled={disabled}
          onChange={e => setShuffleOrder(e.target.checked)}
        />
        Random Order
      </label>
      <button onClick={handleFile} disabled={disabled}>
        Load CSV
      </button>
    </div>
  );
}
