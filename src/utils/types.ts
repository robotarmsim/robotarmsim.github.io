// src/utils/types.ts
// Central shared lightweight types used across the motion system.

/**
 * A structural interface for parameter maps.
 * Any map that exposes evaluate(s:number):number is compatible.
 */
export interface ParamMapLike {
  evaluate: (s: number) => number;
  // optional legacy members some maps expose (kept permissive for compatibility)
  controlPoints?: any;
  updatePoints?: (pts: any) => void;
}
