// draggable keyframesimport React from 'react';
import type { Point } from "../utils/RobotArm";

interface PathEditorProps {
  keyframes: Point[];
  onKeyframeMove: (index: number, pos: Point) => void;
  onKeyframeAdd: (pos: Point) => void;
}

export const PathEditor: React.FC<PathEditorProps> = ({ keyframes, onKeyframeMove, onKeyframeAdd }) => {
  const handlePointerDown = (e: React.PointerEvent<SVGCircleElement>, idx: number) => {
    e.preventDefault();
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg) return;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const pt = svg.createSVGPoint();
      pt.x = moveEvent.clientX;
      pt.y = moveEvent.clientY;
      const transformed = pt.matrixTransform(svg.getScreenCTM()?.inverse());
      onKeyframeMove(idx, { x: transformed.x, y: transformed.y });
    };

    const stop = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stop);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stop);
  };

  const handleClick = (e: React.MouseEvent<SVGElement>) => {
    const svg = e.currentTarget as SVGSVGElement;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const transformed = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    onKeyframeAdd({ x: transformed.x, y: transformed.y });
  };

  return (
    <g onClick={handleClick}>
      {keyframes.map((pt, idx) => (
        <circle
          key={idx}
          cx={pt.x}
          cy={pt.y}
          r={6}
          fill="white"
          stroke="black"
          strokeWidth={1.5}
          onPointerDown={(e) => handlePointerDown(e, idx)}
        />
      ))}
    </g>
  );
};
