// utils/taskPicker.ts
export const taskSizeMap: Record<"small" | "medium" | "large", number> = {
  small: 5,
  medium: 10,
  large: 20,
};

export function pickTasks(
  prompts: string[],
  size: "small" | "medium" | "large"
): string[] {
  const count = taskSizeMap[size];
  // Right now just take the first `count` prompts
  return prompts.slice(0, count);
}