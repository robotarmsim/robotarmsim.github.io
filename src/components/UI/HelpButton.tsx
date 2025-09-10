import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import WikiModal from './WikiModal';
import Tutorial from '../Tutorial';

interface HelpButtonProps {
  id?: string;
  onReplayTutorial: () => void;
}

const HelpButton: React.FC<HelpButtonProps> = ({ id }) => {
  const [wikiOpen, setWikiOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  return (
    <>
      <button
        className="help-button"
        onClick={() => setWikiOpen(true)}
        id={id}
        title="Help / Wiki"
      >
        <HelpCircle size={20} />
      </button>
      {wikiOpen && (
        <WikiModal
          onClose={() => setWikiOpen(false)}
          onReplayTutorialClick={() => {
            setWikiOpen(false);   // close wiki
            setTutorialOpen(true); // open tutorial
          }}
        />
      )}

      {/* Tutorial overlay */}
      {tutorialOpen && <Tutorial onComplete={() => setTutorialOpen(false)} />}
    </>
  );
};

export default HelpButton;
