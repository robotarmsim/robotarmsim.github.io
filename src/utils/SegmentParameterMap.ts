// src/utils/SegmentParameterMap.ts
import type { Point } from './RobotArm';

/**
 * SegmentParameterMap
 * --------------------
 * Unlike MotionParameterMap (which interpolates across [0,1]),
 * this class stores *per-segment* values tied to path segments.
 *
 * Example use:
 *  - Directness: concave/straight/convex per segment
 *  - Smoothness: corner rounding factor per segment
 */
export class SegmentParameterMap {
  private segments: number[];       // per-segment values (-1..1)
  private pathPoints: Point[];      // original path points
  public controlPoints: { x: number; y: number }[] = []; // exposed for UI graphs

  constructor(segmentValues: number[], pathPoints: Point[]) {
    this.segments = segmentValues ? [...segmentValues] : [];
    this.pathPoints = pathPoints ? [...pathPoints] : [];
    this.rebuildControlPoints();
  }

  /** Replace segments + optional path points */
  update(segmentValues: number[], pathPoints?: Point[]) {
    this.segments = segmentValues ? [...segmentValues] : [];
    if (pathPoints) this.pathPoints = [...pathPoints];
    this.rebuildControlPoints();
  }

  /**
   * Interpolates segment value for normalized path progress s ∈ [0,1].
   * This maps s into a segment index and lerps adjacent segment values.
   */
  evaluate(s: number): number {
    if (!this.segments.length) return 0;
    s = Math.max(0, Math.min(1, s));

    const nSeg = this.pathPoints.length - 1;
    if (nSeg <= 0) return this.segments[0] ?? 0;

    // Which segment are we in?
    const segIdx = Math.min(nSeg - 1, Math.floor(s * nSeg));
    const localT = (s * nSeg) - segIdx;

    const v0 = this.segments[segIdx] ?? 0;
    const v1 = this.segments[segIdx + 1] ?? v0;
    return v0 * (1 - localT) + v1 * localT;
  }

  /**
   * Updates segments from UI control points (averages between neighbors).
   */
  updatePoints(points: { x: number; y: number }[]) {
    if (!points || points.length === 0) {
      this.segments = [];
      this.controlPoints = [];
      return;
    }
    const n = points.length;
    const segs: number[] = [];
    for (let i = 0; i < n - 1; i++) {
      const a = points[i]?.y ?? 0;
      const b = points[i + 1]?.y ?? a;
      segs.push((a + b) / 2);
    }
    this.segments = segs;
    this.rebuildControlPoints();
  }

  /**
   * Rebuilds controlPoints array (compatible with MotionParameterMap graphs).
   */
  private rebuildControlPoints() {
    this.controlPoints = this.pathPoints.map((_, i) => {
      const segVal = this.segments[Math.max(0, i - 1)] ?? 0;
      return { x: i / Math.max(1, this.pathPoints.length - 1), y: segVal };
    });
  }
}
