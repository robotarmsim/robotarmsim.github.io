// src/hooks/useGraphData.ts
import { useState } from 'react';

export type GraphPoint = {
  x: number; // from 0 to 1 along the path
  y: number; // intensity of effect (0 to 1+)
};

export type GraphType = 'curvature' | 'noise' | 'speed';

// Helper to calculate cumulative distances between points
function getCumulativeDistances(points: { x: number; y: number }[]) {
  const distances = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const dist = Math.hypot(dx, dy);
    distances.push(distances[i - 1] + dist);
  }
  return distances;
}

export function useGraphData() {
  const [graphs, setGraphs] = useState<Record<GraphType, GraphPoint[]>>({
    curvature: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
    noise: [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
    speed: [
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
  });

  const updateGraph = (type: GraphType, newPoints: GraphPoint[]) => {
    setGraphs(prev => ({ ...prev, [type]: newPoints }));
  };

  const getGraph = (type: GraphType) => graphs[type];

  // 🔧 NEW: Normalize a physical distance along the path to [0, 1]
  const getNormalizedXByDistance = (
    path: { x: number; y: number }[],
    targetDist: number
  ) => {
    const cum = getCumulativeDistances(path);
    const total = cum[cum.length - 1];
    if (targetDist <= 0) return 0;
    if (targetDist >= total) return 1;
    return targetDist / total;
  };

  // 🔧 NEW: Convert normalized x back into real pixel position
  const getGraphPointPosition = (
    path: { x: number; y: number }[],
    graphPoint: GraphPoint
  ) => {
    const cum = getCumulativeDistances(path);
    const total = cum[cum.length - 1];
    const targetDist = graphPoint.x * total;

    for (let i = 1; i < cum.length; i++) {
      if (cum[i] >= targetDist) {
        const segmentLength = cum[i] - cum[i - 1];
        const t = (targetDist - cum[i - 1]) / segmentLength;
        const x =
          path[i - 1].x + t * (path[i].x - path[i - 1].x);
        const y =
          path[i - 1].y + t * (path[i].y - path[i - 1].y);
        return { x, y };
      }
    }

    return path[path.length - 1];
  };

  // 🔧 NEW: Insert or update a point at a real distance
  const updateGraphPointXByDistance = (
    type: GraphType,
    path: { x: number; y: number }[],
    targetDist: number,
    y: number
  ) => {
    const normX = getNormalizedXByDistance(path, targetDist);
    const updated = [...graphs[type]];
    updated.push({ x: normX, y });
    updated.sort((a, b) => a.x - b.x);
    updateGraph(type, updated);
  };

  return {
    getGraph,
    updateGraph,
    graphs,
    getGraphPointPosition,
    updateGraphPointXByDistance,
  };
}
