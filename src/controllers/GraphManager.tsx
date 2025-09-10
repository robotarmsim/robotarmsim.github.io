// src/controllers/GraphManager.tsx
import type { Point } from '../utils/RobotArm';
import { pointGraphFromSegmentValues } from '../utils/segmentUtils';

/**
 * vertexToSegmentValues
 * - Convert vertex-style Point[] -> per-segment number[] where each segment
 *   value is the average of the two adjacent vertex y values.
 */
export function vertexToSegmentValues(vertexGraph: Point[] | number[]): number[] {
  if (!vertexGraph || vertexGraph.length === 0) return [];
  // numeric array passed in already
  if (typeof (vertexGraph[0] as any) === 'number') return (vertexGraph as number[]).slice();

  const verts = vertexGraph as Point[];
  if (verts.length <= 1) return [];
  const segs: number[] = new Array(Math.max(0, verts.length - 1));
  for (let i = 0; i < verts.length - 1; i++) {
    const a = verts[i]?.y ?? 0;
    const b = verts[i + 1]?.y ?? a;
    segs[i] = (a + b) / 2;
  }
  return segs;
}

/**
 * segmentValuesToVertexGraph
 * - Convert per-segment values + pathPoints -> vertex-style Point[] graph
 * - Delegates placement of x coordinates to pointGraphFromSegmentValues
 */
export function segmentValuesToVertexGraph(segmentValues: number[], pathPoints: Point[]): Point[] {
  if (!pathPoints || pathPoints.length === 0) return [];
  return pointGraphFromSegmentValues(segmentValues ?? [], pathPoints ?? []);
}

/**
 * ensureVertexGraph
 * - Accepts either Point[] or number[] and returns a vertex-style Point[].
 */
export function ensureVertexGraph(input: Point[] | number[], pathPoints: Point[]): Point[] {
  if (!input) return segmentValuesToVertexGraph([], pathPoints);
  if (typeof (input[0] as any) === 'number') {
    return segmentValuesToVertexGraph(input as number[], pathPoints);
  }
  return (input as Point[]).slice();
}

/**
 * ensureSegmentValues
 * - Accepts either Point[] or number[] and returns per-segment number[].
 */
export function ensureSegmentValues(input: Point[] | number[]): number[] {
  if (!input) return [];
  if (typeof (input[0] as any) === 'number') return (input as number[]).slice();
  return vertexToSegmentValues(input as Point[]);
}

export default {
  vertexToSegmentValues,
  segmentValuesToVertexGraph,
  ensureVertexGraph,
  ensureSegmentValues,
};
