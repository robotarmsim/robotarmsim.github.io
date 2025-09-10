// src/utils/PathParameterMap.ts
import type { Point } from "./RobotArm";

/** clamp helper */
function clamp(v: number, a = -Infinity, b = Infinity) {
  return Math.max(a, Math.min(b, v));
}

/**
 * ParamCurve
 * - small, local curve class used by PathParameterMap
 * - stores normalized control points and provides evaluate/update/get operations
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
    if (this.controlPoints.length === 0) return 0;
    x = clamp(x, 0, 1);
    for (let i = 0; i < this.controlPoints.length - 1; i++) {
      const p1 = this.controlPoints[i];
      const p2 = this.controlPoints[i + 1];
      if (x >= p1.x && x <= p2.x) {
        const t = (x - p1.x) / (p2.x - p1.x);
        return p1.y * (1 - t) + p2.y * t;
      }
    }
    return this.controlPoints[this.controlPoints.length - 1].y;
  }

  get points() {
    return this.controlPoints;
  }
}

/**
 * PathParameterMap
 *
 * - owns the path geometry (pathPoints)
 * - exposes three ParamCurves: directness, smoothness, tempo
 * - exposes typed helpers to update/read each curve's control points
 */
export default class PathParameterMap {
  private pathPoints: Point[];
  private _directness: ParamCurve;
  private _smoothness: ParamCurve;
  private _tempo: ParamCurve;

  constructor(pathPoints: Point[]) {
    this.pathPoints = [...pathPoints];
    this._directness = new ParamCurve();
    this._smoothness = new ParamCurve();
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
  evaluateSmoothness(s: number) {
    return this._smoothness.evaluate(s);
  }
  evaluateTempo(s: number) {
    return this._tempo.evaluate(s);
  }

  // --- control point setters/getters for each parameter curve ---
  // these are intentionally small wrappers so consumers don't need to know ParamCurve internals
  setDirectnessPoints(points: { x: number; y: number }[]) {
    this._directness.updatePoints(points ?? []);
  }
  getDirectnessPoints() {
    return this._directness.points;
  }

  setSmoothnessPoints(points: { x: number; y: number }[]) {
    this._smoothness.updatePoints(points ?? []);
  }
  getSmoothnessPoints() {
    return this._smoothness.points;
  }

  setTempoPoints(points: { x: number; y: number }[]) {
    this._tempo.updatePoints(points ?? []);
  }
  getTempoPoints() {
    return this._tempo.points;
  }
}
