import type { Point } from '../types/Point';

export const CANVAS_WIDTH    = 700;
export const CANVAS_HEIGHT   = 500;
export const MAX_POINTS: number = 10;
// robot
export const ARM_BASE: Point  = { x: (CANVAS_WIDTH / 2) , y: 480 };
export const LIMB_LENGTHS: [number, number] = [200, 140];
export const START_ANGLES: [number, number] = [-Math.PI / 2, Math.PI / 1.2];  // shoulder ~30°, elbow 90° <- NOT ANYMORE!
// path
export const START_POINT: Point = { x: (CANVAS_WIDTH / 6), y: CANVAS_HEIGHT / 1.6 };
export const END_POINT: Point = { x: CANVAS_WIDTH - (CANVAS_WIDTH / 6), y: CANVAS_HEIGHT / 1.6 };
