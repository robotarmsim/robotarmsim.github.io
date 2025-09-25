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
 * Initialize per-segment values for a given path (pathPoints.length - 1).
 */
export function initSegmentValuesForPath(pathPoints: Point[], defaultValue = 0): number[] {
  const len = Math.max(0, (pathPoints?.length ?? 0) - 1);
  return new Array(len).fill(defaultValue);
}

/**
 * Resample an existing per-segment array to match a new pathPoints length.
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

/**
 * Rebuild a pointGraph from given pathPoints and (possibly stale) segmentValues.
 */
export function resamplePointGraph(segmentValues: number[], pathPoints: Point[]): Point[] {
  const resampled = resampleSegmentsToPath(segmentValues, pathPoints);
  return pointGraphFromSegmentValues(resampled, pathPoints);
}

/**
 * Given old segmentValues and a new path, return a fresh segmentValues array
 * that is interpolated to the new length.
 */
export function updateSegmentsOnPathChange(
  oldSegments: number[],
  newPath: Point[]
): number[] {
  return resampleSegmentsToPath(oldSegments, newPath);
}

/* -------------------- TIMING HELPERS (new) -------------------- */

/**
 * Compute Euclidean lengths for each segment (pathPoints.length - 1)
 */
export function segmentLengths(points: Point[]): number[] {
  const n = Math.max(0, (points?.length ?? 0) - 1);
  if (n <= 0) return [];
  const out: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[i + 1];
    out[i] = Math.hypot(b.x - a.x, b.y - a.y);
  }
  return out;
}

/**
 * Map a tempo segment value (expected range -1..1) to a positive speed multiplier.
 * Adjust minSpeed and maxSpeed to taste. This mapping avoids zero and very tiny speeds.
 */
export function tempoValueToSpeed(tempoValue: number, minSpeed = 0.4, maxSpeed = 2.5): number {
  const v = Math.max(-1, Math.min(1, tempoValue ?? 0));
  // map -1..1 to [minSpeed..maxSpeed] using simple linear mapping
  const mid = (minSpeed + maxSpeed) / 2;
  return mid + v * (maxSpeed - mid);
}

/**
 * Compute per-segment durations from lengths and optional per-segment speed multipliers.
 * If you provide tempoValues (length = segments), they will be converted to speeds using tempoValueToSpeed.
 *
 * duration = length / speed
 */
export function segmentDurations(points: Point[], tempoValues?: number[], baseSpeed = 1): number[] {
  const lengths = segmentLengths(points);
  if (lengths.length === 0) return [];
  const speeds = lengths.map((_, i) => {
    const tempo = tempoValues?.[i] ?? 0;
    // tempoValueToSpeed returns a multiplier; combine with baseSpeed
    return baseSpeed * tempoValueToSpeed(tempo);
  });
  return lengths.map((len, i) => {
    const sp = Math.max(1e-4, speeds[i]); // avoid 0
    return len / sp;
  });
}

/**
 * cumulativeTimes([d1, d2, d3]) => [d1, d1+d2, d1+d2+d3]
 */
export function cumulativeTimes(durations: number[]): number[] {
  const out: number[] = [];
  let sum = 0;
  for (const d of durations) {
    sum += d;
    out.push(sum);
  }
  return out;
}

/**
 * Find active segment index for a given time t (seconds) using cumulative times.
 * If t <= cumulative[0] => 0.
 * If t > cumulative[last] => last index.
 */
export function findSegmentIndex(t: number, cumulative: number[]): number {
  if (!cumulative || cumulative.length === 0) return -1;
  for (let i = 0; i < cumulative.length; i++) {
    if (t <= cumulative[i]) return i;
  }
  return cumulative.length - 1;
}

export default {
  getRelativeDistances,
  pointGraphFromSegmentValues,
  initSegmentValuesForPath,
  resampleSegmentsToPath,
  resamplePointGraph,
  updateSegmentsOnPathChange,
  // timing
  segmentLengths,
  tempoValueToSpeed,
  segmentDurations,
  cumulativeTimes,
  findSegmentIndex,
};
