import React, { useRef, useState } from "react";
import { type Point } from "../utils/RobotArm";
import Triangle from "./Triangle.tsx";
import { RotateCw } from "lucide-react";

interface GraphEditorPanelProps {
    id: string;
    label: string;
    graphPoints: Point[]; // y is offset in [-1, 1]
    setGraphPoints: React.Dispatch<React.SetStateAction<Point[]>>;
    pathPoints: Point[];
    onSegmentChange?: (segIndex: number, value: number) => void;
    segmentValues: number[];         // length = pathPoints.length - 1, values in -1..1
    setSegmentValues: (vals: number[]) => void;
}

export function GraphEditorPanel({
    label,
    graphPoints,
    setGraphPoints,
    pathPoints,
    onSegmentChange,
    segmentValues,
    setSegmentValues,
}: GraphEditorPanelProps) {
    const svgRef = useRef<SVGSVGElement | null>(null);
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null); // point index
    const [draggingSegmentIndex, setDraggingSegmentIndex] = useState<number | null>(null); // segment index (between i and i+1)
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);
    const [hoverSegmentIndex, setHoverSegmentIndex] = useState<number | null>(null);

    const width = 200;
    const height = 100;
    const baselineY = height / 2;
    const snapThreshold = 0.02; // snapping threshold in offset units (-1..1)

    // convert normalized y (0..1) <-> offset (-1..1)
    const normalizedToOffset = (n: number) => (n - 0.5) * 2;
    const offsetToNormalized = (o: number) => (o + 1) / 2;

    // --- Utility: compute normalized distances along the pathPoints ---
    function getRelativeDistances(points: Point[]): number[] {
        if (points.length < 2) return points.map(() => 0);
        let totalLength = 0;
        const distances = [0];
        for (let i = 1; i < points.length; i++) {
            const dx = points[i].x - points[i - 1].x;
            const dy = points[i].y - points[i - 1].y;
            totalLength += Math.hypot(dx, dy);
            distances.push(totalLength);
        }
        if (totalLength <= 0) return distances.map(() => 0);
        return distances.map((d) => d / totalLength);
    }

    const relativeDistances = getRelativeDistances(pathPoints);

    function getMousePos(e: React.PointerEvent): { x: number; y: number } {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };
        return {
            x: (e.clientX - rect.left) / rect.width, // normalized 0..1 (left=0)
            y: 1 - (e.clientY - rect.top) / rect.height, // normalized 0..1 (top=1)
        };
    }

    function handlePointPointerDown(index: number, e: React.PointerEvent) {
        e.stopPropagation();
        setDraggingIndex(index);
    }

    function handleSegmentPointerDown(index: number, e: React.PointerEvent) {
        e.stopPropagation();
        setDraggingSegmentIndex(index);
    }

    function handlePointerMove(e: React.PointerEvent) {
        // compute offset from mouse y
        const { y: normY } = getMousePos(e);
        const clampedNorm = Math.max(0, Math.min(1, normY));
        let offset = normalizedToOffset(clampedNorm);

        // snap to baseline
        if (Math.abs(offset) < snapThreshold) offset = 0;

        if (draggingIndex !== null) {
            // dragging a point
            const newPoints = [...graphPoints];
            // keep x aligned with relativeDistances (so mapping remains correct)
            newPoints[draggingIndex] = {
                x: relativeDistances[draggingIndex] ?? graphPoints[draggingIndex].x,
                y: offset,
            };
            setGraphPoints(newPoints);
            return;
        }

        // if (draggingSegmentIndex !== null) {
        //     // dragging a segment handle; we write same offset to both neighboring graph points
        //     const i = draggingSegmentIndex;
        //     if (i < 0 || i >= graphPoints.length - 1) return;
        //     const newPoints = [...graphPoints];
        //     newPoints[i] = { x: relativeDistances[i] ?? newPoints[i].x, y: offset };
        //     newPoints[i + 1] = { x: relativeDistances[i + 1] ?? newPoints[i + 1].x, y: offset };
        //     setGraphPoints(newPoints);
        //     return;
        // }
        // inside the component, replace the draggingSegmentIndex branch:
        if (draggingSegmentIndex !== null) {
            const i = draggingSegmentIndex;
            if (i < 0 || i >= graphPoints.length - 1) return;
            if (typeof onSegmentChange === 'function') {
                onSegmentChange(i, offset);
            } else {
                // fallback: previous behaviour (overwrite both endpoints)
                const newPoints = [...graphPoints];
                newPoints[i] = { x: relativeDistances[i] ?? newPoints[i].x, y: offset };
                newPoints[i + 1] = { x: relativeDistances[i + 1] ?? newPoints[i + 1].x, y: offset };
                setGraphPoints(newPoints);
            }
            return;
        }
    }

    function handlePointerUp() {
        setDraggingIndex(null);
        setDraggingSegmentIndex(null);
    }

    function resetGraph() {
        setGraphPoints(graphPoints.map((pt) => ({ ...pt, y: 0 })));
    }

    // Convert stored offset points to pixel space
    const pixelPoints = graphPoints.map((pt, i) => {
        const normalizedY = offsetToNormalized(pt.y); // 0..1
        return {
            x: (relativeDistances[i] ?? pt.x) * width,
            y: (1 - normalizedY) * height,
        };
    });

    // midpoints for segments
    const segmentMidpoints = pixelPoints.slice(0, -1).map((p, i) => {
        const pNext = pixelPoints[i + 1];
        return {
            x: (p.x + pNext.x) / 2,
            y: (p.y + pNext.y) / 2,
            value: (graphPoints[i].y + graphPoints[i + 1].y) / 2, // average value for color
        };
    });

    // map -1..1 -> color (interpolate between warm and cool)
    function mapValueToColor(v: number) {
        const clamp = Math.max(-1, Math.min(1, v));
        // warm (negative) -> rgb(249,115,115) red-ish
        const warm = { r: 249, g: 115, b: 115 };
        // neutral -> rgb(148,163,184) grayish
        const neutral = { r: 148, g: 163, b: 184 };
        // cool (positive) -> rgb(96,165,250) blue-ish
        const cool = { r: 96, g: 165, b: 250 };

        if (clamp < 0) {
            const t = (clamp + 1) / 1; // -1 -> 0, 0 -> 1
            const r = Math.round(warm.r * (1 - t) + neutral.r * t);
            const g = Math.round(warm.g * (1 - t) + neutral.g * t);
            const b = Math.round(warm.b * (1 - t) + neutral.b * t);
            return `rgb(${r}, ${g}, ${b})`;
        } else {
            const t = clamp; // 0 -> 0, 1 -> 1
            const r = Math.round(neutral.r * (1 - t) + cool.r * t);
            const g = Math.round(neutral.g * (1 - t) + cool.g * t);
            const b = Math.round(neutral.b * (1 - t) + cool.b * t);
            return `rgb(${r}, ${g}, ${b})`;
        }
    }

    return (
        <div className="flex flex-col space-y-1 relative">
            <strong className="text-xs text-gray-300">{label}</strong>

            <button
                onClick={resetGraph}
                className="absolute right-2 top-5 p-1 text-gray-400 hover:text-white"
                title="Reset graph to baseline"
            >
                <RotateCw size={16} />
            </button>

            <div className="rounded bg-neutral-900 p-2 shadow-inner">
                <svg
                    ref={svgRef}
                    width={width}
                    height={height}
                    className="block cursor-crosshair"
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                    onPointerCancel={handlePointerUp}
                    // let the user start a drag from empty space too
                    onPointerDown={() => {
                        // prevent accidental text selection outside svg
                        // actual drags originate from handles or points
                    }}
                >
                    {/* Background lane */}
                    <rect x={0} y={0} width={width} height={height} className="fill-neutral-900 stroke-neutral-700" />

                    {/* Gridlines */}
                    {[0.25, 0.5, 0.75].map((frac, i) => (
                        <line key={i} x1={0} x2={width} y1={frac * height} y2={frac * height} className="stroke-neutral-700" strokeWidth={0.5} />
                    ))}

                    {/* Middle baseline */}
                    <line x1={0} x2={width} y1={baselineY} y2={baselineY} className="stroke-neutral-600" strokeWidth={1} strokeDasharray="4,2" />

                    {/* Filled area to baseline */}
                    <polygon
                        points={[
                            `${pixelPoints[0].x},${baselineY}`,
                            ...pixelPoints.map((p) => `${p.x},${p.y}`),
                            `${pixelPoints[pixelPoints.length - 1].x},${baselineY}`,
                        ].join(" ")}
                        className="fill-sky-500/30"
                    />

                    {/* colored segments (low-contrast) */}
                    {pixelPoints.slice(0, -1).map((p, i) => {
                        const pNext = pixelPoints[i + 1];
                        const segValue = (graphPoints[i].y + graphPoints[i + 1].y) / 2;
                        return (
                            <line
                                key={`seg-${i}`}
                                x1={p.x}
                                y1={p.y}
                                x2={pNext.x}
                                y2={pNext.y}
                                stroke={mapValueToColor(segValue)}
                                strokeWidth={4}
                                strokeLinecap="round"
                                opacity={0.22}
                            />
                        );
                    })}

                    {/* Envelope line */}
                    <polyline points={pixelPoints.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" className="stroke-gray-200" strokeWidth={2} style={{ filter: "drop-shadow(0 0 2px rgba(255,255,255,0.6))" }} />

                    {/* Segment handles (midpoints) */}
                    {segmentMidpoints.map((m, i) => {
                        const isHovered = hoverSegmentIndex === i;
                        const isDragging = draggingSegmentIndex === i;
                        return (
                            <g
                                key={`mid-${i}`}
                                transform={`translate(${m.x}, ${m.y})`}
                                onPointerDown={(e) => handleSegmentPointerDown(i, e)}
                                onMouseEnter={() => setHoverSegmentIndex(i)}
                                onMouseLeave={() => setHoverSegmentIndex(null)}
                                style={{ cursor: "ns-resize", pointerEvents: "all" }}
                            >
                                <circle r={6} fill="white" stroke="black" strokeWidth={0.8} opacity={isDragging || isHovered ? 1 : 0.9} />
                                <circle r={3} fill={mapValueToColor(m.value)} />
                            </g>
                        );
                    })}

                    {/* Keyframes (with hover tooltip showing offset value) */}
                    {pixelPoints.map((pt, i) => {
                        const offsetValue = graphPoints[i].y;
                        const displayText = (offsetValue >= 0 ? "+" : "") + offsetValue.toFixed(2);
                        const isHovered = hoverIndex === i;

                        // endpoints: triangle
                        if (i === 0 || i === pixelPoints.length - 1) {
                            return (
                                <g key={i} onPointerDown={(e) => handlePointPointerDown(i, e)} onMouseEnter={() => setHoverIndex(i)} onMouseLeave={() => setHoverIndex(null)} style={{ pointerEvents: "all", cursor: "ns-resize" }}>
                                    <Triangle cx={pt.x} cy={pt.y} size={10} className={`fill-white stroke-black ${draggingIndex === i ? "fill-orange-400" : "hover:fill-sky-400"}`} />
                                    {isHovered && <text x={pt.x} y={pt.y - 12} textAnchor="middle" className="fill-white text-[10px] pointer-events-none">{displayText}</text>}
                                </g>
                            );
                        }

                        // internal keyframes: diamond
                        return (
                            <g key={i} onPointerDown={(e) => handlePointPointerDown(i, e)} onMouseEnter={() => setHoverIndex(i)} onMouseLeave={() => setHoverIndex(null)} style={{ pointerEvents: "all", cursor: "ns-resize" }}>
                                <rect x={pt.x - 5} y={pt.y - 5} width={10} height={10} transform={`rotate(45, ${pt.x}, ${pt.y})`} className={`fill-white stroke-black ${draggingIndex === i ? "fill-orange-400" : "hover:fill-sky-400"}`} />
                                {isHovered && <text x={pt.x} y={pt.y - 12} textAnchor="middle" className="fill-white text-[10px] pointer-events-none">{displayText}</text>}
                            </g>
                        );
                    })}
                </svg>
            </div>
        </div>
    );
}

export default GraphEditorPanel;
