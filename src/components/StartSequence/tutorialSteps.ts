// tutorialSteps.ts
import "./tutorial.css";
import type { TutorialStep } from "../../types/tutorial";

export function getTutorialSteps(): TutorialStep[] {
  return [
    {
      id: "starting-point",
      title: "Welcome to Robot Arm Simulator!",
      text: "This tutorial will walk you through the simulator.",
      skipButton: true,
      type: "step",
      centered: true,
    },

    {
      id: "prolific-check",
      type: "prolific-check",
      title: "Are you from Prolific?",
      text: "Please let us know if you are a Prolific participant.",
      centered: true,
      skipButton: false,
      // <-- ADD OPTIONS so yes/no buttons render
      options: [
        { label: "Yes", value: "yes" },
        { label: "No", value: "no" }
      ],
      shouldSkip: ({ hasProlific }) => !!hasProlific,
    },
    {
      id: "canvas",
      highlight: "#just-canvas",
      title: "This is the Robot Arm Canvas",
      text: "All arm motions are drawn here. You can click the path to add more points, try it out!",
      skipButton: true,
      type: "step",
    },
    {
      id: "curvature-graph",
      highlight: "#curvaturegraph",
      title: "Curvature Control",
      text: "Adjust the tension of the spline that the robot arm follows.",
      skipButton: true,
      type: "step",
    },
    {
      id: "speed-graph",
      highlight: "#speedgraph",
      title: "Speed Control",
      text: "Modify the speed of the arm along the path.",
      skipButton: true,
      type: "step",
    },
    {
      id: "noise-graph",
      highlight: "#noisegraph",
      title: "Randomness Control",
      text: "Add slight random offsets to the arm motion to simulate noise.",
      skipButton: true,
      type: "step",
    },
    {
      id: "current-task",
      highlight: ".task-header",
      title: "Current Task",
      text: "Your goal is to design motions that fit the provided prompts, which will be shown here.",
      skipButton: true,
      type: "step",
    },
    {
      id: "play-button",
      highlight: "#play-button",
      title: "Play Animation",
      text: "Click here to see the arm animate along the path.",
      skipButton: true,
      type: "step",
    },
    {
      id: "clear-points",
      highlight: "#clear-points-button",
      title: "Clear Points",
      text: "If you want to reset the path, you can use this button to clear the points.",
      skipButton: true,
      type: "step",
    },
    {
      id: "next-task",
      highlight: "#next-task-button",
      title: "Next Task",
      text: "After you've played the motion and are happy with the design, use this button to submit your motion and move to the next task.",
      skipButton: true,
      type: "step",
    },
    {
      id: "help-button",
      highlight: "#help-button",
      title: "Help & Tutorial Replay",
      text: "Click this button to replay the tutorial or access the system help guides for assistance.",
      skipButton: true,
      type: "step",
    },
    // {
    //   id: "motion-set-size",
    //   type: "step",
    //   skipButton: false,
    //   title: "Choose Motion Set Size",
    //   text: "Before we begin, how many motions would you like to design?",
    //   options: [
    //     { label: "Small set (2 to 5)", value: "small" },
    //     { label: "Medium set (5 to 10)", value: "medium" },
    //     { label: "Large set (10+)", value: "large" },
    //   ],
    //   centered: true,
    //   shouldSkip: ({ hasChosenSize }: { hasChosenSize?: boolean }) => !!hasChosenSize,
    //   onSelect: (value: string, setHasChosenSize?: (v: boolean) => void) => {
    //     console.log("Size option selected:", value);
    //     setHasChosenSize?.(true);
    //   },
    // },
    {
      id: "final",
      type: "step",
      highlight: ".task-header",
      title: "Tutorial Complete!",
      text: "You are now ready to use the Robot Arm Simulator. Enjoy!",
      skipButton: false,
      centered: true,
    },
  ];
}
