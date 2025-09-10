import React, { useState } from "react";
import { getTutorialSteps } from "./tutorialSteps";
import type { TutorialStep } from "../../types/tutorial";
import TutorialOverlay from "./TutorialOverlay";

export interface StartSequenceManagerProps {
  onComplete: () => void;
  resetSignal?: number;
}

const StartSequenceManager: React.FC<StartSequenceManagerProps> = ({
  onComplete,
  resetSignal,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const steps: TutorialStep[] = getTutorialSteps();

  React.useEffect(() => {
    if (resetSignal !== undefined) {
      setCurrentStep(0);
    }
  }, [resetSignal]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  if (currentStep >= steps.length) return null;

  const step = steps[currentStep];

  return (
    <TutorialOverlay
      highlight={step.highlight}
      title={step.title}
      text={step.text}
      onNext={handleNext}
      onSkip={handleSkip}
      showSkip={true}
      showNext={true}
    />
  );
};

export default StartSequenceManager;
