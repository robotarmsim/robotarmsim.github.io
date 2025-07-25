// src/data/defaults.ts
// limbs, timings, etc.

export const DEFAULT_LIMB_LENGTHS: [number, number] = [200, 150];
export const DEFAULT_MAX_POINTS = 5;
export const DEFAULT_TOTAL_DURATION = 5; // in seconds

export const DEFAULT_ZONE_RADIUS = 40;
export const DEFAULT_ZONE_TYPE = 'avoid';

export const DEFAULT_CURVATURE_GRAPH = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
];

export const DEFAULT_NOISE_GRAPH = [
  { x: 0, y: 0 },
  { x: 1, y: 0 },
];

export const DEFAULT_SPEED_GRAPH = [
  { x: 0, y: 1 },
  { x: 1, y: 1 },
];