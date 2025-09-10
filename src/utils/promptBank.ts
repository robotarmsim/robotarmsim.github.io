// utils/promptBank.ts
import { parseCSVText, shuffle, insertInterruptions } from "./csvUtils";

const csvFiles = ["/laban.csv", "/metaphors.csv"];

export async function getRandomPromptList(): Promise<string[]> {
  // Pick a CSV randomly
  const randomFile = csvFiles[Math.floor(Math.random() * csvFiles.length)];
  const res = await fetch(randomFile);
  const text = await res.text();

  let tasks = parseCSVText(text);

  // Apply DevMenu-like randomization & interruptions
  const randomOrder = true;        // mimic DevMenu default if needed
  const interruptionEnabled = true; 
  const interruptionInterval = 1;  // insert after every task

  if (randomOrder) tasks = shuffle(tasks);
  if (interruptionEnabled) tasks = insertInterruptions(tasks, interruptionInterval);

  return tasks;
}
