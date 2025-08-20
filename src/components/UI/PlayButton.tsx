// src/components/UI/PlayButton.tsx
// import React from 'react';

interface PlayButtonProps {
  onClick: () => void;
  id?: string;
  disabled?: boolean;
}

export function PlayButton({ onClick, id, disabled }: PlayButtonProps) {
  return (
    <button onClick={onClick} id={id} disabled={disabled}>
      Play
    </button>
  );
}
