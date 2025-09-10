// src/utils/pathPreprocess.ts
import type { Point } from './RobotArm';
import type { ParamMapLike } from '../types/ParamMapLike';

/**
 * Preprocess the path to create real corner rounding (or sharpening) according to smoothness & directness.
 * We insert two points per interior vertex (Pi- and Pi+) at distance r along each incident segment.
 * This produces true bevel/fillet-like behavior before the spline interpolation.
 *
 * Tuning notes:
 * - Negative smoothness → smaller r (sharper corners). If extremely negative and |directness| large, r may be ~0 for hard corners.
 * - Positive smoothness → larger r (more rounding).
 */
export function preprocessPathWithChamfers(
  path: Point[],
  smoothness: ParamMapLike,
  directness: ParamMapLike
): Point[] {
  if (!path || path.length < 3) return path?.slice() ?? [];

  // Compute cumulative arc and per-vertex s ∈ [0,1]
  const { sPerVertex, totalLen } = arcParams(path);
  if (totalLen <= 0) return path.slice();

  const out: Point[] = [];
  out.push(path[0]);

  for (let i = 1; i < path.length - 1; i++) {
    const P0 = path[i - 1];
    const P1 = path[i];
    const P2 = path[i + 1];

    const vIn = norm(vec(P0, P1));
    const vOut = norm(vec(P1, P2));
    const angleCos = clamp(vIn.x * vOut.x + vIn.y * vOut.y, -1, 1);

    // Corner "strength" ~ sin of half-angle
    const turnMagnitude = Math.sqrt(Math.max(0, 1 - angleCos)); // 0 (straight) .. 1 (U-turn)

    const sHere = sPerVertex[i];
    const sm = clamp1(smoothness.evaluate(sHere));
    const dir = clamp1(directness.evaluate(sHere));

    // Base radius scale from smoothness:
    // - sm < 0  → prefer sharp: small r
    // - sm > 0  → prefer round: larger r
    const baseR = mix(0.02, 0.12, (sm + 1) / 2); // map [-1..1] → [0.02..0.12] of local segment length

    // Modulate by turn magnitude (flat segments get near-zero r):
    const rScaleByTurn = remapClamp(turnMagnitude, 0, 1, 0.2, 1.0);

    // If |dir| is large and sm very negative, snap corners harder (smaller r).
    const hardSnap = Math.max(0, Math.abs(dir) - 0.75) * Math.max(0, -sm);
    const snapFactor = 1 - clamp01(hardSnap) * 0.85; // reduce radius up to 85%

    const rFrac = baseR * rScaleByTurn * snapFactor; // fraction of min(adjacent segment lengths)

    const lenIn = dist(P0, P1);
    const lenOut = dist(P1, P2);
    const stepIn = Math.min(lenIn, lenOut) * rFrac;

    // Create Pi- and Pi+
    const PiMinus: Point = {
      x: P1.x - vIn.x * stepIn,
      y: P1.y - vIn.y * stepIn,
    };
    const PiPlus: Point = {
      x: P1.x + vOut.x * stepIn,
      y: P1.y + vOut.y * stepIn,
    };

    // If sm is extremely negative, collapse to a near-hard corner by making Pi- & Pi+ nearly P1
    // but leave a tiny offset to avoid zero-length edges.
    if (sm < -0.9 && Math.abs(dir) > 0.75) {
      const tiny = Math.min(lenIn, lenOut) * 0.002;
      PiMinus.x = P1.x - vIn.x * tiny;
      PiMinus.y = P1.y - vIn.y * tiny;
      PiPlus.x = P1.x + vOut.x * tiny;
      PiPlus.y = P1.y + vOut.y * tiny;
    }

    out.push(PiMinus, PiPlus);
  }

  out.push(path[path.length - 1]);
  return out;
}

// ---------- helpers ----------

function vec(a: Point, b: Point): { x: number; y: number } {
  return { x: b.x - a.x, y: b.y - a.y };
}
function len(v: { x: number; y: number }): number {
  return Math.hypot(v.x, v.y);
}
function norm(v: { x: number; y: number }): { x: number; y: number } {
  const l = len(v) || 1;
  return { x: v.x / l, y: v.y / l };
}
function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
function clamp1(v: number) {
  return clamp(v, -1, 1);
}
function clamp01(v: number) {
  return clamp(v, 0, 1);
}
function mix(a: number, b: number, t: number) {
  return a * (1 - t) + b * t;
}
function remapClamp(v: number, a: number, b: number, c: number, d: number) {
  const t = clamp01((v - a) / (b - a));
  return mix(c, d, t);
}

/** arc-length params for original vertices */
function arcParams(path: Point[]) {
  const n = path.length;
  const sPerVertex: number[] = new Array(n).fill(0);
  let acc = 0;
  for (let i = 1; i < n; i++) {
    acc += dist(path[i - 1], path[i]);
    sPerVertex[i] = acc;
  }
  const totalLen = acc || 1;
  for (let i = 0; i < n; i++) sPerVertex[i] /= totalLen;
  return { sPerVertex, totalLen };
}
