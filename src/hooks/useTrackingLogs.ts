// hooks/useTrackingLogs.ts
import { useState, useCallback } from 'react';
import { downloadJSON } from '../utils/downloadJSON';
import { loadJSONFile } from '../utils/loadJSONFile';

export interface MotionLogEntry {
  t: number;
  position: { x: number; y: number };
  angles: [number, number];
  speed: number;
  velocity: number;
  noise: number;

  userId: string;
  task: string | null;
}

export interface SessionLog {
  zones: any[];
  userEdits: { time: number; type: string; label?: string; data?: any }[];
}

export function useTrackingLogs() {
  const [motionLog, setMotionLog] = useState<MotionLogEntry[]>([]);
  const [sessionLog, setSessionLog] = useState<SessionLog>({ zones: [], userEdits: [] });

  // Append a motion frame
  const logMotionFrame = useCallback((frame: MotionLogEntry) => {
    setMotionLog(prev => [...prev, frame]);
  }, []);

  // Append a session event
  const logSessionEvent = useCallback((event: SessionLog['userEdits'][0]) => {
    setSessionLog(prev => ({
      ...prev,
      userEdits: [...prev.userEdits, event],
    }));
  }, []);

  // Save
  const saveMotionLog = useCallback(() => {
    downloadJSON(motionLog, 'robot_motion.json');
  }, [motionLog]);

  const saveSessionLog = useCallback(() => {
    downloadJSON(sessionLog, 'session_data.json');
  }, [sessionLog]);

  // Load
  const loadMotionLog = useCallback((onLoaded?: (data: MotionLogEntry[]) => void) => {
    loadJSONFile((data) => {
      setMotionLog(data);
      if (onLoaded) onLoaded(data);
    });
  }, []);

  const loadSessionLog = useCallback((onLoaded?: (data: SessionLog) => void) => {
    loadJSONFile((data) => {
      setSessionLog(data);
      if (onLoaded) onLoaded(data);
    });
  }, []);

  return {
    motionLog,
    sessionLog,
    logMotionFrame,
    logSessionEvent,
    saveMotionLog,
    saveSessionLog,
    loadMotionLog,
    loadSessionLog,
    setSessionLog,
  };
}
