// src/components/SegmentPopup.tsx
import React, { useEffect, useState, useRef } from 'react';
import type { MotionPlanner } from '../utils/motion';

interface SegmentPopupProps {
  x: number;
  y: number;
  segmentIndex: number;
  planner: MotionPlanner;
  onClose: () => void;
}

export const SegmentPopup: React.FC<SegmentPopupProps> = ({ x, y, segmentIndex, planner, onClose }) => {
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [curvature, setCurvature] = useState(planner['curvatureValues'][segmentIndex]);
  const [velocity, setVelocity] = useState(planner['velocityValues'][segmentIndex]);
  const [noise, setNoise] = useState(planner['noiseValues'][segmentIndex]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popupRef.current && !popupRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Sync updates back to planner
  useEffect(() => {
    planner['curvatureValues'][segmentIndex] = curvature;
    planner['velocityValues'][segmentIndex] = velocity;
    planner['noiseValues'][segmentIndex] = noise;
  }, [curvature, velocity, noise, planner, segmentIndex]);

  return (
    <div
      ref={popupRef}
      className="absolute z-50 bg-white border border-gray-300 rounded p-3 shadow-lg text-sm space-y-2"
      style={{ left: x + 10, top: y + 10 }}
    >
      <div>
        <label className="block font-medium text-gray-700">Curvature</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={curvature}
          onChange={(e) => setCurvature(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>
      <div>
        <label className="block font-medium text-gray-700">Speed</label>
        <input
          type="range"
          min={0.1}
          max={2}
          step={0.01}
          value={velocity}
          onChange={(e) => setVelocity(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>
      <div>
        <label className="block font-medium text-gray-700">Noise</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={noise}
          onChange={(e) => setNoise(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>
    </div>
  );
};
