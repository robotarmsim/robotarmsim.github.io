// utils/graphUtils.ts
// Utiliies for the GraphEditorPanel (graphs for user parameter control input)
export function segmentValuesFromGraphPoints(graphPoints: { x:number, y:number }[]) {
  if (!graphPoints || graphPoints.length < 2) return [];
  return graphPoints.slice(0, -1).map((_, i) => (graphPoints[i].y + graphPoints[i+1].y) / 2);
}

/**
 * Apply a new segment value into graphPoints.
 * Strategy: set both endpoints of the segment to the same value (simple).
 * Optionally pass blend = 0..1 to mix new value with existing endpoints:
 *   blend=1 -> overwrite; blend=0 -> do nothing.
 */
export function applySegmentValueToGraphPoints(
  graphPoints: { x:number, y:number }[],
  segIndex: number,
  value: number,
  blend = 1
) {
  const out = graphPoints.map(p => ({ ...p }));
  if (segIndex < 0 || segIndex >= graphPoints.length - 1) return out;
  const aIdx = segIndex;
  const bIdx = segIndex + 1;

  out[aIdx].y = out[aIdx].y * (1 - blend) + value * blend;
  out[bIdx].y = out[bIdx].y * (1 - blend) + value * blend;
  return out;
}
