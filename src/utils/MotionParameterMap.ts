// src/utils/MotionParameterMap.ts
import type { Point } from './RobotArm';

export class MotionParameterMap {
  private controlPoints: Point[];

  constructor(points: Point[]) {
    this.controlPoints = [...points];
  }

  updatePoints(points: Point[]) {
    this.controlPoints = [...points];
  }

  evaluate(x: number): number {
    if (this.controlPoints.length === 0) return 0;

    x = Math.max(0, Math.min(1, x));

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
}
