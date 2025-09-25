// src/components/GraphEditorPanel.tsx
import React, { useRef, useMemo, useState, useCallback } from "react";
import type { Point } from "../utils/RobotArm";

interface Props {
  id?: string;
  label: string;
  pathPoints: Point[];              // actual points user added
  segmentValues: number[];          // same length as pathPoints
  setSegmentValues: (vals: number[]) => void;
  width?: number;
  height?: number;
}

const DEFAULT_WIDTH = 320;
const DEFAULT_HEIGHT = 150;
const SNAP_THRESHOLD = 0.02;

function mapValueToColor(v: number) {
  const c = Math.max(-1, Math.min(1, v));
  return c < 0 ? `rgba(249,115,115,0.95)` : `rgba(96,165,250,0.95)`;
}

function catmullRomToBezierPath(pts: { x: number; y: number }[], tension = 0.5) {
  if (!pts || pts.length === 0) return "";
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

export default function GraphEditorPanel({
  id,
  label,
  pathPoints,
  segmentValues,
  setSegmentValues,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

  const baselineY = height / 2;

  const anchors = useMemo(() => {
    return pathPoints.map((p, i) => ({
      x: (i / (pathPoints.length - 1)) * width,
      y: baselineY - (segmentValues[i] ?? 0) * (height / 2),
      value: segmentValues[i] ?? 0,
    }));
  }, [pathPoints, segmentValues, width, height, baselineY]);

  const curvePath = useMemo(() => catmullRomToBezierPath(anchors, 0.6), [anchors]);

  const fillPath = useMemo(() => {
    if (!anchors.length) return "";
    let d = `M ${anchors[0].x} ${baselineY}`;
    anchors.forEach((a) => (d += ` L ${a.x} ${a.y}`));
    d += ` L ${anchors[anchors.length - 1].x} ${baselineY} Z`;
    return d;
  }, [anchors, baselineY]);

  const getMouseNormalizedY = useCallback(
    (e: React.PointerEvent) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return 0;
      let y = e.clientY - rect.top;
      y = Math.max(0, Math.min(height, y));
      return (baselineY - y) / (height / 2); // -1..1
    },
    [baselineY, height]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (draggingIndex === null) return;
      let val = getMouseNormalizedY(e);
      if (Math.abs(val) < SNAP_THRESHOLD) val = 0;
      val = Math.max(-1, Math.min(1, val));
      const next = [...segmentValues];
      next[draggingIndex] = val;
      setSegmentValues(next);
    },
    [draggingIndex, segmentValues, setSegmentValues, getMouseNormalizedY]
  );

  const onPointerUp = useCallback(() => setDraggingIndex(null), []);

  const handlePointerDown = (i: number, e: React.PointerEvent) => {
    e.stopPropagation();
    setDraggingIndex(i);
    (e.target as Element).setPointerCapture?.(e.pointerId);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", userSelect: "none" }}>
      <strong style={{ color: "#e5e7eb", marginBottom: 4 }}>{label}</strong>
      <svg
        ref={svgRef}
        id={id}
        width={width}
        height={height}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        style={{ background: "#111", borderRadius: 6 }}
      >
        {/* baseline */}
        <line
          x1={0}
          y1={baselineY}
          x2={width}
          y2={baselineY}
          stroke="#4b5563"
          strokeDasharray="4,3"
          strokeWidth={1}
        />

        {/* shaded fill under curve */}
        <path d={fillPath} fill="rgba(96,165,250,0.1)" />

        {/* smooth curve */}
        <path
          d={curvePath}
          fill="none"
          stroke="rgba(100,180,255,0.9)"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* anchors */}
        {anchors.map((a, i) => {
          const outerR = 7;
          const innerR = 3;
          return (
            <g
              key={i}
              transform={`translate(${a.x}, ${a.y})`}
              onPointerDown={(e) => handlePointerDown(i, e)}
              style={{ cursor: "ns-resize", pointerEvents: "all" }}
            >
              {/* outer halo */}
              <circle r={outerR} fill="white" stroke="black" strokeWidth={0.6} opacity={0.8} />
              {/* inner color */}
              <circle r={innerR} fill={mapValueToColor(a.value)} />
              {/* value label inside point */}
              <text
                x={0}
                y={0}
                fontSize={10}
                fill="#e5e7eb"
                textAnchor="middle"
                alignmentBaseline="middle"
              >
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
