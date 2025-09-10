// src/utils/Bezier.ts
import type { Point } from './RobotArm';

/**
 * Generates a sampled cubic Bezier spline through given points.
 *
 * - `points` : control points to pass through (in order).
 * - `segments` : number of samples per segment (samples include both segment endpoints).
 * - `curvatureFn(segmentPos)` : function that returns a signed curvature value for the segment
 *     where segmentPos is in [0,1] representing the segment's normalized position along the whole path.
 *     The returned curvature can be negative (concave) or positive (convex). Larger magnitude -> stronger handles.
 *
 * Behavior notes:
 * - Handles the degenerate 2-point case safely (no NaN).
 * - If |curvature| >= SHARP_THRESHOLD the code uses linear sampling for that segment,
 *   producing a hard/near-sharp corner at the joint (useful for angular motion).
 * - Otherwise it constructs the usual cubic Bezier using adjacent tangent estimates.
 */
export function bezierSpline(
  points: Point[],
  segments = 16,
  curvatureFn: (segmentPos: number) => number = () => 0.0
): Point[] {
  if (!points || points.length < 2) return points.slice();

  const result: Point[] = [];
  const n = points.length;

  // Threshold above which we treat a segment as intentionally "sharp" and do linear sampling.
  const SHARP_THRESHOLD = 0.9;

  // Helper to sample a linear segment between a and b with 'segments' subdivisions (inclusive)
  function sampleLinear(a: Point, b: Point, segs: number) {
    const out: Point[] = [];
    for (let tIndex = 0; tIndex <= segs; tIndex++) {
      const t = tIndex / segs;
      out.push({
        x: a.x * (1 - t) + b.x * t,
        y: a.y * (1 - t) + b.y * t,
      });
    }
    return out;
  }

  for (let i = 0; i < n - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const prev = points[i - 1] || p0;
    const next = points[i + 2] || p1;

    // compute a safe normalized segmentPos in [0,1]
    const segmentPos = (n <= 2) ? 0 : (i / (n - 2));

    // call curvatureFn with safe value
    let curvature = curvatureFn(segmentPos);
    if (!Number.isFinite(curvature)) curvature = 0;

    // Sharp-mode: if curvature magnitude is large, sample the segment linearly.
    if (Math.abs(curvature) >= SHARP_THRESHOLD) {
      // linear sample (avoids smoothing) — this produces a hard corner at p1
      // but we still want to include samples contiguously; avoid duplicating the start point
      const linearSamples = sampleLinear(p0, p1, segments);
      if (i === 0) {
        // first segment: include all samples
        result.push(...linearSamples);
      } else {
        // subsequent segments: drop duplicate first sample (it equals previous last)
        result.push(...linearSamples.slice(1));
      }
      continue;
    }

    // Normal cubic handle calculation (Catmull-Rom–like handle estimation)
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

    // sample cubic Bezier for t in [0..1]. To avoid duplicated points between segments,
    // include t=0 for first segment but skip t=0 for subsequent segments.
    for (let step = 0; step <= segments; step++) {
      const t = step / segments;
      if (i > 0 && step === 0) continue; // skip duplicate point (handled by previous segment)
      const mt = 1 - t;
      const x =
        mt * mt * mt * p0.x +
        3 * mt * mt * t * cp1.x +
        3 * mt * t * t * cp2.x +
        t * t * t * p1.x;
      const y =
        mt * mt * mt * p0.y +
        3 * mt * mt * t * cp1.y +
        3 * mt * t * t * cp2.y +
        t * t * t * p1.y;
      result.push({ x, y });
    }
  }

  return result;
}
