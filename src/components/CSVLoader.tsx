import React from 'react';
import { parseCSVText } from '../utils/csvUtils';

interface CSVLoaderProps {
  /** called immediately with an array of raw tasks (first column of each row) */
  onData: (tasks: string[]) => void;
}

export default function CSVLoader({ onData }: CSVLoaderProps) {
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = ev => {
      const text = ev.target?.result;
      if (typeof text !== 'string') return;
      onData(parseCSVText(text));
    };
    reader.readAsText(file);
  };

  return (
    <div className="csv-loader">
      <label>Load CSV:</label>
      <input
        type="file"
        accept=".csv"
        onChange={handleFile}
        style={{ marginLeft: 8 }}
      />
    </div>
  );
}
