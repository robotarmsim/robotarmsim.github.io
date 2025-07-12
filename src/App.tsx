//src/App.tsx

// import React from 'react';
import { useState, useEffect } from 'react';
import CanvasStage from './components/CanvasStage';
import DevMenu from './components/DevMenu';

export default function App() {
  const [devMenuOpen, setDevMenuOpen] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [numSegments, setNumSegments] = useState(5);
  const [totalDuration, setTotalDuration] = useState(5);


  const handleToggleMenu = () => {
    if (hasAccess) {
      setDevMenuOpen(!devMenuOpen);
    } else {
      const input = prompt('Enter dev password:');
      if (input === '1') {
        setHasAccess(true);
        setDevMenuOpen(true);
      } else {
        alert('Incorrect password.');
      }
    }
  };


  useEffect(() => {
    if (devMenuOpen) {
      document.body.classList.add('dev-menu-open');
    } else {
      document.body.classList.remove('dev-menu-open');
    }
  }, [devMenuOpen]);

  return (
    <>
      <div id="mainContent">
        <CanvasStage maxPoints={numSegments} />

        {/* put dev button in mainContent */}
        {!devMenuOpen && (
          <button id="dev-open" onClick={handleToggleMenu}>
            ☰ Dev
          </button>
        )}
      </div>

      <div id="dev-menu">
        <DevMenu
          isOpen={devMenuOpen}
          numSegments={numSegments}
          setNumSegments={setNumSegments}
          toggleOpen={() => setDevMenuOpen(!devMenuOpen)}
          onClose={() => setDevMenuOpen(false)}
          onDone={() => {
            console.log('[DevMenu] Done clicked');
            setDevMenuOpen(false);
          }}
          toggleRoboticLook={(enabled) => {
            console.log('Robotic Look:', enabled);
          }}
          totalDuration={totalDuration}
          setTotalDuration={setTotalDuration}
          
        />
      </div>
    </>
  );
}
