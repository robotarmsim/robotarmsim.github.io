// src/types/ParamMapLike.ts
/**
 * Structural interface: anything that can evaluate a value along normalized arc s ∈ [0,1].
 * This avoids "private field" nominal typing issues and makes the engine flexible.
 */
export interface ParamMapLike {
  evaluate: (s: number) => number; // expected range -1..1, but the engine will clamp as needed
}
