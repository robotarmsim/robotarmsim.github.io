// src/utils/spline.ts

export interface Point {
  x: number;
  y: number;
}

/**
 * Compute a point on a Catmull-Rom spline segment.
 * @param t - interpolation parameter [0,1]
 * @param P0 - point before segment start
 * @param P1 - segment start
 * @param P2 - segment end
 * @param P3 - point after segment end
 */
export function catmullRomPoint(t: number, P0: Point, P1: Point, P2: Point, P3: Point): Point {
  const t2 = t * t;
  const t3 = t2 * t;
  return {
    x: 0.5 * (
      2 * P1.x +
      (P2.x - P0.x) * t +
      (2 * P0.x - 5 * P1.x + 4 * P2.x - P3.x) * t2 +
      (-P0.x + 3 * P1.x - 3 * P2.x + P3.x) * t3
    ),
    y: 0.5 * (
      2 * P1.y +
      (P2.y - P0.y) * t +
      (2 * P0.y - 5 * P1.y + 4 * P2.y - P3.y) * t2 +
      (-P0.y + 3 * P1.y - 3 * P2.y + P3.y) * t3
    )
  };
}

/**
 * Build a sampled Catmull-Rom spline.
 */
export function buildSpline(rawPoints: Point[]): {
  points: Point[];
  cumLengths: number[];
} {
  const points: Point[] = [];
  const cumLengths: number[] = [];
  const N = rawPoints.length;
  if (N < 2) return { points, cumLengths };

  const padded = [rawPoints[0], ...rawPoints, rawPoints[N - 1]];
  const samplesPerSeg = 50;
  let totalLen = 0;
  let prevPt: Point | null = null;

  for (let i = 1; i < padded.length - 2; i++) {
    const P0 = padded[i - 1];
    const P1 = padded[i];
    const P2 = padded[i + 1];
    const P3 = padded[i + 2];

    for (let s = 0; s <= samplesPerSeg; s++) {
      const t = s / samplesPerSeg;
      const pt = catmullRomPoint(t, P0, P1, P2, P3);
      if (prevPt) {
        totalLen += Math.hypot(pt.x - prevPt.x, pt.y - prevPt.y);
      }
      points.push(pt);
      cumLengths.push(totalLen);
      prevPt = pt;
    }
  }

  return { points, cumLengths };
}

/**
 * Sample a point along the spline at a given arc length.
 */
export function sampleSplineAtArcLength(
  splineData: { points: Point[]; cumLengths: number[] },
  targetLen: number
): Point {
  const { points, cumLengths } = splineData;
  const M = cumLengths.length;
  if (M === 0) return { x: 0, y: 0 };
  if (targetLen <= 0) return points[0];
  if (targetLen >= cumLengths[M - 1]) return points[M - 1];

  let low = 0;
  let high = M - 1;
  while (low + 1 < high) {
    const mid = Math.floor((low + high) / 2);
    if (cumLengths[mid] <= targetLen) {
      low = mid;
    } else {
      high = mid;
    }
  }

  const len0 = cumLengths[low];
  const len1 = cumLengths[high];
  const t = (targetLen - len0) / (len1 - len0);
  return {
    x: points[low].x + (points[high].x - points[low].x) * t,
    y: points[low].y + (points[high].y - points[low].y) * t
  };
}
