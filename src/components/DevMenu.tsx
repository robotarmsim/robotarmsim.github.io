// /src/components/DevMenu.tsx
import React, { useState, useEffect } from 'react';
import CSVLoader from './CSVLoader';
import { CSVPreviewer } from './CSVPreviewer';
import CSVOptions from './CSVOptions';
import { shuffle, insertInterruptions } from '../utils/csvUtils';

import { Link } from 'react-router-dom';

import type { MotionLogEntry, SessionLog } from '../hooks/useTrackingLogs';
import type { Zone } from '../types/zones';

import '../css/index.css';

interface DevMenuProps {
    isOpen: boolean;
    onClose: () => void;
    onDone: () => void;
    toggleRoboticLook: (enabled: boolean) => void;
    totalDuration: number;
    setTotalDuration: (t: number) => void;
    onTasksLoaded: (tasks: string[]) => void;
    addAvoidZone: () => void;
    addRequiredZone: () => void;
    clearZones: () => void;
    setShowProgress?: (enabled: boolean) => void;
    totalTasks: number;
    saveMotionLog: () => void;
    saveSessionLog: () => void;
    loadMotionLog: (onLoaded?: (data: MotionLogEntry[]) => void) => void;
    loadSessionLog: (onLoaded?: (data: SessionLog) => void) => void;
    replayMotion: (data: MotionLogEntry[]) => void;
    setZones: React.Dispatch<React.SetStateAction<Zone[]>>;
}

const DevMenu: React.FC<DevMenuProps> = ({
    isOpen,
    onClose,
    onDone,
    //toggleRoboticLook,
    totalDuration,
    setTotalDuration,
    onTasksLoaded,
    addAvoidZone,
    addRequiredZone,
    clearZones,
    setShowProgress = () => { },
    //totalTasks,
    saveMotionLog,
    saveSessionLog,
    loadMotionLog,
    loadSessionLog,
    replayMotion,
    setZones,
}) => {

    // presets to choose from
    const availablePresets = ["preset-1-laban.csv", "preset-3-metaphor.csv"];

    useEffect(() => {
        // only run once on mount
        const randomPreset = availablePresets[Math.floor(Math.random() * availablePresets.length)];
        setSelectedPreset(randomPreset);

        // auto-load it
        const load = async () => {
            const response = await fetch(`/presets/${randomPreset}`);
            const text = await response.text();
            const lines = text
                .split('\n')
                .map(l => l.trim())
                .filter(l => l.length > 0);
            setRawTasks(lines.map(l => l.split(',')[0].trim()));
        };

        load();
    }, []);

    // raw task list and preview rows
    const [rawTasks, setRawTasks] = useState<string[]>([]);
    const [csvRows, setCsvRows] = useState<string[][]>([]);

    // CSV options state
    const [randomOrder, setRandomOrder] = useState(false);
    const [interruptionEnabled, setInterruptionEnabled] = useState(false);
    const [interruptionInterval, setInterruptionInterval] = useState(1);
    const [showProgressLocal, setShowProgressLocal] = useState(true); // true for the pie
    const [selectedPreset, setSelectedPreset] = useState<string | null>(null);

    // whenever rawTasks or options change, recompute rows and notify parent
    useEffect(() => {
        let tasks = [...rawTasks];
        if (randomOrder) tasks = shuffle(tasks);
        if (interruptionEnabled) tasks = insertInterruptions(tasks, interruptionInterval);

        setCsvRows(tasks.map(t => [t]));
        onTasksLoaded(tasks);
    }, [rawTasks, randomOrder, interruptionEnabled, interruptionInterval]);

    // propagate showProgress toggles externally
    useEffect(() => {
        console.log('DevMenu toggled showProgress ', showProgressLocal);
        if (typeof setShowProgress === 'function') {
            setShowProgress(showProgressLocal);
        }
    }, [showProgressLocal, setShowProgress]);

    const handleLoadPreset = async () => {
        if (!selectedPreset) return;
        const response = await fetch(`/presets/${selectedPreset}`);
        const text = await response.text();
        const lines = text
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0);
        setRawTasks(lines.map(l => l.split(',')[0].trim()));
    };

    return (
        <div className={`dev-menu-container ${isOpen ? 'open' : ''}`}>
            <button className="close-button" onClick={onClose}>×</button>
            <h2>Developer Menu</h2>

            {/* Operator Controls */}
            <section id="dev-functional">
                <h3>Operator Controls</h3>
                <label htmlFor="totalDuration">Total Duration (s):</label>
                <input
                    id="totalDuration"
                    type="number"
                    value={totalDuration}
                    step="0.1"
                    onChange={e => setTotalDuration(Number(e.target.value))}
                />
            </section>

            {/* CSV Section */}
            <section id="dev-csv">
                <h3>Set Feature List</h3>
                <CSVLoader onData={setRawTasks} />

                <div className="csv-presets">
                    <label>Choose from Presets:</label>
                    <select
                        value={selectedPreset || ''}
                        onChange={e => setSelectedPreset(e.target.value)}
                    >
                        <option value="">-- Select Preset --</option>
                        <option value="preset-1-laban.csv">Laban</option>
                        <option value="preset-2-demo.csv">Demo</option>
                    </select>
                    <button onClick={handleLoadPreset}>Load Preset</button>
                </div>

                <CSVOptions
                    randomOrder={randomOrder}
                    setRandomOrder={setRandomOrder}
                    showProgress={showProgressLocal}
                    setShowProgress={setShowProgressLocal}
                    interruptionEnabled={interruptionEnabled}
                    setInterruptionEnabled={setInterruptionEnabled}
                    interruptionInterval={interruptionInterval}
                    setInterruptionInterval={setInterruptionInterval}
                />

                <div className="csv-preview-section">
                    <h3 className="dev-h3">Preview</h3>
                    <CSVPreviewer rows={csvRows} hasHeader={false} />
                </div>
            </section>

            {/* Interactive Assets */}
            <section id="dev-int-assets">
                <h3>Interactive Assets</h3>
                <div className="zone-buttons">
                    <button onClick={addAvoidZone}>Add Avoid Zone (Red)</button>
                    <button onClick={addRequiredZone}>Add Required Zone (Green)</button>
                    <button onClick={clearZones}>Clear All Zones</button>
                </div>
                <Link to="/asset-help" className="asset-help-link">
                    Open Asset Help
                </Link>
                {/* <div id="UserObjective">
                    <label htmlFor="userObj">Edit User Objective</label>
                    <input
                        type="text"
                        id="userObj"
                        placeholder="This Does Nothing Right Now"
                    />
                    <button id="saveObjBtn">Save Objective</button>
                </div> */}
            </section>

            {/* Data Logs */}
            <section id="dev-data-logs">
                <h3>Data Logs</h3>
                <ul>
                    <li>
                        <a
                            href="#"
                            onClick={e => { e.preventDefault(); saveMotionLog(); }}
                        >
                            Save Motion Data
                        </a>
                    </li>
                    <li>
                        <a
                            href="#"
                            onClick={e => { e.preventDefault(); saveSessionLog(); }}
                        >
                            Save Session Data
                        </a>
                    </li>
                    <li>
                        <a
                            href="#"
                            onClick={e => {
                                e.preventDefault();
                                loadMotionLog(data => replayMotion(data));
                            }}
                        >
                            Load & Replay Motion Data
                        </a>
                    </li>
                    <li>
                        <a
                            href="#"
                            onClick={e => {
                                e.preventDefault();
                                loadSessionLog(data => data?.zones && setZones(data.zones));
                            }}
                        >
                            Load Session Data
                        </a>
                    </li>
                </ul>
            </section>


            {/* Done */}
            <button onClick={onDone}>Done</button>
        </div>
    );
};

export default DevMenu;