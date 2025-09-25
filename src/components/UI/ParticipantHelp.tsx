import { useState } from "react";
import { Play, RotateCcw, SkipForward, MousePointer, Keyboard, AlertCircle, Trash2, ActivitySquare } from "lucide-react";

interface Props {
  onClose: () => void;
  onReplayTutorial: () => void;
}

export default function ParticipantHelp({ onClose, onReplayTutorial }: Props) {
  const [prolificId, setProlificId] = useState(
    localStorage.getItem("prolificID") || ""
  );

  function saveProlificId() {
    if (prolificId.trim().length > 0) {
      localStorage.setItem("prolificID", prolificId.trim());
      alert("Prolific ID saved.");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
      <div className="bg-neutral-900 text-gray-200 max-w-lg w-full p-6 rounded-xl shadow-xl overflow-y-auto space-y-6">
        {/* Header */}
        <header className="flex justify-between items-center">
          <h2 className="text-xl font-bold">Help</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </header>

        {/* Task overview */}
        <section>
          <h3 className="font-semibold mb-2">What's the task?</h3>
          <p className="text-sm text-gray-300">
            You'll see a <strong>prompt at the top</strong> of the screen.  
            Use the robot arm to draw a path that follows the instructions.  
            Once done, press <b>Next</b> to move to the next prompt.
          </p>
        </section>

        {/* Quick Start */}
        <section>
          <h3 className="font-semibold mb-2">Quick Start</h3>
          <ul className="list-disc list-inside text-sm space-y-1 text-gray-300">
            <li>Click on the canvas to add path points. The arm follows them in order.</li>
            <li className="flex items-center gap-1">
              <Trash2 size={14}/> Right-click a point to delete it.
            </li>
            <li>
              <b className="inline-flex items-center gap-1"><Play size={14}/> Play</b> — watch the arm move.
            </li>
            <li>
              <b className="inline-flex items-center gap-1"><RotateCcw size={14}/> Clear</b> — reset the path.
            </li>
            <li>
              <b className="inline-flex items-center gap-1"><SkipForward size={14}/> Next</b> — go to the next task.
            </li>
          </ul>
        </section>

        {/* Controls */}
        <section>
          <h3 className="font-semibold mb-2">Controls</h3>
          <div className="space-y-3 text-sm text-gray-300">
            <p className="font-medium flex items-center gap-2"><MousePointer size={14}/> Mouse / Trackpad</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Click to add new points.</li>
              <li>You can move points by clicking and dragging in the canvas.</li>
              <li>Right-click to delete a point.</li>
            </ul>

            <p className="font-medium flex items-center gap-2"><Keyboard size={14}/> Keyboard</p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><b>Space</b> — Play / Pause</li>
              <li><b>Delete</b> — remove selected point</li>
            </ul>
          </div>
        </section>

        {/* Graph editors */}
        <section>
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <ActivitySquare size={16}/> User Graphs
          </h3>
          <p className="text-sm text-gray-300 mb-2">
            On the right side, you'll see two graphs: <b>Curvature</b> and <b>Speed</b>.  
            These let you adjust how the arm moves between points:
          </p>
          <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
            <li><b>Curvature</b>: positive values give more concave curves, negative values make the path more convex. 
            For a straight path,  keep the point closer to the baseline.</li>
            <li><b>Speed</b>: Positive is acceleration, negative is deceleration. Baseline gives a constant speed.</li>
          </ul>
          <p className="text-xs text-gray-400 mt-1">
            Drag the little squares up/down to change the motion. Reset with the ⟳ button.
          </p>
        </section>

        {/* Troubleshooting */}
        <section>
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <AlertCircle size={16}/> Troubleshooting
          </h3>
          <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
            <li>If the arm doesn't move, press <b>Play</b> again.</li>
            <li>If <b>Next</b> is greyed out, finish the current task first.</li>
            <li>If stuck, try <b>Clear</b> and redraw the path.</li>
          </ul>
        </section>

        {/* Prolific ID */}
        <section>
          <h3 className="font-semibold mb-2">Prolific ID</h3>
          <p className="text-sm text-gray-300 mb-2">
            If you forgot to enter your Prolific ID earlier, enter it here:
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={prolificId}
              onChange={(e) => setProlificId(e.target.value)}
              className="flex-1 rounded px-2 py-1 text-white"
              placeholder="Enter your Prolific ID"
            />
            <button
              onClick={saveProlificId}
              className="bg-sky-600 hover:bg-sky-500 px-3 py-1 rounded text-sm font-medium"
            >
              Save
            </button>
          </div>
        </section>

        {/* Footer actions */}
        <div className="flex gap-2 pt-4">
          <button
            className="flex-1 bg-sky-600 hover:bg-sky-500 py-2 rounded font-medium"
            onClick={onReplayTutorial}
          >
            Replay Tutorial
          </button>
          <button
            className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded font-medium"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
