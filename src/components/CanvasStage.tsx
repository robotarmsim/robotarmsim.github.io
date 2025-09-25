// src/components/CanvasStage.tsx
import React, { useRef, useEffect, useState, useMemo } from 'react';
import { RobotArm, type Point } from '../utils/RobotArm';
import type { Zone } from '../types/zones';
import { renderRobotArm } from '../utils/PrettierRobot';
import { loadAllImages } from '../utils/ImageManager';
import Triangle from './Triangle';
import checkImg from '../assets/check.svg';
import xImg from '../assets/x-fail.svg';
import { DrawReachableArea } from './UI/DrawReachableArea';
import MotionEngine from '../utils/MotionEngine';

import {
  ARM_BASE,
  START_ANGLES,
  LIMB_LENGTHS,
} from '../config/constants';

const checkImage = new Image();
checkImage.src = checkImg;

const xImage = new Image();
xImage.src = xImg;

interface CanvasStageProps {
  width: number;
  height: number;
  pathPoints: Point[];
  setPathPoints: React.Dispatch<React.SetStateAction<Point[]>>;
  arm: RobotArm;
  angles: [number, number];
  setAngles: React.Dispatch<React.SetStateAction<[number, number]>>;
  zones: Zone[];
  setZones: React.Dispatch<React.SetStateAction<Zone[]>>;
  directnessSegments: number[]; // user edits curvature per-segment
  tempoSegments: number[];      // user edits tempo per-segment
}

// Minimal per-segment evaluator builder -> moved from App.tsx
function makeSegmentEvaluator(segmentValues: number[], pathPoints: Point[]) {
  return {
    evaluate: (s: number) => {
      if (!segmentValues || segmentValues.length === 0) return 0;
      s = Math.max(0, Math.min(1, s));
      const nSeg = Math.max(0, pathPoints.length - 1);
      if (nSeg <= 0) return segmentValues[0] ?? 0;
      const segIdx = Math.min(nSeg - 1, Math.floor(s * nSeg));
      const localT = (s * nSeg) - segIdx;
      const v0 = segmentValues[segIdx] ?? 0;
      const v1 = segmentValues[segIdx + 1] ?? v0;
      return v0 * (1 - localT) + v1 * localT;
    }
  };
}

type TrajectoryState = {
  samples: Point[];
  velocities: number[];
  curvatures: number[];
  speedFrac: number[];
};

export function CanvasStage({
  width,
  height,
  pathPoints,
  setPathPoints,
  arm,
  angles,
  setAngles,
  zones,
  setZones,
  directnessSegments,
  tempoSegments,
}: CanvasStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, setImagesLoaded] = useState(false);

  // keep these since they are used by pointer handlers / UI
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [draggingZoneId, setDraggingZoneId] = useState<number | null>(null);
  const [resizingZoneId, setResizingZoneId] = useState<number | null>(null);
  const [, setInAvoidZone] = useState(false);

  const tipTrailRef = useRef<Point[]>([]);

  useEffect(() => {
    let mounted = true;
    loadAllImages().then(() => {
      if (!mounted) return;
      setImagesLoaded(true);
    });
    return () => { mounted = false; };
  }, []);

  // drawing constants (adjust to taste)
  const SAMPLES_PER_SEGMENT = 24;
  const DIRECTNESS_SCALE = 1.4;
  const BASE_STROKE = 1.5;
  const STROKE_SCALE = 0.02; // multiplier for velocity -> stroke width
  const MINI_DOT_EVERY = 4; // draw larger dots every N samples

  // Build lightweight "ParamMap" evaluators from raw per-segment arrays.
  const directnessMap = useMemo(
    () => makeSegmentEvaluator(directnessSegments, pathPoints),
    [directnessSegments, pathPoints]
  );
  const tempoMap = useMemo(
    () => makeSegmentEvaluator(tempoSegments, pathPoints),
    [tempoSegments, pathPoints]
  );

  // MotionEngine instance (kept across renders)
  const engineRef = useRef<MotionEngine | null>(null);

  // Create engine once (or recreate if arm changes)
  useEffect(() => {
    // create with initial maps (these will be updated by the map-effect below when maps change)
    engineRef.current = new MotionEngine(arm, {
      directnessMap,
      tempoMap,
      segments: SAMPLES_PER_SEGMENT,
      minSpeed: 6,
      maxSpeed: 220,
      accelBase: 1200,
      curvatureBaseScale: 1.0,
    });

    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
    // recreate only when RobotArm instance actually changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arm]);

  // Keep engine maps & segments in sync whenever segment arrays or pathPoints change.
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    // keep engine maps current
    engine.updateMaps({ directnessMap, tempoMap });
    // update segments for sampling density
    try { (engine as any).segments = SAMPLES_PER_SEGMENT; } catch {}
    // no return - this effect simply pushes new maps into the engine
  }, [directnessMap, tempoMap, SAMPLES_PER_SEGMENT]);

  // Keep engine pathPoints in sync and build schedule immediately.
  // Call setPathPoints on the engine (it will rebuild schedule synchronously).
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (!pathPoints || pathPoints.length === 0) {
      // clear schedule
      engine.setPathPoints([]);
      return;
    }
    engine.setPathPoints(pathPoints);
  }, [pathPoints]);

  // Trajectory state (cached for draw)
  const [trajectory, setTrajectory] = useState<TrajectoryState>({
    samples: [],
    velocities: [],
    curvatures: [],
    speedFrac: [],
  });

  // Whenever relevant inputs change, read schedule out of engine and compute curvatures/sNorm
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine || !pathPoints || pathPoints.length === 0) {
      setTrajectory({ samples: [], velocities: [], curvatures: [], speedFrac: [] });
      return;
    }

    // Ensure engine maps are current (defensive; we already update in separate effect)
    engine.updateMaps({ directnessMap, tempoMap });
    try { (engine as any).segments = SAMPLES_PER_SEGMENT; } catch {}

    // engine.setPathPoints(pathPoints) was already called by the pathPoints effect,
    // but calling again is cheap (it will rebuild schedule synchronously).
    engine.setPathPoints(pathPoints);

    // Read schedule via public getter
    const sched = engine.getSchedule();
    const samples: Point[] = (sched.positions ?? []).slice();
    const velocities: number[] = (sched.velocities ?? []).slice();
    const speedFrac: number[] = (sched.speedFractions ?? []).slice();

    if (samples.length === 0) {
      setTrajectory({ samples: [], velocities: [], curvatures: [], speedFrac: [] });
      return;
    }

    // compute normalized s along arc-length for samples
    const n = samples.length;
    const dists: number[] = new Array(n).fill(0);
    for (let i = 1; i < n; i++) {
      dists[i] = Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
    }
    const cumDist: number[] = new Array(n).fill(0);
    for (let i = 1; i < n; i++) cumDist[i] = cumDist[i - 1] + dists[i];
    const totalLen = cumDist[n - 1] || 1e-6;
    const sNorm: number[] = new Array(n);
    for (let i = 0; i < n; i++) sNorm[i] = totalLen === 0 ? 0 : cumDist[i] / totalLen;

    // compute a curvature visualization value from directnessMap (scaled)
    const curvatures = sNorm.map(s => {
      const d = directnessMap.evaluate(s) || 0;
      return Math.max(-1, Math.min(1, d * DIRECTNESS_SCALE));
    });

    setTrajectory({ samples, velocities, curvatures, speedFrac });
  }, [pathPoints, directnessSegments, tempoSegments, directnessMap, tempoMap, SAMPLES_PER_SEGMENT]);

  // pointer helpers and handlers (kept intact)
  function getMousePos(e: React.PointerEvent): Point {
    if (!canvasRef.current) return { x: 0, y: 0 };
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function getClosestPointOnSegment(a: Point, b: Point, p: Point): Point {
    const atob = { x: b.x - a.x, y: b.y - a.y };
    const atop = { x: p.x - a.x, y: p.y - a.y };
    const len = atob.x * atob.x + atob.y * atob.y;
    if (len === 0) return { x: a.x, y: a.y };
    const dot = atop.x * atob.x + atop.y * atob.y;
    const t = Math.max(0, Math.min(1, dot / len));
    return { x: a.x + atob.x * t, y: a.y + atob.y * t };
  }

  function isNearZoneEdge(zone: Zone, x: number, y: number, edgeTolerance = 10) {
    const dist = Math.hypot(zone.x - x, zone.y - y);
    return Math.abs(dist - zone.radius) <= edgeTolerance;
  }

  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    const { x, y } = getMousePos(e);

    if (e.button === 2) {
      const idx = pathPoints.findIndex(
        (pt, i) =>
          i !== 0 &&
          i !== pathPoints.length - 1 &&
          Math.hypot(pt.x - x, pt.y - y) < 12
      );
      if (idx >= 0) {
        const newPoints = pathPoints.filter((_, i) => i !== idx);
        setPathPoints(newPoints);
        return;
      }
    }

    if (e.button === 0) {
      for (const zone of zones) {
        if (isNearZoneEdge(zone, x, y)) {
          setResizingZoneId(zone.id);
          return;
        }
      }

      for (const zone of zones) {
        const dist = Math.hypot(zone.x - x, zone.y - y);
        if (dist <= zone.radius) {
          setDraggingZoneId(zone.id);
          return;
        }
      }

      const idx = pathPoints.findIndex(
        (pt, i) => i !== 0 && i !== pathPoints.length - 1 && Math.hypot(pt.x - x, pt.y - y) < 12
      );
      if (idx >= 0) {
        setDraggingIndex(idx);
        return;
      }

      let closestPt: Point | null = null;
      let insertIndex = -1;
      let closestDist = Infinity;

      for (let i = 0; i < pathPoints.length - 1; i++) {
        const a = pathPoints[i];
        const b = pathPoints[i + 1];
        const proj = getClosestPointOnSegment(a, b, { x, y });
        const dist = Math.hypot(proj.x - x, proj.y - y);
        if (dist < 20 && dist < closestDist) {
          closestPt = proj;
          closestDist = dist;
          insertIndex = i + 1;
        }
      }

      if (closestPt) {
        const newPath = [...pathPoints];
        newPath.splice(insertIndex, 0, closestPt);
        setPathPoints(newPath);
        setDraggingIndex(insertIndex);
      }
    }
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (resizingZoneId !== null) {
      const { x, y } = getMousePos(e);
      setZones(zones =>
        zones.map(zone => {
          if (zone.id === resizingZoneId) {
            const newRadius = Math.max(5, Math.hypot(zone.x - x, zone.y - y));
            return { ...zone, radius: newRadius };
          }
          return zone;
        })
      );
      return;
    }

    if (draggingZoneId !== null) {
      const { x, y } = getMousePos(e);
      setZones(zones =>
        zones.map(zone => (zone.id === draggingZoneId ? { ...zone, x, y } : zone))
      );
      return;
    }

    if (draggingIndex !== null) {
      if (draggingIndex === 0 || draggingIndex === pathPoints.length - 1) return;
      const { x, y } = getMousePos(e);
      const newPoints = [...pathPoints];
      newPoints[draggingIndex] = { x, y };
      setPathPoints(newPoints);
    }
  }

  function handlePointerUp() {
    setDraggingIndex(null);
    setDraggingZoneId(null);
    setResizingZoneId(null);
  }

  // draw function (keeps same visuals / order you had)
  function draw(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, width, height);

    // render robot arm
    renderRobotArm(ctx, arm.base, angles, arm.limbLengths);

    // tip trail
    const [angle1, angle2] = angles;
    const [l1, l2] = arm.limbLengths;
    const joint1 = { x: arm.base.x + l1 * Math.cos(angle1), y: arm.base.y + l1 * Math.sin(angle1) };
    const tip = { x: joint1.x + l2 * Math.cos(angle1 + angle2), y: joint1.y + l2 * Math.sin(angle1 + angle2) };

    const trail = tipTrailRef.current;
    trail.push({ x: tip.x, y: tip.y });
    if (trail.length > 250) trail.shift();

    if (trail.length > 1) {
      ctx.beginPath();
      ctx.lineWidth = 2;
      ctx.strokeStyle = 'rgba(0,0,0,0.18)';
      for (let i = 0; i < trail.length - 1; i++) {
        ctx.moveTo(trail[i].x, trail[i].y);
        ctx.lineTo(trail[i + 1].x, trail[i + 1].y);
      }
      ctx.stroke();
    }

    // trajectory from the MotionEngine schedule (rebuilt by effects)
    const { samples, velocities, curvatures } = trajectory;

    if (samples.length > 1) {
      // curvature overlay
      for (let i = 0; i < samples.length - 1; i++) {
        const pA = samples[i];
        const pB = samples[i + 1];
        const c = curvatures[i] ?? 0;
        const alpha = 0.22;
        ctx.strokeStyle = c < 0 ? `rgba(249,115,115,${alpha})` : `rgba(96,165,250,${alpha})`;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.stroke();
      }

      // main variable-width stroke by drawing small segments
      for (let i = 0; i < samples.length - 1; i++) {
        const pA = samples[i];
        const pB = samples[i + 1];
        const vel = velocities[i] ?? 1;
        const strokeW = Math.max(0.8, BASE_STROKE + vel * STROKE_SCALE);
        const alpha = 0.35 + Math.min(1, vel * 0.003);
        ctx.beginPath();
        ctx.strokeStyle = `rgba(10,90,220,${alpha})`;
        ctx.lineWidth = strokeW;
        ctx.lineCap = 'round';
        ctx.moveTo(pA.x, pA.y);
        ctx.lineTo(pB.x, pB.y);
        ctx.stroke();
      }

      // mini-sample points
      for (let i = 0; i < samples.length; i++) {
        const p = samples[i];
        const vel = velocities[i] ?? 1;
        const r = (i % MINI_DOT_EVERY === 0) ? 2.2 + Math.min(3, vel * 0.002) : 1.2;
        ctx.beginPath();
        ctx.fillStyle = 'rgba(255,255,255,0.95)';
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        const innerR = r * 0.6;
        const c = curvatures[i] ?? 0;
        ctx.fillStyle = c < 0 ? 'rgba(220,80,80,0.95)' : 'rgba(50,120,220,0.95)';
        ctx.arc(p.x, p.y, innerR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // draw zones
    zones.forEach(zone => {
      ctx.save();
      ctx.shadowBlur = 20;
      if (zone.type === 'avoid') {
        ctx.shadowColor = 'rgba(255, 0, 0, 0.7)';
        ctx.fillStyle = 'rgba(255, 0, 0, 0.36)';
      } else {
        ctx.shadowColor = 'rgba(0, 255, 0, 0.7)';
        ctx.fillStyle = zone.visited ? 'rgba(0, 255, 0, 0.36)' : 'rgba(0, 180, 0, 0.28)';
      }
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      const handleX = zone.x + zone.radius * Math.cos(Math.PI / 4);
      const handleY = zone.y + zone.radius * Math.sin(Math.PI / 4);
      ctx.beginPath();
      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 1;
      ctx.arc(handleX, handleY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      if (zone.type === 'required') {
        const symbol = zone.visited ? checkImage : xImage;
        const size = 35;
        ctx.drawImage(symbol, zone.x - size / 2, zone.y - size / 2, size, size);
      }
    });

    // overlay control points
    pathPoints.forEach((pt, i) => {
      if (i !== 0 && i !== pathPoints.length - 1) {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = 'darkblue';
        ctx.fill();
      }
      if (i === draggingIndex) {
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 14, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // reachable area
    const maxReach = LIMB_LENGTHS.reduce((sum, l) => sum + l, 0);
    new DrawReachableArea(ctx, arm.base).drawReachableArea(maxReach);
  }

  useEffect(() => {
    arm.base = ARM_BASE;
    setAngles(START_ANGLES);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [height]);

  // main draw effect
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    draw(ctx);
    // redraw when trajectory or visuals change
  }, [trajectory, pathPoints, angles, draggingIndex, draggingZoneId, resizingZoneId, zones, width, height, arm]);

  // update zone visited state + in-avoid detection
  useEffect(() => {
    const [angle1Local, angle2Local] = angles;
    const [l1, l2] = arm.limbLengths;

    const joint1 = { x: arm.base.x + l1 * Math.cos(angle1Local), y: arm.base.y + l1 * Math.sin(angle1Local) };
    const tipLocal = { x: joint1.x + l2 * Math.cos(angle1Local + angle2Local), y: joint1.y + l2 * Math.sin(angle1Local + angle2Local) };

    let isInAvoidZone = false;
    setZones(prev =>
      prev.map(zone => {
        const dx = tipLocal.x - zone.x;
        const dy = tipLocal.y - zone.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const inside = dist <= zone.radius;

        if (zone.type === 'avoid' && inside) isInAvoidZone = true;
        if (zone.type === 'required' && !zone.visited && inside) return { ...zone, visited: true };
        return zone;
      })
    );
    setInAvoidZone(isInAvoidZone);
  }, [angles, arm, setZones]);

  return (
    <div style={{ position: 'relative', width, height }}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className={`canvas-stage${resizingZoneId !== null ? ' resizing' : ''}`}
        style={{ position: 'absolute', top: 0, left: 0, width, height, pointerEvents: 'auto' }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
      />
      <svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}>
        {pathPoints.map((pt, i) =>
          (i === 0 || i === pathPoints.length - 1) ? (
            <Triangle key={`triangle-${i}`} cx={pt.x} cy={pt.y} size={24} className="start-end-triangle" />
          ) : null
        )}
      </svg>
    </div>
  );
}

export default CanvasStage;
