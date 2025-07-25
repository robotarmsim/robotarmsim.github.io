// src/components/UI/PlayButton.tsx
// import React from 'react';

interface ButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export function Button({ onClick, disabled }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled} style={{ padding: '8px 16px', fontSize: 16 }}>
      Button
    </button>
  );
}
