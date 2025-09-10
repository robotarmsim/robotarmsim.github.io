// src/utils/MotionEngine.ts
/**
 * MotionEngine
 * Samples the path (bezier spline) taking into account:

 *  - directness(s)  -> controls signed curvature magnitude (concave/convex)

 *  - smoothness(s)  -> positive -> smooth / negative -> angular

 *  - tempo(s)       -> local tempo warp -> velocity profile

 *

 * The engine expects maps of the shape { evaluate: (s:number) => number } where s in [0,1].

 *

 * Notes on fixes:

 * - We MUST use the warped parameter returned by applyDirectnessWarp(...) when evaluating

 *   curvature & smoothness (previous version called applyDirectnessWarp but ignored the result).

 * - Corner post-processing parameters (window size, sigma) are computed relative to the number

 *   of samples so smoothing behaves consistently across different path lengths and sample densities.

 */
import { RobotArm, type Point } from './RobotArm';
import { bezierSpline } from './Bezier';

export type MotionFrame = {
  t: number;
  position: Point;
  angles: [number, number];
  speedFraction: number;
  velocity: number;
  meta?: Record<string, any>;
};

type ParamMap = { evaluate: (s: number) => number };

export type MotionEngineOptions = {
  directnessMap: ParamMap;
  tempoMap: ParamMap;
  smoothnessMap: ParamMap;
  totalDuration?: number;
  segments?: number;
  minSpeed?: number;
  maxSpeed?: number;
  accelBase?: number;
  accelMin?: number;
  curvatureBaseScale?: number;
};

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

/**
 * NOTE: Semantics chosen here:
 *  - directness controls signed curvature magnitude along continuous curve sampling.
 *    (+ => concave one way, - => concave the opposite way)
 *  - smoothness *only* controls corner processing (rounding vs angular)
 *    i.e. it does not scale down continuous curvature.
 *
 * This matches your requirement:
 *  - Directness controls whether a smooth curved path exists (and direction & magnitude)
 *  - Smoothness only adjusts how corners are rounded (positive = smoother, negative = sharper)
 */

export default class MotionEngine {
  private arm: RobotArm;
  private directnessMap: ParamMap;
  private tempoMap: ParamMap;
  private smoothnessMap: ParamMap;

  private segments: number;
  private minSpeed: number;
  private maxSpeed: number;
  private totalDuration?: number;
  private accelBase: number;
  private accelMin: number;
  private curvatureBaseScale: number;

  private animationId: number | null = null;
  private frameCb: ((f: MotionFrame) => void) | null = null;

  private schedulePositions: Point[] = [];
  private scheduleTimes: number[] = [];
  private scheduleSpeedFraction: number[] = [];
  private scheduleVelocity: number[] = [];
  private playbackAngles: [number, number][] = [];

  constructor(arm: RobotArm, opts: MotionEngineOptions) {
    this.arm = arm;
    this.directnessMap = opts.directnessMap;
    this.tempoMap = opts.tempoMap;
    this.smoothnessMap = opts.smoothnessMap;
    this.segments = opts.segments ?? 20;
    this.minSpeed = opts.minSpeed ?? 6;
    this.maxSpeed = opts.maxSpeed ?? 220;
    this.totalDuration = opts.totalDuration;
    this.accelBase = opts.accelBase ?? 1200;
    this.accelMin = opts.accelMin ?? 40;
    this.curvatureBaseScale = opts.curvatureBaseScale ?? 1.0;
  }

  setOnFrame(cb: (f: MotionFrame) => void) {
    this.frameCb = cb;
  }

  updateMaps(maps: { directnessMap?: ParamMap; tempoMap?: ParamMap; smoothnessMap?: ParamMap }) {
    if (maps.directnessMap) this.directnessMap = maps.directnessMap;
    if (maps.tempoMap) this.tempoMap = maps.tempoMap;
    if (maps.smoothnessMap) this.smoothnessMap = maps.smoothnessMap;
  }

  setTotalDuration(seconds?: number) {
    if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0) {
      this.totalDuration = seconds;
    } else {
      this.totalDuration = undefined;
    }
  }

  stop() {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  destroy() {
    this.stop();
    this.frameCb = null;
  }

  /**
   * Use directness only to compute signed curvature magnitude for continuous sampling.
   *
   * We intentionally DO NOT incorporate 'smoothness' here; smoothing is applied
   * later in applyCornerProcessing (so smoothness only affects corners).
   */
  private sampleSpline(pathPoints: Point[], samplesPerSegment: number) {
    const curvatureFn = (segmentPos: number) => {
      // directness controls the sign & magnitude of curvature continuously
      const dIntensity = Math.max(-1, Math.min(1, this.directnessMap.evaluate(segmentPos) || 0));
      // simple linear mapping — tweak by raising to a power if you want non-linear response
      return dIntensity * this.curvatureBaseScale;
    };

    // bezierSpline(pathPoints, samplesPerSegment, curvatureFn) -> array of points
    return bezierSpline(pathPoints, samplesPerSegment, curvatureFn);
  }

  /**
   * Corner processing: smoothing (gaussian blur) when smoothness >= 0,
   * angular snap when smoothness < 0.  This function reads smoothnessMap
   * at vertex positions and uses that to determine the radius & strength.
   */
  private applyCornerProcessing(samples: Point[], pathPoints: Point[], sSamples: number[]) {
    const nSamples = samples.length;
    if (nSamples === 0) return samples.slice();

    // compute original vertex normalized positions along polyline
    const origDists: number[] = new Array(pathPoints.length).fill(0);
    for (let i = 1; i < pathPoints.length; i++) {
      const dx = pathPoints[i].x - pathPoints[i - 1].x;
      const dy = pathPoints[i].y - pathPoints[i - 1].y;
      origDists[i] = origDists[i - 1] + Math.hypot(dx, dy);
    }
    const origTotal = origDists[origDists.length - 1] || 1e-6;
    const origS = origDists.map(d => d / origTotal);

    const out = samples.map(p => ({ x: p.x, y: p.y }));
    const lerp = (a: Point, b: Point, t: number) => ({ x: a.x * (1 - t) + b.x * t, y: a.y * (1 - t) + b.y * t });

    // tuning knobs scaled by sample density
    const maxWindowSamples = Math.max(2, Math.round(this.segments * 0.6));
    const blurSigmaBase = Math.max(0.5, this.segments * 0.12);

    for (let pi = 1; pi < pathPoints.length - 1; pi++) {
      const sVertex = origS[pi];

      // find center sample index nearest this vertex
      let centerIdx = 0;
      let bestD = Infinity;
      for (let si = 0; si < sSamples.length; si++) {
        const d = Math.abs(sSamples[si] - sVertex);
        if (d < bestD) {
          bestD = d;
          centerIdx = si;
        }
      }

      const sIntensity = this.smoothnessMap.evaluate(sVertex); // -1..1
      const windowSamples = Math.max(1, Math.round(1 + Math.abs(sIntensity) * maxWindowSamples));
      const left = Math.max(0, centerIdx - windowSamples);
      const right = Math.min(nSamples - 1, centerIdx + windowSamples);

      if (sIntensity >= 0) {
        // smoothing: gaussian blur across the window (positive smoothness -> stronger blur)
        const sigma = Math.max(0.6, blurSigmaBase * sIntensity);
        const weights: number[] = [];
        let wsum = 0;
        for (let j = left; j <= right; j++) {
          const didx = j - centerIdx;
          const w = Math.exp(-0.5 * (didx * didx) / (sigma * sigma));
          weights.push(w);
          wsum += w;
        }
        for (let j = left; j <= right; j++) {
          let wxSum = 0;
          let wySum = 0;
          let k = 0;
          for (let m = left; m <= right; m++) {
            const w = weights[k++];
            wxSum += out[m].x * w;
            wySum += out[m].y * w;
          }
          out[j].x = wxSum / wsum;
          out[j].y = wySum / wsum;
        }
      } else {
        // angular: snap neighborhood to two straight pieces meeting at original vertex
        const prevP = pathPoints[pi - 1];
        const midP = pathPoints[pi];
        const nextP = pathPoints[pi + 1];
        const leftLen = Math.max(1, centerIdx - left);
        for (let j = left; j <= centerIdx; j++) {
          const t = (j - left) / leftLen;
          out[j] = lerp(prevP, midP, t);
        }
        const rightLen = Math.max(1, right - centerIdx);
        for (let j = centerIdx; j <= right; j++) {
          const t = (j - centerIdx) / rightLen;
          out[j] = lerp(midP, nextP, t);
        }
      }
    }

    return out;
  }

  private buildSchedule(pathPoints: Point[]) {
    // defensive clears
    if (!pathPoints || pathPoints.length === 0) {
      this.schedulePositions = [];
      this.scheduleTimes = [];
      this.scheduleSpeedFraction = [];
      this.scheduleVelocity = [];
      return;
    }

    // sample the spline: uses only directness for continuous curvature now
    const rawSamples = this.sampleSpline(pathPoints, this.segments);
    const nRaw = rawSamples.length;
    if (nRaw === 0) {
      this.schedulePositions = [];
      this.scheduleTimes = [];
      this.scheduleSpeedFraction = [];
      this.scheduleVelocity = [];
      return;
    }

    // compute normalized arc positions sSamples
    const distsSamples: number[] = new Array(nRaw).fill(0);
    for (let i = 1; i < nRaw; i++) {
      distsSamples[i] = Math.hypot(rawSamples[i].x - rawSamples[i - 1].x, rawSamples[i].y - rawSamples[i - 1].y);
    }
    const cumSamples: number[] = new Array(nRaw).fill(0);
    for (let i = 1; i < nRaw; i++) cumSamples[i] = cumSamples[i - 1] + distsSamples[i];
    const totalSamplesLen = cumSamples[nRaw - 1] || 0.0001;
    const sSamples = cumSamples.map(d => d / totalSamplesLen);

    // post-process corners using smoothnessMap only
    const samples = this.applyCornerProcessing(rawSamples, pathPoints, sSamples);
    const n = samples.length;
    if (n === 0) {
      this.schedulePositions = [];
      this.scheduleTimes = [];
      this.scheduleSpeedFraction = [];
      this.scheduleVelocity = [];
      return;
    }

    // compute arc distances and normalized s
    const dists: number[] = new Array(n).fill(0);
    for (let i = 1; i < n; i++) {
      dists[i] = Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
    }
    const cumDist: number[] = new Array(n).fill(0);
    for (let i = 1; i < n; i++) cumDist[i] = cumDist[i - 1] + dists[i];
    const totalLength = cumDist[n - 1] || 0.0001;
    const sNorm: number[] = new Array(n);
    for (let i = 0; i < n; i++) sNorm[i] = totalLength === 0 ? 0 : cumDist[i] / totalLength;

    // tempo warp u(s)
    const uWarp: number[] = new Array(n);
    for (let i = 0; i < n; i++) {
      const intensity = this.tempoMap.evaluate(sNorm[i]);
      // tempo warp function — simple paramization; keep as before
      const amp = 2.5;
      const iVal = Math.max(-1, Math.min(1, intensity));
      if (iVal === 0) uWarp[i] = sNorm[i];
      else if (iVal > 0) uWarp[i] = Math.pow(sNorm[i], 1 + iVal * amp);
      else uWarp[i] = 1 - Math.pow(1 - sNorm[i], 1 + Math.abs(iVal) * amp);
    }

    // du/ds finite differences
    const du_ds: number[] = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      if (i === 0) {
        const ds = Math.max(1e-6, sNorm[i + 1] - sNorm[i]);
        du_ds[i] = (uWarp[i + 1] - uWarp[i]) / ds;
      } else if (i === n - 1) {
        const ds = Math.max(1e-6, sNorm[i] - sNorm[i - 1]);
        du_ds[i] = (uWarp[i] - uWarp[i - 1]) / ds;
      } else {
        const ds = Math.max(1e-6, sNorm[i + 1] - sNorm[i - 1]);
        du_ds[i] = (uWarp[i + 1] - uWarp[i - 1]) / ds;
      }
      if (!Number.isFinite(du_ds[i])) du_ds[i] = 0;
    }

    // map derivative to 0..1 speed fraction
    let minD = Number.POSITIVE_INFINITY, maxD = Number.NEGATIVE_INFINITY;
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

    const vDesired = speedFrac.map(f => this.minSpeed + f * (this.maxSpeed - this.minSpeed));

    // accel limit based on smoothness (positive smoothness -> lower accel)
    const accelLimit = new Array(n).fill(this.accelBase);
    for (let i = 0; i < n; i++) {
      const s = sNorm[i];
      const sIntensity = this.smoothnessMap.evaluate(s);
      const factor = Math.abs(sIntensity);
      accelLimit[i] = this.accelMin + (this.accelBase - this.accelMin) * (1 - factor);
      accelLimit[i] = Math.max(this.accelMin, Math.min(this.accelBase, accelLimit[i]));
    }

    // velocity profile forward/backward passes & time integration (unchanged)
    const vForward = new Array(n).fill(0);
    vForward[0] = Math.min(vDesired[0], this.maxSpeed);
    for (let i = 0; i < n - 1; i++) {
      const ds = Math.max(1e-6, dists[i + 1]);
      const a = accelLimit[i];
      const reachable = Math.sqrt(Math.max(0, vForward[i] * vForward[i] + 2 * a * ds));
      vForward[i + 1] = Math.min(vDesired[i + 1], reachable);
    }
    const v = vForward.slice();
    v[n - 1] = Math.min(v[n - 1], vDesired[n - 1]);
    for (let i = n - 2; i >= 0; i--) {
      const ds = Math.max(1e-6, dists[i + 1]);
      const a = accelLimit[i];
      const reachableBack = Math.sqrt(Math.max(0, v[i + 1] * v[i + 1] + 2 * a * ds));
      v[i] = Math.min(v[i], reachableBack);
    }

    const times: number[] = new Array(n).fill(0);
    let cumulative = 0;
    times[0] = 0;
    for (let i = 0; i < n - 1; i++) {
      const ds = Math.max(1e-6, dists[i + 1]);
      const vi = Math.max(1e-6, v[i]);
      const vj = Math.max(1e-6, v[i + 1]);
      const dt = ds / ((vi + vj) / 2);
      cumulative += dt;
      times[i + 1] = cumulative;
    }

    let intrinsicDuration = times[n - 1] || 0.0001;
    if (intrinsicDuration <= 0) intrinsicDuration = 1e-4;

    const scale = (this.totalDuration && this.totalDuration > 0)
      ? (this.totalDuration / intrinsicDuration)
      : 1;
    const scaledTimes = times.map(t => t * scale);
    const scaledVelocities = v.map(val => val / scale);

    // persist
    this.schedulePositions = samples;
    this.scheduleTimes = scaledTimes;
    this.scheduleSpeedFraction = speedFrac;
    this.scheduleVelocity = scaledVelocities;
  }

  private findSampleIndexForTime(timeSec: number) {
    const times = this.scheduleTimes;
    if (!times || times.length === 0) return 0;
    let lo = 0, hi = times.length - 1;
    if (timeSec <= times[0]) return 0;
    if (timeSec >= times[hi]) return hi;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (times[mid] === timeSec) return mid;
      if (times[mid] < timeSec) lo = mid + 1;
      else hi = mid - 1;
    }
    return Math.max(0, lo - 1);
  }

  play(pathPoints: Point[], opts?: { totalDuration?: number }) {
    this.stop();
    if (!pathPoints || pathPoints.length === 0) return;
    if (opts && typeof opts.totalDuration === 'number') {
      this.totalDuration = opts.totalDuration;
    }

    this.buildSchedule(pathPoints);

    const positions = this.schedulePositions;
    const times = this.scheduleTimes;
    const speedFrac = this.scheduleSpeedFraction;
    const velocities = this.scheduleVelocity;

    if (!positions || positions.length === 0) return;

    const finalTimeRaw = times[times.length - 1] ?? 0;
    const finalTime = Math.max(finalTimeRaw, 1e-4);

    const startTime = performance.now();

    const step = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      const tNow = Math.min(elapsed, finalTime);

      const idx = this.findSampleIndexForTime(tNow);
      const tA = times[idx];
      const tB = times[Math.min(idx + 1, times.length - 1)];
      const pA = positions[idx];
      const pB = positions[Math.min(idx + 1, positions.length - 1)];
      const sfA = speedFrac[idx];
      const sfB = speedFrac[Math.min(idx + 1, speedFrac.length - 1)];
      const vA = velocities[idx] ?? 0;
      const vB = velocities[Math.min(idx + 1, velocities.length - 1)] ?? vA;

      const localT = (tB - tA) <= 0 ? 0 : (tNow - tA) / (tB - tA);

      const pos = { x: pA.x * (1 - localT) + pB.x * localT, y: pA.y * (1 - localT) + pB.y * localT };
      const speedFractionNow = sfA * (1 - localT) + sfB * localT;
      const velocityNow = vA * (1 - localT) + vB * localT;

      this.arm.solveIK(pos);
      const angles: [number, number] = [...this.arm.angles];

      const frame: MotionFrame = {
        t: performance.now(),
        position: pos,
        angles,
        speedFraction: speedFractionNow,
        velocity: velocityNow,
      };

      if (this.frameCb) this.frameCb(frame);

      if (elapsed < finalTime) {
        this.animationId = requestAnimationFrame(step);
      } else {
        this.animationId = null;
      }
    };

    this.animationId = requestAnimationFrame(step);
  }

  replay(frames: Array<{ position: Point; angles: [number, number]; meta?: any }>, opts?: { totalDuration?: number }) {
    // same replay implementation as before (unchanged)
    this.stop();
    if (!frames || frames.length === 0) return;
    if (opts && typeof opts.totalDuration === 'number') {
      this.totalDuration = opts.totalDuration;
    }

    const n = frames.length;
    const rawTimes: (number | null)[] = frames.map(f => (typeof f.meta?.t === 'number' ? f.meta.t as number : null));
    const haveTimes = rawTimes.every(v => v !== null);

    let times: number[] = [];
    if (haveTimes) {
      const nums = rawTimes.map(v => v as number);
      const first = nums[0];
      const looksLikeMs = nums.some(v => v > 1e5);
      times = nums.map(v => (v - first) / (looksLikeMs ? 1000 : 1));
      const intrinsic = times[times.length - 1] || 0.0001;
      const scale = (this.totalDuration && this.totalDuration > 0) ? (this.totalDuration / intrinsic) : 1;
      times = times.map(t => t * scale);
    } else {
      const total = (this.totalDuration && this.totalDuration > 0) ? this.totalDuration : Math.max(0.5, n / 30);
      if (n === 1) times = [0];
      else for (let i = 0; i < n; i++) times.push((i / (n - 1)) * total);
    }

    this.schedulePositions = frames.map(f => f.position);
    this.scheduleTimes = times;
    this.playbackAngles = frames.map(f => f.angles);

    const finalTime = Math.max(this.scheduleTimes[this.scheduleTimes.length - 1] ?? 0, 1e-4);
    const startTime = performance.now();

    const step = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      const tNow = Math.min(elapsed, finalTime);

      const idx = this.findSampleIndexForTime(tNow);
      const tA = this.scheduleTimes[idx];
      const tB = this.scheduleTimes[Math.min(idx + 1, this.scheduleTimes.length - 1)];
      const pA = this.schedulePositions[idx];
      const pB = this.schedulePositions[Math.min(idx + 1, this.schedulePositions.length - 1)];
      const aA = this.playbackAngles[idx] ?? [0, 0];
      const aB = this.playbackAngles[Math.min(idx + 1, this.playbackAngles.length - 1)] ?? aA;

      const localT = (tB - tA) <= 0 ? 0 : (tNow - tA) / (tB - tA);

      const pos = {
        x: pA.x * (1 - localT) + pB.x * localT,
        y: pA.y * (1 - localT) + pB.y * localT,
      };

      const angles: [number, number] = [
        aA[0] * (1 - localT) + aB[0] * localT,
        aA[1] * (1 - localT) + aB[1] * localT,
      ];

      const frame: MotionFrame = {
        t: performance.now(),
        position: pos,
        angles,
        speedFraction: 0,
        velocity: 0,
        meta: frames[Math.max(0, Math.min(frames.length - 1, idx))]?.meta,
      };

      if (this.frameCb) this.frameCb(frame);

      if (elapsed < finalTime) {
        this.animationId = requestAnimationFrame(step);
      } else {
        this.animationId = null;
      }
    };

    this.animationId = requestAnimationFrame(step);
  }
}
