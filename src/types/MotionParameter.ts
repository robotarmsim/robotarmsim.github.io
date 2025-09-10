// src/types/MotionParameter.ts
// export interface IMotionParameterMap {
//   evaluate(s: number): number;
//   controlPoints: { x: number; y: number }[];
//   updatePoints(points: { x: number; y: number }[]): void;
// }

import type { MotionParameterMap } from "../utils/MotionParameterMap";

// A read-only shape (optional)
export type IMotionParameterMap = Pick<
  MotionParameterMap,
  "evaluate" | "controlPoints" | "updatePoints"
>;