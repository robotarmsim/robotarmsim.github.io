// src/utils/catmullRomSpline.ts
import type { Point } from "./RobotArm";

/**
 * Catmull–Rom spline generator with tension control.
 *
 * @param points - Array of control points {x, y}
 * @param segments - Number of samples per segment
 * @param curvatureFn - Function (segmentPos ∈ [0,1]) → tension value
 *    tension = 0 gives loose/curvy (default Catmull-Rom)
 *    tension > 0 tightens toward straight lines
 *    tension < 0 exaggerates bowing
 */
export function catmullRomSpline(
  points: Point[],
  segments = 16,
  curvatureFn: (segmentPos: number) => number = () => 0
): Point[] {
  if (!points || points.length < 2) return points.slice();

  const result: Point[] = [];
  const n = points.length;

  function sampleSegment(p0: Point, p1: Point, p2: Point, p3: Point, tension: number): Point[] {
    const out: Point[] = [];
    const tau = (1 - tension) / 2; // scaling factor for tangents

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const t2 = t * t;
      const t3 = t2 * t;

      const a0 = -tau * t3 + 2 * tau * t2 - tau * t;
      const a1 = (2 - tau) * t3 + (tau - 3) * t2 + 1;
      const a2 = (tau - 2) * t3 + (3 - 2 * tau) * t2 + tau * t;
      const a3 = tau * t3 - tau * t2;

      const x = a0 * p0.x + a1 * p1.x + a2 * p2.x + a3 * p3.x;
      const y = a0 * p0.y + a1 * p1.y + a2 * p2.y + a3 * p3.y;
      out.push({ x, y });
    }
    return out;
  }

  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;

    const segmentPos = n <= 2 ? 0 : i / (n - 2);
    let tension = curvatureFn(segmentPos);
    if (!Number.isFinite(tension)) tension = 0;

    const samples = sampleSegment(p0, p1, p2, p3, tension);
    if (i > 0) samples.shift(); // avoid duplicate at joint
    result.push(...samples);
  }

  return result;
}
