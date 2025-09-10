// src/components/UI/PlayButton.tsx
// import React from 'react';

interface PlayButtonProps {
  onClick: () => void;
  id?: string;
  className?: string;
  disabled?: boolean;
}

export function PlayButton({ onClick, id, className, disabled }: PlayButtonProps) {
  return (
    <button type="button" onClick={onClick} id={id} className={className} disabled={disabled}>
      Play
    </button>
  );
}
