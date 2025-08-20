import React, { useState, useEffect } from "react";
import { getTutorialSteps } from "./tutorialSteps";
import type { TutorialStep } from "../../types/tutorial";
import TutorialOverlay from "./TutorialOverlay";
import "./tutorial.css";

export interface StartSequenceManagerProps {
  onComplete: () => void;
  resetSignal?: number;
  hasChosenSize: boolean;
  onSizeChosen: () => void;
  //onSizeChosen?: (size: "small" | "medium" | "large") => void;
}

const StartSequenceManager: React.FC<StartSequenceManagerProps> = ({
  onComplete,
  resetSignal,
  hasChosenSize,
  onSizeChosen,
}) => {
  const tutorialSteps = getTutorialSteps();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [finished, setFinished] = useState(false);
  //const [hasChosenSize, setHasChosenSize] = useState(false);

  const currentStep: TutorialStep = tutorialSteps[currentStepIndex];

  // Reset when resetSignal changes
  // useEffect(() => {
  //   setCurrentStepIndex(0);
  //   //setHasChosenSize(false);
  // }, [resetSignal]);

  useEffect(() => {
    let steps = getTutorialSteps();

    let startIndex = 0;

    while (
      startIndex < steps.length &&
      steps[startIndex].shouldSkip?.({ hasChosenSize })
    ) {
      startIndex++;
    }

    setCurrentStepIndex(startIndex);
  }, [resetSignal, hasChosenSize]);

  // const handleOptionSelected = (value: string) => {
  //   if (["small", "medium", "large"].includes(value)) {
  //     onSizeChosen(); // persist choice to App
  //   }
  // };

  const handleNext = () => {
    setCurrentStepIndex((prevIndex) => {
      let nextIndex = prevIndex + 1;

      // skip over steps that should be skipped
      while (
        nextIndex < tutorialSteps.length &&
        tutorialSteps[nextIndex].shouldSkip?.({ hasChosenSize })
      ) {
        nextIndex++;
      }

      if (nextIndex < tutorialSteps.length) {
        return nextIndex;
      } else {
        setFinished(true); // mark finished, effect will call onComplete
        return prevIndex; // stay at last step
      }
    });
  };

  // Effect to safely call onComplete outside render
  useEffect(() => {
    if (finished) {
      onComplete();
    }
  }, [finished, onComplete]);




  const handleSkip = () => {
    if (hasChosenSize) {
      // Already chosen → just end tutorial
      onComplete();
    } else {
      // Not chosen → jump to the final step before complete
      setCurrentStepIndex(tutorialSteps.length - 2);
    }
  };

  // Scroll highlight into view
  useEffect(() => {
    if (currentStep?.highlight && typeof currentStep.highlight === "string") {
      const el = document.querySelector(currentStep.highlight);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      }
    }
  }, [currentStep]);

  return (
    <>
      {currentStep && currentStep.type !== "titleScreen" && (
        // StartSequenceManager.tsx (bridge between Step + Overlay)
        <TutorialOverlay
          title={currentStep.title}
          text={currentStep.text}
          highlight={currentStep.highlight}
          options={currentStep.options}
          skipButton={currentStep.skipButton}
          buttonText={currentStep.buttonText}
          centered={currentStep.centered}
          onNext={(val?: string) => {
            if (val) {
              currentStep.onSelect?.(val, () => onSizeChosen());
            }
            handleNext();
          }}
          onSelect={(val: string) => {
            currentStep.onSelect?.(val, () => onSizeChosen());
            handleNext();
          }}

          onSkip={handleSkip}
        />


      )}
    </>
  );
};

export default StartSequenceManager;
