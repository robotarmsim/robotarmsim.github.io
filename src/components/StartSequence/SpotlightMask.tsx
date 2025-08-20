import React from "react";

type Props = {
  rect: DOMRect | null;
  padding?: number;
  radius?: number;
};

export function SpotlightMask({ rect, padding = 12, radius = 12 }: Props) {
  if (!rect) return null;

  const style: React.CSSProperties = {
    top: rect.top - padding,
    left: rect.left - padding,
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
    borderRadius: radius,
    boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
  };

  return <div className="ts-hole" style={style} />;
}
