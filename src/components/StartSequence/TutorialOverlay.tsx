// TutorialOverlay.tsx
import React, { useLayoutEffect, useRef, useState, useEffect } from "react";
import "./tutorial.css";

type Option = string | { label: string; value?: string };

interface TutorialOverlayProps {
  highlight?: string | { top: number; left: number; width: number; height: number };
  title: string;
  text?: string;
  options?: Option[];
  skipButton?: boolean;
  type?: string;
  buttonText?: string;
  centered?: boolean;
  onNext: (value?: string) => void;
  onSelect?: (val: string) => void;
  onSkip: () => void;
  setHasProlific?: (v: boolean) => void;
  setProlificID?: (id: string) => void;
  showProlificInput?: boolean;
  setShowProlificInput?: (v: boolean) => void;
  prolificID?: string;
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  highlight,
  title,
  text,
  options,
  skipButton = true,
  buttonText = "Next",
  centered = false,
  onNext,
  onSelect,
  onSkip,
  setHasProlific,
  setProlificID,
  showProlificInput,
  setShowProlificInput,
  //prolificID,
}) => {
  const [prolificIDInput, setProlificIDInput] = useState("");
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);
  const [side, setSide] = useState<"right" | "left" | "top" | "bottom">("right");

  const prolificInputRef = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    if (showProlificInput) {
      // wait a tick to ensure input is in DOM
      setTimeout(() => prolificInputRef.current?.focus(), 30);
    }
  }, [showProlificInput]);

  const normalizedOptions = (options || []).map((o) =>
    typeof o === "string" ? { label: o, value: o } : { label: o.label, value: o.value ?? o.label }
  );

  const computeRect = () => {
    if (!highlight) return null;
    if (typeof highlight === "string") {
      const el = document.querySelector(highlight);
      if (el) return el.getBoundingClientRect();
    } else {
      return {
        ...highlight,
        right: highlight.left + highlight.width,
        bottom: highlight.top + highlight.height,
        x: highlight.left,
        y: highlight.top,
        toJSON: () => { },
      } as DOMRect;
    }
    return null;
  };

  useLayoutEffect(() => {
    const update = () => {
      const r = computeRect();
      if (r) setRect(r);
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [highlight]);

  useLayoutEffect(() => {
    if (!rect) {
      setPopupPos(null);
      return;
    }

    const measure = () => {
      const popup = popupRef.current;
      const popupW = popup ? popup.offsetWidth : 300;
      const popupH = popup ? popup.offsetHeight : 140;
      const gap = 16;
      const margin = 12;

      const rightSpace = window.innerWidth - rect.right;
      const leftSpace = rect.left;
      const topSpace = rect.top;
      const bottomSpace = window.innerHeight - rect.bottom;

      let chosen: "right" | "left" | "top" | "bottom" = "right";
      if (rightSpace >= popupW + gap) chosen = "right";
      else if (leftSpace >= popupW + gap) chosen = "left";
      else if (bottomSpace >= popupH + gap) chosen = "bottom";
      else if (topSpace >= popupH + gap) chosen = "top";
      else {
        const maxSpace = Math.max(rightSpace, leftSpace, bottomSpace, topSpace);
        if (maxSpace === rightSpace) chosen = "right";
        else if (maxSpace === leftSpace) chosen = "left";
        else if (maxSpace === bottomSpace) chosen = "bottom";
        else chosen = "top";
      }

      let top = 0;
      let left = 0;

      if (chosen === "right") {
        top = rect.top + rect.height / 2 - popupH / 2;
        left = rect.right + gap;
      } else if (chosen === "left") {
        top = rect.top + rect.height / 2 - popupH / 2;
        left = rect.left - popupW - gap;
      } else if (chosen === "bottom") {
        top = rect.bottom + gap;
        left = rect.left + rect.width / 2 - popupW / 2;
      } else {
        top = rect.top - popupH - gap;
        left = rect.left + rect.width / 2 - popupW / 2;
      }

      if (top < margin) top = margin;
      if (top + popupH > window.innerHeight - margin) top = window.innerHeight - popupH - margin;
      if (left < margin) left = margin;
      if (left + popupW > window.innerWidth - margin) left = window.innerWidth - popupW - margin;

      setPopupPos({ top, left });
      setSide(chosen);
    };

    measure();
    const t = window.setTimeout(measure, 40);
    return () => window.clearTimeout(t);
  }, [rect, title, text, JSON.stringify(normalizedOptions)]);

  // When showProlificInput is true we render only the input block (with Cancel).
  // Otherwise we render the normal option buttons.
  const handleOptionClick = (opt: { label: string; value?: string }) => {
    const val = opt.value ?? opt.label;
    if (onSelect) onSelect(val);
  };

  return (
    <>
      {rect && (
        <div
          className="tutorial-backdrop"
          style={{
            WebkitMask: `radial-gradient(
            circle 0 at ${rect.left + rect.width / 2}px ${rect.top + rect.height / 2}px,
            transparent 98%,
            black 100%
          )`,
          }}
        />
      )}

      {rect && (
        <div
          className="tutorial-highlight-rect"
          style={{
            top: rect.top,
            left: rect.left,
            width: rect.width,
            height: rect.height,
          }}
        />
      )}

      <div
        ref={popupRef}
        className={`tutorial-popup ${centered
          ? "tutorial-popup-centered"
          : !rect && normalizedOptions.length > 0
            ? "tutorial-popup-centered"
            : `arrow-${side}`
          }`}
        style={{
          top: centered || !rect ? "50%" : popupPos?.top,
          left: centered || !rect ? "50%" : popupPos?.left,
          transform: centered || !rect ? "translate(-50%,-50%)" : undefined,
        }}
      >
        <div className="tutorial-popup-inner">
          <h3 className="tutorial-title">{title}</h3>
          {text && <div className="tutorial-text">{text}</div>}

          {/* If the parent signalled we should show Prolific input, render only the input UI */}
          {showProlificInput ? (
            <div style={{ marginTop: 12 }}>
              <div className="tutorial-prolific-input">
                <input
                  ref={prolificInputRef}
                  type="text"
                  placeholder="Enter your Prolific ID"
                  value={prolificIDInput}
                  onChange={(e) => setProlificIDInput(e.target.value)}
                />
                <button
                  onClick={() => {
                    const trimmed = prolificIDInput.trim();
                    if (!trimmed) return;
                    setProlificID?.(trimmed);
                    setHasProlific?.(true);
                    onNext(trimmed); // advance parent
                  }}
                >
                  Continue
                </button>
                <button
                  onClick={() => {
                    // cancel back to options (parent owns showProlificInput)
                    setShowProlificInput?.(false);
                    setProlificIDInput("");
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : normalizedOptions.length > 0 ? (
            <div className="tutorial-options">
              {normalizedOptions.map((opt) => (
                <button
                  key={opt.value ?? opt.label}
                  className="tutorial-option"
                  onClick={() => handleOptionClick(opt)}
                >
                  {opt.label}
                </button>
              ))}

              {skipButton && (
                <button className="tutorial-skip" onClick={onSkip}>
                  Skip
                </button>
              )}
            </div>
          ) : (
            <div className="tutorial-actions">
              <button className="tutorial-next" onClick={() => onNext()}>
                {buttonText}
              </button>
              {skipButton && (
                <button className="tutorial-skip" onClick={onSkip}>
                  Skip
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default TutorialOverlay;
