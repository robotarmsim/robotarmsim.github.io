// src/utils/segmentUtils.ts
import type { Point } from './RobotArm';

/**
 * Compute cumulative normalized distances for a list of path points.
 * Returns an array of length = points.length with values in [0,1].
 */
export function getRelativeDistances(points: Point[]): number[] {
  if (!points || points.length === 0) return [];
  if (points.length === 1) return [0];
  const dists: number[] = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    const seg = Math.hypot(dx, dy);
    total += seg;
    dists.push(total);
  }
  if (total <= 0) {
    // degenerate: collapse to evenly spaced positions
    return points.map((_, i) => (points.length === 1 ? 0 : i / (points.length - 1)));
  }
  return dists.map((v) => v / total);
}

/**
 * Convert per-segment values (length = pathPoints.length - 1)
 * into a vertex-style point graph (length = pathPoints.length).
 *
 * Vertex x coordinates are normalized along the path (0..1).
 * Vertex y values are derived from the segment values:
 * - If no segment values provided, y is 0 for every vertex.
 * - For interior vertices we average adjacent segment values.
 * - Endpoints take their adjacent segment value if available.
 *
 * This mapping is intentionally simple and stable: the UI displays
 * the vertex graph, and per-segment editing operates on the segmentValues array.
 */
export function pointGraphFromSegmentValues(segmentValues: number[], pathPoints: Point[]): Point[] {
  const n = pathPoints?.length ?? 0;
  if (n === 0) return [];
  const rel = getRelativeDistances(pathPoints);
  const segCount = segmentValues?.length ?? 0;

  const verts: Point[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let y = 0;
    if (segCount === 0) {
      y = 0;
    } else if (i === 0) {
      y = segmentValues[0] ?? 0;
    } else if (i === n - 1) {
      y = segmentValues[segCount - 1] ?? 0;
    } else {
      const a = segmentValues[i - 1] ?? 0;
      const b = segmentValues[i] ?? a;
      y = (a + b) / 2;
    }
    verts[i] = { x: rel[i] ?? (n === 1 ? 0 : i / (n - 1)), y };
  }
  return verts;
}

/**
 * Initialize per-segment values for a given path (pathPoints.length - 1),
 * filled with the provided defaultValue (default 0).
 */
export function initSegmentValuesForPath(pathPoints: Point[], defaultValue = 0): number[] {
  const len = Math.max(0, (pathPoints?.length ?? 0) - 1);
  return new Array(len).fill(defaultValue);
}

/**
 * Resample an existing per-segment array to match a new pathPoints length.
 * Uses linear interpolation across the index-space of segments to create a
 * new array sized (pathPoints.length - 1).
 *
 * - If prevSegments is empty, return an initSegmentValuesForPath(...).
 * - If lengths match, returns a shallow copy of prevSegments.
 * - Otherwise, linearly interpolates values.
 */
export function resampleSegmentsToPath(prevSegments: number[], pathPoints: Point[]): number[] {
  const newLen = Math.max(0, (pathPoints?.length ?? 0) - 1);
  if (newLen === 0) return [];
  const old = (prevSegments && prevSegments.length) ? prevSegments.slice() : [];
  const oldLen = old.length;

  if (oldLen === newLen) return old.slice();
  if (oldLen === 0) return initSegmentValuesForPath(pathPoints, 0);

  // if either side has length 1, fill with that single value
  if (oldLen === 1) return new Array(newLen).fill(old[0]);

  const res: number[] = new Array(newLen);
  const maxOldIndex = Math.max(1, oldLen - 1);

  for (let i = 0; i < newLen; i++) {
    const t = newLen === 1 ? 0 : i / (newLen - 1);
    const src = t * maxOldIndex;
    const lo = Math.floor(src);
    const hi = Math.min(oldLen - 1, lo + 1);
    const localT = src - lo;
    const val = (old[lo] ?? 0) * (1 - localT) + (old[hi] ?? 0) * localT;
    res[i] = val;
  }
  return res;
}

export default {
  getRelativeDistances,
  pointGraphFromSegmentValues,
  initSegmentValuesForPath,
  resampleSegmentsToPath,
};
