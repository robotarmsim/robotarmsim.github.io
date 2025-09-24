// src/utils/PathParameterMap.ts
// PathParameterMap (patched)
// Notes:
// - Baseline is 0 (neutral), range is -1..1
// - If no points are defined, curve evaluates to 0
// - Directness: -1 = concave, 0 = straight baseline, 1 = convex
// - Tempo: -1 = deceleration, 0 = constant, 1 = acceleration

import type { Point } from "./RobotArm";

/** clamp helper (internal) */
function clamp(v: number, a = -Infinity, b = Infinity) {
  return Math.max(a, Math.min(b, v));
}

/**
 * ParamCurve
 * - stores normalized control points (x ∈ [0,1], y ∈ [-1,1])
 * - evaluates linearly between points
 */
class ParamCurve {
  private controlPoints: { x: number; y: number }[] = [];

  constructor(points?: { x: number; y: number }[]) {
    if (points) this.controlPoints = [...points];
  }

  updatePoints(points: { x: number; y: number }[]) {
    this.controlPoints = [...points];
  }

  evaluate(x: number): number {
    if (this.controlPoints.length === 0) {
      // Neutral baseline when no points are set
      return 0;
    }

    x = clamp(x, 0, 1);

    // If x is before the first point
    if (x <= this.controlPoints[0].x) {
      return this.controlPoints[0].y;
    }
    // If x is after the last point
    if (x >= this.controlPoints[this.controlPoints.length - 1].x) {
      return this.controlPoints[this.controlPoints.length - 1].y;
    }

    // Otherwise interpolate between the two surrounding points
    for (let i = 0; i < this.controlPoints.length - 1; i++) {
      const p1 = this.controlPoints[i];
      const p2 = this.controlPoints[i + 1];
      if (x >= p1.x && x <= p2.x) {
        const t = (x - p1.x) / (p2.x - p1.x);
        return p1.y * (1 - t) + p2.y * t;
      }
    }

    // Fallback: last point value
    return this.controlPoints[this.controlPoints.length - 1].y;
  }

  get points() {
    return this.controlPoints;
  }
}

/**
 * PathParameterMap
 * - owns the path geometry (pathPoints)
 * - exposes two ParamCurves: directness, tempo
 */
export default class PathParameterMap {
  private pathPoints: Point[];
  private _directness: ParamCurve;
  private _tempo: ParamCurve;

  constructor(pathPoints: Point[]) {
    this.pathPoints = [...pathPoints];
    this._directness = new ParamCurve();
    this._tempo = new ParamCurve();
  }

  // --- path management ---
  updatePath(points: Point[]) {
    this.pathPoints = [...points];
  }

  get path() {
    return this.pathPoints;
  }

  // --- evaluate helpers (preferred for consumers) ---
  evaluateDirectness(s: number) {
    return this._directness.evaluate(s);
  }
  evaluateTempo(s: number) {
    return this._tempo.evaluate(s);
  }

  // --- control point setters/getters for each parameter curve ---
  setDirectnessPoints(points: { x: number; y: number }[]) {
    this._directness.updatePoints(points ?? []);
  }
  getDirectnessPoints() {
    return this._directness.points;
  }

  setTempoPoints(points: { x: number; y: number }[]) {
    this._tempo.updatePoints(points ?? []);
  }
  getTempoPoints() {
    return this._tempo.points;
  }
}
