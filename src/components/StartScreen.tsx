// components/StartScreen.tsx
import React from "react";

interface StartScreenProps {
  participantId?: string | null;
  onStartTutorial: () => void;
  onSkipTutorial: () => void;
}

const StartScreen: React.FC<StartScreenProps> = ({ participantId, onStartTutorial, onSkipTutorial }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-800 to-indigo-700">
      <div className="bg-white/6 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl p-8 w-full max-w-2xl text-center">
        <h2 className="text-3xl font-bold text-white mb-2">Ready to begin?</h2>
        <p className="text-sm text-white/80 mb-6">
          {participantId ? `Welcome, ${participantId}!` : "Welcome! No ID provided."}
        </p>

        <div className="flex gap-3 justify-center">
          <button
            onClick={onStartTutorial}
            className="px-5 py-2 bg-white text-indigo-700 rounded-lg font-semibold shadow hover:scale-[1.02] transition-transform"
          >
            Start Tutorial
          </button>

          <button
            onClick={onSkipTutorial}
            className="px-5 py-2 bg-transparent border border-white/20 text-white rounded-lg hover:bg-white/5"
          >
            Skip Tutorial
          </button>
        </div>

        <p className="mt-6 text-xs text-white/60">If you want an overview later, click Help → Replay Tutorial.</p>
      </div>
    </div>
  );
};

export default StartScreen;
