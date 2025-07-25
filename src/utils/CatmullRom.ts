import type { Point } from './RobotArm';

/**
 * Generates a smooth Catmull-Rom spline through given control points.
 * Returns an array of interpolated points (the smooth curve).
 * @param points Control points to pass through.
 * @param segments Number of segments between each pair of points (higher = smoother).
 */

// type SplineOptions = {
//   tensionFn?: (i: number) => number; // i = segment index
//   samplesPerSegment?: number;
// };


export function catmullRomSpline(
  points: Point[],
  segments = 16,
  tensionFn: (t: number) => number
): Point[] {
  if (points.length < 2) return points;

  const result: Point[] = [];

  const n = points.length;

  function interpolate(p0: Point, p1: Point, p2: Point, p3: Point, t: number, tension: number): Point {
  const t2 = t * t;
  const t3 = t2 * t;

  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  // Tangents scaled by (1 - tension)
  const m1x = ((1 - tension) * (p2.x - p0.x)) / 2;
  const m1y = ((1 - tension) * (p2.y - p0.y)) / 2;
  const m2x = ((1 - tension) * (p3.x - p1.x)) / 2;
  const m2y = ((1 - tension) * (p3.y - p1.y)) / 2;

  return {
    x: h00 * p1.x + h10 * m1x + h01 * p2.x + h11 * m2x,
    y: h00 * p1.y + h10 * m1y + h01 * p2.y + h11 * m2y,
  };
}

  // For each point in the original array, interpolate between neighbors
  for (let i = 0; i < n - 1; i++) {
    // Handle boundaries by duplicating start/end points
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || points[i + 1];

    const normalizedSegmentPos = i / (n - 2); // range [0, 1]
    const tension = tensionFn(normalizedSegmentPos);

    for (let j = 0; j < segments; j++) {
      const t = j / segments;
      result.push(interpolate(p0, p1, p2, p3, t, tension));
    }
  }

  result.push(points[n - 1]);
  return result;
}
