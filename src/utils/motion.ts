// utils/motion.ts

import { buildSpline, sampleSplineAtArcLength } from './spline';
import { makePerlin1D } from './noise';

export interface Point {
  x: number;
  y: number;
}

export interface MotionExport {
  checkpoints: Point[];
  totalTimeSec: number;
  curvatureValues: number[];
  velocityValues: number[];
  noiseValues: number[];
}

export class MotionPlanner {
  private base: Point;
  private ikSolver: (dx: number, dy: number) => [number, number][];
  private limbLengths: number[];
  private maxReach: number;

  private checkpoints: Point[] = [];
  private curvatureValues: number[] = [];
  private velocityValues: number[] = [];
  private noiseValues: number[] = [];

  private perlinX = makePerlin1D();
  private perlinY = makePerlin1D();

  constructor(base: Point, ikSolver: (dx: number, dy: number) => [number, number][], limbLengths: number[] = []) {
    this.base = base;
    this.ikSolver = ikSolver;
    this.limbLengths = limbLengths;
    this.maxReach = limbLengths.reduce((sum, len) => sum + len, 0);
  }

  getCheckpoints(): Point[] {
    return this.checkpoints;
  }

  getMaxReach(): number {
    return this.maxReach;
  }

tryAddCheckpoint(pt: Point, maxPts: number): boolean {
  const last = this.checkpoints[this.checkpoints.length - 1];
  if (last && last.x === pt.x && last.y === pt.y) return false; // Prevent duplicate
  if (this.checkpoints.length < maxPts) {
    this.checkpoints.push(pt);
    return true;
  }
  return false;
}

  findHoveredSegment(mx: number, my: number): number {
    const threshold = 5;
    for (let i = 0; i < this.checkpoints.length - 1; i++) {
      const A = this.checkpoints[i];
      const B = this.checkpoints[i + 1];
      const vx = B.x - A.x;
      const vy = B.y - A.y;
      const wx = mx - A.x;
      const wy = my - A.y;
      const len2 = vx * vx + vy * vy;
      if (len2 === 0) continue;
      let t = (wx * vx + wy * vy) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = A.x + t * vx;
      const py = A.y + t * vy;
      const dist = Math.hypot(mx - px, my - py);
      if (dist <= threshold) return i;
    }
    return -1;
  }

  initializeSegments(): void {
    const n = this.checkpoints.length - 1;
    this.curvatureValues = Array(n).fill(0.5);
    this.velocityValues = Array(n).fill(1.0);
    this.noiseValues = Array(n).fill(0.0);
  }

  clear(): void {
    this.checkpoints = [];
    this.curvatureValues = [];
    this.velocityValues = [];
    this.noiseValues = [];
  }

  exportData(totalTimeSec: number): MotionExport {
    return {
      checkpoints: this.checkpoints,
      totalTimeSec,
      curvatureValues: this.curvatureValues,
      velocityValues: this.velocityValues,
      noiseValues: this.noiseValues,
    };
  }

  async animate(
    totalDuration: number,
    onStep: (angles: [number, number]) => void
  ): Promise<void> {
    const checkpoints = this.checkpoints;
    const n = checkpoints.length - 1;
    if (n <= 0) return;

    const lengths: number[] = [];
    let totalLen = 0;
    for (let i = 0; i < n; i++) {
      const dx = checkpoints[i + 1].x - checkpoints[i].x;
      const dy = checkpoints[i + 1].y - checkpoints[i].y;
      const len = Math.hypot(dx, dy);
      lengths.push(len);
      totalLen += len;
    }

    const tSegments = this.velocityValues.map((v, i) => {
      const base = totalDuration / n;
      return v > 0 ? base / v : base;
    });

    const splineData = buildSpline(checkpoints);
    let currentAngles: [number, number] = [0, 0];

    for (let i = 0; i < n; i++) {
      await new Promise<void>((resolve) => {
        const t0 = performance.now();
        const pStart = checkpoints[i];
        const pEnd = checkpoints[i + 1];
        const offsetLen = lengths.slice(0, i).reduce((a, b) => a + b, 0);
        const L_i = lengths[i];
        const duration = tSegments[i] * 1000;
        const curvature = this.curvatureValues[i];
        const noise = this.noiseValues[i];

        const step = (now: number) => {
          const elapsed = now - t0;
          const t = Math.min(elapsed / duration, 1);

          const linX = pStart.x + (pEnd.x - pStart.x) * t;
          const linY = pStart.y + (pEnd.y - pStart.y) * t;
          const arcLen = offsetLen + L_i * t;
          const { x: arcX, y: arcY } = sampleSplineAtArcLength(splineData, arcLen);

          let x = curvature * linX + (1 - curvature) * arcX;
          let y = curvature * linY + (1 - curvature) * arcY;

          if (noise > 0) {
            const amp = 6 * noise;
            const tNoise = now * 0.002;
            x += this.perlinX(tNoise + i * 100) * amp;
            y += this.perlinY(tNoise + i * 200) * amp;
          }

          const dx = x - this.base.x;
          const dy = y - this.base.y;
          const sols = this.ikSolver(dx, dy);
          const best = sols.reduce((b, s) => {
            const dB = Math.hypot(b[0] - currentAngles[0], b[1] - currentAngles[1]);
            const dS = Math.hypot(s[0] - currentAngles[0], s[1] - currentAngles[1]);
            return dS < dB ? s : b;
          }, sols[0]);

          currentAngles = best;
          onStep(currentAngles);

          if (t < 1) {
            requestAnimationFrame(step);
          } else {
            resolve();
          }
        };

        requestAnimationFrame(step);
      });
    }
  }
}
