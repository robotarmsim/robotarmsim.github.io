// src/components/GraphEditorPanel.tsx
import React, { useRef, useState, useMemo, useCallback } from 'react';
import type { Point } from '../utils/RobotArm';
import { RotateCw } from 'lucide-react';

interface Props {
  id?: string;
  label: string;
  pathPoints: Point[];
  segmentValues: number[];
  setSegmentValues: (vals: number[]) => void;
}

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 150;
const SNAP_THRESHOLD = 0.02;

function catmullRomToBezierPath(pts: { x: number; y: number }[], tension = 0.5) {
  if (pts.length === 0) return '';
  if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y}`;
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`;

  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = i > 0 ? pts[i - 1] : pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = i < pts.length - 2 ? pts[i + 2] : p2;

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
  return c < 0 ? `rgba(249,115,115,0.95)` : `rgba(96,165,250,0.95)`;
}

export function GraphEditorPanel({
  label,
  pathPoints,
  segmentValues,
  setSegmentValues,
  //id,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingSeg, setDraggingSeg] = useState<number | null>(null);
  const [hoverSeg, setHoverSeg] = useState<number | null>(null);

  const width = DEFAULT_WIDTH;
  const height = DEFAULT_HEIGHT;
  const baselineY = height / 2;

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
    return total > 0 ? dists.map(d => d / total) : dists.map(() => 0);
  }, [pathPoints]);

  const segmentMidpoints = useMemo(() => {
    return relativeDistances.slice(0, -1).map((_, i) => {
      const tMid = (relativeDistances[i] + relativeDistances[i + 1]) / 2;
      const x = tMid * width;
      const segVal = segmentValues[i] ?? 0;
      const normalizedY = (segVal + 1) / 2;
      const y = (1 - normalizedY) * height;
      return { x, y, value: segVal };
    });
  }, [relativeDistances, segmentValues, width, height]);

  // curve points: start (baseline), mids, end (baseline)
  const curvePts = useMemo(() => {
    const start = { x: 0, y: baselineY };
    const end = { x: width, y: baselineY };
    return [start, ...segmentMidpoints.map(m => ({ x: m.x, y: m.y })), end];
  }, [segmentMidpoints, baselineY, width]);

  const curvePath = useMemo(() => catmullRomToBezierPath(curvePts, 0.6), [curvePts]);

  // filled version (to baseline)
  const filledPath = useMemo(() => {
    if (!curvePath) return '';
    return `${curvePath} L ${width} ${baselineY} L 0 ${baselineY} Z`;
  }, [curvePath, width, baselineY]);

  const getMousePosNormalized = (e: React.PointerEvent) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    const x = (e.clientX - rect.left) / rect.width;
    const y = 1 - (e.clientY - rect.top) / rect.height;
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  };

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (draggingSeg === null) return;
      const { y: normY } = getMousePosNormalized(e);
      let val = (normY - 0.5) * 2;
      if (Math.abs(val) < SNAP_THRESHOLD) val = 0;
      val = Math.max(-1, Math.min(1, val));
      const next = segmentValues.slice();
      next[draggingSeg] = val;
      setSegmentValues(next);
    },
    [draggingSeg, segmentValues, setSegmentValues]
  );

  const onPointerUp = useCallback(() => setDraggingSeg(null), []);
  const handlePointerDownSegment = (i: number, e: React.PointerEvent) => {
    e.stopPropagation();
    setDraggingSeg(i);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  const resetValues = () => setSegmentValues(segmentValues.map(() => 0));

  return (
    <div className="flex flex-col relative" style={{ userSelect: 'none' }}>
      <strong className="text-xs text-gray-300">{label}</strong>
      <button
        onClick={resetValues}
        className="absolute right-2 top-5 p-1 text-gray-400 hover:text-white"
        title="Reset values to zero"
        type="button"
      >
        <RotateCw size={16} />
      </button>

      <div className="rounded bg-neutral-900 p-2 shadow-inner w-full h-full flex justify-center">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onPointerCancel={onPointerUp}
          className="block w-full h-full"
        >
          {/* background */}
          <rect width={width} height={height} rx={6} fill="#111" stroke="#333" />

          {/* baseline */}
          <line
            x1={0}
            x2={width}
            y1={baselineY}
            y2={baselineY}
            stroke="#4b5563"
            strokeDasharray="4,3"
            strokeWidth={1}
          />
          <text x={4} y={baselineY - 4} fontSize={10} fill="#9ca3af">
            baseline
          </text>

          {/* triangles */}
          <polygon
            points={`${0},${baselineY - 6} ${0},${baselineY + 6} ${8},${baselineY}`}
            fill="#9ca3af"
          />
          <polygon
            points={`${width},${baselineY - 6} ${width},${baselineY + 6} ${width - 8},${baselineY}`}
            fill="#9ca3af"
          />

          {/* fill shading */}
          {filledPath && (
            <path d={filledPath} fill="rgba(100,180,255,0.15)" stroke="none" />
          )}

          {/* curve stroke */}
          {curvePath && (
            <path
              d={curvePath}
              fill="none"
              stroke="rgba(100,180,255,0.9)"
              strokeWidth={2}
            />
          )}

          {/* handles + numeric labels */}
          {segmentMidpoints.map((m, i) => {
            const isDragging = draggingSeg === i;
            const isHover = hoverSeg === i;
            const outerR = isDragging ? 9 : isHover ? 8 : 7;
            return (
              <g
                key={`mid-${i}`}
                transform={`translate(${m.x}, ${m.y})`}
                onPointerDown={(e) => handlePointerDownSegment(i, e)}
                onMouseEnter={() => setHoverSeg(i)}
                onMouseLeave={() => setHoverSeg(null)}
                style={{ cursor: 'ns-resize', pointerEvents: 'all' }}
              >
                <circle r={outerR} fill="white" stroke="black" strokeWidth={0.6} />
                <circle r={3} fill={mapValueToColor(m.value)} />
                <text
                  y={-10}
                  textAnchor="middle"
                  fontSize={10}
                  fill="#e5e7eb"
                >
                  {m.value.toFixed(2)}
                </text>
                
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

export default GraphEditorPanel;
