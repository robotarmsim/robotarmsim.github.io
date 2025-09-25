import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import WikiModal from './WikiModal';
import Tutorial from '../Tutorial';
import ParticipantHelp from './ParticipantHelp';

interface HelpButtonProps {
  id?: string;
  onReplayTutorial: () => void;
  isOperator?: boolean; // NEW
}

const HelpButton: React.FC<HelpButtonProps> = ({ id, isOperator = false }) => {
  //const [wikiOpen, setWikiOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  return (
    <>
      <button
        className="help-button"
        //onClick={() => setWikiOpen(true)}
        onClick={() => setHelpOpen(true)}
        id={id}
        title="Help / Wiki"
      >
        <HelpCircle size={20} />
      </button>
      {helpOpen && (
        isOperator ? (
          <WikiModal
            onClose={() => setHelpOpen(false)}
            onReplayTutorialClick={() => {
              setHelpOpen(false);
              setTutorialOpen(true);
            }}
          />
        ) : (
          <ParticipantHelp
            onClose={() => setHelpOpen(false)}
            onReplayTutorial={() => {
              setHelpOpen(false);
              setTutorialOpen(true);
            }}
          />
        )
      )}
      {/* {wikiOpen && (
        <WikiModal
          onClose={() => setWikiOpen(false)}
          onReplayTutorialClick={() => {
            setWikiOpen(false);   // close wiki
            setTutorialOpen(true); // open tutorial
          }}
        />
      )} */}

      {/* Tutorial overlay */}
      {tutorialOpen && <Tutorial onComplete={() => setTutorialOpen(false)} />}
    </>
  );
};

export default HelpButton;
