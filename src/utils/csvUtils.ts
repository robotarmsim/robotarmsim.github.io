// Utility functions for CSV task processing

/**
 * Fisher–Yates shuffle: returns a new shuffled array
 */
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Insert interruption markers at the specified interval (in task count)
 * Returns a new array including markers like `__INTERRUPTION__:<index>`
 */
export function insertInterruptions(tasks: string[], interval: number): string[] {
  if (interval < 1) return tasks;
  const result: string[] = [];
  tasks.forEach((task, idx) => {
    result.push(task);
    if ((idx + 1) % interval === 0) {
      result.push(`__INTERRUPTION__:${idx + 1}`);
    }
  });
  return result;
}

/**
 * Pulling out the parsing logic from CSVLoader.tsx
 * @param text 
 * @returns split up into the components of the csv
 */
export function parseCSVText(text: string): string[] {
  const lines = text
    .split("\n")
    .map(l => l.trim())
    .filter(l => l !== "");
  return lines.map(line => line.split(",")[0].trim());
}