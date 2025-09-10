// src/utils/trajectory.ts
// Pure geometry and trajectory utilities:
//  - preprocessChamfers: replace interior vertices with trimmed points for real fillets/chamfers
//  - splineSampler: sample bezierSpline and return both samples and normalized arc positions (sSamples)
//  - computeVelocityProfile: compute uWarp, du/ds, speed fractions, velocity limits, and time array

import type { Point } from './RobotArm';
import type { ParamMapLike } from './types';
import { bezierSpline } from './Bezier'; // used internally by splineSampler

// small helpers
const EPS = 1e-9;
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * Tempo warp helper used by computeVelocityProfile.
 * Kept local to the trajectory module so computeVelocityProfile is pure.
 */
function applyTempoWarp(t: number, intensity: number): number {
  if (intensity === 0) return t;
  const amp = 2.5;
  const i = Math.max(-1, Math.min(1, intensity));
  if (i > 0) {
    return Math.pow(t, 1 + i * amp);
  } else {
    return 1 - Math.pow(1 - t, 1 + Math.abs(i) * amp);
  }
}

/**
 * Preprocess chamfers (Phase 1 corner rounding)
 *
 * For each interior vertex Pi, we compute trimmed points Pi- and Pi+ along incoming and outgoing
 * segments. The trimming distance r is a function of the local smoothness (smoothMap.evaluate(s))
 * and local directness (directMap.evaluate(s)). The trimming is clamped so we don't exceed segment halves.
 *
 * Returns a new array of points containing first point, then for every interior vertex Pi:
 *   P_{i-} (trimmed back along incoming), P_{i+} (trimmed forward along outgoing)
 * and final point. This gives two points per original interior vertex.
 */
export function preprocessChamfers(
  pathPoints: Point[],
  smoothMap: ParamMapLike,
  directMap: ParamMapLike,
  opts?: {
    rBaseFraction?: number;
    smoothnessScale?: number;
    maxFraction?: number;
  }
): Point[] {
  const { rBaseFraction = 0.06, smoothnessScale = 0.8, maxFraction = 0.45 } = opts || {};

  const n = pathPoints.length;
  if (n <= 2) return pathPoints.slice();

  // compute cumulative distances along pathPoints
  const dists: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const dx = pathPoints[i].x - pathPoints[i - 1].x;
    const dy = pathPoints[i].y - pathPoints[i - 1].y;
    dists[i] = dists[i - 1] + Math.hypot(dx, dy);
  }
  const totalLen = dists[n - 1] || 1e-6;
  const sAtVertex = dists.map(d => (totalLen <= 0 ? 0 : d / totalLen));

  const out: Point[] = [];
  out.push({ x: pathPoints[0].x, y: pathPoints[0].y });

  for (let i = 1; i < n - 1; i++) {
    const Pprev = pathPoints[i - 1];
    const Pi = pathPoints[i];
    const Pnext = pathPoints[i + 1];

    const vIn = { x: Pi.x - Pprev.x, y: Pi.y - Pprev.y };
    const vOut = { x: Pnext.x - Pi.x, y: Pnext.y - Pi.y };

    const lenIn = Math.hypot(vIn.x, vIn.y) || EPS;
    const lenOut = Math.hypot(vOut.x, vOut.y) || EPS;

    const dirIn = { x: vIn.x / lenIn, y: vIn.y / lenIn };
    const dirOut = { x: vOut.x / lenOut, y: vOut.y / lenOut };

    // local s for maps (normalized along whole polyline)
    const sLocal = sAtVertex[i];

    // Evaluate maps
    const smoothness = (smoothMap && typeof smoothMap.evaluate === 'function') ? smoothMap.evaluate(sLocal) : 0;
    const directness = (directMap && typeof directMap.evaluate === 'function') ? directMap.evaluate(sLocal) : 0;

    // baseline trimming proportion (fraction of adjacent segment length)
    const smoothFactor = 1 + Math.max(0, smoothness) * smoothnessScale;
    const directFactor = 1 + Math.abs(directness) * 0.3; // slight influence

    const rIn = Math.min(lenIn * Math.min(maxFraction, rBaseFraction * smoothFactor * directFactor), lenIn * 0.5 - EPS);
    const rOut = Math.min(lenOut * Math.min(maxFraction, rBaseFraction * smoothFactor * directFactor), lenOut * 0.5 - EPS);

    const Pminus = { x: Pi.x - dirIn.x * rIn, y: Pi.y - dirIn.y * rIn };
    const Pplus = { x: Pi.x + dirOut.x * rOut, y: Pi.y + dirOut.y * rOut };

    out.push(Pminus);
    out.push(Pplus);
  }

  out.push({ x: pathPoints[n - 1].x, y: pathPoints[n - 1].y });
  return out;
}

/**
 * splineSampler
 *
 * Calls bezierSpline(pathPoints, samplePerSegment, curvatureFn) and returns:
 *  - samples: the sampled points (Point[])
 *  - sSamples: normalized arc-length positions (0..1) for each sample
 */
export function splineSampler(
  pathPoints: Point[],
  samplePerSegment: number,
  curvatureFn: (s: number) => number
): { samples: Point[]; sSamples: number[] } {
  const raw = bezierSpline(pathPoints, samplePerSegment, curvatureFn) || [];
  if (!raw || raw.length === 0) return { samples: [], sSamples: [] };

  // compute arc distances
  const n = raw.length;
  const dists: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const dx = raw[i].x - raw[i - 1].x;
    const dy = raw[i].y - raw[i - 1].y;
    dists[i] = Math.hypot(dx, dy);
  }
  const cum: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + dists[i];
  const total = cum[n - 1] || EPS;
  const sSamples = cum.map(c => (total <= 0 ? 0 : c / total));
  return { samples: raw, sSamples };
}

/**
 * computeVelocityProfile
 *
 * Given sampled points and their normalized arc positions, plus tempo and smoothness maps
 * and motion constraints, compute:
 *  - speedFrac: normalized [0..1] fraction derived from du/ds
 *  - velocities: desired velocities (units of whatever min/max speed use)
 *  - times: time for each sample point (scaled to totalDuration if provided)
 */
export function computeVelocityProfile(
  samples: Point[],
  sSamples: number[],
  tempoMap: ParamMapLike,
  smoothnessMap: ParamMapLike,
  minSpeed: number,
  maxSpeed: number,
  accelBase: number,
  accelMin: number,
  totalDuration?: number
): { speedFrac: number[]; velocities: number[]; times: number[] } {
  const n = samples.length;
  if (n === 0) return { speedFrac: [], velocities: [], times: [] };

  // compute uWarp from tempoMap
  const uWarp: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const intensity = tempoMap.evaluate(sSamples[i]);
    uWarp[i] = applyTempoWarp(sSamples[i], intensity);
  }

  // du/ds via finite differences
  const du_ds: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      const ds = Math.max(EPS, sSamples[i + 1] - sSamples[i]);
      du_ds[i] = (uWarp[i + 1] - uWarp[i]) / ds;
    } else if (i === n - 1) {
      const ds = Math.max(EPS, sSamples[i] - sSamples[i - 1]);
      du_ds[i] = (uWarp[i] - uWarp[i - 1]) / ds;
    } else {
      const ds = Math.max(EPS, sSamples[i + 1] - sSamples[i - 1]);
      du_ds[i] = (uWarp[i + 1] - uWarp[i - 1]) / ds;
    }
    if (!Number.isFinite(du_ds[i])) du_ds[i] = 0;
  }

  // map derivative to 0..1 speed fraction
  let minD = Number.POSITIVE_INFINITY;
  let maxD = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < n; i++) {
    if (du_ds[i] < minD) minD = du_ds[i];
    if (du_ds[i] > maxD) maxD = du_ds[i];
  }
  if (!Number.isFinite(minD)) minD = 0;
  if (!Number.isFinite(maxD)) maxD = 0;

  const speedFrac: number[] = new Array(n);
  if (Math.abs(maxD - minD) < 1e-9) {
    for (let i = 0; i < n; i++) speedFrac[i] = 0.5;
  } else {
    for (let i = 0; i < n; i++) {
      speedFrac[i] = (du_ds[i] - minD) / (maxD - minD);
      speedFrac[i] = clamp01(speedFrac[i]);
    }
  }

  // compute distances between samples
  const dists: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const dx = samples[i].x - samples[i - 1].x;
    const dy = samples[i].y - samples[i - 1].y;
    dists[i] = Math.hypot(dx, dy);
  }

  // desired velocities from speedFrac
  const vDesired = speedFrac.map(f => minSpeed + f * (maxSpeed - minSpeed));

  // accel limit per sample based on smoothness map
  const accelLimit: number[] = new Array(n).fill(accelBase);
  for (let i = 0; i < n; i++) {
    const s = sSamples[i];
    const sIntensity = smoothnessMap.evaluate(s);
    const factor = Math.abs(sIntensity);
    accelLimit[i] = accelMin + (accelBase - accelMin) * (1 - factor);
    accelLimit[i] = Math.max(accelMin, Math.min(accelBase, accelLimit[i]));
  }

  // forward pass to respect acceleration
  const vForward = new Array(n).fill(0);
  vForward[0] = Math.min(vDesired[0], maxSpeed);
  for (let i = 0; i < n - 1; i++) {
    const ds = Math.max(EPS, dists[i + 1]);
    const a = accelLimit[i];
    const reachable = Math.sqrt(Math.max(0, vForward[i] * vForward[i] + 2 * a * ds));
    vForward[i + 1] = Math.min(vDesired[i + 1], reachable);
  }

  // backward pass
  const v = vForward.slice();
  v[n - 1] = Math.min(v[n - 1], vDesired[n - 1]);
  for (let i = n - 2; i >= 0; i--) {
    const ds = Math.max(EPS, dists[i + 1]);
    const a = accelLimit[i];
    const reachableBack = Math.sqrt(Math.max(0, v[i + 1] * v[i + 1] + 2 * a * ds));
    v[i] = Math.min(v[i], reachableBack);
  }

  // times from trapezoidal integration
  const times: number[] = new Array(n).fill(0);
  let cumulative = 0;
  times[0] = 0;
  for (let i = 0; i < n - 1; i++) {
    const ds = Math.max(EPS, dists[i + 1]);
    const vi = Math.max(EPS, v[i]);
    const vj = Math.max(EPS, v[i + 1]);
    const dt = ds / ((vi + vj) / 2);
    cumulative += dt;
    times[i + 1] = cumulative;
  }

  let intrinsicDuration = times[n - 1] || EPS;
  if (intrinsicDuration <= 0) intrinsicDuration = EPS;
  const scale = (totalDuration && totalDuration > 0) ? (totalDuration / intrinsicDuration) : 1;
  const scaledTimes = times.map(t => t * scale);
  const scaledVelocities = v.map(val => val / scale);

  return { speedFrac, velocities: scaledVelocities, times: scaledTimes };
}
