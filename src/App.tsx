import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RobotArm, type Point } from './utils/RobotArm';
import { catmullRomSpline } from './utils/CatmullRom';
import { CanvasStage } from './components/CanvasStage';
import DevMenu from './components/DevMenu';
import { GraphEditorPanel } from './components/GraphEditorPanel';
import { PlayButton } from './components/UI/PlayButton';
import { MotionParameterMap } from './utils/MotionParameterMap';
import { perlin1D } from './utils/perlin';
import { useZones } from './types/zones';
import { HashRouter, Routes, Route } from 'react-router-dom';
import MarkdownViewer from './MarkdownViewer';

import { CurrentTaskDisplay } from './components/CurrentTaskDisplay';
import { InstructionPanel } from './components/InstructionPanel';
import { ProgressBar } from './components/ProgressBar';

import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  MAX_POINTS,
  ARM_BASE,
  LIMB_LENGTHS,
} from './config/constants';


export default function App() {
  // State for path key points
  const [devMenuOpen, setDevMenuOpen] = useState(false);
  //const [hasAccess, setHasAccess] = useState(false);
  const [totalDuration, setTotalDuration] = useState(5);

  const [taskList, setTaskList] = useState<string[]>([]);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);

  const [pathPoints, setPathPoints] = useState<Point[]>([
    ARM_BASE,
    { x: 500, y: CANVAS_HEIGHT / 2 },
  ]);

  // ZONE STUFF
  const [robotTip, setRobotTip] = useState<Point>(pathPoints[0]);

  const { zones, setZones, addZone, clearZones } = useZones(CANVAS_HEIGHT / 2);


  // Curvature tension controls Catmull-Rom spline tightness (0 = tight, 1 = loose)
  //const [curvatureTension, setCurvatureTension] = useState(0.5);

  const [curvatureGraph, setCurvatureGraph] = useState<Point[]>(() =>
    pathPoints.map((_, i) => ({ x: i / (pathPoints.length - 1 || 1), y: 0.5 }))
  );

  useEffect(() => {
    document.body.classList.toggle('dev-menu-open', devMenuOpen);
  }, [devMenuOpen]);


  useEffect(() => {
    function syncGraph(graph: Point[], setter: React.Dispatch<React.SetStateAction<Point[]>>) {
      const n = pathPoints.length;
      const newGraph = [];
      for (let i = 0; i < n; i++) {
        const normalizedX = n === 1 ? 0 : i / (n - 1);
        newGraph.push({ x: normalizedX, y: graph[i]?.y ?? 0.5 });
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
    pathPoints.map((_, i) => ({ x: i / (pathPoints.length - 1 || 1), y: 0.1 }))
  );

  // Sync graphs when pathPoints length changes (to avoid mismatch)
  useEffect(() => {
    function syncGraph(graph: Point[], setter: React.Dispatch<React.SetStateAction<Point[]>>) {
      const n = pathPoints.length;
      const newGraph = [];
      for (let i = 0; i < n; i++) {
        const normalizedX = n === 1 ? 0 : i / (n - 1);
        newGraph.push({ x: normalizedX, y: graph[i]?.y ?? 0.5 });
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

  // Play animation function - moves along spline using tension & speed/noise maps
  function handlePlay() {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }

    // Generate smooth spline with current tension
    const smoothSpline = catmullRomSpline(
      pathPoints,
      20,
      t => curvatureMap.evaluate(t)  // <-- pass a function here!
    );


    let progress = 0;
    const maxProgress = smoothSpline.length - 1;

    // Speed range in spline indices per frame
    const minSpeed = 0.005;
    const maxSpeed = 1;

    function step() {
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

      // // Noise offsets (random jitter scaled by noise)
      // const noiseOffsetX = (Math.random() - 0.5) * 10 * noiseVal;
      // const noiseOffsetY = (Math.random() - 0.5) * 10 * noiseVal;

      const time = performance.now() / 1000; // seconds

      const noiseOffsetX = perlin1D(time + normalizedPos * 2) * 100 * noiseVal;
      const noiseOffsetY = perlin1D(time + normalizedPos * 2 + 1000) * 100 * noiseVal;

      const noisyTarget = { x: interpX + noiseOffsetX, y: interpY + noiseOffsetY };

      setRobotTip(noisyTarget); // Track real-time robot position


      // Solve IK for noisy target & update angles
      arm.solveIK(noisyTarget);
      setAngles([...arm.angles]);

      // Advance progress by speed mapped to spline index increments
      const speed = minSpeed + speedVal * (maxSpeed - minSpeed);
      progress += speed;

      animationRef.current = requestAnimationFrame(step);
    }

    animationRef.current = requestAnimationFrame(step);
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

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={
          <div id="root">
            <div className="app-container" id="mainContent">
              <div className="main-container" id="main-container">
                <h1>Main App Content</h1>
                <div id="main-items">
                  <CanvasStage
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    pathPoints={pathPoints}
                    setPathPoints={setPathPoints}
                    arm={arm}
                    angles={angles}
                    setAngles={setAngles}
                    maxPoints={MAX_POINTS}
                    zones={zones}
                    setZones={setZones}
                    curvatureGraph={curvatureGraph}
                  />
                  <div id="user-controls">
                    <GraphEditorPanel
                      label="Tension"
                      graphPoints={curvatureGraph}
                      setGraphPoints={setCurvatureGraph}
                      pathPoints={pathPoints}
                    />
                    <GraphEditorPanel
                      label="Speed"
                      graphPoints={speedGraph}
                      setGraphPoints={setSpeedGraph}
                      pathPoints={pathPoints}
                    />
                    <GraphEditorPanel
                      label="Randomness"
                      graphPoints={noiseGraph}
                      setGraphPoints={setNoiseGraph}
                      pathPoints={pathPoints}
                    />
                    <PlayButton onClick={handlePlay} />
                    <button
                      id="dev-open"
                      onClick={() => setDevMenuOpen(!devMenuOpen)}
                    >
                      {devMenuOpen ? 'Close Dev Menu' : 'Open Dev Menu'}
                    </button>

                    <InstructionPanel
                    />

                    <CurrentTaskDisplay
                      task={taskList[currentTaskIndex] || null}
                      index={currentTaskIndex}
                      total={taskList.length}
                    />

                    <ProgressBar
                      current={currentTaskIndex + 1}
                      total={taskList.length}
                    />

                  </div>
                </div>
              </div>
              {/* Dev Menu overlay */}
              <DevMenu
                isOpen={devMenuOpen}
                toggleOpen={() => setDevMenuOpen(!devMenuOpen)}
                onClose={() => setDevMenuOpen(false)}
                onDone={() => {
                  console.log('[DevMenu] Done clicked');
                  setDevMenuOpen(false);
                }}
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
                addAvoidZone={() => addZone('avoid')}
                addRequiredZone={() => addZone('required')}
                clearZones={clearZones}
              />
            </div>
          </div>
        } />
        {/* Markdown Viewer */}
        <Route path="/asset-help" element={
          <MarkdownViewer filePath="AssetHelp.markdown" />
        } />
      </Routes>
    </HashRouter>
  );
}
