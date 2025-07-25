import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RobotArm, type Point } from './utils/RobotArm';
import { catmullRomSpline } from './utils/CatmullRom';
import { CanvasStage } from './components/CanvasStage';
import { GraphEditorPanel } from './components/GraphEditorPanel';
import { PlayButton } from './components/UI/PlayButton';
import { MotionParameterMap } from './utils/MotionParameterMap';
import { perlin1D } from './utils/perlin';

const CANVAS_WIDTH = 700;
const CANVAS_HEIGHT = 500;
const MAX_POINTS = 10;
const ARM_BASE = { x: 50, y: CANVAS_HEIGHT / 2 };
const LIMB_LENGTHS: [number, number] = [250, 250];

type Zone = {
  id: number;
  x: number;
  y: number;
  radius: number;
};


export default function App() {
  // State for path key points
  const [pathPoints, setPathPoints] = useState<Point[]>([
    ARM_BASE,
    { x: 500, y: CANVAS_HEIGHT / 2 },
  ]);

  const [zones, setZones] = React.useState<Zone[]>([
    { id: 1, x: 300, y: CANVAS_HEIGHT / 2, radius: 40 },
  ]);

  // Function to add a new zone
  function addZone() {
    setZones(zones => [
      ...zones,
      { id: Date.now(), x: 200, y: CANVAS_HEIGHT / 2, radius: 40 },
    ]);
  }

  // Curvature tension controls Catmull-Rom spline tightness (0 = tight, 1 = loose)
  //const [curvatureTension, setCurvatureTension] = useState(0.5);

  const [curvatureGraph, setCurvatureGraph] = useState<Point[]>(() =>
    pathPoints.map((_, i) => ({ x: i / (pathPoints.length - 1 || 1), y: 0.5 }))
  );

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

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <>
      <div style={{ display: 'flex', gap: 20, padding: 20 }}>
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

        <div style={{ width: 220, userSelect: 'none' }}>
          {/* <label>
          Curvature Tension: {curvatureTension.toFixed(2)}
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={curvatureTension}
            onChange={(e) => setCurvatureTension(parseFloat(e.target.value))}
            style={{ width: '100%' }}
          />
        </label> */}

          <button onClick={addZone} style={{ position: 'absolute', top: 8, right: 8, backgroundColor: '#ff000090', color: 'white', fontWeight: 'bold', cursor: 'pointer' }}>
            + Add Avoid Zone
          </button>


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

        </div>

        {/* Placeholder Dev Menu
        <div style={{
          width: 180,
          backgroundColor: '#f0f0f0',
          border: '1px solid #ccc',
          borderRadius: 6,
          padding: 12,
          userSelect: 'none',
          fontSize: 14,
          color: '#333',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          height: CANVAS_HEIGHT,
          boxShadow: '0 0 6px rgba(0,0,0,0.1)',
        }}>
          <h3 style={{ margin: 0, fontSize: 18, textAlign: 'center' }}>Dev Menu</h3>
          <label>
            <input type="checkbox" disabled /> Placeholder Option 1
          </label>
          <label>
            <input type="checkbox" disabled /> Placeholder Option 2
          </label>
          <button disabled style={{ marginTop: 'auto' }}>Dummy Button</button>
        </div> */}

        {/* Overlay placeholders */}
        <div style={{
          position: 'absolute',
          top: 8,
          left: 8,
          color: 'rgba(0,0,0,0.4)',
          fontSize: 14,
          fontStyle: 'italic',
          maxWidth: 200,
          userSelect: 'none',
          pointerEvents: 'none',
        }}>
          <b>Task Prompt: Carefree (PLACEHOLDER)</b><br />
          Trace the path by dragging keyframes.<br />
          Use graphs to adjust curvature, speed, and noise.
        </div>

        <div style={{
          position: 'absolute',
          bottom: 8,
          right: 8,
          color: 'rgba(0,0,0,0.4)',
          fontSize: 14,
          fontStyle: 'italic',
          maxWidth: 220,
          textAlign: 'right',
          userSelect: 'none',
          pointerEvents: 'none',
        }}>
          <b>Instructions: (EXAMPLE)</b><br />
          • Drag pink dots to adjust path shape.<br />
          • Click on path line to add new keyframes.<br />
          • Press Play to animate the arm.
        </div>
      </div >
    </>
  );
}
