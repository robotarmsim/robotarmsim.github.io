// components/Tutorial.tsx
import { useEffect, useRef, useState, useLayoutEffect } from "react";

interface TutorialProps {
    onComplete: () => void;
    participantId?: string | null;
}

interface Step {
    title: string;
    description: string;
    highlightSelector?: string;
}

const steps: Step[] = [
    {
        title: "Canvas",
        description:
            "This is where you'll draw a path for the robot arm. Left click to add points, right click to remove, and drag to adjust.",
        highlightSelector: "#just-canvas",
    },
    {
        title: "Curvature Graph",
        description:
            "This graph lets you control how curved the line is. Higher values = smoother arcs, lower values = straighter segments.",
        highlightSelector: "#curvaturegraph",
    },
    {
        title: "Speed Graph",
        description: "Adjust the robot's speed per segment here.",
        highlightSelector: "#speedgraph",
    },
    {
        title: "Randomness",
        description: "Add random offsets to simulate noise in the motion trajectory.",
        highlightSelector: "#noisegraph",
    },
    {
        title: "Prompt",
        description:
            "This bubble shows the prompt for the current task. Read it before you draw.",
        highlightSelector: ".task-header",
    },
    {
        title: "Progress",
        description: "Track your progress across tasks with the progress indicator.",
        highlightSelector: "#progress-bar",
    },
    {
        title: "Play",
        description: "Click Play to preview the arm moving along your path.",
        highlightSelector: "#play-button",
    },
    {
        title: "Clear",
        description: "Clear resets the path so you can start over.",
        highlightSelector: "#clear-points-button",
    },
    {
        title: "Next Task",
        description: "When you're happy with your design, click Next to continue.",
        highlightSelector: "#next-task-button",
    },
    {
        title: "Help",
        description: "Click Help anytime to replay this tutorial.",
        highlightSelector: "#help-button",
    },
    {
        title: "You're Ready",
        description: "That's it. Time to design some paths!",
    },
];

type Rect = { top: number; left: number; width: number; height: number };

export default function Tutorial({ onComplete, participantId }: TutorialProps) {
    const [index, setIndex] = useState(0);
    const step = steps[index];

    // highlight border
    const highlightRef = useRef<HTMLDivElement | null>(null);

    // blur layer strips
    const blurTopRef = useRef<HTMLDivElement | null>(null);
    const blurBottomRef = useRef<HTMLDivElement | null>(null);
    const blurLeftRef = useRef<HTMLDivElement | null>(null);
    const blurRightRef = useRef<HTMLDivElement | null>(null);

    // dim layer strips
    const dimTopRef = useRef<HTMLDivElement | null>(null);
    const dimBottomRef = useRef<HTMLDivElement | null>(null);
    const dimLeftRef = useRef<HTMLDivElement | null>(null);
    const dimRightRef = useRef<HTMLDivElement | null>(null);

    const rafRef = useRef<number | null>(null);
    const PADDING = 8;

    function getHighlightRect(selector?: string): Rect | null {
        if (!selector) return null;
        try {
            const el = document.querySelector(selector) as HTMLElement | null;
            if (!el) return null;
            const r = el.getBoundingClientRect(); // viewport coords
            return {
                top: Math.max(0, r.top - PADDING),
                left: Math.max(0, r.left - PADDING),
                width: Math.max(0, r.width + PADDING * 2),
                height: Math.max(0, r.height + PADDING * 2),
            };
        } catch {
            return null;
        }
    }

    function applyHighlightBorder(rect: Rect | null) {
        if (!highlightRef.current) return;
        if (!rect) {
            highlightRef.current.style.display = "none";
            return;
        }
        highlightRef.current.style.display = "block";
        highlightRef.current.style.top = `${rect.top}px`;
        highlightRef.current.style.left = `${rect.left}px`;
        highlightRef.current.style.width = `${rect.width}px`;
        highlightRef.current.style.height = `${rect.height}px`;
    }

    function styleStrip(
        el: HTMLDivElement | null,
        top: number,
        left: number,
        width: number,
        height: number
    ) {
        if (!el) return;
        el.style.top = `${top}px`;
        el.style.left = `${left}px`;
        el.style.width = `${width}px`;
        el.style.height = `${height}px`;
        el.style.display = width <= 0 || height <= 0 ? "none" : "block";
    }

    function coverAll(vw: number, vh: number) {
        // top covers everything, others hidden
        styleStrip(blurTopRef.current, 0, 0, vw, vh);
        styleStrip(blurBottomRef.current, 0, 0, 0, 0);
        styleStrip(blurLeftRef.current, 0, 0, 0, 0);
        styleStrip(blurRightRef.current, 0, 0, 0, 0);

        styleStrip(dimTopRef.current, 0, 0, vw, vh);
        styleStrip(dimBottomRef.current, 0, 0, 0, 0);
        styleStrip(dimLeftRef.current, 0, 0, 0, 0);
        styleStrip(dimRightRef.current, 0, 0, 0, 0);
    }

    function applyOverlayStrips(rect: Rect | null) {
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        if (!rect) {
            coverAll(vw, vh);
            return;
        }

        const topH = Math.max(0, rect.top);
        const bottomTop = Math.min(vh, rect.top + rect.height);
        const bottomH = Math.max(0, vh - bottomTop);
        const leftW = Math.max(0, rect.left);
        const rightLeft = Math.min(vw, rect.left + rect.width);
        const rightW = Math.max(0, vw - rightLeft);
        const middleH = Math.max(0, rect.height);

        // blur strips
        styleStrip(blurTopRef.current, 0, 0, vw, topH);
        styleStrip(blurBottomRef.current, bottomTop, 0, vw, bottomH);
        styleStrip(blurLeftRef.current, rect.top, 0, leftW, middleH);
        styleStrip(blurRightRef.current, rect.top, rightLeft, rightW, middleH);

        // dim strips
        styleStrip(dimTopRef.current, 0, 0, vw, topH);
        styleStrip(dimBottomRef.current, bottomTop, 0, vw, bottomH);
        styleStrip(dimLeftRef.current, rect.top, 0, leftW, middleH);
        styleStrip(dimRightRef.current, rect.top, rightLeft, rightW, middleH);
    }

    // animation loop to keep overlays synced to moving elements or scroll
    useEffect(() => {
        function loop() {
            const rect = getHighlightRect(step.highlightSelector);
            applyHighlightBorder(rect);
            applyOverlayStrips(rect);
            rafRef.current = requestAnimationFrame(loop);
        }
        rafRef.current = requestAnimationFrame(loop);
        return () => {
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, [index, step.highlightSelector]);

    // also update on resize for safety
    useLayoutEffect(() => {
        const onResize = () => {
            const rect = getHighlightRect(step.highlightSelector);
            applyHighlightBorder(rect);
            applyOverlayStrips(rect);
        };
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, [index, step.highlightSelector]);

    // keyboard support
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key === "Escape") onComplete();
            else if (e.key === "ArrowRight") setIndex(i => Math.min(i + 1, steps.length - 1));
            else if (e.key === "ArrowLeft") setIndex(i => Math.max(i - 1, 0));
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [onComplete]);

    return (
        <div className="fixed inset-0 z-[1000]">
            {/* Overlay container with two layers composed from 4 strips each */}
            <div className="absolute inset-0 z-[900] pointer-events-none">
                {/* Blur layer strips */}
                <div ref={blurTopRef} className="absolute inset-x-0 backdrop-blur-sm" />
                <div ref={blurBottomRef} className="absolute inset-x-0 backdrop-blur-sm" />
                <div ref={blurLeftRef} className="absolute backdrop-blur-sm" />
                <div ref={blurRightRef} className="absolute backdrop-blur-sm" />

                {/* Dim layer strips */}
                <div ref={dimTopRef} className="absolute inset-x-0 bg-black/60" />
                <div ref={dimBottomRef} className="absolute inset-x-0 bg-black/60" />
                <div ref={dimLeftRef} className="absolute bg-black/60" />
                <div ref={dimRightRef} className="absolute bg-black/60" />
            </div>

            {/* Tutorial card */}
            <div className="absolute left-1/2 top-12 -translate-x-1/2 w-[min(720px,92%)] z-[1030]">
                <div className="bg-white rounded-2xl p-6 shadow-2xl">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="text-2xl font-bold text-slate-800">{steps[index].title}</h3>
                            <p className="mt-2 text-sm text-slate-600">{steps[index].description}</p>
                            {participantId && (
                                <p className="mt-3 text-xs text-slate-400">Participant ID: {participantId}</p>
                            )}
                        </div>

                        <div className="flex flex-col items-end gap-2">
                            <div className="text-sm text-slate-500">
                                Step {index + 1} / {steps.length}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setIndex(i => Math.max(i - 1, 0))}
                                    disabled={index === 0}
                                    className="px-3 py-1 rounded bg-slate-100 disabled:opacity-50"
                                >
                                    Back
                                </button>
                                <button
                                    onClick={() => {
                                        if (index >= steps.length - 1) onComplete();
                                        else setIndex(i => i + 1);
                                    }}
                                    className="px-3 py-1 rounded bg-indigo-600 text-white"
                                >
                                    {index === steps.length - 1 ? "Finish" : "Next"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Highlight outline */}
            <div
                ref={highlightRef}
                className="pointer-events-none absolute border-4 border-yellow-400 rounded-lg shadow-lg transition-all duration-150 z-[920]"
                style={{ display: "none" }}
            />

            {/* Tip */}
            <div className="absolute bottom-8 left-0 right-0 flex justify-center">
                <div className="bg-white/6 text-sm text-white/80 px-4 py-2 rounded-full backdrop-blur-md border border-white/10 z-[1040]">
                    Tip: press Esc to close this tutorial at any time
                </div>
            </div>
        </div>
    );
}
