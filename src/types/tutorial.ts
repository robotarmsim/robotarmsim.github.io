// types/tutorial.ts
export interface TutorialStep {
  id: string;
  type: string;
  title: string;
  highlight?: string | { top: number; left: number; width: number; height: number };
  text?: string;
  options?: { label: string; value: string }[];
  buttonText?: string;
  skipButton?: boolean;
  centered?: boolean;
  hasChosenSize?: boolean;
  hasProlific?: boolean;

  // tutorial-only hooks
  shouldSkip?: (ctx: { hasChosenSize?: boolean; hasProlific?: boolean }) => boolean;
  onSelect?: (value: string, setHasChosenSize?: (v: boolean) => void) => void;
  
}
