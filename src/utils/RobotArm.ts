// src/utils/RobotArm.ts

export interface Point {
  x: number;
  y: number;
}

export class RobotArm {
  base: Point;
  limbLengths: [number, number];
  angles: [number, number];

  constructor(base: Point, limbLengths: [number, number]) {
    this.base = base;
    this.limbLengths = limbLengths;
    this.angles = [0, 0];
  }

  // Simple 2-joint IK solver for target point
  solveIK(target: Point): [number, number] {
    const dx = target.x - this.base.x;
    const dy = target.y - this.base.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const [l1, l2] = this.limbLengths;

    // Clamp distance
    const d = Math.min(dist, l1 + l2);
    const angleToTarget = Math.atan2(dy, dx);

    // law of cosines
    const cosA = (l1 * l1 + d * d - l2 * l2) / (2 * l1 * d);
    const angleA = Math.acos(Math.max(-1, Math.min(1, cosA)));
    const theta1 = angleToTarget - angleA; // bend upward
    const cosB = (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2);
    const theta2 = Math.PI - Math.acos(Math.max(-1, Math.min(1, cosB)));
    // const a = Math.acos(Math.min(1, Math.max(-1, (l1*l1 + d*d - l2*l2) / (2*l1*d))));
    // const b = Math.atan2(dy, dx);
    // const theta1 = b - a;

    // const c = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2))));
    // const theta2 = Math.PI - c;

    this.angles = [theta1, theta2];
    return this.angles;
  }
}
