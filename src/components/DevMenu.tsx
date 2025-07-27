// /src/components/DevMenu.tsx
import React, { useState } from 'react';
import { CSVPreviewer } from './CSVPreviewer';
import CSVLoader from './CSVLoader';
//import MarkdownViewer from '../MarkdownViewer';

import '../css/index.css';



interface DevMenuProps {
    isOpen: boolean;
    toggleOpen: () => void;
    onClose: () => void;
    onDone: () => void;
    toggleRoboticLook: (enabled: boolean) => void;

    totalDuration: number;
    setTotalDuration: (t: number) => void;
    onTasksLoaded: (tasks: string[]) => void;
    addAvoidZone: () => void;
    addRequiredZone: () => void;
    clearZones: () => void;

}

const DevMenu: React.FC<DevMenuProps> = ({
    isOpen,
    //toggleOpen,
    onClose,
    onDone,
    toggleRoboticLook,
    totalDuration,
    setTotalDuration,
    onTasksLoaded,
    addAvoidZone,
    addRequiredZone,
    clearZones
}) => {
    //const [hasAccess, setHasAccess] = React.useState(false);
    const [roboticLook, setRoboticLook] = React.useState(false);
    const [csvRows, setCsvRows] = useState<string[][]>([]); // Shared CSV state
    const [showMarkdown, setShowMarkdown] = useState(false); // State to toggle 
    //const correctPassword = '1';

    return (
        <>


            <div className={`dev-menu-container ${isOpen ? 'open' : ''}`}>
                <button className="close-button" onClick={onClose}>×</button>
                <h2>Developer Menu</h2>
                <h1 className="dev-h1">Operator Controls</h1>

                <div id="dev-functional">
                    {/* <button id="addSegmentBtn">Add Segment</button> */}

                    <label htmlFor="totalDuration">Total Duration (s):</label>
                    <input
                        className="functional-controls"
                        id="totalDuration"
                        type="number"
                        value={totalDuration}
                        step="0.1"
                        onChange={(e) => setTotalDuration(Number(e.target.value))} /*readOnly*/
                    />

                    {/*
                        <label htmlFor="toggleRoboticLook">Enable Robotic Look</label>
                        <input type="checkbox" id="toggleRoboticLook" />
                        */}

                </div>


                <section id="dev-csv-load">
                    <h2 className="dev-h2">Load Feature List</h2>
                    {/* <p>Accepted formats: .csv</p> */}

                    {/* <label htmlFor="csvInput">Select CSV File:</label> */}
                    {/* <input type="file" id="csvInput" accept=".csv" onChange={handleCSVInput} /> */}

                    <CSVLoader
                        testFlowManager={{
                            loadTasks: (tasks) => {
                                const rows = tasks.map(row => [row]);
                                setCsvRows(rows);
                                if (onTasksLoaded) onTasksLoaded(tasks);
                            },
                        }}
                    />

                    <div id="csvMenuComponents">
                        <section className="csvComponents">
                            <h3 className="dev-h3">Preview</h3> {/*//THIS IS THE CSV PREVIEWER! */}
                            <CSVPreviewer rows={csvRows} />
                        </section>

                        <section className="csvComponents">
                            <h3 className="dev-h3">Options</h3>
                            <div id="csvOptions">
                                <ul className="noBullets">
                                    <li>
                                        <label>
                                            <input type="checkbox" id="CSVshuffleOrder" />
                                            Random Order
                                        </label>
                                    </li>
                                    <li>
                                        <label>
                                            <input type="checkbox" id="CSVinterruption" />
                                            Add interuptions in between
                                        </label>
                                    </li>
                                    <li>
                                        <label>
                                            <input type="checkbox" id="CSVshowProgress" />
                                            Show Progress
                                        </label>

                                    </li>
                                </ul>
                            </div>
                        </section>
                    </div>

                    <button id="loadCsvBtn">Save</button>

                    <section id="dev-int-assets">
                        <h2 className="dev-h2">Interactive Assets</h2>
                        <label htmlFor="assetInput">Load saved asset design</label>
                        <input type="file" id="assetInput" accept=".json" />

                        <div className={`dev-menu ${isOpen ? 'open' : ''}`}>
                            <h2>Dev Menu</h2>
                            <button onClick={addAvoidZone}>Add Avoid Zone (Red)</button>
                            <button onClick={addRequiredZone}>Add Required Zone (Green)</button>
                            <button onClick={clearZones}>Clear All Zones</button>
                            <button onClick={onClose}>Close</button>
                        </div>

                        <button id="toggleAssetEditor">Open Asset Toolbar</button>
                        <a href="AssetHelp.markdown" target="_blank">Asset help and Info</a>

                        <button onClick={() => setShowMarkdown(!showMarkdown)}>
                            {showMarkdown ? 'Hide' : 'Show'} Asset Help and Info
                        </button>

                        <a
                            href="/asset-help"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Open Asset Help
                        </a>

                        <div id="UserObjective">
                            <label htmlFor="userObj">Edit User Objective</label>
                            <input type="text" id="userObj" placeholder="Example: ''Approach the marked point''" />
                            <button id="saveObjBtn">Save Objective</button>

                        </div>
                    </section>
                </section>

                <section id="dev-data-logs">
                    <h2 className="dev-h2">Data Logs</h2>
                    <p>Note: motion set will be from current local device. Online user designs to be stored elsewhere.</p>
                    {/* BTW: WHERE IS THAT GOING TO BE STORED??? TBD. */}
                    <ul>
                        <li><button id="downloadAllBtn">Download individual motion set</button></li>
                        <li><button id="downloadObj_Asset">Download asset and objective log </button></li>
                    </ul>
                </section>

                <label>
                    <input
                        type="checkbox"
                        checked={roboticLook}
                        onChange={(e) => {
                            setRoboticLook(e.target.checked);
                            toggleRoboticLook(e.target.checked);
                        }}
                    />
                    Enable Robotic Look
                </label>


                <button id="assetDoneBtn">Done Editing</button>

                <button onClick={onDone}>Done</button>
            </div>
        </>
    );
};


export default DevMenu;
