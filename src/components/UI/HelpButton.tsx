import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import WikiModal from './WikiModal';

interface HelpButtonProps {
  id?: string;
  onReplayTutorial: () => void;
}

const HelpButton: React.FC<HelpButtonProps> = ({ id, onReplayTutorial }) => {
  const [wikiOpen, setWikiOpen] = useState(false);

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
          onReplayTutorialClick={onReplayTutorial}
        />
      )}
    </>
  );
};

export default HelpButton;
