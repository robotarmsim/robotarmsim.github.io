// src/App.tsx
import { useState, useEffect, useMemo, useRef } from 'react';
import { RobotArm, type Point } from './utils/RobotArm';
import { CanvasStage } from './components/CanvasStage';
import DevMenu from './components/DevMenu';
import { GraphEditorPanel } from './components/GraphEditorPanel-v2';
import { PlayButton } from './components/UI/PlayButton';
import useMotionEngine from './hooks/useMotionEngine';
import { useZones } from './types/zones';
import { HashRouter, Routes, Route } from 'react-router-dom';
import MarkdownViewer from './MarkdownViewer';
import { nanoid } from 'nanoid';
import { CurrentTaskDisplay } from './components/CurrentTaskDisplay';
import { useTrackingLogs, type MotionLogEntry } from './hooks/useTrackingLogs';
import HelpButton from './components/UI/HelpButton';

import StartScreen from './components/StartScreen';
import SplashScreen from './components/SplashScreen';
import Tutorial from './components/Tutorial';
import { getRandomPromptList } from "./utils/promptBank";
import ProgressPie from './components/ProgressPie';

import {
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  ARM_BASE,
  LIMB_LENGTHS,
  START_POINT,
  END_POINT,
} from './config/constants';

import {
  initSegmentValuesForPath,
  resampleSegmentsToPath,
  pointGraphFromSegmentValues,
} from './utils/segmentUtils';

// Use the PathParameterMap class (constructor takes pathPoints: Point[])
import PathParameterMap from './utils/PathParameterMap';

export default function App() {
  // start / tutorial
  const [showSplash, setShowSplash] = useState(true);
  const [showStartScreen, setShowStartScreen] = useState(false);
  const [started, setStarted] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [, setTutorialCompleted] = useState<boolean>(() => !!sessionStorage.getItem('tutorialCompleted'));

  const openTutorial = (opts?: { force?: boolean }) => {
    const force = !!opts?.force;
    const alreadyCompleted = !!sessionStorage.getItem('tutorialCompleted');
    if (alreadyCompleted && !force) return false;
    setStarted(true);
    setShowTutorial(true);
    return true;
  };

  // general state
  const [devMenuOpen, setDevMenuOpen] = useState(false);
  const [totalDuration, setTotalDuration] = useState(5);
  const [showProgress, setShowProgress] = useState(true);
  const [currentTaskIndex, setCurrentTaskIndex] = useState(0);
  const [taskList, setTaskList] = useState<string[]>(() => {
    const saved = sessionStorage.getItem("taskList");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // ignore
      }
    }
    return [];
  });

  useEffect(() => {
    let mounted = true;
    const saved = sessionStorage.getItem("taskList");
    if (saved) return;
    (async () => {
      try {
        const list = await getRandomPromptList();
        if (!mounted) return;
        const finalList = Array.isArray(list)
          ? list
          : (typeof list === 'object' && list !== null && Array.isArray((list as any).list) ? (list as any).list : []);
        if (finalList && finalList.length) {
          sessionStorage.setItem("taskList", JSON.stringify(finalList));
          setTaskList(finalList);
        }
      } catch (err) {
        console.warn('Failed to load prompts', err);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const realTasks = taskList.filter(task => !task.startsWith('__INTERRUPTION__'));
  const currentRealIndex = realTasks.findIndex(t => t === taskList[currentTaskIndex]);

  // user id
  const [userId, setUserId] = useState<string>(() =>
    localStorage.getItem('userId') || (() => {
      const id = nanoid();
      localStorage.setItem('userId', id);
      return id;
    })()
  );

  // path points
  const [pathPoints, setPathPoints] = useState<Point[]>([START_POINT, END_POINT]);

  // zones, logs
  const [robotTip, setRobotTip] = useState<Point>(pathPoints[0]);
  const { zones, setZones, addZone, clearZones } = useZones(CANVAS_HEIGHT / 2);

  const {
    logMotionFrame,
    logSessionEvent,
    saveMotionLog,
    saveSessionLog,
    loadMotionLog,
    loadSessionLog,
    setSessionLog,
  } = useTrackingLogs();

  // --- PER-SEGMENT GRAPH STATE ---
  // (n-1 values for n path points)
  const [directnessSegments, setDirectnessSegments] = useState<number[]>(() => initSegmentValuesForPath(pathPoints, 0));
  const [tempoSegments, setTempoSegments] = useState<number[]>(() => initSegmentValuesForPath(pathPoints, 0));
  const [smoothnessSegments, setSmoothnessSegments] = useState<number[]>(() => initSegmentValuesForPath(pathPoints, 0));

  // sync segments when path length changes
  useEffect(() => {
    setDirectnessSegments(prev => resampleSegmentsToPath(prev, pathPoints));
    setTempoSegments(prev => resampleSegmentsToPath(prev, pathPoints));
    setSmoothnessSegments(prev => resampleSegmentsToPath(prev, pathPoints));
  }, [pathPoints.length]);

  /**
   * Build & maintain a PathParameterMap instance.
   *
   * Important:
   * - PathParameterMap constructor takes the pathPoints array.
   * - We convert per-segment arrays (what the GraphEditor produces)
   *   into vertex control-points using pointGraphFromSegmentValues,
   *   then store those control points into the PathParameterMap using
   *   the typed setters (setDirectnessPoints / setTempoPoints / setSmoothnessPoints).
   *
   * This keeps your UI editing (segment arrays) and runtime evaluation (PathParameterMap)
   * in sync without changing how GraphEditorPanel works.
   */
  const pathMap = useMemo(() => {
    const pm = new PathParameterMap(pathPoints);

    // convert per-segment data -> vertex graph control points
    const directCP = pointGraphFromSegmentValues(directnessSegments, pathPoints); // [{x,y},...]
    const tempoCP = pointGraphFromSegmentValues(tempoSegments, pathPoints);
    const smoothCP = pointGraphFromSegmentValues(smoothnessSegments, pathPoints);

    // set them into the PathParameterMap
    pm.setDirectnessPoints(directCP);
    pm.setTempoPoints(tempoCP);
    pm.setSmoothnessPoints(smoothCP);

    return pm;
  }, [pathPoints, directnessSegments, tempoSegments, smoothnessSegments]);

  // Robot arm
  const arm = useMemo(() => new RobotArm(ARM_BASE, LIMB_LENGTHS), []);

  const [angles, setAngles] = useState<[number, number]>(() => {
    arm.solveIK(pathPoints[0]);
    return [...arm.angles];
  });

  // Throttled logging
  const lastLogTimeRef = useRef<number>(0);
  const LOG_INTERVAL_MS = 100;

  // Motion engine expects objects that expose evaluate(s:number): number.
  // PathParameterMap exposes evaluateDirectness / evaluateSmoothness / evaluateTempo.
  // Create small wrappers that forward evaluate -> pathMap.evaluate*
  const directnessMap = useMemo(() => ({ evaluate: (s: number) => pathMap.evaluateDirectness(s) }), [pathMap]);
  const tempoMap = useMemo(() => ({ evaluate: (s: number) => pathMap.evaluateTempo(s) }), [pathMap]);
  const smoothnessMap = useMemo(() => ({ evaluate: (s: number) => pathMap.evaluateSmoothness(s) }), [pathMap]);

  // Motion engine callback
  const onFrame = (frame: any) => {
    setRobotTip(frame.position);
    setAngles(frame.angles);

    try {
      const now = performance.now();
      if (now - lastLogTimeRef.current >= LOG_INTERVAL_MS) {
        lastLogTimeRef.current = now;
        logMotionFrame({
          t: frame.t,
          position: frame.position,
          angles: frame.angles,
          speed: frame.speedFraction,
          velocity: frame.velocity,
          noise: 0,
          userId,
          task: taskList[currentTaskIndex] || null,
        });
      }
    } catch (err) {
      console.warn('Throttled logging failed', err);
    }
  };

  // call the hook with the three parameter-maps (objects with evaluate(s):number)
  const { play, replay, stop } = useMotionEngine({
    arm,
    directnessMap,
    tempoMap,
    smoothnessMap,
    totalDuration,
    onFrame,
  });

  function handlePlay() {
    play(pathPoints, { totalDuration });
  }

  function replayMotion(data: MotionLogEntry[]) {
    const frames = data.map(d => ({ position: d.position, angles: d.angles, meta: d }));
    replay(frames);
  }

  useEffect(() => {
    setZones(zones =>
      zones.map(zone => {
        if (zone.type === 'required' && !zone.visited) {
          const dx = robotTip.x - zone.x;
          const dy = robotTip.y - zone.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const inside = dist <= zone.radius;
          if (inside) {
            return { ...zone, visited: true };
          }
        }
        return zone;
      })
    );
  }, [robotTip, setZones]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === '~') {
        setDevMenuOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => () => stop(), [stop]);

  return (
    <HashRouter>
      <Routes>
        <Route
          path="/"
          element={
            <div id="root">
              {showSplash && (
                <SplashScreen
                  onContinue={(optionalId?: string) => {
                    if (optionalId && optionalId.trim().length > 0) {
                      const id = optionalId.trim();
                      setUserId(id);
                      localStorage.setItem('userId', id);
                    }
                    setShowSplash(false);
                    setShowStartScreen(true);
                  }}
                />
              )}

              {showStartScreen && !showTutorial && (
                <StartScreen
                  participantId={userId}
                  onStartTutorial={() => {
                    setShowStartScreen(false);
                    openTutorial({ force: true });
                  }}
                  onSkipTutorial={() => {
                    setShowStartScreen(false);
                    setStarted(true);
                    sessionStorage.setItem('tutorialCompleted', '1');
                    setTutorialCompleted(true);
                  }}
                />
              )}

              {started && (
                <div id="appLayout">
                  <div className="app-container" id="mainContent">
                    <div className="main-container" id="main-container">
                      <div id="starting-point" />

                      <div id="main-wrapper">
                        <div className="task-header flex items-center gap-3" id="task-bar">
                          <div className="rounded-2xl shadow px-4 py-2 flex items-center">
                            <CurrentTaskDisplay
                              task={taskList[currentTaskIndex] || null}
                              index={currentRealIndex}
                              total={realTasks.length}
                              showProgress={showProgress}
                            />
                          </div>

                          <ProgressPie
                            index={currentRealIndex}
                            total={realTasks.length}
                            showProgress={showProgress}
                            size={56}
                            strokeWidth={6}
                          />
                        </div>

                        <div id="main-items">
                          <div id="just-canvas">
                            <CanvasStage
                              width={CANVAS_WIDTH}
                              height={CANVAS_HEIGHT}
                              pathPoints={pathPoints}
                              setPathPoints={setPathPoints}
                              arm={arm}
                              angles={angles}
                              setAngles={setAngles}
                              zones={zones}
                              setZones={setZones}
                              directnessSegments={directnessSegments}
                              tempoSegments={tempoSegments}
                              smoothnessSegments={smoothnessSegments}
                            />
                          </div>

                          <div id="user-controls">
                            <div id="directness-graph">
                              <GraphEditorPanel
                                id="directness-graph"
                                label="C"
                                pathPoints={pathPoints}
                                segmentValues={directnessSegments}
                                setSegmentValues={(vals: number[]) => {
                                  setDirectnessSegments(vals);
                                  logSessionEvent({ time: Date.now(), type: 'graphChange', label: 'Curvature', data: vals });
                                }}
                              />
                            </div>
                            <div id="tempo-graph">
                              <GraphEditorPanel
                                id="tempo-graph"
                                label="Speed"
                                pathPoints={pathPoints}
                                segmentValues={tempoSegments}
                                setSegmentValues={(vals: number[]) => {
                                  setTempoSegments(vals);
                                  logSessionEvent({ time: Date.now(), type: 'graphChange', label: 'Speed', data: vals });
                                }}
                              />
                            </div>
                            <div id="smoothness-graph">
                              <GraphEditorPanel
                                id="smoothness-graph"
                                label="Smoothness"
                                pathPoints={pathPoints}
                                segmentValues={smoothnessSegments}
                                setSegmentValues={(vals: number[]) => {
                                  setSmoothnessSegments(vals);
                                  logSessionEvent({ time: Date.now(), type: 'graphChange', label: 'Smoothness', data: vals });
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="user-buttons">
                          <button
                            className="user-buttons"
                            id="clear-points-button"
                            onClickCapture={() => {
                              setPathPoints([START_POINT, END_POINT]);
                              setDirectnessSegments(initSegmentValuesForPath([START_POINT, END_POINT], 0));
                              setTempoSegments(initSegmentValuesForPath([START_POINT, END_POINT], 0));
                              setSmoothnessSegments(initSegmentValuesForPath([START_POINT, END_POINT], 0));
                            }}
                          >
                            Clear
                          </button>

                          <PlayButton id="play-button" onClick={handlePlay} />

                          <button
                            className="user-buttons"
                            id="next-task-button"
                            onClickCapture={() => {
                              setPathPoints([START_POINT, END_POINT]);
                              setZones(z => z.map(zone => ({ ...zone, visited: false })));
                              setCurrentTaskIndex(i => Math.min(i + 1, taskList.length - 1));
                            }}
                            disabled={currentTaskIndex >= taskList.length - 1}
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </div>

                    <HelpButton
                      id="help-button"
                      onReplayTutorial={() => {
                        const alreadyCompleted = !!sessionStorage.getItem('tutorialCompleted');
                        if (alreadyCompleted) {
                          const ok = window.confirm("You've already completed the tutorial this session. Replay it? This will reset your tutorial answers for this session.");
                          if (!ok) return;
                          sessionStorage.removeItem('tutorialCompleted');
                          sessionStorage.removeItem('chosenSize');
                          sessionStorage.removeItem('taskList');
                          sessionStorage.removeItem('hasProlific');
                          sessionStorage.removeItem('prolificID');
                          setTutorialCompleted(false);
                        }
                        openTutorial({ force: true });
                      }}
                    />

                    <DevMenu
                      isOpen={devMenuOpen}
                      onClose={() => setDevMenuOpen(false)}
                      onDone={() => setDevMenuOpen(false)}
                      toggleRoboticLook={(enabled) => { console.log('Robotic Look:', enabled); }}
                      totalDuration={totalDuration}
                      setTotalDuration={setTotalDuration}
                      onTasksLoaded={(tasks) => {
                        setTaskList(tasks);
                        setCurrentTaskIndex(0);
                      }}
                      addAvoidZone={() => {
                        const newZone = addZone('avoid');
                        setSessionLog(prev => ({ ...prev, zones: [...prev.zones, newZone] }));
                        logSessionEvent({ time: Date.now(), type: 'addZone', label: 'avoid', data: newZone });
                      }}
                      addRequiredZone={() => {
                        const newZone = addZone('required');
                        setSessionLog(prev => ({ ...prev, zones: [...prev.zones, newZone] }));
                        logSessionEvent({ time: Date.now(), type: 'addZone', label: 'required', data: newZone });
                      }}
                      replayMotion={replayMotion}
                      setZones={setZones}
                      clearZones={clearZones}
                      setShowProgress={setShowProgress}
                      totalTasks={taskList.length}
                      saveMotionLog={saveMotionLog}
                      saveSessionLog={saveSessionLog}
                      loadMotionLog={loadMotionLog}
                      loadSessionLog={loadSessionLog}
                    />
                  </div>
                </div>
              )}

              {showTutorial && (
                <Tutorial
                  participantId={userId}
                  onComplete={() => {
                    setShowTutorial(false);
                    setTutorialCompleted(true);
                    sessionStorage.setItem('tutorialCompleted', '1');
                    if (!started) setStarted(true);
                  }}
                />
              )}
            </div>
          } />
        <Route path="/asset-help" element={<MarkdownViewer filePath="AssetHelp.markdown" />} />
      </Routes>
    </HashRouter>
  );
}
