// utils/promptBank.ts
import { parseCSVText } from "./csvUtils";

export async function loadPromptBank(path = "/prompts.csv"): Promise<string[]> {
  const response = await fetch(path);
  const text = await response.text();
  return parseCSVText(text);
}
