//types/perlin.ts
let permutation = [...Array(256).keys()];
for (let i = permutation.length - 1; i > 0; i--) {
  const j = Math.floor(Math.random() * (i + 1));
  [permutation[i], permutation[j]] = [permutation[j], permutation[i]];
}
permutation = permutation.concat(permutation); // Extend

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

function grad(hash: number, x: number): number {
  return (hash & 1 ? -1 : 1) * x;
}

export function perlin1D(x: number): number {
  const xi = Math.floor(x) & 255;
  const xf = x - Math.floor(x);
  const u = fade(xf);

  const a = permutation[xi];
  const b = permutation[xi + 1];

  return lerp(grad(a, xf), grad(b, xf - 1), u);
}
