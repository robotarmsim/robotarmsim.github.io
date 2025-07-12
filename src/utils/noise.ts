// utils/noise.ts

/**
 * Simple 1D Perlin-like noise generator using cosine interpolation.
 * This version uses a seeded hash for repeatability.
 */

export function makePerlin1D(seed = Math.random()) {
  const gradSize = 256;
  const gradients = new Float32Array(gradSize);
  const perm = new Uint8Array(gradSize);

  // Fill with pseudo-random gradient values
  for (let i = 0; i < gradSize; i++) {
    gradients[i] = Math.random() * 2 - 1;
    perm[i] = i;
  }

  // Shuffle perm array for randomness
  for (let i = gradSize - 1; i > 0; i--) {
    const j = Math.floor(seed * (i + 1)) % gradSize;
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }

  function fade(t: number): number {
    // 6t^5 - 15t^4 + 10t^3
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  function lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  function noise1D(x: number): number {
    const xi = Math.floor(x) % gradSize;
    const xf = x - Math.floor(x);
    const g0 = gradients[perm[xi % gradSize]];
    const g1 = gradients[perm[(xi + 1) % gradSize]];
    const t = fade(xf);
    return lerp(g0 * xf, g1 * (xf - 1), t);
  }

  return noise1D;
}
