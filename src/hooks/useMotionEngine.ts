// src/hooks/useMotionEngine.ts
/**
 * useMotionEngine
 *
 * Flexible hook wrapper for MotionEngine.
 * Accepts either:
 *   - pathMap: PathParameterMap (having evaluateDirectness/evaluateTempo/evaluateSmoothness),
 * OR
 *   - directnessMap / tempoMap / smoothnessMap: objects with evaluate(s:number):number
 *
 * The hook constructs the ParamMap objects the MotionEngine expects,
 * creates a single MotionEngine instance (recreated only when `arm` changes),
 * and keeps the engine's maps + totalDuration + onFrame up-to-date as React state changes.
 */

import { useEffect, useRef } from 'react';
import MotionEngine, { type MotionFrame } from '../utils/MotionEngine';
import type { RobotArm } from '../utils/RobotArm';
import type PathParameterMap from '../utils/PathParameterMap';

// A minimal shape MotionEngine expects for parameter maps
type ParamMap = { evaluate: (s: number) => number };

type UseMotionEngineParams = {
  arm: RobotArm;

  // Optional single path map (higher-level object)
  pathMap?: InstanceType<typeof PathParameterMap> | null;

  // Or the three explicit maps (each must have evaluate(s:number):number)
  directnessMap?: ParamMap | null;
  tempoMap?: ParamMap | null;
  smoothnessMap?: ParamMap | null;

  totalDuration?: number;
  onFrame?: (frame: MotionFrame) => void;
};

export function useMotionEngine(params: UseMotionEngineParams) {
  const {
    arm,
    pathMap = null,
    directnessMap = null,
    tempoMap = null,
    smoothnessMap = null,
    totalDuration,
    onFrame,
  } = params;

  const engineRef = useRef<MotionEngine | null>(null);

  // Helper: convert PathParameterMap -> ParamMap (object with evaluate)
  function wrapPathMap(pm: InstanceType<typeof PathParameterMap> | null): {
    directness?: ParamMap;
    tempo?: ParamMap;
    smoothness?: ParamMap;
  } {
    if (!pm) return {};
    return {
      directness: { evaluate: (s: number) => pm.evaluateDirectness ? pm.evaluateDirectness(s) : 0 },
      tempo: { evaluate: (s: number) => pm.evaluateTempo ? pm.evaluateTempo(s) : 0 },
      smoothness: { evaluate: (s: number) => pm.evaluateSmoothness ? pm.evaluateSmoothness(s) : 0 },
    };
  }

  // Build final maps that will be passed to MotionEngine.
  // Priority order:
  //  - use explicit directnessMap/tempoMap/smoothnessMap if provided
  //  - else, if pathMap provided, wrap it
  //  - else fallback to a noop evaluator that returns 0
  const pathWrap = wrapPathMap(pathMap as any);

  const finalDirectnessMap: ParamMap = directnessMap ?? pathWrap.directness ?? { evaluate: (_s: number) => 0 };
  const finalTempoMap: ParamMap = tempoMap ?? pathWrap.tempo ?? { evaluate: (_s: number) => 0 };
  const finalSmoothnessMap: ParamMap = smoothnessMap ?? pathWrap.smoothness ?? { evaluate: (_s: number) => 0 };

  // Create MotionEngine once (or when arm changes). Keep a stable instance across re-renders.
  useEffect(() => {
    // instantiate engine with the initial maps (we'll update maps later when they change)
    engineRef.current = new MotionEngine(arm, {
      directnessMap: finalDirectnessMap,
      tempoMap: finalTempoMap,
      smoothnessMap: finalSmoothnessMap,
      totalDuration,
      segments: 24,
      minSpeed: 6,
      maxSpeed: 220,
      accelBase: 1200,
      accelMin: 40,
      curvatureBaseScale: 1.0,
    });

    // if caller passed an onFrame, set it
    if (onFrame && engineRef.current) engineRef.current.setOnFrame(onFrame);

    // cleanup
    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
    };
    // intentionally only recreate when the RobotArm instance changes.
    // callers may change the maps rapidly; we just call updateMaps below to avoid re-instantiation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arm]);

  // Keep maps up-to-date whenever they change
  useEffect(() => {
    if (!engineRef.current) return;
    engineRef.current.updateMaps({
      directnessMap: finalDirectnessMap,
      tempoMap: finalTempoMap,
      smoothnessMap: finalSmoothnessMap,
    });
    // also keep totalDuration in sync
    if (typeof totalDuration === 'number') engineRef.current.setTotalDuration(totalDuration);
  }, [finalDirectnessMap, finalTempoMap, finalSmoothnessMap, totalDuration]);

  // Keep onFrame up-to-date
  useEffect(() => {
    if (!engineRef.current) return;
    if (onFrame) engineRef.current.setOnFrame(onFrame);
  }, [onFrame]);

  // control wrappers
  const play = (pathPoints: any[], opts?: { totalDuration?: number }) => {
    engineRef.current?.play(pathPoints, opts);
  };

  const replay = (frames: any[], opts?: { totalDuration?: number }) => {
    engineRef.current?.replay(frames, opts);
  };

  const stop = () => {
    engineRef.current?.stop();
  };

  return { play, replay, stop, engineRef };
}

export default useMotionEngine;
