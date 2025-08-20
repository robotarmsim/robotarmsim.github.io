import type { Point } from './RobotArm';

/**
 * Generates a smooth cubic Bezier spline through given points.
 * @param points Control points to pass through (in order).
 * @param segments Number of samples per segment.
 * @param curvature Controls how far control handles are from the point (0 = straight lines, higher = more curve).
 */
export function bezierSpline(
  points: Point[],
  segments = 16,
  curvatureFn: (segmentPos: number) => number = () => 0.0 // default curvature
): Point[] {
  if (points.length < 2) return points;

  const result: Point[] = [];
  const n = points.length;

  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const prev = points[i - 1] || p0;
    const next = points[i + 2] || p1;

    const curvature = curvatureFn(i / (n - 2)); // normalized position in [0,1]

    const dx1 = p1.x - prev.x;
    const dy1 = p1.y - prev.y;
    const dx2 = next.x - p0.x;
    const dy2 = next.y - p0.y;

    const cp1: Point = {
      x: p0.x + dx1 * curvature,
      y: p0.y + dy1 * curvature,
    };
    const cp2: Point = {
      x: p1.x - dx2 * curvature,
      y: p1.y - dy2 * curvature,
    };

    for (let t = 0; t <= 1; t += 1 / segments) {
      const mt = 1 - t;
      const x =
        mt ** 3 * p0.x +
        3 * mt ** 2 * t * cp1.x +
        3 * mt * t ** 2 * cp2.x +
        t ** 3 * p1.x;
      const y =
        mt ** 3 * p0.y +
        3 * mt ** 2 * t * cp1.y +
        3 * mt * t ** 2 * cp2.y +
        t ** 3 * p1.y;
      result.push({ x, y });
    }
  }

  return result;
}

