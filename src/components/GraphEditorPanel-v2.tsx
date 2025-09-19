// src/components/GraphEditorPanel.tsx
import React, { useRef, useState, useMemo, useCallback } from 'react';
import type { Point } from '../utils/RobotArm';
import { RotateCw } from 'lucide-react';

interface Props {
  id?: string;
  label: string;
  pathPoints: Point[];              // original path points (for x positions)
  segmentValues: number[];         // length = pathPoints.length - 1, values in -1..1
  setSegmentValues: (vals: number[]) => void;
}

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 96;
const SNAP_THRESHOLD = 0.02; // values within this of 0 snap to 0

// Convert a list of pixel points into an SVG cubic-bezier path using Catmull-Rom -> Bezier.
function catmullRomToBezierPath(pts: { x: number; y: number }[], tension = 0.5) {
  if (!pts || pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = i - 1 >= 0 ? pts[i - 1] : pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = i + 2 < pts.length ? pts[i + 2] : p2;

    const cp1x = p1.x + ((p2.x - p0.x) / 6) * tension;
    const cp1y = p1.y + ((p2.y - p0.y) / 6) * tension;
    const cp2x = p2.x - ((p3.x - p1.x) / 6) * tension;
    const cp2y = p2.y - ((p3.y - p1.y) / 6) * tension;

    d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

function mapValueToColor(v: number) {
  const c = Math.max(-1, Math.min(1, v));
  if (c < 0) return `rgba(249,115,115,0.95)`; // reddish
  return `rgba(96,165,250,0.95)`; // bluish
}

export function GraphEditorPanel({
  label,
  pathPoints,
  segmentValues,
  setSegmentValues,
  id,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingSeg, setDraggingSeg] = useState<number | null>(null);
  const [hoverSeg, setHoverSeg] = useState<number | null>(null);

  const width = DEFAULT_WIDTH;
  const height = DEFAULT_HEIGHT;

  // compute relative distances along the path (0..1)
  const relativeDistances = useMemo(() => {
    if (pathPoints.length < 2) return [0, 1];
    const dists: number[] = [0];
    let total = 0;
    for (let i = 1; i < pathPoints.length; i++) {
      const dx = pathPoints[i].x - pathPoints[i - 1].x;
      const dy = pathPoints[i].y - pathPoints[i - 1].y;
      total += Math.hypot(dx, dy);
      dists.push(total);
    }
    if (total <= 0) return dists.map(() => 0);
    return dists.map(d => d / total);
  }, [pathPoints]);

  // one handle per segment (between pathPoints[i] and pathPoints[i+1])
  const segmentMidpoints = useMemo(() => {
    const mids: { x: number; y: number; value: number }[] = [];
    for (let i = 0; i < Math.max(0, relativeDistances.length - 1); i++) {
      const tMid = (relativeDistances[i] + relativeDistances[i + 1]) / 2;
      const x = tMid * width;
      const segVal = segmentValues[i] ?? 0;
      const normalizedY = (segVal + 1) / 2; // 0..1
      const y = (1 - normalizedY) * height;
      mids.push({ x, y, value: segVal });
    }
    return mids;
  }, [relativeDistances, segmentValues, width, height]);

  // pixel pts for curve drawing
  const curvePts = useMemo(() => {
    return segmentMidpoints.map(m => ({ x: m.x, y: m.y }));
  }, [segmentMidpoints]);

  const curvePath = useMemo(() => catmullRomToBezierPath(curvePts, 0.6), [curvePts]);

  function getMousePosNormalized(e: React.PointerEvent) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const x = (e.clientX - rect.left) / rect.width; // 0..1
    const y = 1 - (e.clientY - rect.top) / rect.height; // invert, 0..1
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }

  // pointer move while dragging: update only vertical value for the active segment
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (draggingSeg === null) return;
    const { y: normY } = getMousePosNormalized(e);
    let val = (normY - 0.5) * 2; // -1..1
    if (Math.abs(val) < SNAP_THRESHOLD) val = 0;
    val = Math.max(-1, Math.min(1, val));
    const next = segmentValues.slice();
    next[draggingSeg] = val;
    setSegmentValues(next);
  }, [draggingSeg, segmentValues, setSegmentValues]);

  const onPointerUp = useCallback(() => {
    setDraggingSeg(null);
  }, []);

  // start dragging a segment handle
  function handlePointerDownSegment(index: number, e: React.PointerEvent) {
    e.stopPropagation();
    setDraggingSeg(index);
    // ensure we get pointermove/up even if pointer leaves svg
    // (we keep svg onPointerMove/onPointerUp too; this is defensive)
    (e.target as Element).setPointerCapture?.(e.pointerId);
  }

  // reset all values to zero
  function resetValues() {
    setSegmentValues(segmentValues.map(() => 0));
  }

  return (
    <div className="flex flex-col space-y-1 relative" style={{ userSelect: 'none' }}>
      <strong className="text-xs text-gray-300">{label}</strong>
      <button
        onClick={resetValues}
        className="absolute right-2 top-5 p-1 text-gray-400 hover:text-white"
        title="Reset values to zero"
        aria-label="Reset"
        type="button"
      >
        <RotateCw size={16} />
      </button>

      <div className="rounded bg-neutral-900 p-2 shadow-inner">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onPointerCancel={onPointerUp}
          className="block"
          role="img"
          aria-label={label + " editor"}
        >
          {/* background */}
          <rect x={0} y={0} width={width} height={height} className="fill-neutral-900 stroke-neutral-700" rx={6} />

          {/* baseline */}
          <line
            x1={0}
            x2={width}
            y1={height / 2}
            y2={height / 2}
            stroke="#4b5563"
            strokeDasharray="4,3"
            strokeWidth={1}
            opacity={0.9}
          />

          {/* faint per-segment colored bars (like previous) */}
          {segmentMidpoints.map((m, i) => (
            <line
              key={`segline-${i}`}
              x1={Math.max(0, m.x - 24)}
              y1={m.y}
              x2={Math.min(width, m.x + 24)}
              y2={m.y}
              stroke={mapValueToColor(m.value)}
              strokeWidth={6}
              strokeLinecap="round"
              opacity={0.12}
            />
          ))}

          {/* smooth curve (stroke) */}
          {curvePath ? (
            <>
              <path d={curvePath} fill="none" stroke="rgba(100,180,255,0.14)" strokeWidth={12} strokeLinecap="round" strokeLinejoin="round" />
              <path d={curvePath} fill="none" stroke="rgba(100,180,255,0.9)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </>
          ) : null}

          {/* handles */}
          {segmentMidpoints.map((m, i) => {
            const isDragging = draggingSeg === i;
            const isHover = hoverSeg === i;
            const outerR = isDragging ? 9 : isHover ? 8 : 7;
            const innerR = 3;
            return (
              <g
                key={`mid-${i}`}
                transform={`translate(${m.x}, ${m.y})`}
                onPointerDown={(e) => handlePointerDownSegment(i, e)}
                onPointerMove={(e) => {}}
                onPointerUp={() => { /* pointerUp handled on svg */ }}
                onMouseEnter={() => setHoverSeg(i)}
                onMouseLeave={() => setHoverSeg(null)}
                style={{ cursor: 'ns-resize', pointerEvents: 'all' }}
                role="slider"
                aria-label={`${label} segment ${i}`}
                aria-valuemin={-1}
                aria-valuemax={1}
                aria-valuenow={Number((m.value).toFixed(2))}
                tabIndex={0}
              >
                {/* outer halo */}
                <circle r={outerR} fill="white" stroke="black" strokeWidth={0.6} opacity={isDragging || isHover ? 0.95 : 0.8} />
                {/* inner color */}
                <circle r={innerR} fill={mapValueToColor(m.value)} />
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default GraphEditorPanel;
