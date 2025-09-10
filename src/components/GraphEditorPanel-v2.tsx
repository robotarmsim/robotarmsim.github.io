// src/components/GraphEditorPanel.tsx
import React, { useRef, useState, useMemo } from 'react';
import type { Point } from '../utils/RobotArm';
//import Triangle from './Triangle';
import { RotateCw } from 'lucide-react';

interface Props {
  id?: string;
  label: string;
  pathPoints: Point[];              // original path points (for x positions)
  segmentValues: number[];         // length = pathPoints.length - 1, values in -1..1
  setSegmentValues: (vals: number[]) => void;
}

export function GraphEditorPanel({
  label,
  pathPoints,
  segmentValues,
  setSegmentValues,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingSeg, setDraggingSeg] = useState<number | null>(null);
  const [hoverSeg, setHoverSeg] = useState<number | null>(null);

  const width = 200;
  const height = 100;
  //const baselineY = height / 2;
  const snapThreshold = 0.02;

  // compute relative distances along path
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

  // midpoints positions for segments (pixel)
  const segmentMidpoints = useMemo(() => {
    const mids = [];
    for (let i = 0; i < Math.max(0, relativeDistances.length - 1); i++) {
      const x = ((relativeDistances[i] + relativeDistances[i + 1]) / 2) * width;
      // derive displayed y from average of segment value (just show the segment value)
      const segVal = segmentValues[i] ?? 0;
      const normalizedY = (segVal + 1) / 2;
      const y = (1 - normalizedY) * height;
      mids.push({ x, y, value: segVal });
    }
    return mids;
  }, [relativeDistances, segmentValues, width, height]);

  function getMousePos(e: React.PointerEvent) {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: 1 - (e.clientY - rect.top) / rect.height,
    };
  }

  function handlePointerDownSegment(index: number, e: React.PointerEvent) {
    e.stopPropagation();
    setDraggingSeg(index);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (draggingSeg === null) return;
    const { y: normY } = getMousePos(e);
    const clamped = Math.max(0, Math.min(1, normY));
    let val = (clamped - 0.5) * 2; // -1..1
    if (Math.abs(val) < snapThreshold) val = 0;

    const next = segmentValues.slice();
    next[draggingSeg] = val;
    setSegmentValues(next);
  }

  function handlePointerUp() {
    setDraggingSeg(null);
  }

  // map -1..1 -> color
  function mapValueToColor(v: number) {
    const c = Math.max(-1, Math.min(1, v));
    if (c < 0) return `rgba(249,115,115,0.9)`; // redish
    return `rgba(96,165,250,0.9)`; // blueish
  }

  return (
    <div className="flex flex-col space-y-1 relative">
      <strong className="text-xs text-gray-300">{label}</strong>
      <button onClick={() => setSegmentValues(segmentValues.map(() => 0))} className="absolute right-2 top-5 p-1 text-gray-400 hover:text-white" title="Reset">
        <RotateCw size={16} />
      </button>

      <div className="rounded bg-neutral-900 p-2 shadow-inner">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="block"
        >
          <rect x={0} y={0} width={width} height={height} className="fill-neutral-900 stroke-neutral-700" />
          <line x1={0} x2={width} y1={height/2} y2={height/2} className="stroke-neutral-600" strokeDasharray="4,2" />
          {/* draw segment colored lines */}
          {segmentMidpoints.map((m, i) => {
            //const nextX = i < segmentMidpoints.length - 1 ? segmentMidpoints[i + 1].x : m.x + 20;
            return (
              <line
                key={`segline-${i}`}
                x1={m.x - 20}
                y1={m.y}
                x2={m.x + 20}
                y2={m.y}
                stroke={mapValueToColor(m.value)}
                strokeWidth={6}
                strokeLinecap="round"
                opacity={0.14}
              />
            );
          })}

          {/* segment handles */}
          {segmentMidpoints.map((m, i) => {
            const isDragging = draggingSeg === i;
            const isHover = hoverSeg === i;
            return (
              <g key={`mid-${i}`} transform={`translate(${m.x}, ${m.y})`} onPointerDown={(e) => handlePointerDownSegment(i, e)} onMouseEnter={() => setHoverSeg(i)} onMouseLeave={() => setHoverSeg(null)} style={{ cursor: 'ns-resize', pointerEvents: 'all' }}>
                <circle r={6} fill="white" stroke="black" strokeWidth={0.8} opacity={isDragging || isHover ? 1 : 0.95} />
                <circle r={3} fill={mapValueToColor(m.value)} />
              </g>
            );
          })}

        </svg>
      </div>
    </div>
  );
}

export default GraphEditorPanel;
