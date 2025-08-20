
/**
 * Props for the TutorialOverlay component.
 *
 * @property highlight - CSS selector string or an object specifying the highlight rectangle (top, left, width, height).
 * @property title - Title text displayed in the overlay.
 * @property text - Optional descriptive text displayed below the title.
 * @property options - Optional array of selectable options, either as strings or objects with label and value.
 * @property onNext - Callback invoked when the "Next" button is clicked or an option is selected.
 * @property onSelect - Optional callback invoked when an option is selected.
 * @property onSkip - Callback invoked when the "Skip" button is clicked.
 * @property skipButton - Whether to show the "Skip" button (default: true).
 * @property type - Optional type string for custom usage.
 * @property buttonText - Text for the "Next" button (default: "Next").
 * @property centered - Whether to center the popup regardless of highlight.
 */

/**
 * TutorialOverlay component displays a guided overlay with highlight, title, text, options, and navigation actions.
 * It positions itself relative to a highlighted element or centered, and supports option selection and skipping.
 * For the tasksize options, TutorialOverlay just tells the parent which option was clicked via onNext(val) or onSelect(val).
 * 
 * @param props - {@link TutorialOverlayProps}
 * @returns React element for the tutorial overlay.
 */
import React, { useLayoutEffect, useRef, useState } from "react";
import "./tutorial.css";

type Option = string | { label: string; value?: string };

interface TutorialOverlayProps {
  highlight?: string | { top: number; left: number; width: number; height: number };
  title: string;
  text?: string;
  options?: Option[];
  onNext: (value?: string) => void;
  onSelect?: (val: string) => void;
  onSkip: () => void;
  skipButton?: boolean;
  type?: string;
  buttonText?: string;
  centered?: boolean;
}

const TutorialOverlay: React.FC<TutorialOverlayProps> = ({
  highlight,
  title,
  text,
  options,
  onNext,
  onSelect,
  onSkip,
  skipButton = true,
  buttonText = "Next",
  centered = false,
}) => {
  const popupRef = useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);
  const [side, setSide] = useState<"right" | "left" | "top" | "bottom">("right");

  // normalize options into objects {label, value}
  const normalizedOptions = (options || []).map((o) =>
    typeof o === "string" ? { label: o, value: o } : { label: o.label, value: o.value ?? o.label }
  );

  // helper: compute highlight rect
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

  // measure highlight rect on mount, scroll, resize
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

  // Measure popup and pick side + position
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

      // clamp to viewport
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

  const handleOptionClick = (opt: { label: string; value?: string }) => {
    const val = opt.value ?? opt.label;
    if (onSelect) onSelect(val);
    onNext(val);
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
            ? "tutorial-popup-centered" // 👈 force center
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

          {normalizedOptions.length > 0 ? (
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
