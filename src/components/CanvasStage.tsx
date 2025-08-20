import React, { useRef, useEffect, useState } from 'react';
import { RobotArm, type Point } from '../utils/RobotArm';
import { bezierSpline } from '../utils/Bezier.ts';
import type { Zone } from '../types/zones';
import { renderRobotArm } from '../utils/PrettierRobot.ts';
import { loadAllImages } from '../utils/ImageManager';
import Triangle from './Triangle.tsx';
import checkImg from '../assets/check.svg';
import xImg from '../assets/x-fail.svg';
import { DrawReachableArea } from './UI/DrawReachableArea.ts';
import {
  ARM_BASE,
  START_ANGLES,
  LIMB_LENGTHS,
} from '../config/constants.ts';

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
  curvatureGraph: Point[];
  noiseGraph: Point[]; // <-- added
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
  curvatureGraph,
  noiseGraph
}: CanvasStageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [, setImagesLoaded] = useState(false);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [draggingZoneId, setDraggingZoneId] = useState<number | null>(null);
  const [resizingZoneId, setResizingZoneId] = useState<number | null>(null);
  const [, setInAvoidZone] = useState(false);
  

  useEffect(() => {
    let mounted = true;
    loadAllImages().then(() => {
      if (!mounted) return;
      setImagesLoaded(true);
    });
    return () => { mounted = false; };
  }, []);

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
    const dot = atop.x * atob.x + atop.y * atob.y;
    const t = Math.max(0, Math.min(1, dot / len));
    return { x: a.x + atob.x * t, y: a.y + atob.y * t };
  }

  function isNearZoneEdge(zone: Zone, x: number, y: number, edgeTolerance = 10) {
    const dist = Math.hypot(zone.x - x, zone.y - y);
    return Math.abs(dist - zone.radius) <= edgeTolerance;
  }

  function handlePointerDown(e: React.PointerEvent) {
    const { x, y } = getMousePos(e);

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

  function getGraphValueAt(graph: Point[], t: number): number {
    if (graph.length === 0) return 0.5;
    t = Math.min(Math.max(t, 0), 1);
    for (let i = 0; i < graph.length - 1; i++) {
      const p0 = graph[i];
      const p1 = graph[i + 1];
      if (t >= p0.x && t <= p1.x) {
        const localT = (t - p0.x) / (p1.x - p0.x);
        return p0.y * (1 - localT) + p1.y * localT;
      }
    }
    return graph[graph.length - 1].y;
  }

  function draw(ctx: CanvasRenderingContext2D) {
    ctx.clearRect(0, 0, width, height);

    const tensionFn = (segmentNormalizedPos: number) =>
      getGraphValueAt(curvatureGraph, segmentNormalizedPos);

    renderRobotArm(ctx, arm.base, angles, arm.limbLengths);

    const smoothCurve = bezierSpline(pathPoints, 20, tensionFn);

    // Draw zones
    zones.forEach(zone => {
      ctx.save();
      ctx.shadowBlur = 20;
      if (zone.type === 'avoid') {
        ctx.shadowColor = 'rgba(255, 0, 0, 0.7)';
        ctx.fillStyle = 'rgba(255, 0, 0, 0.4)';
      } else {
        ctx.shadowColor = 'rgba(0, 255, 0, 0.7)';
        ctx.fillStyle = zone.visited ? 'rgba(0, 255, 0, 0.4)' : 'rgba(0, 180, 0, 0.3)';
      }
      ctx.beginPath();
      ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Resize handle
      const handleX = zone.x + zone.radius * Math.cos(Math.PI / 4);
      const handleY = zone.y + zone.radius * Math.sin(Math.PI / 4);
      ctx.beginPath();
      ctx.fillStyle = 'white';
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 1;
      ctx.arc(handleX, handleY, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Checkmarks
      if (zone.type === 'required') {
        const symbol = zone.visited ? checkImage : xImage;
        const size = 35;
        ctx.drawImage(symbol, zone.x - size / 2, zone.y - size / 2, size, size);
      }
    });

    // Draw path with noise visualized
    ctx.strokeStyle = 'rgba(0, 55, 255, 0.6)';
    ctx.lineWidth = 4;
    ctx.shadowColor = 'rgba(56, 156, 255, 0.8)';
    ctx.shadowBlur = 4;
    ctx.beginPath();
    for (let i = 0; i < smoothCurve.length; i++) {
      const pt = smoothCurve[i];
      const t = i / (smoothCurve.length - 1);
      const noiseAmp = getGraphValueAt(noiseGraph, t) * 20; // wiggle scale
      const y = pt.y + Math.sin(i * 0.3) * noiseAmp;
      if (i === 0) ctx.moveTo(pt.x, y);
      else ctx.lineTo(pt.x, y);
    }
    ctx.stroke();

    // Draw points
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

    // Reachable area
    const maxReach = LIMB_LENGTHS.reduce((sum, l) => sum + l, 0);
    new DrawReachableArea(ctx, arm.base).drawReachableArea(maxReach);
  }

  useEffect(() => {
    arm.base = ARM_BASE;
    setAngles(START_ANGLES);
  }, [height, arm, setAngles]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    draw(ctx);
  }, [pathPoints, angles, draggingIndex, draggingZoneId, resizingZoneId, zones, curvatureGraph, noiseGraph]);

  useEffect(() => {
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
