// src/components/CanvasStage.tsx

import React, { useRef, useState, type MouseEvent } from 'react';
import { useMotion } from '../hooks/useMotion';
import { SegmentPopup } from './SegmentPopup';
import type { Point } from '../utils/motion';

interface CanvasStageProps {
  width?: number;
  height?: number;
  limbLengths?: [number, number];
  maxPoints?: number;
  defaultDuration?: number;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  width = 800,
  height = 500,
  limbLengths = [200, 100],
  maxPoints = 4,
  defaultDuration = 5,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null); // Edited
  const [mousePos, setMousePos] = useState<Point>({ x: 0, y: 0 });
  const [popupIndex, setPopupIndex] = useState<number>(-1);
  
  const {
    angles,
    locked,
    addCheckpoint,
    clearPath,
    preview,
    findSegment,
    planner,
  } = useMotion({
    canvasRef,
    width,
    height,
    limbLengths,
    maxPoints,
  });

  const handleCanvasClick = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pt = { x, y };
    setMousePos(pt);

    console.log('Canvas clicked at:', x, y);

    if (!locked) {
      addCheckpoint(pt);
    } else {
      const idx = findSegment(pt);
      setPopupIndex(idx);
    }
  };

  const handleMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div className="relative">
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="border"
        onClick={handleCanvasClick}
        onMouseMove={handleMouseMove}
      />

      {popupIndex >= 0 && planner && (
        <SegmentPopup
          x={mousePos.x}
          y={mousePos.y}
          segmentIndex={popupIndex}
          planner={planner}
          onClose={() => setPopupIndex(-1)}
        />
      )}

      <div className="mt-2 flex space-x-2">
        <button
          onClick={clearPath}
          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
        >
          Clear
        </button>
        <button
          onClick={() => preview(defaultDuration)}
          className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Preview
        </button>
      </div>
    </div>
  );
};

export default CanvasStage;
