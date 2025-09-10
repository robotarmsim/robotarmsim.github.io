import React, { useLayoutEffect, useRef, useState, useEffect } from "react";
import "./tutorial.css";

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface TutorialOverlayProps {
  highlight?: HighlightRect | string;
  title: string;
  text?: string;
  onNext: () => void;
  onSkip: () => void;
  showSkip?: boolean;
  showNext?: boolean;
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  highlight,
  title,
  text,
  onNext,
  onSkip,
  showSkip = true,
  showNext = true,
}) => {
  const popupRef = useRef<HTMLDivElement>(null);
  const [popupStyle, setPopupStyle] = useState<React.CSSProperties>({});
  const [arrowStyle, setArrowStyle] = useState<React.CSSProperties>({});

  useLayoutEffect(() => {
    if (highlight && typeof highlight !== "string") {
      const { top, left, width, height } = highlight;
      const popup = popupRef.current;

      if (popup) {
        const popupHeight = popup.offsetHeight;
        const below = top + height + 12; // place popup below target
        const above = top - popupHeight - 12; // place popup above target
        const popupTop =
          window.innerHeight - below > popupHeight ? below : Math.max(above, 12);

        setPopupStyle({
          position: "absolute",
          top: popupTop,
          left: left,
        });

        setArrowStyle({
          position: "absolute",
          top: popupTop < top ? top - 8 : top + height, // above or below
          left: left + width / 2 - 6,
        });
      }
    }
  }, [highlight]);

  useEffect(() => {
    const handleScroll = () => {
      if (highlight && typeof highlight !== "string") {
        const { top, left, width, height } = highlight;
        const popup = popupRef.current;
        if (!popup) return;

        const popupHeight = popup.offsetHeight;
        const below = top + height + 12;
        const above = top - popupHeight - 12;
        const popupTop =
          window.innerHeight - below > popupHeight ? below : Math.max(above, 12);

        setPopupStyle({
          position: "absolute",
          top: popupTop - window.scrollY,
          left: left,
        });

        setArrowStyle({
          position: "absolute",
          top:
            popupTop < top
              ? top - 8 - window.scrollY
              : top + height - window.scrollY,
          left: left + width / 2 - 6,
        });
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [highlight]);

  return (
    <div className="tutorial-overlay">
      {highlight && typeof highlight !== "string" && (
        <div
          className="tutorial-highlight"
          style={{
            top: highlight.top,
            left: highlight.left,
            width: highlight.width,
            height: highlight.height,
          }}
        />
      )}

      {/* Connector arrow */}
      {highlight && typeof highlight !== "string" && (
        <div className="tutorial-arrow" style={arrowStyle} />
      )}

      <div className="tutorial-popup" ref={popupRef} style={popupStyle}>
        <h3 className="tutorial-title">{title}</h3>
        {text && <p className="tutorial-text">{text}</p>}

        <div className="tutorial-buttons">
          {showSkip && (
            <button className="tutorial-skip" onClick={onSkip}>
              Skip
            </button>
          )}
          {showNext && (
            <button className="tutorial-next" onClick={onNext}>
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TutorialOverlay;
