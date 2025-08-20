import React from 'react';

interface WikiModalProps {
  onClose: () => void;
  onReplayTutorialClick: () => void;
}

const WikiModal: React.FC<WikiModalProps> = ({ onClose, onReplayTutorialClick }) => {
  return (
    <div className="wiki-overlay">
      <div className="wiki-card">
        <h2>Robot Arm Simulator Help</h2>
        <p>Learn how to use the system effectively.</p>

        <section>
          <h3>Tutorial</h3>
          <p>Follow the tutorial to learn step-by-step how to interact with the robot arm and editing tools.</p>
        </section>

        <section>
          <h3>Drawing Paths</h3>
          <p>Click the path to add points along the curve. Corresponding points will populate in the parameter graphs.</p>
        </section>

        <section>
          <h3>Editing Motion</h3>
          <p>Adjust speed, curvature, and noise using the graph editors below the canvas.</p>
        </section>

        <section>
          <h3>TBD</h3>
          <p>IDK. lalalalala</p>
        </section>

        <div className="wiki-actions">
          <button onClick={() => {onReplayTutorialClick(); onClose();}}>Replay Tutorial</button>
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
};

export default WikiModal;
