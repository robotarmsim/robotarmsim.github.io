// src/components/MainContent.tsx

import React from 'react';

export default function MainContent() {
  return (
    <>
    {/* <!-- Instructions Panel --> */}
    <div id="instructionPanel" className="instruction-panel">
      <span id="instructionText">Click to plot [4] points.</span>
    </div>


    {/* <!-- taskOverlay --> */}
    <div id="taskOverlay" style={{display: 'none'}}>
      <span id="taskDisplay">Task: (none)</span>
      <br />
      <span id="progressDisplay"></span>
      {/* <!-- <button id="nextTaskBtn">Next Task</button> --> */}
    </div>


    {/* <!-- canvasContainer --> */}
    <div id="canvasContainer">
      <canvas id="robotCanvas" width="800" height="500"></canvas>
    </div>

    {/* <!-- user-controls --> */}
    <div className="user-controls">
      <button className="user-controlsB" id="clearBtn">Clear</button>
      <button className="user-controlsB" id="previewBtn">Play</button>
      <button className="user-controlsB" id="nextBtn">Next</button>
    </div>

    {/* <!-- Popup UI --> */}
    <div id="segmentPopup" className="hidden" style={{ position: 'absolute' }}>
      <label>Curvature:
        <input id="popup-curvature" type="range" min="0" max="500" step="1" className="level-0" />
        <span id="popup-curvature-val">0</span>
      </label><br />

      <label>Velocity:
        <input id="popup-velocity" type="range" min="0" max="500" step="1" className="level-0" />
        <span id="popup-velocity-val">0</span>
      </label><br />

      <label>Noise:
        <input id="popup-noise" type="range" min="0" max="500" step="1" className="level-0" />
        <span id="popup-noise-val">0</span>
      </label>
    </div>

    {/* <!-- toggleHelper --> */}
    <button id="toggleHelper" aria-label="Toggle help sidebar">
      ☰ Help
    </button>

    <div id="helperMenu">
      <button id="closeHelper" aria-label="Close sidebar">✕</button>
      <h2>What to Do</h2>
      <ol>
        <li>LOAD IN A [TASKLIST] CSV.</li>
        <li>Click to add path checkpoints.</li>
        <li>Hover over the line between two checkpoints to edit that part of the animation with sliders.</li>
        <li>Click "Play" to check the animation.</li>
        <li>Tweak the motion with the sliders, or <em>"Clear"</em> to reset your bus.</li>
        <li>Press "Next" to go to the next task.</li>
      </ol>
    </div>

    {/* <!-- interactive-toolbar --> */}
    <div id="interactive-toolbar">
      {/* <!-- for blocks and walls and such --> */}
    </div>
  </>
  );
}
