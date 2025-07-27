// yeah this is literally just the triangle. I moved it out of GraphEditorPanel.
import React from 'react';
import '../css/index.css'; // could try replacing it with Triangle.css...

interface TriangleProps {
    cx: number;
    cy: number;
    size: number;
    onPointerDown?: React.PointerEventHandler<SVGPolygonElement>;
    className?: string;
}

const Triangle: React.FC<TriangleProps> = ({
    cx,
    cy,
    size,
    onPointerDown,
    className,
}) => {
    const height = (size * Math.sqrt(3)) / 2;
    const points = [
        `${cx},${cy - (2 / 3) * height}`, // top
        `${cx - size / 2},${cy + height / 3}`, // bottom left
        `${cx + size / 2},${cy + height / 3}`, // bottom right
    ].join(' ');

    return (
        <polygon
            points={points}
            className={`triangle-fill ${className}`} // Apply the fill class and any additional class
            stroke="white"
            strokeWidth={1}
            style={{ cursor: 'pointer' }}
            onPointerDown={onPointerDown}
        />
    );
};

export default Triangle;