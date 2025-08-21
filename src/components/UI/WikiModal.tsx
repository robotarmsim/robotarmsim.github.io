import React, { useEffect, useRef, useState } from 'react';

interface WikiModalProps {
  onClose: () => void;
  onReplayTutorialClick: () => void;
}

const WikiModal: React.FC<WikiModalProps> = ({ onClose, onReplayTutorialClick }) => {
  const contentRef = useRef<HTMLElement | null>(null);
  const tocRef = useRef<HTMLElement | null>(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const toc = tocRef.current;
    const container = contentRef.current;
    if (!toc || !container) return;

    const links = Array.from(toc.querySelectorAll('a')) as HTMLAnchorElement[];
    // build section refs from inside the content container
    const sections = links.map((a) => {
      const id = a.getAttribute('href')?.slice(1) || '';
      return container.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null;
    });

    // highlight active TOC entry based on container scroll
    function onContainerScroll() {
      if (!container) return;
      const top = container.scrollTop + 20;
      let activeIndex = 0;
      sections.forEach((sec, i) => {
        if (!sec) return;
        // offset relative to container
        const offset = sec.offsetTop;
        if (offset <= top) activeIndex = i;
      });
      links.forEach((l, i) => l.classList.toggle('active', i === activeIndex));
    }

    // smooth-scroll handler that scrolls the modal content container
    const clickRemovers: Array<() => void> = [];
    links.forEach((link) => {
      const handler = (e: Event) => {
        e.preventDefault();
        const id = link.getAttribute('href')?.slice(1) || '';
        const target = container.querySelector(`#${CSS.escape(id)}`) as HTMLElement | null;
        if (!target) return;
        // compute top relative to container and scroll smoothly
        const containerTop = container.getBoundingClientRect().top;
        const targetTop = target.getBoundingClientRect().top;
        const scrollOffset = targetTop - containerTop + container.scrollTop - 8;
        container.scrollTo({ top: scrollOffset, behavior: 'smooth' });
        // focus target for accessibility
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      };
      link.addEventListener('click', handler);
      // allow keyboard activation
      link.addEventListener('keydown', (ev: KeyboardEvent) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          link.click();
        }
      });
      clickRemovers.push(() => link.removeEventListener('click', handler));
    });

    container.addEventListener('scroll', onContainerScroll, { passive: true });
    onContainerScroll();

    return () => {
      container.removeEventListener('scroll', onContainerScroll);
      clickRemovers.forEach((r) => r());
    };
  }, []);

  // filter TOC entries by search term
  useEffect(() => {
    const toc = tocRef.current;
    if (!toc) return;
    const links = Array.from(toc.querySelectorAll('a')) as HTMLAnchorElement[];
    const q = search.trim().toLowerCase();
    links.forEach((l) => {
      const text = (l.textContent || '').toLowerCase();
      l.style.display = q === '' || text.includes(q) ? '' : 'none';
    });
  }, [search]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Robot Arm Simulator Help"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(2,6,12,0.96)', // much more opaque overlay
        padding: 20,
      }}
    >
      <style>{`
        :root{
          --bg:#0d1117;
          --panel:#071022; /* solid panel */
          --muted:#9aa7b2;
          --accent:#3ddc97;
          --accent-2:#6ee7b7;
          --card:#071122;
          --glass: rgba(255,255,255,0.12); /* heavier glass */
          --glass-2: rgba(255,255,255,0.16);
          --text:#e6eef3;
          --code-bg:#06101a;
          --max-width:1100px;
          --radius:12px;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
        }
        .help-shell{
          width:100%;
          max-width:var(--max-width);
          display:grid;
          grid-template-columns: 320px 1fr;
          gap:20px;
          align-items:start;
        }
        .sidebar{
          background: var(--panel);
          border-radius:var(--radius);
          padding:18px;
          box-shadow: 0 16px 48px rgba(2,6,12,0.75);
          position:sticky;
          top:28px;
          height:calc(80vh);
          overflow:auto;
          border: 1px solid rgba(255,255,255,0.08);
        }
        .brand{
          display:flex;
          gap:12px;
          align-items:center;
          margin-bottom:14px;
        }
        .logo{
          width:40px;
          height:40px;
          background:linear-gradient(135deg,var(--accent), var(--accent-2));
          border-radius:8px;
          display:grid;
          place-items:center;
          font-weight:700;
          color:#042018;
          box-shadow:0 10px 28px rgba(95,255,200,0.08);
        }
        .brand h1{font-size:15px;margin:0}
        .brand p{margin:0;font-size:12px;color:var(--muted)}
        .search{margin:12px 0;display:flex;gap:8px}
        .search input{
          flex:1;padding:8px 10px;background:var(--glass);border-radius:8px;border:1px solid rgba(255,255,255,0.08);color:var(--text);outline:none;
        }
        .search button{
          background:transparent;border:1px solid rgba(255,255,255,0.08);color:var(--muted);padding:8px 10px;border-radius:8px;cursor:pointer;
        }
        .toc{margin-top:8px;display:flex;flex-direction:column;gap:6px}
        .toc a{
          display:block;padding:10px 12px;border-radius:8px;color:var(--muted);text-decoration:none;font-size:14px;
        }
        .toc a:hover, .toc a.active{background:var(--glass-2);color:var(--text)}
        .content{
          background: #071021; /* solid content background */
          border-radius:var(--radius);
          padding:26px;
          min-height:60vh;
          box-shadow: 0 18px 60px rgba(2,6,12,0.55);
          border:1px solid rgba(255,255,255,0.06);
          overflow:auto;
          height:80vh;
        }
        .content h2{margin-top:0;font-size:20px;color:var(--text);margin-bottom:6px}
        .content h3{margin:18px 0 6px 0;font-size:16px;color:var(--text)}
        p{color:var(--muted);margin:8px 0}
        .card{background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02));border-radius:10px;padding:12px;border:1px solid rgba(255,255,255,0.05);margin:12px 0;}
        .quick-grid{display:grid;grid-template-columns: 1fr 1fr;gap:12px}
        ul{color:var(--muted); margin:8px 0; padding-left:18px}
        li{margin:6px 0}
        .controls{display:flex;gap:8px;flex-wrap:wrap;margin:12px 0 20px 0}
        .btn{background:linear-gradient(120deg, rgba(255,255,255,0.04), rgba(255,255,255,0.015));border:1px solid rgba(255,255,255,0.08);color:var(--text);padding:8px 12px;border-radius:9px;cursor:pointer;font-weight:600}
        .btn.ghost{background:transparent;color:var(--muted);border:1px solid rgba(255,255,255,0.07)}
        .badge{display:inline-block;background:rgba(255,255,255,0.06);padding:6px 8px;border-radius:8px;color:var(--muted);font-size:13px}
        pre{background:var(--code-bg);color:#c9f7e5;padding:12px;border-radius:8px;overflow:auto;font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, "Roboto Mono", monospace;font-size:13px;border:1px solid rgba(255,255,255,0.04)}
        .muted{color:var(--muted)}
        .note{font-size:13px;color:var(--muted);background:rgba(255,255,255,0.01);border-radius:8px;padding:8px;border:1px solid rgba(255,255,255,0.02)}
        details{background:transparent;border-radius:8px;padding:8px}
        details summary{cursor:pointer;list-style:none;outline:none;font-weight:600;color:var(--text)}
        @media (max-width:980px){
          .help-shell{grid-template-columns:1fr; padding:8px}
          .sidebar{position:relative; height:auto; order:2}
          .content{order:1; height:60vh}
          .quick-grid{grid-template-columns:1fr}
        }
        .modal-header{display:flex;gap:12px;align-items:center;justify-content:space-between;margin-bottom:12px}
        .close-btn{background:transparent;border:1px solid rgba(255,255,255,0.08);padding:8px 10px;border-radius:8px;color:var(--muted);cursor:pointer}
      `}</style>

      <div className="help-shell" role="main" style={{ background: 'transparent' }}>
        <aside className="sidebar" aria-label="Help navigation">
          <div className="brand">
            <div className="logo" aria-hidden>
              RA
            </div>
            <div>
              <h1>Robot Arm Help</h1>
              <p>Quick reference and tips</p>
            </div>
          </div>

          <div className="search" role="search" style={{ marginBottom: 8 }}>
            <input
              id="search-input"
              type="search"
              placeholder="Search help..."
              aria-label="Search help"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              id="clear"
              onClick={() => setSearch('')}
              aria-label="Clear search"
            >
              Clear
            </button>
          </div>

          <nav className="toc" id="toc" ref={tocRef} aria-label="Table of contents">
            <a href="#quick-start">Quick start</a>
            <a href="#interface-overview">Interface overview</a>
            <a href="#controls">Controls</a>
            <a href="#path-editing">Path editing</a>
            <a href="#pose-mode">Pose Mode</a>
            <a href="#zones">Zones</a>
            <a href="#graph-editors">Graph Editors</a>
            <a href="#saving-loading">Saving and exporting</a>
            <a href="#playback-testing">Playback and testing</a>
            <a href="#troubleshooting">Troubleshooting</a>
            <a href="#best-practices">Best practices</a>
            <a href="#faq">FAQ</a>
            <a href="#glossary">Glossary</a>
          </nav>

          <div style={{ marginTop: 14 }}>
            <div className="badge">Version: Help v1.0</div>
            <div style={{ marginTop: 10 }}>
              <button className="btn" onClick={onReplayTutorialClick} style={{ width: '100%' }}>
                Replay Tutorial
              </button>
              <button className="btn ghost" onClick={onClose} style={{ width: '100%', marginTop: 8 }}>
                Close Help
              </button>
            </div>
          </div>
        </aside>

        <article className="content" id="content" ref={contentRef} tabIndex={-1}>
          <div className="modal-header">
            <h2 id="quick-start">Quick start</h2>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" onClick={() => window.print()}>
                Print
              </button>
              <button className="close-btn" onClick={onClose} aria-label="Close help">
                Close
              </button>
            </div>
          </div>

          <div className="card">
            <p className="muted">Get up and running in seconds.</p>
            <div className="quick-grid">
              <div>
                <ul>
                  <li>Open the app and pick a canvas size if needed.</li>
                  <li>Click the canvas to add path points. The arm follows the points in order.</li>
                  <li>Click a point to move the arm to that pose.</li>
                </ul>
              </div>
              <div>
                <ul>
                  <li>Enter Pose Mode to refine elbow orientation by dragging the elbow indicator.</li>
                  <li>Add zones with the Zone tool for avoid or touch regions.</li>
                  <li>Use Graph Editors to tweak speed, curvature, and noise.</li>
                </ul>
              </div>
            </div>
          </div>

          <h3 id="interface-overview">Interface overview</h3>
          <p className="muted">What you will see and where to find common tools.</p>
          <ul>
            <li><strong>Canvas</strong> - Add points and watch the arm move.</li>
            <li><strong>Toolbar</strong> - Tools: Add Point, Move Point, Pose Mode, Zone tool, Play, Stop.</li>
            <li><strong>Right panels</strong> - Graph Editors and state controls.</li>
            {/* <li><strong>Dev Menu</strong> - Advanced toggles, import/export, logging.</li> */}
          </ul>

          <h3 id="controls">Basic controls</h3>
          <div className="card">
            <p className="muted">Mouse / Trackpad</p>
            <ul>
              <li>Left click - add or select a point depending on tool.</li>
              <li>Left drag - move a selected point or drag the elbow in Pose Mode.</li>
              <li>Right click - context menu for zones and points.</li>
              <li>Scroll - zoom. Space + drag - pan.</li>
            </ul>

            <p className="muted">Touch</p>
            <ul>
              <li>Tap - select. Long press + drag - move. Pinch - zoom. Two-finger drag - pan.</li>
            </ul>

            <p className="muted">Keyboard</p>
            <ul>
              <li>Space - Play / Pause. P - toggle Pose Mode. Z - toggle Zone tool.</li>
              <li>Delete - remove point or zone. Ctrl/Cmd + S - save.</li>
            </ul>
          </div>

          <h3 id="path-editing">Path editing basics</h3>
          <p className="muted">Quick rules for building solid paths.</p>
          <ul>
            <li>Add points to sketch a path. Points are followed in list order.</li>
            <li>Click to select, drag to move (unless Pose Mode locks points).</li>
            <li>Use Graph Editors to shape speed, curvature, and noise along the path.</li>
            <li>Tip: space out points sensibly to avoid jitter.</li>
          </ul>

          <h3 id="pose-mode">Pose Mode</h3>
          <p className="muted">Pose Mode lets you snap the arm to a point then choose elbow orientation.</p>

          <details>
            <summary>Workflow</summary>
            <div className="card">
              <ul>
                <li>Select a point, then enter Pose Mode. The arm will move the end effector to the point.</li>
                <li>An elbow indicator appears. Drag the elbow to adjust the elbow orientation.</li>
                <li>The end effector stays within a small tolerance radius while you edit.</li>
                <li>Release to lock the elbow for that point. Locked elbows are saved with the project.</li>
                <li>You can re-enter Pose Mode for the same point to change or unlock the elbow.</li>
              </ul>
            </div>
          </details>

          <details>
            <summary>Settings and tips</summary>
            <div className="card">
              <ul>
                <li>Tolerance radius controls how far the end effector may move during elbow edits. Try 4 to 10 pixels as a default.</li>
                <li>Auto-lock controls whether the elbow is saved automatically on release.</li>
                <li>If the elbow goes out of reach, the UI shows a visual cue and either snaps back or presents the nearest valid pose.</li>
                <li>Run the IK updates on RAF frames, not raw pointer events, for best performance.</li>
              </ul>
            </div>
          </details>

          <h3 id="zones">Zones</h3>
          <p className="muted">Zones are circular regions set to avoid or touch.</p>
          <ul>
            <li>Add a zone with the Zone tool. Click to set center then drag to size the radius.</li>
            <li>Right click a zone to rename, change radius numerically, toggle type, or delete.</li>
            <li>Zones glow red when violated or triggered depending on mode.</li>
          </ul>

          <h3 id="graph-editors">Graph Editors - speed, curvature, noise</h3>
          <p className="muted">Use graphical editors to shape motion between points.</p>
          <ul>
            <li>Drag nodes to change values at sampled points along the path.</li>
            <li>Smooth the graph for natural motion. Use sharp nodes for sudden behavior.</li>
            <li>Small speed deltas are better than big jumps to avoid abrupt motion.</li>
          </ul>

          <h3 id="saving-loading">Saving and exporting</h3>
          <p className="muted">Persist project state and export data.</p>
          <ul>
            <li>Save stores points, zones, elbow locks, and graph data.</li>
            <li>Export CSV includes columns: id, x, y, elbowX, elbowY, speed, curvature, locked.</li>
            <li>Auto-save can be enabled in Dev Menu.</li>
          </ul>

          <h3 id="playback-testing">Playback and testing</h3>
          <ul>
            <li>Play to animate the arm along the path. Use single-step or slow modes to inspect critical frames.</li>
            <li>Enable collision highlighting to show intersections with avoid zones.</li>
          </ul>

          <h3 id="troubleshooting">Troubleshooting - quick fixes</h3>
          <div className="card">
            <p className="muted"><strong>Arm does not move when I add a point</strong></p>
            <ul>
              <li>Make sure the point is in the path list and not locked. Check that the Play loop is running.</li>
            </ul>

            <p className="muted"><strong>Pose Mode elbow snaps back</strong></p>
            <ul>
              <li>The elbow may be outside reach. Move it closer or increase tolerance a bit.</li>
            </ul>

            <p className="muted"><strong>Zones not triggering</strong></p>
            <ul>
              <li>Check zone type and radius. Use single-step playback for debugging.</li>
            </ul>

            <p className="muted"><strong>Motion looks jittery</strong></p>
            <ul>
              <li>Reduce graph noise, merge very close path points, and check high-DPI scaling.</li>
            </ul>
          </div>

          <h3 id="best-practices">Best practices</h3>
          <ul>
            <li>Use fewer, meaningful points and polish motion with graphs.</li>
            <li>Use Pose Mode for critical poses that need a specific elbow orientation.</li>
            <li>Set zones early to force valid, collision-free paths.</li>
            <li>Preview often while editing.</li>
          </ul>

          <h3 id="faq">FAQ</h3>
          <div className="card">
            <p className="muted"><strong>Can I edit points while in Pose Mode?</strong> Points are visually locked during Pose Mode. Exit Pose Mode to move points normally.</p>
            <p className="muted"><strong>Do locked elbows export?</strong> Yes, locked elbows are included in saved projects and exports.</p>
            <p className="muted"><strong>Does Pose Mode work on touch?</strong> Yes. Long press the elbow indicator then drag to adjust.</p>
          </div>

          <h3 id="glossary">Glossary</h3>
          <ul>
            <li><strong>Point</strong> - a path control point the arm will visit.</li>
            <li><strong>End effector</strong> - the tool or tip at the end of the arm.</li>
            <li><strong>Elbow lock</strong> - a stored elbow position tied to a point.</li>
            <li><strong>Zone</strong> - circular area that is avoid or touch.</li>
            <li><strong>Tolerance radius</strong> - allowed movement for the end effector during elbow edits.</li>
          </ul>

          <div style={{ height: 28 }} />
          <p className="muted" style={{ fontSize: 13 }}>
            {/* Need this as a printable file or an in-app help modal? Click Print in your browser, or ask to export this as a PDF or markdown file. */}
          </p>
        </article>
      </div>
    </div>
  );
};

export default WikiModal;
