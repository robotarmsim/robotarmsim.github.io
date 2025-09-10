// src/utils/MotionParameterMap.ts
import type { Point } from './RobotArm';

function clamp(v: number, a = -Infinity, b = Infinity) {
  return Math.max(a, Math.min(b, v));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export class MotionParameterMap {
  // internal storage — keep private to avoid accidental external mutation
  private _controlPoints: Point[];
  public baseline: number; // baseline in same units as y (default 0.5)

  constructor(points: Point[] = [], opts?: { baseline?: number }) {
    // shallow copy for safety
    this._controlPoints = points.map(p => ({ x: p.x, y: p.y }));
    this.baseline = clamp(opts?.baseline ?? 0.5, 0, 1);
    this.sortControlPoints();
  }

  // Public readonly view of control points.
  // A getter is a property at the JS level, so it satisfies the interface expecting `controlPoints`.
  public get controlPoints(): Point[] {
    // return copies so callers cannot mutate internal array by accident
    return this._controlPoints.map(p => ({ x: p.x, y: p.y }));
  }

  /** Replace all control points (caller-provided array is copied) */
  updatePoints(points: Point[]) {
    this._controlPoints = (points || []).map(p => ({ x: p.x, y: p.y }));
    this.sortControlPoints();
  }

  /** Convenience: set baseline */
  setBaseline(b: number) {
    this.baseline = clamp(b, 0, 1);
  }

  /** Reset */
  clear() {
    this._controlPoints = [];
  }

  /** Add a point (keeps list sorted) */
  addPoint(p: Point) {
    this._controlPoints.push({ x: p.x, y: p.y });
    this.sortControlPoints();
  }

  // --- legacy-compatible: evaluate y at x (linear interpolation between control points) ---
  evaluate(x: number): number {
    if (!this._controlPoints || this._controlPoints.length === 0) {
      return this.baseline;
    }
    x = clamp(x, 0, 1);

    const pts = this._controlPoints;
    if (x <= pts[0].x) return pts[0].y;
    if (x >= pts[pts.length - 1].x) return pts[pts.length - 1].y;

    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i];
      const p2 = pts[i + 1];
      if (x >= p1.x && x <= p2.x) {
        const t = (x - p1.x) / (p2.x - p1.x || 1);
        return p1.y * (1 - t) + p2.y * t;
      }
    }

    return pts[pts.length - 1].y;
  }

  // alias
  sampleY(x: number) {
    return this.evaluate(x);
  }

  // Returns signed normalized value relative to baseline in [-1, 1]
  signedNormalizedAt(x: number): number {
    const y = this.sampleY(x);
    const denom = Math.max(this.baseline, 1 - this.baseline, 1e-6);
    const signed = (y - this.baseline) / denom;
    return clamp(signed, -1, 1);
  }

  // map signed [-1..1] into [minValue,maxValue]
  mapSignedToRange(signed: number, minValue: number, maxValue: number) {
    const alpha = (clamp(signed, -1, 1) + 1) / 2;
    return lerp(minValue, maxValue, alpha);
  }

  // convenience: sample x and map through baseline normalization into [minValue, maxValue]
  getValueAt(x: number, minValue = 0, maxValue = 1) {
    const s = this.signedNormalizedAt(x);
    return this.mapSignedToRange(s, minValue, maxValue);
  }

  private sortControlPoints() {
    this._controlPoints.sort((a, b) => a.x - b.x);
  }
}

export default MotionParameterMap;
