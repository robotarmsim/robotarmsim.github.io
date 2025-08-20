// zones.ts
import { useState } from 'react';

export type Zone = {
  id: number;
  x: number;
  y: number;
  radius: number;
  type: 'avoid' | 'required';
  visited?: boolean;
};

export function useZones(initialY: number) {
  const [zones, setZones] = useState<Zone[]>([
    // { id: 1, x: 200, y: initialY, radius: 40, type: 'avoid' },
    // NO INITIAL ZONE !!
  ]);

  function addZone(type: 'avoid' | 'required' = 'avoid') {
    setZones(zones => [
      ...zones,
      {
        id: Date.now(),
        x: 200,
        y: initialY,
        radius: 40,
        type,
        visited: type === 'required' ? false : undefined,
      },
    ]);
  }

  function clearZones() {
    setZones([]);
  }

  return { zones, setZones, addZone, clearZones };
}
