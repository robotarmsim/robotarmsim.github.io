// src/components/GraphEditorPanel.tsx
import React, { useRef, useState } from 'react';
import { type Point } from '../utils/RobotArm';

interface GraphEditorPanelProps {
    label: string;
    graphPoints: Point[];
    setGraphPoints: React.Dispatch<React.SetStateAction<Point[]>>;
    pathPoints: Point[];  // <--- NEW prop for the actual path points
}

export function GraphEditorPanel({ label, graphPoints, setGraphPoints, pathPoints }: GraphEditorPanelProps) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [draggingIndex, setDraggingIndex] = useState<number | null>(null);

    const width = 200;
    const height = 100;

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
        return distances.map(d => d / totalLength);
    }

    const relativeDistances = getRelativeDistances(pathPoints);

    function getMousePos(e: React.PointerEvent): Point {
        const rect = svgRef.current?.getBoundingClientRect();
        if (!rect) return { x: 0, y: 0 };
        return {
            x: (e.clientX - rect.left) / rect.width,
            y: 1 - (e.clientY - rect.top) / rect.height, // invert y
        };
    }

    function handlePointerDown(index: number) {
        setDraggingIndex(index);
    }

    function handlePointerMove(e: React.PointerEvent) {
        if (draggingIndex === null) return;
        const { y } = getMousePos(e);
        const clampedY = Math.max(0, Math.min(1, y));

        // Keep X locked to path-relative distance, only update Y
        const newPoints = [...graphPoints];
        newPoints[draggingIndex] = { x: relativeDistances[draggingIndex] ?? graphPoints[draggingIndex].x, y: clampedY };
        setGraphPoints(newPoints);
    }

    function handlePointerUp() {
        setDraggingIndex(null);
    }

    function Triangle({ cx, cy, size, fill, onPointerDown }: { cx: number; cy: number; size: number; fill: string; onPointerDown?: React.PointerEventHandler<SVGPolygonElement> }) {
        const height = size * Math.sqrt(3) / 2;
        const points = [
            `${cx},${cy - (2 / 3) * height}`, // top
            `${cx - size / 2},${cy + height / 3}`, // bottom left
            `${cx + size / 2},${cy + height / 3}` // bottom right
        ].join(' ');
        return <polygon points={points} fill={fill} stroke="white" strokeWidth={1} style={{ cursor: 'pointer' }} onPointerDown={onPointerDown} />;
    }

    // Use path-relative distances for X when rendering points and polyline
    const pixelPoints = graphPoints.map((pt, i) => ({
        x: (relativeDistances[i] ?? pt.x) * width,
        y: (1 - pt.y) * height,
    }));

    return (
        <div style={{ marginBottom: 12 }}>
            <strong>{label}</strong>
            <svg
                ref={svgRef}
                width={width}
                height={height}
                style={{
                    border: '1px solid #ccc',
                    background: '#fafafa',
                    touchAction: 'none',
                    userSelect: 'none',
                    display: 'block',
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
            >
                {/* Draw lines between points */}
                <polyline
                    fill="none"
                    stroke="hotpink"
                    strokeWidth={2}
                    points={pixelPoints.map(p => `${p.x},${p.y}`).join(' ')}
                />

                {/* Draw draggable points */}
                {pixelPoints.map((pt, i) =>
                    (i === 0 || i === pixelPoints.length - 1) ? (
                        <Triangle
                            key={i}
                            cx={pt.x}
                            cy={pt.y}
                            size={10}
                            fill="deeppink"
                            onPointerDown={() => handlePointerDown(i)}
                        />
                    ) : (
                        <circle
                            key={i}
                            cx={pt.x}
                            cy={pt.y}
                            r={5}
                            fill="deeppink"
                            stroke="white"
                            strokeWidth={1}
                            onPointerDown={() => handlePointerDown(i)}
                            style={{ cursor: 'pointer' }}
                        />
                    )
                )}
            </svg>
        </div>
    );
}
