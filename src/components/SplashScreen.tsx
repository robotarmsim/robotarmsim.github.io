// components/SplashScreen.tsx
import React, { useState } from "react";

interface SplashProps {
  onContinue: (id?: string) => void;
}

const SplashScreen: React.FC<SplashProps> = ({ onContinue }) => {
  const [id, setId] = useState("");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-indigo-900 to-indigo-600">
      <div className="relative w-full max-w-3xl mx-6">
        {/* Decorative blobs */}
        <div className="absolute -top-12 -left-12 w-64 h-64 rounded-full blur-3xl opacity-30 bg-purple-400 animate-blob mix-blend-multiply"></div>
        <div className="absolute -bottom-12 -right-12 w-72 h-72 rounded-full blur-3xl opacity-30 bg-emerald-400 animate-blob animation-delay-2000 mix-blend-multiply"></div>

        <div className="relative bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-2xl shadow-xl text-center">
          <h1 className="text-4xl font-extrabold text-white mb-2">Robot Arm Simulator</h1>
          <p className="text-sm text-white/80 mb-6 max-w-xl mx-auto">
            Are you from Prolific? Paste your Participant ID below. If not, leave it blank.
          </p>

          <div className="flex items-center justify-center gap-3">
            <input
              value={id}
              onChange={(e) => setId(e.target.value)}
              placeholder="Optional ID"
              className="px-3 py-2 rounded-md bg-white/10 text-white placeholder-white/60 border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <button
              onClick={() => onContinue(id)}
              className="px-4 py-2 rounded-md bg-white text-indigo-700 font-semibold shadow hover:scale-[1.02] transition-transform"
            >
              Continue
            </button>
          </div>

          <p className="mt-6 text-xs text-white/60">Tip: You can skip the tutorial later from the start screen.</p>
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
