> Set up framework, tailwind.
> added ts versions of utils: ik.ts, spline.ts, noise.ts.
> created motion.ts to replace MotionPlanner.js from v5.1. thats it for the utils folder for now.
> in /components: made CanvasRenderer.ts (CanvasRenderer.js in v5.1)

> started PopupManager.ts
> created Popup.tsx that's supposed to work with PopupManager.ts.

> SHOULD PROBABLY DELETE AND RESTART BOTH OF THESE FILES. BCM.
> deleted PopupManager.ts and Popup.tsx

> NEXT DAY. SegmentPopup.tsx.
> CanvasStage.tsx: instantiates CanvasRenderer and SegmentPopup
    > sets up canvas, motionplanner, and canvasrenderer
    > handles click-to-add / click-to-edit logic based on the locked state.
    > tracks mouse position to position in segmentpopup
    > adds the clear and preview buttons wired to movement planner


> DAY THREE. updated CanvasRenderer, CanvasStage, and App.tsx.
> This thing isn't showing any movement. Damn. I'm not even feeding useMotion into CanvasStage.

> DAY FOUR. idk

> DAY FIVE. Locked is defined by setLocked!! in useMotion.ts. - if length is bigger than maxpts
> Added a new thing called MaxPoints instead of maxPts which should uhh pass in numSegments

> fixed the numSegments nightmare, now the number of checkpoints is controllable again and not static max

> fixed stupid issue with CSV preview having a false header

> heres what I want: the path's visual representation should (accurately!) update based on curvature and noise controls. Additionally, the path should have a color gradient (focused on each point and carrying down the line) based on the Speed control (red being high/fast, green being low value/slow - this would have to have a variation that is colorblind accessible)