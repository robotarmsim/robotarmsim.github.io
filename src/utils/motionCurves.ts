// src/utils/motionCurves.ts
import { clamp, lerp } from "./mathUtils";

/** Tempo warp: map s ∈ [0,1] + intensity ∈ [-1,1] to warped s */
export function applyTempoWarp(s: number, intensity: number): number {
  if (intensity === 0) return s;
  const amp = 2.5;
  const i = clamp(intensity, -1, 1);
  return i > 0 ? Math.pow(s, 1 + i * amp) : 1 - Math.pow(1 - s, 1 + Math.abs(i) * amp);
}

/** Map derivative of warped s -> speed fraction in [0,1] */
export function speedFractionFromDerivative(du_ds: number[], minSpeed = 6, maxSpeed = 220) {
  let minD = Math.min(...du_ds);
  let maxD = Math.max(...du_ds);
  if (Math.abs(maxD - minD) < 1e-9) return du_ds.map(() => 0.5);
  return du_ds.map(f => clamp((f - minD) / (maxD - minD), 0, 1));
}

/** Curvature based on directness curve */
export function curvatureFromDirectness(intensity: number, scale = 1) {
  return clamp(intensity, -1, 1) * scale;
}
