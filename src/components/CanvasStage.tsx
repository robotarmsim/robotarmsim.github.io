// src/components/CanvasStage.tsx
// Canvas stage (updated: removed user-controllable "smoothness")
// Notes:
// - I removed smoothnessSegments and anything the user can edit for "smoothness".
// - I keep a fixed corner post-processor so corners are reasonable in previews.
// - Everything else (pointer handling, zones, tempo visualization, tip trail) is preserved.

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
  directnessSegments: number[]; // kept: user edits curvature per-segment
  tempoSegments: number[];      // kept: user edits tempo per-segment
}

/**
 * Helper that builds a tiny "ParamMap" object from per-segment values.
 * This mirrors the previous SegmentParameterMap.evaluate(s) semantics but avoids importing the class.
 */
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

  /**
   * Fixed corner post-processing: removed user-controlled smoothness,
   * but we keep a fixed gentle rounding so preview/runtime don't produce extreme spikes.
   */
  function applyCornerProcessingFixed(samples: Point[], pathPts: Point[], sSamples: number[]) {
    const nSamples = samples.length;
    if (nSamples === 0) return samples.slice();

    const origDists: number[] = new Array(pathPts.length).fill(0);
    for (let i = 1; i < pathPts.length; i++) {
      const dx = pathPts[i].x - pathPts[i - 1].x;
      const dy = pathPts[i].y - pathPts[i - 1].y;
      origDists[i] = origDists[i - 1] + Math.hypot(dx, dy);
    }
    const origTotal = origDists[origDists.length - 1] || 1e-6;
    const origS = origDists.map(d => d / origTotal);

    const out = samples.map(p => ({ x: p.x, y: p.y }));
    const lerp = (a: Point, b: Point, t: number) => ({ x: a.x * (1 - t) + b.x * t, y: a.y * (1 - t) + b.y * t });

    const maxWindowSamples = Math.max(2, Math.round(Math.max(8, Math.round(nSamples * 0.06))));
    const blurSigmaBase = Math.max(0.5, Math.max(1, Math.round(nSamples * 0.04)));

    // fixed moderate smoothing strength
    const cornerSmoothingStrength = 0.6;

    for (let pi = 1; pi < pathPts.length - 1; pi++) {
      const sVertex = origS[pi];

      let centerIdx = 0;
      let bestD = Infinity;
      for (let si = 0; si < sSamples.length; si++) {
        const d = Math.abs(sSamples[si] - sVertex);
        if (d < bestD) {
          bestD = d;
          centerIdx = si;
        }
      }

      const windowSamples = Math.max(1, Math.round(1 + cornerSmoothingStrength * maxWindowSamples));
      const left = Math.max(0, centerIdx - windowSamples);
      const right = Math.min(nSamples - 1, centerIdx + windowSamples);

      // gaussian blur across window
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

  // drawing constants
  const DIRECTNESS_SCALE = 1.4;

  function draw(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, width, height);

    // robot drawing
    renderRobotArm(ctx, arm.base, angles, arm.limbLengths);

    // current tip & trail
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

    // tension function uses directness only; we keep tiny positive smoothing effect by scaling curvature down when path points are "smoothed" conceptually
    const tensionFn = (segmentNormalizedPos: number) => {
      const d = directnessMap.evaluate(segmentNormalizedPos); // -1..1
      const curvature = Math.max(-1, Math.min(1, d * DIRECTNESS_SCALE));
      return curvature;
    };

    // preview spline (20 samples per segment)
    const rawCurve = bezierSpline(pathPoints, 20, tensionFn);

    // compute sSamples
    const distsS: number[] = new Array(rawCurve.length).fill(0);
    for (let i = 1; i < rawCurve.length; i++) {
      distsS[i] = Math.hypot(rawCurve[i].x - rawCurve[i - 1].x, rawCurve[i].y - rawCurve[i - 1].y);
    }
    const cumS: number[] = new Array(rawCurve.length).fill(0);
    for (let i = 1; i < rawCurve.length; i++) cumS[i] = cumS[i - 1] + distsS[i];
    const totalS = cumS[rawCurve.length - 1] || 1e-6;
    const sSamples = cumS.map(d => d / totalS);

    // apply FIXED corner processing (user can't set smoothness anymore)
    const smoothCurve = applyCornerProcessingFixed(rawCurve, pathPoints, sSamples);

    // tempo per-sample for visualization
    const tempoSamples: number[] = [];
    for (let i = 0; i < smoothCurve.length; i++) {
      const t = i / (smoothCurve.length - 1);
      const tempoVal = tempoMap.evaluate(t);
      tempoSamples.push(tempoVal);
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

    // draw the path; stroke width indicates tempo (faster -> thicker)
    for (let i = 0; i < smoothCurve.length - 1; i++) {
      const pA = smoothCurve[i];
      const pB = smoothCurve[i + 1];
      const tempoVal = tempoSamples[i] ?? 0.5;
      const strokeW = 2 + tempoVal * 6;
      const alpha = 0.35 + tempoVal * 0.6;
      ctx.beginPath();
      ctx.strokeStyle = `rgba(10,90,220,${alpha})`;
      ctx.lineWidth = strokeW;
      ctx.lineCap = 'round';
      ctx.moveTo(pA.x, pA.y);
      ctx.lineTo(pB.x, pB.y);
      ctx.stroke();
    }

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
    console.log('[CanvasStage] draw called, angles:', angles);
    draw(ctx);
  }, [pathPoints, angles, draggingIndex, draggingZoneId, resizingZoneId, zones, directnessSegments, tempoSegments, width, height, arm]);

  useEffect(() => {
    // tip detection for zones (unchanged)
    const [angle1, angle2] = angles;
    const [l1, l2] = arm.limbLengths;

    const joint1 = { x: arm.base.x + l1 * Math.cos(angle1), y: arm.base.y + l1 * Math.sin(angle1) };
    const tip = { x: joint1.x + l2 * Math.cos(angle1 + angle2), y: joint1.y + l2 * Math.sin(angle1 + angle2) };

    let isInAvoidZone = false;
    setZones(prev =>
      prev.map(zone => {
        const dx = tip.x - zone.x;
        const dy = tip.y - zone.y;
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
