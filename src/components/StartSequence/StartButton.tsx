import type { ReactNode } from "react";
import './tutorial.css';

interface StartButtonProps {
  children: ReactNode;
  onClick: () => void;
}

export function StartButton({ children, onClick }: StartButtonProps) {
  return (
    <button className="start-button" onClick={onClick}>
      {children}
    </button>
  );
}
