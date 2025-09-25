// src/utils/MotionEngine.ts
/**
 * MotionEngine (preserves original behavior; adds arc-length resampling)
 *
 * Changes:
 * - Samples spline at higher internal density, then resamples by arc-length to
 *   produce evenly spaced points. This fixes clumping/long flat regions and
 *   stabilizes tempo/du-ds calculations.
 *
 * Everything else (corner processing, tempo warp, accel passes, frame callback)
 * remains functionally identical to your previous implementation.
 */

// src/utils/MotionEngine.ts
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

function applyTempoWarp(t: number, intensity: number) {
    if (intensity === 0) return t;
    const amp = 2.5;
    const i = Math.max(-1, Math.min(1, intensity));
    if (i > 0) return Math.pow(t, 1 + i * amp);
    return 1 - Math.pow(1 - t, 1 + Math.abs(i) * amp);
}

/**
 * Standalone trajectory generator for previews.
 * Uses the same logic as MotionEngine.buildSchedule, but returns just positions.
 */
export function computeTrajectory(
  pathPoints: Point[],
  opts: {
    directnessMap: ParamMap;
    tempoMap: ParamMap;
    segments?: number;
    curvatureBaseScale?: number;
    samplesPerSegment?: number;
  }
): Point[] {
  if (!pathPoints || pathPoints.length === 0) return [];

  const segments = opts.segments ?? 20;
  const curvatureBaseScale = opts.curvatureBaseScale ?? 1.0;

  // directness drives curvature deformation
  const curvatureFn = (s: number) => {
    const directness = Math.max(-1, Math.min(1, opts.directnessMap.evaluate(s) || 0));
    return directness * curvatureBaseScale;
  };

  // oversample raw curve
  const oversampleMultiplier = 4;
  const internalSamplesPerSegment = Math.max(
    4,
    Math.round((opts.samplesPerSegment ?? segments) * oversampleMultiplier)
  );
  const rawSamples = bezierSpline(pathPoints, internalSamplesPerSegment, curvatureFn);
  if (!rawSamples.length) return [];

  // cumulative distances
  const dists: number[] = new Array(rawSamples.length).fill(0);
  for (let i = 1; i < rawSamples.length; i++) {
    dists[i] =
      dists[i - 1] +
      Math.hypot(rawSamples[i].x - rawSamples[i - 1].x, rawSamples[i].y - rawSamples[i - 1].y);
  }
  const totalLen = dists[dists.length - 1] || 1e-6;

  // tempoFn biases spacing along the curve
  const tempoFn = (s: number) => {
    const v = opts.tempoMap.evaluate(s) || 0;
    return Math.max(0.01, 1 + v); // ensure positive density
  };

  // build a warped cumulative distribution function (CDF) for tempo
  const warped: number[] = new Array(rawSamples.length);
  warped[0] = 0;
  for (let i = 1; i < rawSamples.length; i++) {
    const sNorm = dists[i] / totalLen;
    const weight = tempoFn(sNorm);
    warped[i] = warped[i - 1] + (dists[i] - dists[i - 1]) * weight;
  }
  const warpedTotal = warped[warped.length - 1];

  // resample evenly in warped space
  const targetSamples = Math.max(pathPoints.length * segments * 2, 20);
  const samples: Point[] = [];
  for (let ti = 0; ti < targetSamples; ti++) {
    const target = (ti / (targetSamples - 1)) * warpedTotal;

    // binary search in warped array
    let lo = 0,
      hi = warped.length - 1;
    while (lo < hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (warped[mid] < target) lo = mid + 1;
      else hi = mid;
    }

    const idx = Math.max(1, lo);
    const wL = warped[idx - 1];
    const wR = warped[idx];
    const segLen = Math.max(1e-9, wR - wL);
    const localT = (target - wL) / segLen;

    const a = rawSamples[idx - 1];
    const b = rawSamples[idx];
    samples.push({
      x: a.x * (1 - localT) + b.x * localT,
      y: a.y * (1 - localT) + b.y * localT,
    });
  }

  return samples;
}


export default class MotionEngine {
    private arm: RobotArm;
    private directnessMap: ParamMap;
    private tempoMap: ParamMap;

    private pathPoints: Point[] = [];

    private segments: number;
    private minSpeed: number;
    private maxSpeed: number;
    private totalDuration?: number;
    private accelBase: number;
    private accelMin: number;
    private curvatureBaseScale: number;

    private animationId: number | null = null;
    private frameCb: ((f: MotionFrame) => void) | null = null;
    private _instanceId = Math.random().toString(36).slice(2, 9);

    private schedulePositions: Point[] = [];
    private scheduleTimes: number[] = [];
    private scheduleSpeedFraction: number[] = [];
    private scheduleVelocity: number[] = [];
    private playbackAngles: [number, number][] = [];

    constructor(arm: RobotArm, opts: MotionEngineOptions) {
        this.arm = arm;
        this.directnessMap = opts.directnessMap;
        this.tempoMap = opts.tempoMap;
        this.segments = opts.segments ?? 20;
        this.minSpeed = opts.minSpeed ?? 6;
        this.maxSpeed = opts.maxSpeed ?? 220;
        this.totalDuration = opts.totalDuration;
        this.accelBase = opts.accelBase ?? 1200;
        this.accelMin = opts.accelMin ?? 40;
        this.curvatureBaseScale = opts.curvatureBaseScale ?? 1.0;
    }

    // === NEW ===
    setPathPoints(points: Point[]) {
        this.pathPoints = points.slice();
        this.rebuildSchedule();
    }

    setOnFrame(cb: (f: MotionFrame) => void) {
        console.log('[MotionEngine]', this._instanceId, 'setOnFrame attached', !!cb);
        this.frameCb = cb;
    }

    // === UPDATED ===
    updateMaps(maps: { directnessMap?: ParamMap; tempoMap?: ParamMap }) {
        if (maps.directnessMap) this.directnessMap = maps.directnessMap;
        if (maps.tempoMap) this.tempoMap = maps.tempoMap;
        this.rebuildSchedule(); // <--- auto update
    }

    // === NEW ===
    private rebuildSchedule() {
        if (this.pathPoints.length) {
            this.buildSchedule(this.pathPoints);
        } else {
            this.schedulePositions = [];
            this.scheduleTimes = [];
            this.scheduleSpeedFraction = [];
            this.scheduleVelocity = [];
            this.playbackAngles = [];
        }
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
            console.log('[MotionEngine]', this._instanceId, 'stop called, cancelling raf id', this.animationId);
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        } else {
            console.log('[MotionEngine]', this._instanceId, 'stop called, no raf to cancel');
        }
    }

    destroy() {
        console.log('[MotionEngine]', this._instanceId, 'destroy called (will stop + clear cb)');
        this.stop();
        this.frameCb = null;
    }

    // === NEW: Exposed getters for CanvasStage ===
    getSchedule() {
        return {
            positions: this.schedulePositions.slice(),
            times: this.scheduleTimes.slice(),
            speedFractions: this.scheduleSpeedFraction.slice(),
            velocities: this.scheduleVelocity.slice(),
            angles: this.playbackAngles.slice(),
        };
    }

    getTrajectory(): Point[] {
        return this.schedulePositions.slice();
    }

    getDuration(): number {
        return this.scheduleTimes.length ? this.scheduleTimes[this.scheduleTimes.length - 1] : 0;
    }

    isRunning(): boolean {
        return this.animationId !== null;
    }

    public recompute(): void {
        if (this.pathPoints.length) {
            try {
                this.buildSchedule(this.pathPoints);
            } catch (err) {
                console.warn('[MotionEngine] recompute failed:', err);
            }
        }
    }

    /**
     * Sample the bezier spline while using directnessMap for signed curvature magnitude.
     *
     * We internally sample with higher density (oversampleMultiplier) so that subsequent
     * arc-length resampling yields a smooth uniform distribution.
     */
    private sampleSpline(pathPoints: Point[], samplesPerSegment: number) {
        // curvatureFn uses directnessMap and curvatureBaseScale
        const curvatureFn = (segmentPos: number) => {
            const dIntensity = Math.max(-1, Math.min(1, this.directnessMap.evaluate(segmentPos) || 0));
            return dIntensity * this.curvatureBaseScale;
        };

        // Oversample factor: keep moderate oversampling to give resampler enough resolution
        const oversampleMultiplier = 4;
        const internalSamplesPerSegment = Math.max(4, Math.round(samplesPerSegment * oversampleMultiplier));

        // Call bezierSpline. The bezierSpline implementation may vary, but we treat its output as raw samples.
        return bezierSpline(pathPoints, internalSamplesPerSegment, curvatureFn);
    }

    /**
     * Arc-length resampling: given an ordered sample array, return 'targetCount' points
     * evenly spaced along cumulative distance. Uses linear interpolation between sample points.
     */
    private resampleByArcLength(src: Point[], targetCount: number) {
        if (!src || src.length === 0) return [] as Point[];
        if (src.length === 1 || targetCount <= 1) return src.slice();

        // 1) cumulative distances
        const n = src.length;
        const dists: number[] = new Array(n).fill(0);
        for (let i = 1; i < n; i++) {
            const dx = src[i].x - src[i - 1].x;
            const dy = src[i].y - src[i - 1].y;
            dists[i] = dists[i - 1] + Math.hypot(dx, dy);
        }
        const total = dists[n - 1] || 1e-6;

        // 2) target positions along arc (0..total)
        const out: Point[] = [];
        for (let ti = 0; ti < targetCount; ti++) {
            const t = ti / (targetCount - 1);
            const target = t * total;

            // binary search for interval
            let lo = 0, hi = n - 1;
            while (lo < hi) {
                const mid = Math.floor((lo + hi) / 2);
                if (dists[mid] < target) lo = mid + 1;
                else hi = mid;
            }
            const idx = Math.max(1, lo);
            const dL = dists[idx - 1];
            const dR = dists[idx];
            const segLen = Math.max(1e-9, dR - dL);
            const localT = (target - dL) / segLen;

            const a = src[idx - 1];
            const b = src[idx];
            const x = a.x * (1 - localT) + b.x * localT;
            const y = a.y * (1 - localT) + b.y * localT;
            out.push({ x, y });
        }

        return out;
    }

    private applyCornerProcessing(samples: Point[], pathPoints: Point[], sSamples: number[]) {
        const nSamples = samples.length;
        if (nSamples === 0) return samples.slice();

        const src = samples.map(p => ({ x: p.x, y: p.y }));
        const out = samples.map(p => ({ x: p.x, y: p.y }));

        // original control vertex normalized positions along polyline
        const origDists: number[] = new Array(pathPoints.length).fill(0);
        for (let i = 1; i < pathPoints.length; i++) {
            const dx = pathPoints[i].x - pathPoints[i - 1].x;
            const dy = pathPoints[i].y - pathPoints[i - 1].y;
            origDists[i] = origDists[i - 1] + Math.hypot(dx, dy);
        }
        const origTotal = origDists[origDists.length - 1] || 1e-6;
        const origS = origDists.map(d => d / origTotal);

        // tuning — scale relative to sample density
        const maxWindowSamples = Math.max(2, Math.round(this.segments * 0.6));
        const blurSigmaBase = Math.max(0.6, this.segments * 0.12);
        const cornerSmoothingStrength = 0.7;

        for (let pi = 1; pi < pathPoints.length - 1; pi++) {
            const sVertex = origS[pi];

            // find nearest sample index (center)
            let centerIdx = 0;
            let bestD = Infinity;
            for (let si = 0; si < sSamples.length; si++) {
                const d = Math.abs(sSamples[si] - sVertex);
                if (d < bestD) {
                    bestD = d;
                    centerIdx = si;
                }
            }

            const windowSamples = Math.max(1, Math.round(1 + cornerSmoothingStrength * maxWindowSamples));
            const left = Math.max(0, centerIdx - windowSamples);
            const right = Math.min(nSamples - 1, centerIdx + windowSamples);

            const sigma = Math.max(0.6, blurSigmaBase * cornerSmoothingStrength);

            // For each output index j in window, compute Gaussian weights centered at j (convolution)
            for (let j = left; j <= right; j++) {
                let wxSum = 0;
                let wySum = 0;
                let wsum = 0;
                for (let m = left; m <= right; m++) {
                    const didx = m - j; // distance from output index j to source index m
                    const w = Math.exp(-0.5 * (didx * didx) / (sigma * sigma));
                    wxSum += src[m].x * w;
                    wySum += src[m].y * w;
                    wsum += w;
                }
                if (wsum > 0) {
                    out[j].x = wxSum / wsum;
                    out[j].y = wySum / wsum;
                } else {
                    out[j].x = src[j].x;
                    out[j].y = src[j].y;
                }
            }
        }

        return out;
    }

    /**
     * Build schedule: sample spline, arc-length resample to uniform spacing,
     * post-process corners (on the pre-resampled samples), compute tempo warp -> velocities -> times.
     */
    private buildSchedule(pathPoints: Point[]) {
        if (!pathPoints || pathPoints.length === 0) {
            this.schedulePositions = [];
            this.scheduleTimes = [];
            this.scheduleSpeedFraction = [];
            this.scheduleVelocity = [];
            return;
        }

        // 1) raw sampling (oversampled)
        const rawSamples = this.sampleSpline(pathPoints, this.segments);
        const nRaw = rawSamples.length;
        if (nRaw === 0) {
            this.schedulePositions = [];
            this.scheduleTimes = [];
            this.scheduleSpeedFraction = [];
            this.scheduleVelocity = [];
            return;
        }

        // 2) compute normalized arc positions for rawSamples (used by corner processor)
        const distsSamples: number[] = new Array(nRaw).fill(0);
        for (let i = 1; i < nRaw; i++) {
            distsSamples[i] = Math.hypot(rawSamples[i].x - rawSamples[i - 1].x, rawSamples[i].y - rawSamples[i - 1].y);
        }
        const cumSamples: number[] = new Array(nRaw).fill(0);
        for (let i = 1; i < nRaw; i++) cumSamples[i] = cumSamples[i - 1] + distsSamples[i];
        const totalSamplesLen = cumSamples[nRaw - 1] || 0.0001;
        const sSamples = cumSamples.map(d => d / totalSamplesLen);

        // 3) corner processing (non-destructive). We run it on rawSamples
        const processed = this.applyCornerProcessing(rawSamples, pathPoints, sSamples);
        const nProcessed = processed.length;
        if (nProcessed === 0) {
            this.schedulePositions = [];
            this.scheduleTimes = [];
            this.scheduleSpeedFraction = [];
            this.scheduleVelocity = [];
            return;
        }

        // 4) ARC-LENGTH RESAMPLE: produce uniformly spaced points along processed curve
        // Choose target sample count: keep proportional to original segments * path length.
        // Use a reasonably large target so velocity mapping is smooth.
        const targetSamples = Math.max(Math.round(pathPoints.length * this.segments * 2), Math.min(Math.round(nProcessed), pathPoints.length * this.segments));
        const samples = this.resampleByArcLength(processed, targetSamples);
        const n = samples.length;
        if (n === 0) {
            this.schedulePositions = [];
            this.scheduleTimes = [];
            this.scheduleSpeedFraction = [];
            this.scheduleVelocity = [];
            return;
        }

        // 5) arc distances + normalized s for resampled samples
        const dists: number[] = new Array(n).fill(0);
        for (let i = 1; i < n; i++) {
            dists[i] = Math.hypot(samples[i].x - samples[i - 1].x, samples[i].y - samples[i - 1].y);
        }
        const cumDist: number[] = new Array(n).fill(0);
        for (let i = 1; i < n; i++) cumDist[i] = cumDist[i - 1] + dists[i];
        const totalLength = cumDist[n - 1] || 0.0001;
        const sNorm: number[] = new Array(n);
        for (let i = 0; i < n; i++) sNorm[i] = totalLength === 0 ? 0 : cumDist[i] / totalLength;

        // 6) TEMPO warp u(s)
        const uWarp: number[] = new Array(n);
        for (let i = 0; i < n; i++) {
            const intensity = this.tempoMap.evaluate(sNorm[i]);
            uWarp[i] = applyTempoWarp(sNorm[i], intensity);
        }

        // 7) du/ds finite differences
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

        // 8) map derivative to 0..1 speed fraction
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

        // 9) ACCEL LIMIT: fixed accel limit
        const accelLimit = new Array(n).fill(this.accelBase);

        // 10) velocity forward/backward passes
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

        // 11) integrate times
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
        const scale = (this.totalDuration && this.totalDuration > 0) ? (this.totalDuration / intrinsicDuration) : 1;
        const scaledTimes = times.map(t => t * scale);
        const scaledVelocities = v.map(val => val / scale);

        // store schedule (positions are the resampled points)
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

        (this as any)._runningFinalTime = finalTime;
        (this as any)._runningStartTime = performance.now();

        console.log('[MotionEngine] Schedule built:', positions.length, 'samples, duration', finalTime);

        const step = () => {
            const startTime = (this as any)._runningStartTime as number;
            const elapsed = (performance.now() - startTime) / 1000;
            const tNow = Math.min(elapsed, (this as any)._runningFinalTime as number);

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

            const hadCb = !!this.frameCb;
            if (hadCb) {
                try {
                    this.frameCb!(frame);
                } catch (err) {
                    console.error('[MotionEngine]', this._instanceId, 'frameCb threw', err);
                }
            }
            console.log('[MotionEngine]', this._instanceId, 'Frame', { elapsed, tNow, idx, pos, angles, hadCb, rafIdBeforeSchedule: this.animationId });

            if (elapsed < (this as any)._runningFinalTime) {
                this.animationId = requestAnimationFrame(step);
            } else {
                this.animationId = null;
                console.log('[MotionEngine] Animation complete');
            }
        };

        this.animationId = requestAnimationFrame(step);
    }

    replay(frames: Array<{ position: Point; angles: [number, number]; meta?: any }>, opts?: { totalDuration?: number }) {
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
