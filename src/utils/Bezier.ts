// src/utils/Bezier.ts
import type { Point } from './RobotArm';

/**
 * Generates a sampled cubic Bezier spline through given points.
 *
 * - `points` : control points to pass through (in order).
 * - `segments` : either:
 *     - a number: baseline samples-per-segment (used to compute an adaptive distribution
 *       proportional to control-segment geometric length), or
 *     - an array<number>: explicit samples per control-segment.
 * - `curvatureFn(segmentPos)` : function that returns a signed curvature value for the segment
 *     where segmentPos is in [0,1] representing the segment's normalized position along the whole path.
 *
 * Returns: Point[] (sampled points along the whole curve, endpoints included).
 */
export function bezierSpline(
  points: Point[],
  segments: number | number[] = 16,
  curvatureFn: (segmentPos: number) => number = () => 0.0
): Point[] {
  if (!points || points.length < 2) return points.slice();

  const result: Point[] = [];
  const n = points.length;
  const nSegments = Math.max(0, n - 1);

  // Threshold above which we treat a segment as intentionally "sharp" and do linear sampling.
  const SHARP_THRESHOLD = 0.9;

  // Helper to sample a linear segment between a and b with 'segs' subdivisions (inclusive)
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

  // compute per-control-segment sample counts
  let segCounts: number[] = new Array(nSegments).fill(Math.max(2, typeof segments === 'number' ? Math.round(segments) : 2));

  if (Array.isArray(segments)) {
    // provided explicit per-segment counts; clamp & ensure length
    for (let i = 0; i < nSegments; i++) {
      const v = segments[i] ?? segments[segments.length - 1] ?? 2;
      segCounts[i] = Math.max(2, Math.floor(v));
    }
  } else {
    // adaptive distribution proportional to geometric length
    //  - desiredTotal approximates segments * nSegments (backwards compat)
    const desiredTotal = Math.max(nSegments, Math.round(segments * nSegments));
    // measure segment lengths (polyline between control points)
    const segmentLengths: number[] = new Array(nSegments).fill(0);
    let totalLen = 0;
    for (let i = 0; i < nSegments; i++) {
      const a = points[i];
      const b = points[i + 1];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      segmentLengths[i] = len;
      totalLen += len;
    }

    if (totalLen <= 0) {
      // degenerate: fallback uniform
      for (let i = 0; i < nSegments; i++) segCounts[i] = Math.max(2, Math.round(segments));
    } else {
      // allocate proportionally
      let sum = 0;
      for (let i = 0; i < nSegments; i++) {
        const approx = Math.max(2, Math.round((segmentLengths[i] / totalLen) * desiredTotal));
        segCounts[i] = approx;
        sum += segCounts[i];
      }
      // adjust (distribute remainder) until sums match desiredTotal but keep >=2
      // If sum < desiredTotal, add 1 progressively to largest segments; if > desiredTotal reduce where possible.
      if (sum < desiredTotal) {
        // add to segments in order of descending length
        const order = segmentLengths.map((l, idx) => ({ l, idx })).sort((a, b) => b.l - a.l);
        let idx = 0;
        while (sum < desiredTotal) {
          segCounts[order[idx % order.length].idx] += 1;
          sum++;
          idx++;
        }
      } else if (sum > desiredTotal) {
        const order = segmentLengths.map((l, idx) => ({ l, idx })).sort((a, b) => a.l - b.l); // reduce smallest first
        let idx = 0;
        while (sum > desiredTotal) {
          const i = order[idx % order.length].idx;
          if (segCounts[i] > 2) {
            segCounts[i] -= 1;
            sum--;
          }
          idx++;
          // guard: if all at min then break
          if (idx > order.length * 3) break;
        }
      }
    }
  }

  // now sample per segment
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

    const segCount = segCounts[Math.min(i, segCounts.length - 1)] ?? Math.max(2, Math.round(typeof segments === 'number' ? segments : 8));

    // Sharp-mode: if curvature magnitude is large, sample the segment linearly.
    if (Math.abs(curvature) >= SHARP_THRESHOLD) {
      const linearSamples = sampleLinear(p0, p1, segCount);
      if (i === 0) {
        result.push(...linearSamples);
      } else {
        result.push(...linearSamples.slice(1)); // avoid duplicate start point
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

    // sample cubic Bezier for t in [0..1] using segCount
    for (let step = 0; step <= segCount; step++) {
      const t = step / segCount;
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
