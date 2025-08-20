import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RobotArm, type Point } from './utils/RobotArm';
// import { catmullRomSpline } from './utils/CatmullRom';
import { bezierSpline } from './utils/Bezier';
import { CanvasStage } from './components/CanvasStage';
import DevMenu from './components/DevMenu';
import { GraphEditorPanel } from './components/GraphEditorPanel';
import { PlayButton } from './components/UI/PlayButton';
import { MotionParameterMap } from './utils/MotionParameterMap';
import { perlin1D } from './utils/perlin';
import { useZones } from './types/zones';
import { HashRouter, Routes, Route } from 'react-router-dom';
import MarkdownViewer from './MarkdownViewer';
import { nanoid } from 'nanoid';
import { CurrentTaskDisplay } from './components/CurrentTaskDisplay';
import { useTrackingLogs, type MotionLogEntry } from './hooks/useTrackingLogs';
// took out SessionLogs from above. TBD.
//import { loadPromptBank } from "./utils/promptBank";
//import { taskSizeMap } from "./utils/taskPicker";
import StartSequenceManager from './components/StartSequence/StartSequenceManager';
//import { tutorialSteps } from './components/StartSequence/tutorialSteps';
import HelpButton from './components/UI/HelpButton';



import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  //MAX_POINTS,
  ARM_BASE,
  LIMB_LENGTHS,
  START_POINT,
  END_POINT,
} from './config/constants';


export default function App(
) {
  // Initial states/tutorial
  const [started, setStarted] = useState(false);
  const [showStartSequence, setShowStartSequence] = useState(false);
  const [resetTutorialSignal, setResetTutorialSignal] = useState(0);

  // for autopromptlist!!
  // const [allPrompts, setAllPrompts] = useState<string[]>([]);
  // const [tasks, setTasks] = useState<string[]>([]);
  // // Load prompt bank on startup
  // useEffect(() => {
  //   loadPromptBank().then(setAllPrompts);
  // }, []);
  const [hasChosenSize, setHasChosenSize] = useState(false);


  // State for path key points
  const [devMenuOpen, setDevMenuOpen] = useState(false);
  //const [hasAccess, setHasAccess] = useState(false);
  const [totalDuration, setTotalDuration] = useState(5);


  // CSVLOADER & DEVMENU STUFF
  const [showProgress, setShowProgress] = useState(false);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [taskList, setTaskList] = useState<string[]>(() => {
    const saved = localStorage.getItem("taskList");
    return saved ? JSON.parse(saved) : [];
  });
  // Get tasks that are NOT interruptions
  const realTasks = taskList.filter(task => !task.startsWith("__INTERRUPTION__"));
  // Compute current real index
  const currentRealIndex = realTasks.findIndex(t => t === taskList[currentTaskIndex]);

  // USER ID
  const [userId] = useState(() =>
    localStorage.getItem('userId')
    || (() => {
      const id = nanoid();
      localStorage.setItem('userId', id);
      return id;
    })()
  );

  // pathpoints.
  const [pathPoints, setPathPoints] = useState<Point[]>([
    START_POINT,
    END_POINT,
  ]);

  // ZONE STUFF
  const [robotTip, setRobotTip] = useState<Point>(pathPoints[0]);
  const { zones, setZones, addZone, clearZones } = useZones(CANVAS_HEIGHT / 2);

  //RECORDING MOTION
  const {
    //motionLog,
    //sessionLog,
    logMotionFrame,
    logSessionEvent,
    saveMotionLog,
    saveSessionLog,
    loadMotionLog,
    loadSessionLog,
    setSessionLog,
  } = useTrackingLogs();

  // Curvature tension controls Catmull-Rom spline tightness (0 = tight, 1 = loose)
  const [curvatureGraph, setCurvatureGraph] = useState<Point[]>(() =>
    pathPoints.map((_, i) => ({ x: i / (pathPoints.length - 1 || 1), y: 0 })) // 0 by default
  );

  useEffect(() => {
    function onDevEnable() {
      document.body.classList.remove("dev-hidden");
      // show your dev menu again
    }
    window.addEventListener("dev:enable", onDevEnable);
    return () => window.removeEventListener("dev:enable", onDevEnable);
  }, []);


  useEffect(() => {
    document.body.classList.toggle('dev-menu-open', devMenuOpen);
  }, [devMenuOpen]);

  useEffect(() => {
    //console.log('App showProgress is now', showProgress);
  }, [showProgress]);


  useEffect(() => {
    function syncGraph(graph: Point[], setter: React.Dispatch<React.SetStateAction<Point[]>>) {
      const n = pathPoints.length;
      const newGraph = [];
      for (let i = 0; i < n; i++) {
        const normalizedX = n === 1 ? 0 : i / (n - 1);
        newGraph.push({ x: normalizedX, y: graph[i]?.y ?? 0 }); // default to 0
      }
      setter(newGraph);
    }
    syncGraph(curvatureGraph, setCurvatureGraph);
    syncGraph(speedGraph, setSpeedGraph);
    syncGraph(noiseGraph, setNoiseGraph);
  }, [pathPoints.length]);

  // Graph data for speed and noise along the path (normalized 0..1)
  const [speedGraph, setSpeedGraph] = useState<Point[]>(() =>
    pathPoints.map((_, i) => ({ x: i / (pathPoints.length - 1 || 1), y: 0.5 }))
  );
  const [noiseGraph, setNoiseGraph] = useState<Point[]>(() =>
    pathPoints.map((_, i) => ({ x: i / (pathPoints.length - 1 || 1), y: 0 })) //0 by default
  );

  // Sync graphs when pathPoints length changes (to avoid mismatch)
  useEffect(() => {
    function syncGraph(graph: Point[], setter: React.Dispatch<React.SetStateAction<Point[]>>) {
      const n = pathPoints.length;
      const newGraph = [];
      for (let i = 0; i < n; i++) {
        const normalizedX = n === 1 ? 0 : i / (n - 1);
        newGraph.push({ x: normalizedX, y: graph[i]?.y ?? 0 }); // default to 0
      }
      setter(newGraph);
    }
    syncGraph(speedGraph, setSpeedGraph);
    syncGraph(noiseGraph, setNoiseGraph);
  }, [pathPoints.length]);

  // Create motion parameter maps for interpolation
  const curvatureMap = useMemo(() => new MotionParameterMap(curvatureGraph), [curvatureGraph]);
  const speedMap = useMemo(() => new MotionParameterMap(speedGraph), [speedGraph]);
  const noiseMap = useMemo(() => new MotionParameterMap(noiseGraph), [noiseGraph]);

  // Initialize robot arm
  const arm = useMemo(() => new RobotArm(ARM_BASE, LIMB_LENGTHS), []);

  // Angles to render arm joints
  const [angles, setAngles] = useState<[number, number]>(() => {
    arm.solveIK(pathPoints[0]);
    return [...arm.angles];
  });

  // Animation refs/state
  const animationRef = useRef<number | null>(null);

  // Play animation function -> moves along spline using tension & speed/noise maps
  function handlePlay() {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }

    // Generate smooth spline with current tension
    const smoothSpline = bezierSpline(
      pathPoints,
      20,
      t => curvatureMap.evaluate(t)  // <-- pass a function here!
    );


    //let progress = 0;
    const maxProgress = smoothSpline.length - 1;
    const animationStart = performance.now(); // capture the start time

    // Speed range in spline indices per frame
    const minSpeed = 0.005;
    const maxSpeed = 100;

    function step() {
      const elapsed = (performance.now() - animationStart) / 1000; // seconds
      const normalizedTime = Math.min(elapsed / totalDuration, 1); // clamp to 1
      const progress = normalizedTime * maxProgress;
      if (progress >= maxProgress) {
        setAngles([...arm.angles]); // Final pose
        animationRef.current = null;
        return; // Stop animation
      }

      const i = Math.floor(progress);
      const t = progress - i;

      // Interpolate between smooth spline points
      const p1 = smoothSpline[i];
      const p2 = smoothSpline[Math.min(i + 1, maxProgress)];
      const interpX = p1.x * (1 - t) + p2.x * t;
      const interpY = p1.y * (1 - t) + p2.y * t;

      // Normalized progress [0..1]
      const normalizedPos = progress / maxProgress;

      // Evaluate speed & noise
      const speedVal = speedMap.evaluate(normalizedPos);
      const noiseVal = noiseMap.evaluate(normalizedPos);

      const time = performance.now() / 1000; // 

      const noiseOffsetX = perlin1D(time + normalizedPos * 2) * 100 * noiseVal;
      const noiseOffsetY = perlin1D(time + normalizedPos * 2 + 1000) * 100 * noiseVal;

      const noisyTarget = { x: interpX + noiseOffsetX, y: interpY + noiseOffsetY };

      setRobotTip(noisyTarget); // Track real-time robot position

      // Solve IK for noisy target & update angles
      arm.solveIK(noisyTarget);
      setAngles([...arm.angles]);

      // Log motion frame for recording
      logMotionFrame({
        t: performance.now(),
        position: noisyTarget,
        angles: [...arm.angles],
        speed: speedVal,
        velocity: minSpeed + speedVal * (maxSpeed - minSpeed),
        noise: noiseVal,

        userId,
        task: taskList[currentTaskIndex] || null,
      });

      if (normalizedTime < 1) {
        animationRef.current = requestAnimationFrame(step);
      } else {
        animationRef.current = null; // Done
      }
    }

    animationRef.current = requestAnimationFrame(step);
  }

  // Replay function drives arm from a saved motionLog
  function replayMotion(data: MotionLogEntry[]) {
    let idx = 0;
    function step() {
      if (idx >= data.length) return;
      const entry = data[idx++];
      setRobotTip(entry.position);
      setAngles(entry.angles);
      requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }


  useEffect(() => {
    setZones(zones =>
      zones.map(zone => {
        if (zone.type === 'required' && !zone.visited) {
          const dx = robotTip.x - zone.x;
          const dy = robotTip.y - zone.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const inside = dist <= zone.radius;
          if (inside) {
            return { ...zone, visited: true };
          }
        }

        return zone;
      })
    );
  }, [robotTip]);


  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // TOGGLE DEV MENU
  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey && e.shiftKey && e.key === "~") {
      setDevMenuOpen(prev => !prev); // toggle the state
    }
  });

  useEffect(() => {
    const handler = (e: { ctrlKey: any; shiftKey: any; key: string; }) => {
      if (e.ctrlKey && e.shiftKey && e.key === "~") {
        setDevMenuOpen(prev => !prev);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);



  return (
    <HashRouter>
      <Routes>
        <Route
          path="/"
          element={
            <div id="root">

              {/* Start Screen Overlay */}
              {!started && (
                <div id="title-screen">
                  <h1>Robot Arm Simulator</h1>
                  <button
                    onClick={() => {
                      setStarted(true);           // show main app layout
                      setShowStartSequence(true); // immediately trigger tutorial
                    }}
                  >
                    Start Tutorial
                  </button>
                </div>
              )}


              {started && (
                <div id="appLayout">
                  {/* of course! another div will fix this! */}
                  <div className="app-container" id="mainContent">
                    <div className="main-container" id="main-container">
                      <div id="starting-point">
                        <h1>Robot Arm Simulator</h1>
                      </div>
                      <div id="main-wrapper">
                        <div
                          className="task-header"
                          id="task-bar"
                        //style={{ margin: '1rem 0', textAlign: 'center' }}
                        >
                          {/* <InstructionPanel/> */}

                          <CurrentTaskDisplay
                            task={taskList[currentTaskIndex] || null}
                            index={currentRealIndex}
                            total={realTasks.length}
                            showProgress={showProgress}
                          />
                        </div>
                        <div id="main-items">
                          <div id="just-canvas">
                            <CanvasStage
                              width={CANVAS_WIDTH}
                              height={CANVAS_HEIGHT}
                              pathPoints={pathPoints}
                              setPathPoints={setPathPoints}
                              arm={arm}
                              angles={angles}
                              setAngles={setAngles}
                              zones={zones}
                              setZones={setZones}
                              curvatureGraph={curvatureGraph}
                              noiseGraph={noiseGraph}
                            />

                          </div>

                          <div id="user-controls">
                            <div id="curvaturegraph">
                              <GraphEditorPanel
                                id="curvature-graph"
                                label="Curvature"
                                graphPoints={curvatureGraph}
                                setGraphPoints={(points) => {
                                  setCurvatureGraph(points);
                                  logSessionEvent({
                                    time: Date.now(),
                                    type: 'graphChange',
                                    label: 'Curvature',
                                    data: points
                                  });
                                }}
                                pathPoints={pathPoints}
                              />
                            </div>
                            <div id="speedgraph">
                              <GraphEditorPanel
                                id="speed-graph"
                                label="Speed"
                                graphPoints={speedGraph}
                                setGraphPoints={(points) => {
                                  setSpeedGraph(points);
                                  logSessionEvent({
                                    time: Date.now(),
                                    type: 'graphChange',
                                    label: 'Speed',
                                    data: points
                                  });
                                }}
                                pathPoints={pathPoints}
                              />
                            </div>
                            <div id="noisegraph">
                              <GraphEditorPanel
                                id="noise-graph"
                                label="Randomness"
                                graphPoints={noiseGraph}
                                setGraphPoints={(points) => {
                                  setNoiseGraph(points);
                                  logSessionEvent({
                                    time: Date.now(),
                                    type: 'graphChange',
                                    label: 'Noise',
                                    data: points
                                  });
                                }}
                                pathPoints={pathPoints}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="user-buttons">
                          <button
                            className="user-buttons" id="clear-points-button"
                            onClickCapture={() => {
                              // Clear user-added path points
                              setPathPoints([
                                START_POINT,
                                END_POINT
                              ]);
                            }}
                          >
                            Clear
                          </button>

                          <PlayButton id="play-button" onClick={handlePlay} />

                          <button
                            className="user-buttons" id="next-task-button"
                            onClickCapture={() => {
                              // Clear user-added path points
                              setPathPoints([
                                START_POINT,
                                END_POINT
                              ]);

                              // reset visited status on zones too
                              setZones(z => z.map(zone => ({ ...zone, visited: false })));

                              // Go to next task
                              setCurrentTaskIndex(i =>
                                Math.min(i + 1, taskList.length - 1)
                              );
                            }}
                            disabled={currentTaskIndex >= taskList.length - 1}
                          >
                            Next
                          </button>
                        </div>

                      </div>
                    </div>
                    {/* Help Button */}
                    <HelpButton
                      id="help-button"
                      onReplayTutorial={() => {
                        setShowStartSequence(true);              // make the tutorial visible
                        setResetTutorialSignal(prev => prev + 1); // trigger reset logic inside it
                      }}
                    />

                    {/* ABOvE: NEED TO FIX... */}
                    {/* Dev Menu overlay */}
                    <DevMenu
                      isOpen={devMenuOpen}
                      onClose={() => setDevMenuOpen(false)}
                      onDone={() => setDevMenuOpen(false)}
                      toggleRoboticLook={(enabled) => {
                        console.log('Robotic Look:', enabled);
                      }}
                      totalDuration={totalDuration}
                      setTotalDuration={setTotalDuration}
                      onTasksLoaded={(tasks) => {
                        console.log('App received tasks from DevMenu:', tasks);
                        setTaskList(tasks);
                        setCurrentTaskIndex(0);
                      }}
                      addAvoidZone={() => {
                        const newZone = addZone('avoid');
                        setSessionLog(prev => ({ ...prev, zones: [...prev.zones, newZone] }));
                        logSessionEvent({
                          time: Date.now(),
                          type: 'addZone',
                          label: 'avoid',
                          data: newZone
                        });
                      }}
                      addRequiredZone={() => {
                        const newZone = addZone('required');
                        setSessionLog(prev => ({ ...prev, zones: [...prev.zones, newZone] }));
                        logSessionEvent({
                          time: Date.now(),
                          type: 'addZone',
                          label: 'required',
                          data: newZone
                        });
                      }}
                      replayMotion={replayMotion}
                      setZones={setZones}
                      clearZones={clearZones}
                      setShowProgress={setShowProgress}
                      totalTasks={taskList.length}
                      saveMotionLog={saveMotionLog}
                      saveSessionLog={saveSessionLog}
                      loadMotionLog={loadMotionLog}
                      loadSessionLog={loadSessionLog}
                    />

                  </div>
                  {/* Tutorial Overlay */}
                  {showStartSequence && (
                    <StartSequenceManager
                      //tutorialSteps={tutorialSteps}
                      onComplete={() => setShowStartSequence(false)}
                      resetSignal={resetTutorialSignal}
                      hasChosenSize={hasChosenSize}              // 👈 pass down
                      onSizeChosen={() => setHasChosenSize(true)} // 👈 callback
                    />
                  )}
                </div>

              )}
            </div>
          } />
        {/* Markdown Viewer */}
        <Route path="/asset-help" element={
          <MarkdownViewer filePath="AssetHelp.markdown" />
        } />
      </Routes>
    </HashRouter >
  );
}
