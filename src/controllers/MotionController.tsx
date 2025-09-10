// src/controllers/MotionController.tsx
import { useCallback } from 'react';
import useMotionEngine from '../hooks/useMotionEngine';
import type { MotionFrame } from '../utils/MotionEngine';
import type { RobotArm } from '../utils/RobotArm';
import type { MotionParameterMap } from '../utils/MotionParameterMap';

type MotionControllerParams = {
  arm: RobotArm;
  directnessMap: MotionParameterMap | any;
  tempoMap: MotionParameterMap | any;
  smoothnessMap: MotionParameterMap | any;
  totalDuration?: number;
  onFrame?: (frame: MotionFrame) => void;
};

export function useMotionController(params: MotionControllerParams) {
  const {
    arm,
    directnessMap,
    tempoMap,
    smoothnessMap,
    totalDuration = 0,
    onFrame,
  } = params;

  const { play, replay, stop } = useMotionEngine({
    arm,
    directnessMap,
    tempoMap,
    smoothnessMap,
    totalDuration,
    onFrame: onFrame ?? ((frame: MotionFrame) => {}),
  });

  const doPlay = useCallback((pathPoints: any[], opts?: { totalDuration?: number }) => {
    play(pathPoints, opts);
  }, [play]);

  const doReplay = useCallback((frames: any[]) => {
    replay(frames);
  }, [replay]);

  const doStop = useCallback(() => {
    stop();
  }, [stop]);

  return {
    play: doPlay,
    replay: doReplay,
    stop: doStop,
  };
}

export default useMotionController;
