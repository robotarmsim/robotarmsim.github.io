// src/utils/ik.ts

/**
 * Inverse Kinematics Solver for a 2-link planar robot arm.
 * Solves for joint angles given a target x,y offset from the base.
 */
export class IKSolver {
  L1: number;
  L2: number;

  constructor(limbLengths: [number, number]) {
    [this.L1, this.L2] = limbLengths;
  }

  /**
   * Compute possible IK solutions for given x,y offset.
   * @returns Array of [theta1, theta2] pairs in radians
   */
  solve(dx: number, dy: number): [number, number][] {
    const r2 = dx * dx + dy * dy;
    const cos2 = (r2 - this.L1 ** 2 - this.L2 ** 2) / (2 * this.L1 * this.L2);
    const clampedCos2 = Math.max(-1, Math.min(1, cos2));
    const theta2a = Math.acos(clampedCos2);
    const theta2b = -theta2a;

    return [theta2a, theta2b].map((theta2) => {
      const k1 = this.L1 + this.L2 * Math.cos(theta2);
      const k2 = this.L2 * Math.sin(theta2);
      const theta1 = Math.atan2(dy, dx) - Math.atan2(k2, k1);
      return [theta1, theta2];
    });
  }
}
