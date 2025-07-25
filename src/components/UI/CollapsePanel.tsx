// src/components/UI/CollapsePanel.tsx
import React, { useState } from 'react';

type CollapsePanelProps = {
  title: string;
  children: React.ReactNode;
};

export function CollapsePanel({ title, children }: CollapsePanelProps) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ border: '1px solid #aaa', borderRadius: 4, marginBottom: 10 }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          background: '#ddd',
          padding: '6px 12px',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        {title} {open ? '▾' : '▸'}
      </div>
      {open && <div style={{ padding: 12 }}>{children}</div>}
    </div>
  );
}
