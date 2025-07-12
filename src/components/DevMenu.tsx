import React, { useState, type ChangeEvent } from 'react';
import { CSVPreviewer } from './CSVPreviewer';
import '../css/DevMenu.css';

interface DevMenuProps {
    isOpen: boolean;
    toggleOpen: () => void;
    onClose: () => void;
    onDone: () => void;
    toggleRoboticLook: (enabled: boolean) => void;

    // NEW:
    numSegments: number;
    setNumSegments: (n: number) => void;
    totalDuration: number;
    setTotalDuration: (t: number) => void;
}

const DevMenu: React.FC<DevMenuProps> = ({
    isOpen,
    toggleOpen,
    onClose,
    onDone,
    toggleRoboticLook,
    numSegments,
    setNumSegments,
    totalDuration,
    setTotalDuration,
}) => {
    const [hasAccess, setHasAccess] = React.useState(false);
    const [roboticLook, setRoboticLook] = React.useState(false);
    const [csvRows, setCsvRows] = useState<string[][]>([]); // Shared CSV state
    const correctPassword = '1';

    const handleToggleMenu = () => {
        if (hasAccess) {
            toggleOpen();
        } else {
            const input = prompt('Enter dev password:');
            if (input === correctPassword) {
                setHasAccess(true);
                toggleOpen();
            } else {
                alert('Incorrect password.');
            }
        }
    };

    const handleCSVInput = (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const rows = text.trim().split('\n').map(row => row.split(','));
            setCsvRows(rows);
        };
        reader.readAsText(file);
    };


    return (
        <>
            {/* <button id="dev-open" onClick={handleToggleMenu}>
                ☰ Dev
            </button> */}

            {isOpen && (
                <div id="dev-menu-int">
                    <h1 className="dev-h1">Experimental Controls</h1>
                    <button
                        id="closeDevMenu"
                        onClick={() => {
                            onClose();
                            toggleOpen();
                        }}
                    >
                        ✕
                    </button>

                    <div id="dev-functional">
                        <label htmlFor="numSegments">Number of Points:</label>
                        <input
                            className="functional-controls"
                            id="numSegments"
                            type="number"
                            value={numSegments}
                            min="1"
                            max="10"
                            onChange={(e) => setNumSegments(Number(e.target.value))}/* readOnly */
                        />
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
                        <p>Accepted formats: .csv</p>

                        {/* <label htmlFor="csvInput">Select CSV File:</label> */}
                        <input type="file" id="csvInput" accept=".csv" onChange={handleCSVInput} />

                        <div id="csvMenuComponents">
                            <section className="csvComponents">
                                <h3 className="dev-h3">Preview</h3>
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

                            <button id="toggleAssetEditor">Open Asset Toolbar</button>
                            <a href="README.md" target="_blank">Asset help and info</a>

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
                </div>
            )}
        </>
    );
};


export default DevMenu;
