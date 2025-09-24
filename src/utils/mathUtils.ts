// src/utils/mathUtils.ts

/** Clamp a value to [min, max] */
export function clamp(v: number, min = -Infinity, max = Infinity) {
  return Math.max(min, Math.min(max, v));
}

/** Linear interpolation between a and b */
export function lerp(a: number, b: number, t: number) {
  return a * (1 - t) + b * t;
}

/** Simple finite difference derivative */
export function derivative(xs: number[], ys: number[]) {
  const n = xs.length;
  const ds: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (i === 0) ds[i] = (ys[1] - ys[0]) / Math.max(1e-6, xs[1] - xs[0]);
    else if (i === n - 1) ds[i] = (ys[n - 1] - ys[n - 2]) / Math.max(1e-6, xs[n - 1] - xs[n - 2]);
    else ds[i] = (ys[i + 1] - ys[i - 1]) / Math.max(1e-6, xs[i + 1] - xs[i - 1]);
  }
  return ds;
}
