// StartSequenceManager.tsx
import React, { useEffect, useRef, useState } from "react";
import { getTutorialSteps } from "./tutorialSteps";
import type { TutorialStep } from "../../types/tutorial";
import TutorialOverlay from "./TutorialOverlay";
import "./tutorial.css";

export interface StartSequenceManagerProps {
  onComplete: () => void;
  resetSignal?: number;
  hasChosenSize: boolean;
  onSizeChosen?: (size: "small" | "medium" | "large") => void;
}

const StartSequenceManager: React.FC<StartSequenceManagerProps> = ({
  onComplete,
  resetSignal = 0,
  hasChosenSize,
  onSizeChosen,
}) => {
  const tutorialSteps = getTutorialSteps();

  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [finished, setFinished] = useState(false);

  // sessionStorage-backed Prolific state
  const [hasProlific, setHasProlificState] = useState<boolean>(() => {
    return !!sessionStorage.getItem("hasProlific");
  });
  const [prolificID, setProlificIDState] = useState<string | null>(() => {
    return sessionStorage.getItem("prolificID");
  });

  const [showProlificInput, setShowProlificInput] = useState(false);

  // refs to avoid double-actions
  const lastResetSignalRef = useRef<number>(resetSignal);
  const calledOnCompleteRef = useRef(false);
  const syncedChosenSizeRef = useRef(false); // ensure we call onSizeChosen at most once when bootstrapping

  const currentStep: TutorialStep = tutorialSteps[currentStepIndex];

  // defensive logger — shows transitions in console for debugging
  useEffect(() => {
    console.log("[StartSequenceManager] mount - hasProlific:", hasProlific, "hasChosenSize:", hasChosenSize);
    return () => console.log("[StartSequenceManager] unmount");
    // intentionally runs on mount/unmount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    console.log("[StartSequenceManager] currentStepIndex ->", currentStepIndex, "stepId:", tutorialSteps[currentStepIndex]?.id);
  }, [currentStepIndex, tutorialSteps]);

  // wrapper setters that persist to sessionStorage
  const setHasProlific = (v: boolean) => {
    setHasProlificState(v);
    if (v) sessionStorage.setItem("hasProlific", "1");
    else sessionStorage.removeItem("hasProlific");
  };
  const setProlificID = (id: string | null) => {
    setProlificIDState(id);
    if (id) sessionStorage.setItem("prolificID", id);
    else sessionStorage.removeItem("prolificID");
  };
  const persistChosenSize = (size: string | null) => {
    if (size) sessionStorage.setItem("chosenSize", size);
    else sessionStorage.removeItem("chosenSize");
  };

  // Bootstrap: if sessionStorage has chosenSize, call onSizeChosen once so App syncs.
  useEffect(() => {
    const storedSize = sessionStorage.getItem("chosenSize") as
      | "small"
      | "medium"
      | "large"
      | null;
    if (storedSize && onSizeChosen && !syncedChosenSizeRef.current) {
      syncedChosenSizeRef.current = true;
      onSizeChosen(storedSize);
    }
    // run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------- IMPORTANT FIX ----------
  // Compute the first visible step when resetSignal OR when hasChosenSize changes.
  // DO NOT include hasProlific here — changing hasProlific mid-tutorial should NOT restart the sequence.
  useEffect(() => {
    // If nothing actually changed (resetSignal unchanged and already finished), don't restart.
    // We still allow explicit resetSignal to re-run.
    if (finished && lastResetSignalRef.current === resetSignal) {
      return;
    }

    lastResetSignalRef.current = resetSignal;

    // When an explicit reset happens or chosen-size changed, clear finished and UI flags
    setFinished(false);
    calledOnCompleteRef.current = false;
    setShowProlificInput(false);

    const steps = getTutorialSteps();
    let startIndex = 0;

    // NOTE: only pass hasChosenSize and NOT hasProlific here
    while (
      startIndex < steps.length &&
      steps[startIndex].shouldSkip?.({ hasChosenSize })
    ) {
      startIndex++;
    }
    setCurrentStepIndex(startIndex);
  }, [resetSignal, hasChosenSize]); // <-- removed hasProlific and finished

  // helper for skip logic (used when advancing)
  const stepShouldSkip = (step?: TutorialStep) =>
    !!step?.shouldSkip?.({ hasChosenSize, hasProlific });

  // Advance to next non-skipped step; mark finished if we go past last
  const handleNext = () => {
    setCurrentStepIndex((prevIndex) => {
      let nextIndex = prevIndex + 1;
      while (nextIndex < tutorialSteps.length && stepShouldSkip(tutorialSteps[nextIndex])) {
        nextIndex++;
      }
      if (nextIndex < tutorialSteps.length) {
        return nextIndex;
      } else {
        setFinished(true);
        return prevIndex;
      }
    });
  };

  // IMPORTANT: persist completion BEFORE calling onComplete (guard)
  useEffect(() => {
    if (finished && !calledOnCompleteRef.current) {
      calledOnCompleteRef.current = true;
      try {
        sessionStorage.setItem("tutorialCompleted", "1");
      } catch (e) {
        console.warn("Could not persist tutorialCompleted:", e);
      }
      onComplete();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]); // intentionally minimal deps

  // Handle option button clicks (Yes/No and size choices)
  const handleSelect = (val: string) => {
    if (currentStep.id === "prolific-check") {
      if (val === "yes") {
        // show input, don't advance or change hasProlific yet
        setShowProlificInput(true);
        return;
      }
      if (val === "no") {
        // persist 'no' answer and advance
        setHasProlific(true);
        setShowProlificInput(false);
        handleNext();
        return;
      }
    }

    if (currentStep.id === "motion-set-size" && onSizeChosen) {
      // persist chosen size in sessionStorage, and bubble to App
      persistChosenSize(val);
      syncedChosenSizeRef.current = true;
      onSizeChosen(val as "small" | "medium" | "large");
    }

    currentStep.onSelect?.(val);
    handleNext();
  };

  // Called by overlay when Next pressed or Prolific Continue supplies an ID
  const handleOverlayNext = (val?: string) => {
    if (currentStep.id === "prolific-check") {
      if (val && val !== "no") {
        // user entered an ID -> persist and advance
        setProlificID(val);
        setHasProlific(true);
        setShowProlificInput(false);
        handleNext();
        return;
      }
      // fallback: treat as answered and advance
      setHasProlific(true);
      setShowProlificInput(false);
      handleNext();
      return;
    }

    if (val) currentStep.onSelect?.(val);
    handleNext();
  };

  const handleSkip = () => {
    if (hasChosenSize) {
      if (!calledOnCompleteRef.current) {
        calledOnCompleteRef.current = true;
        try {
          sessionStorage.setItem("tutorialCompleted", "1");
        } catch {}
        onComplete();
      }
    } else {
      setCurrentStepIndex(tutorialSteps.length - 2);
    }
  };

  // scroll highlighted element into view
  useEffect(() => {
    if (currentStep?.highlight && typeof currentStep.highlight === "string") {
      const el = document.querySelector(currentStep.highlight);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
      }
    }
  }, [currentStep]);

  // defensive: if finished, render nothing (parent should hide overlay)
  if (finished) return null;

  return (
    <>
      {currentStep && currentStep.type !== "titleScreen" && (
        <TutorialOverlay
          title={currentStep.title}
          text={currentStep.text}
          highlight={currentStep.highlight}
          options={currentStep.options}
          skipButton={currentStep.skipButton}
          buttonText={currentStep.buttonText}
          centered={currentStep.centered}
          onNext={(val?: string) => handleOverlayNext(val)}
          onSelect={(val: string) => handleSelect(val)}
          onSkip={handleSkip}
          showProlificInput={showProlificInput}
          setShowProlificInput={setShowProlificInput}
          setHasProlific={setHasProlific}
          setProlificID={setProlificID}
          prolificID={prolificID ?? undefined}
        />
      )}
    </>
  );
};

export default StartSequenceManager;
