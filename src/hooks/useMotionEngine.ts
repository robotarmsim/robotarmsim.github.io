// src/hooks/useMotionEngine.ts
// useMotionEngine (auto-updating, stable API)

import { useEffect, useRef, useMemo, useCallback } from 'react';
import MotionEngine, { type MotionFrame } from '../utils/MotionEngine';
import type { RobotArm } from '../utils/RobotArm';
import type PathParameterMap from '../utils/PathParameterMap';

// Minimal shape MotionEngine expects for parameter maps
type ParamMap = { evaluate: (s: number) => number };

type UseMotionEngineParams = {
  arm: RobotArm;

  // Optional higher-level map
  pathMap?: InstanceType<typeof PathParameterMap> | null;

  // Or explicit maps
  directnessMap?: ParamMap | null;
  tempoMap?: ParamMap | null;

  totalDuration?: number;
  onFrame?: (frame: MotionFrame) => void;
};

export function useMotionEngine(params: UseMotionEngineParams) {
  const {
    arm,
    pathMap = null,
    directnessMap = null,
    tempoMap = null,
    totalDuration,
    onFrame,
  } = params;

  const engineRef = useRef<MotionEngine | null>(null);

  // Convert PathParameterMap → ParamMap
  const pathWrap = useMemo(() => {
    if (!pathMap) return {};
    return {
      directness: {
        evaluate: (s: number) =>
          pathMap.evaluateDirectness ? pathMap.evaluateDirectness(s) : 0,
      },
      tempo: {
        evaluate: (s: number) =>
          pathMap.evaluateTempo ? pathMap.evaluateTempo(s) : 0,
      },
    } as { directness?: ParamMap; tempo?: ParamMap };
  }, [pathMap]);

  // final maps (memoized)
  const finalDirectnessMap: ParamMap = useMemo(
    () =>
      directnessMap ??
      pathWrap.directness ?? { evaluate: (_s: number) => 0 },
    [directnessMap, pathWrap.directness]
  );
  const finalTempoMap: ParamMap = useMemo(
    () => tempoMap ?? pathWrap.tempo ?? { evaluate: (_s: number) => 0 },
    [tempoMap, pathWrap.tempo]
  );

  // Create engine once per arm
  useEffect(() => {
    console.log('[useMotionEngine] creating engine for arm', arm);
    engineRef.current = new MotionEngine(arm, {
      directnessMap: finalDirectnessMap,
      tempoMap: finalTempoMap,
      totalDuration,
      segments: 24,
      minSpeed: 6,
      maxSpeed: 220,
      accelBase: 1200,
      accelMin: 40,
      curvatureBaseScale: 1.0,
    });

    if (onFrame && engineRef.current) {
      engineRef.current.setOnFrame(onFrame);
    }

    return () => {
      engineRef.current?.destroy();
      engineRef.current = null;
      console.log('[useMotionEngine] destroyed engine for arm cleanup');
    };
    // recreate only when RobotArm instance changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arm]);

  // Keep maps & duration up-to-date on engine
  useEffect(() => {
    if (!engineRef.current) return;

    engineRef.current.updateMaps({
      directnessMap: finalDirectnessMap,
      tempoMap: finalTempoMap,
    });

    if (typeof totalDuration === 'number') {
      engineRef.current.setTotalDuration(totalDuration);
    }

    // Force recompute when maps or duration change
    engineRef.current.recompute?.();
  }, [finalDirectnessMap, finalTempoMap, totalDuration]);

  // Keep onFrame callback current
  useEffect(() => {
    if (!engineRef.current) return;
    if (onFrame) {
      engineRef.current.setOnFrame(onFrame);
    } else {
      engineRef.current.setOnFrame(() => {});
    }
  }, [onFrame]);

  // Stable controls
  const play = useCallback(
    (pathPoints: any[], opts?: { totalDuration?: number }) => {
      const engine = engineRef.current;
      if (!engine) {
        console.warn(
          '[useMotionEngine] play called but engine not initialized yet'
        );
        return;
      }
      if (onFrame) engine.setOnFrame(onFrame);
      engine.play(pathPoints, opts);
    },
    [onFrame]
  );

  const replay = useCallback(
    (frames: any[], opts?: { totalDuration?: number }) => {
      const engine = engineRef.current;
      if (!engine) {
        console.warn(
          '[useMotionEngine] replay called but engine not initialized yet'
        );
        return;
      }
      if (onFrame) engine.setOnFrame(onFrame);
      engine.replay(frames, opts);
    },
    [onFrame]
  );

  const stop = useCallback(() => {
    engineRef.current?.stop();
  }, []);

  return { play, replay, stop, engineRef };
}

export default useMotionEngine;
