// src/components/UI/PlayButton.tsx
// import React from 'react';

interface PlayButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function PlayButton({ onClick, disabled }: PlayButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: '8px 16px', fontSize: 16 }}>
      Play
    </button>
  );
}
