// src/components/CanvasStage.tsx
// Canvas stage (updated: unified sampling + tempo/velocity visualization)
//
// - Samples the bezier spline and computes tempo/velocity using the same
//   algorithm MotionEngine uses, so the visual path matches playback.
// - Renders variable stroke width (based on velocity), mini-sample points,
//   and a curvature overlay (positive vs negative).
// - Keeps pointer handling, zones, tip trail, and control points behavior.

import React, { useRef, useEffect, useState, useMemo } from 'react';
import { RobotArm, type Point } from '../utils/RobotArm';
import { bezierSpline } from '../utils/Bezier';
import type { Zone } from '../types/zones';
import { renderRobotArm } from '../utils/PrettierRobot';
import { loadAllImages } from '../utils/ImageManager';
import Triangle from './Triangle';
import checkImg from '../assets/check.svg';
import xImg from '../assets/x-fail.svg';
import { DrawReachableArea } from './UI/DrawReachableArea';
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

// Minimal per-segment evaluator builder (same as in App originally)
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

/**
 * Tempo warp helper (kept consistent with MotionEngine.applyTempoWarp)
 */
function applyTempoWarp(t: number, intensity: number) {
  if (intensity === 0) return t;
  const amp = 2.5;
  const i = Math.max(-1, Math.min(1, intensity));
  if (i > 0) return Math.pow(t, 1 + i * amp);
  return 1 - Math.pow(1 - t, 1 + Math.abs(i) * amp);
}

/**
 * Compute a trajectory from pathPoints + maps.
 *
 * This mirrors the MotionEngine.buildSchedule logic so CanvasStage
 * draws exactly the same samples, tempo/velocity and times the engine uses.
 */
function computeTrajectory(
  pathPoints: Point[],
  directnessMap: { evaluate: (s: number) => number },
  tempoMap: { evaluate: (s: number) => number },
  opts?: {
    samplesPerSegment?: number;
    minSpeed?: number;
    maxSpeed?: number;
    accelBase?: number;
    curvatureBaseScale?: number;
    totalDuration?: number | undefined;
  }
) {
  const samplesPerSegment = opts?.samplesPerSegment ?? 24;
  const minSpeed = opts?.minSpeed ?? 6;
  const maxSpeed = opts?.maxSpeed ?? 220;
  const accelBase = opts?.accelBase ?? 1200;
  const curvatureBaseScale = opts?.curvatureBaseScale ?? 1.0;
  const totalDuration = opts?.totalDuration;

  // 1) Sample bezier spline with curvature function
  const curvatureFn = (segmentPos: number) => {
    const dIntensity = Math.max(-1, Math.min(1, directnessMap.evaluate(segmentPos) || 0));
    return dIntensity * curvatureBaseScale;
  };

  const rawSamples = bezierSpline(pathPoints, samplesPerSegment, curvatureFn);
  const nRaw = rawSamples.length;
  if (!rawSamples || nRaw === 0) {
    return {
      samples: [] as Point[],
      sSamples: [] as number[],
      tempoSamples: [] as number[],
      times: [] as number[],
      velocities: [] as number[],
      curvatures: [] as number[],
    };
  }

  // compute sSamples (normalized arc positions along rawSamples)
  const distsSamples: number[] = new Array(nRaw).fill(0);
  for (let i = 1; i < nRaw; i++) {
    distsSamples[i] = Math.hypot(rawSamples[i].x - rawSamples[i - 1].x, rawSamples[i].y - rawSamples[i - 1].y);
  }
  const cumSamples: number[] = new Array(nRaw).fill(0);
  for (let i = 1; i < nRaw; i++) cumSamples[i] = cumSamples[i - 1] + distsSamples[i];
  const totalSamplesLen = cumSamples[nRaw - 1] || 1e-6;
  const sSamples = cumSamples.map(d => d / totalSamplesLen);

  // 2) Corner processing (fixed behavior) - same approach MotionEngine used
  // We'll implement identical gaussian-window blur around each vertex's nearest sample.
  function applyCornerProcessing(samples: Point[], pathPts: Point[], sSmpls: number[]) {
    const nSamplesLocal = samples.length;
    if (nSamplesLocal === 0) return samples.map(p => ({ x: p.x, y: p.y }));

    // original control vertex normalized positions along polyline
    const origDists: number[] = new Array(pathPts.length).fill(0);
    for (let i = 1; i < pathPts.length; i++) {
      const dx = pathPts[i].x - pathPts[i - 1].x;
      const dy = pathPts[i].y - pathPts[i - 1].y;
      origDists[i] = origDists[i - 1] + Math.hypot(dx, dy);
    }
    const origTotal = origDists[origDists.length - 1] || 1e-6;
    const origS = origDists.map(d => d / origTotal);

    const out = samples.map(p => ({ x: p.x, y: p.y }));
    const maxWindowSamples = Math.max(2, Math.round(samplesPerSegment * 0.6));
    const blurSigmaBase = Math.max(0.6, samplesPerSegment * 0.12);
    const cornerSmoothingStrength = 0.7; // fixed (close to MotionEngine)

    for (let pi = 1; pi < pathPts.length - 1; pi++) {
      const sVertex = origS[pi];

      // find nearest sample index
      let centerIdx = 0;
      let bestD = Infinity;
      for (let si = 0; si < sSmpls.length; si++) {
        const d = Math.abs(sSmpls[si] - sVertex);
        if (d < bestD) {
          bestD = d;
          centerIdx = si;
        }
      }

      const windowSamples = Math.max(1, Math.round(1 + cornerSmoothingStrength * maxWindowSamples));
      const left = Math.max(0, centerIdx - windowSamples);
      const right = Math.min(nSamplesLocal - 1, centerIdx + windowSamples);

      const sigma = Math.max(0.6, blurSigmaBase * cornerSmoothingStrength);
      const weights: number[] = [];
      let wsum = 0;
      for (let j = left; j <= right; j++) {
        const didx = j - centerIdx;
        const w = Math.exp(-0.5 * (didx * didx) / (sigma * sigma));
        weights.push(w);
        wsum += w;
      }

      for (let j = left; j <= right; j++) {
        let wxSum = 0;
        let wySum = 0;
        let k = 0;
        for (let m = left; m <= right; m++) {
          const w = weights[k++];
          wxSum += out[m].x * w;
          wySum += out[m].y * w;
        }
        out[j].x = wxSum / wsum;
        out[j].y = wySum / wsum;
      }
    }

    return out;
  }

  const samples = applyCornerProcessing(rawSamples, pathPoints, sSamples);
  const n = samples.length;
  if (n === 0) {
    return {
      samples: [] as Point[],
      sSamples: [] as number[],
      tempoSamples: [] as number[],
      times: [] as number[],
      velocities: [] as number[],
      curvatures: [] as number[],
    };
  }

  // arc distances + normalized s for processed samples
  const dists: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    dists[i] = Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
  }
  const cumDist: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) cumDist[i] = cumDist[i - 1] + dists[i];
  const totalLength = cumDist[n - 1] || 1e-6;
  const sNorm: number[] = new Array(n);
  for (let i = 0; i < n; i++) sNorm[i] = totalLength === 0 ? 0 : cumDist[i] / totalLength;

  // TEMPO warp u(s)
  const uWarp: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const intensity = tempoMap.evaluate(sNorm[i]);
    uWarp[i] = applyTempoWarp(sNorm[i], intensity);
  }

  // du/ds finite differences
  const du_ds: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      const ds = Math.max(1e-6, sNorm[i + 1] - sNorm[i]);
      du_ds[i] = (uWarp[i + 1] - uWarp[i]) / ds;
    } else if (i === n - 1) {
      const ds = Math.max(1e-6, sNorm[i] - sNorm[i - 1]);
      du_ds[i] = (uWarp[i] - uWarp[i - 1]) / ds;
    } else {
      const ds = Math.max(1e-6, sNorm[i + 1] - sNorm[i - 1]);
      du_ds[i] = (uWarp[i + 1] - uWarp[i - 1]) / ds;
    }
    if (!Number.isFinite(du_ds[i])) du_ds[i] = 0;
  }

  // map derivative to 0..1 speed fraction
  let minD = Number.POSITIVE_INFINITY, maxD = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < n; i++) {
    if (du_ds[i] < minD) minD = du_ds[i];
    if (du_ds[i] > maxD) maxD = du_ds[i];
  }
  if (!Number.isFinite(minD)) minD = 0;
  if (!Number.isFinite(maxD)) maxD = 0;

  const speedFrac: number[] = new Array(n);
  if (Math.abs(maxD - minD) < 1e-9) {
    for (let i = 0; i < n; i++) speedFrac[i] = 0.5;
  } else {
    for (let i = 0; i < n; i++) {
      speedFrac[i] = (du_ds[i] - minD) / (maxD - minD);
      speedFrac[i] = Math.max(0, Math.min(1, speedFrac[i]));
    }
  }

  const vDesired = speedFrac.map(f => minSpeed + f * (maxSpeed - minSpeed));

  // ACCEL LIMIT (fixed)
  const accelLimit = new Array(n).fill(accelBase);

  // velocity forward/backward passes
  const vForward = new Array(n).fill(0);
  vForward[0] = Math.min(vDesired[0], maxSpeed);
  for (let i = 0; i < n - 1; i++) {
    const ds = Math.max(1e-6, dists[i + 1]);
    const a = accelLimit[i];
    const reachable = Math.sqrt(Math.max(0, vForward[i] * vForward[i] + 2 * a * ds));
    vForward[i + 1] = Math.min(vDesired[i + 1], reachable);
  }
  const v = vForward.slice();
  v[n - 1] = Math.min(v[n - 1], vDesired[n - 1]);
  for (let i = n - 2; i >= 0; i--) {
    const ds = Math.max(1e-6, dists[i + 1]);
    const a = accelLimit[i];
    const reachableBack = Math.sqrt(Math.max(0, v[i + 1] * v[i + 1] + 2 * a * ds));
    v[i] = Math.min(v[i], reachableBack);
  }

  // integrate times
  const times: number[] = new Array(n).fill(0);
  let cumulative = 0;
  times[0] = 0;
  for (let i = 0; i < n - 1; i++) {
    const ds = Math.max(1e-6, dists[i + 1]);
    const vi = Math.max(1e-6, v[i]);
    const vj = Math.max(1e-6, v[i + 1]);
    const dt = ds / ((vi + vj) / 2);
    cumulative += dt;
    times[i + 1] = cumulative;
  }

  let intrinsicDuration = times[n - 1] || 1e-4;
  if (intrinsicDuration <= 0) intrinsicDuration = 1e-4;
  const scale = (typeof totalDuration === 'number' && totalDuration > 0) ? (totalDuration / intrinsicDuration) : 1;
  const scaledTimes = times.map(t => t * scale);
  const scaledVelocities = v.map(val => val / scale);

  // compute per-sample curvature (from directnessMap) for visualization:
  const curvatures: number[] = sNorm.map(s => {
    const d = directnessMap.evaluate(s) || 0;
    return Math.max(-1, Math.min(1, d));
  });

  // done
  return {
    samples,
    sSamples: sNorm,
    tempoSamples: uWarp,
    times: scaledTimes,
    velocities: scaledVelocities,
    curvatures,
  };
}

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
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [draggingZoneId, setDraggingZoneId] = useState<number | null>(null);
  const [resizingZoneId, setResizingZoneId] = useState<number | null>(null);
  const [, setInAvoidZone] = useState(false);

  // Tip trail so playback is visible even if robot drawing looks subtle
  const tipTrailRef = useRef<Point[]>([]);

  useEffect(() => {
    let mounted = true;
    loadAllImages().then(() => {
      if (!mounted) return;
      setImagesLoaded(true);
    });
    return () => { mounted = false; };
  }, []);

  // Build lightweight "ParamMap" evaluators from raw per-segment arrays.
  const directnessMap = useMemo(() => makeSegmentEvaluator(directnessSegments, pathPoints), [directnessSegments, pathPoints]);
  const tempoMap = useMemo(() => makeSegmentEvaluator(tempoSegments, pathPoints), [tempoSegments, pathPoints]);

  useEffect(() => {
    // reset tip trail when path changes so we don't show stale trails
    tipTrailRef.current = [];
  }, [pathPoints]);

  // --- pointer helpers (unchanged) ---
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

  // drawing constants (adjust to taste)
  const SAMPLES_PER_SEGMENT = 24;
  const DIRECTNESS_SCALE = 1.4;
  const BASE_STROKE = 1.5;
  const STROKE_SCALE = 0.02; // multiplier for velocity -> stroke width
  const MINI_DOT_EVERY = 2; // draw larger dots every N samples

  function draw(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, width, height);

    // render robot arm (base positions are updated externally)
    renderRobotArm(ctx, arm.base, angles, arm.limbLengths);

    // tip trail rendering (unchanged)
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

    // Build the trajectory using the shared computation
    const trajectory = computeTrajectory(
      pathPoints,
      { evaluate: (s: number) => directnessMap.evaluate(s) * DIRECTNESS_SCALE },
      tempoMap,
      {
        samplesPerSegment: SAMPLES_PER_SEGMENT,
        minSpeed: 6,
        maxSpeed: 220,
        accelBase: 1200,
        curvatureBaseScale: 1.0,
      }
    );

    const { samples, velocities, curvatures } = trajectory;

    // draw the path using per-sample velocities for stroke width
    if (samples.length > 1) {
      // draw a thin curvature-colour overlay first (optional subtle)
      ctx.beginPath();
      for (let i = 0; i < samples.length - 1; i++) {
        const pA = samples[i];
        const pB = samples[i + 1];
        const c = curvatures[i] ?? 0;
        // map curvature to color (negative -> red-ish, positive -> blue-ish)
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
        const tempoVal = 0.5; // not directly used here (vel already encodes tempo)
        const alpha = 0.35 + Math.min(1, vel * 0.003); // keep alpha bounded
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
        // inner color to hint speed
        ctx.beginPath();
        const innerR = r * 0.6;
        // color by curvature sign (subtle)
        const c = curvatures[i] ?? 0;
        ctx.fillStyle = c < 0 ? 'rgba(220,80,80,0.95)' : 'rgba(50,120,220,0.95)';
        ctx.arc(p.x, p.y, innerR, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // draw zones (unchanged)
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // console.debug('[CanvasStage] draw called, angles:', angles);
    draw(ctx);
  }, [pathPoints, angles, draggingIndex, draggingZoneId, resizingZoneId, zones, directnessSegments, tempoSegments, width, height, arm]);

  useEffect(() => {
    // tip detection for zones (unchanged)
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
