import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import useAuthStore from "../store/authStore";
import { BUILD_PHASES } from "../components/build/phases";
import BuildHeader from "../components/build/BuildHeader";
import TheoryPanel from "../components/build/TheoryPanel";
import CodeEditor  from "../components/build/CodeEditor";
import PhaseTabs   from "../components/build/PhaseTabs";
import Navbar from "../components/Navbar";
import PanelWindow from "../components/PanelWindow";
import LivePanelWindow from "../components/LivePanelWindow";
import { useResponsive } from "../hooks/useResponsive";

function initWorkspace(phase) {
  const contents = {};
  (phase.workspaceFiles || []).forEach(f => { contents[f.name] = f.content; });
  return contents;
}

export default function BuildPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user  = useAuthStore(s => s.user);
  const { isMobile, isMobileOrTablet } = useResponsive();

  const [activePhase, setActivePhase] = useState(0);
  const [activeTab,   setActiveTab]   = useState("structure");
  const [mode,        setMode]        = useState("sandbox");
  const [mobileMode,    setMobileMode]    = useState("theory"); // "theory" | "code"
  const [learnSection,  setLearnSection]  = useState("structure"); // "structure" | "steps" | "tips"

  const [initialOpenFileId, setInitialOpenFileId] = useState(null);
  const [livePanels, setLivePanels] = useState({});

  const [workspaceContents, setWorkspaceContents] = useState(
    () => initWorkspace(BUILD_PHASES[0])
  );
  const [activeFile, setActiveFile] = useState(
    BUILD_PHASES[0].workspaceFiles?.[0]?.name ?? ""
  );

  const phase = BUILD_PHASES[activePhase];

  function selectPhase(idx) {
    const nextPhase = BUILD_PHASES[idx];
    setActivePhase(idx);
    setWorkspaceContents(initWorkspace(nextPhase));
    setActiveFile(nextPhase.workspaceFiles?.[0]?.name ?? "");
    setActiveTab("structure");
  }

  function handleOpenLivePanel(panelName) {
    setLivePanels(prev => ({ ...prev, [panelName]: true }));
  }
  function handleCloseLivePanel(panelName) {
    setLivePanels(prev => ({ ...prev, [panelName]: false }));
  }

  useEffect(() => {
    const state = location.state;
    if (state?.phaseId && state?.fileId) {
      const idx = BUILD_PHASES.findIndex(p => p.id === state.phaseId);
      if (idx >= 0) {
        selectPhase(idx);
        setInitialOpenFileId(state.fileId);
      }
      window.history.replaceState({}, document.title);
    }
  }, []);

  useEffect(() => {
    function handleOpenPanelEvent(e) {
      handleOpenLivePanel(e.detail?.title || "Panel");
    }
    window.addEventListener("open-live-panel", handleOpenPanelEvent);
    return () => window.removeEventListener("open-live-panel", handleOpenPanelEvent);
  }, []);

  // ── Shared nav button style ─────────────────────────────────────
  const navBtn = (disabled) => ({
    background:   "transparent",
    border:       `1px solid ${disabled ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.15)"}`,
    borderRadius: "6px",
    color:        disabled ? "rgba(255,255,255,0.18)" : "#e2eeff",
    cursor:       disabled ? "not-allowed" : "pointer",
    fontFamily:   "'JetBrains Mono',monospace",
    fontSize:     "13px",
    fontWeight:   700,
    padding:      "0 10px",
    height:       "32px",
    flexShrink:   0,
    display:      "flex",
    alignItems:   "center",
  });

  // ── Shared editor/theory props ──────────────────────────────────
  const editorProps = {
    phase, workspaceContents, setWorkspaceContents,
    activeFile, setActiveFile, navigate,
    disabled: !user, mode,
    initialOpenFileId,
    onInitialFileOpened: () => setInitialOpenFileId(null),
  };

  // ── Auth lock overlay ───────────────────────────────────────────
  const authLock = !user && (
    <div style={{
      position:"absolute", inset:0, zIndex:10,
      display:"flex", flexDirection:"column", justifyContent:"center",
      alignItems:"center", gap:"16px", padding:"24px",
      background:"rgba(4,3,15,0.96)", color:"#e2eeff", textAlign:"center",
    }}>
      <div style={{ fontSize:"40px" }}>🔒</div>
      <h2 style={{ margin:0, fontSize: isMobile ? "22px" : "28px" }}>Build access locked</h2>
      <p style={{ maxWidth:"400px", color:"#94a3b8", fontSize: isMobile ? "13px" : "14px" }}>
        Sign in or sign up to unlock the interactive build experience and save your progress.
      </p>
      <div style={{ display:"flex", gap:"12px", flexWrap:"wrap", justifyContent:"center" }}>
        <button onClick={() => navigate("/signin")} style={{ borderRadius:"999px", background:"#2563eb", color:"#fff", padding: isMobile ? "10px 20px" : "12px 22px", border:"none", cursor:"pointer", fontWeight:600 }}>
          Sign In
        </button>
        <button onClick={() => navigate("/signup")} style={{ borderRadius:"999px", background:"#0f766e", color:"#fff", padding: isMobile ? "10px 20px" : "12px 22px", border:"none", cursor:"pointer", fontWeight:600 }}>
          Sign Up
        </button>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════════
  // MOBILE LAYOUT
  // ════════════════════════════════════════════════════════════════
  if (isMobile) {
    return (
      <div style={{
        display:"flex", flexDirection:"column",
        height:"100vh", background:"#04030f",
        color:"#e2eeff", overflow:"hidden",
        fontFamily:"'Space Grotesk',sans-serif",
      }}>
        <Navbar />

        {/* ── Phase navigation row ── */}
        <div style={{
          display:"flex", alignItems:"center", gap:"8px",
          padding:"8px 12px",
          background:"rgba(5,8,18,0.95)",
          borderBottom:"1px solid rgba(255,255,255,0.06)",
          flexShrink:0,
        }}>
          <button
            style={navBtn(activePhase <= 0)}
            onClick={() => activePhase > 0 && selectPhase(activePhase - 1)}
          >←</button>

          <div style={{ position:"relative", flex:1, minWidth:0 }}>
            <div style={{
              position:"absolute", left:"10px", top:"50%", transform:"translateY(-50%)",
              width:6, height:6, borderRadius:"50%",
              background: phase.color, boxShadow:`0 0 6px ${phase.color}`,
              pointerEvents:"none", zIndex:1,
            }}/>
            <select
              value={activePhase}
              onChange={e => selectPhase(Number(e.target.value))}
              style={{
                width:"100%", height:"32px",
                background:"rgba(255,255,255,0.04)",
                border:`1px solid ${phase.color}55`,
                borderRadius:"8px",
                color: phase.color,
                fontFamily:"'JetBrains Mono',monospace",
                fontSize:"11px", fontWeight:700,
                paddingLeft:"22px", paddingRight:"8px",
                outline:"none", cursor:"pointer",
                appearance:"none", WebkitAppearance:"none",
              }}
            >
              {BUILD_PHASES.map((p, i) => (
                <option key={p.id} value={i} style={{ background:"#04030f", color:"#e2eeff" }}>
                  {p.num} — {p.label.split(" — ")[0]}
                </option>
              ))}
            </select>
          </div>

          <button
            style={navBtn(activePhase >= BUILD_PHASES.length - 1)}
            onClick={() => activePhase < BUILD_PHASES.length - 1 && selectPhase(activePhase + 1)}
          >→</button>
        </div>

        {/* ── Row 2: Theory / Editor toggle ── */}
        <div style={{
          display:"flex", gap:"8px", padding:"6px 12px",
          background:"rgba(4,3,15,0.92)",
          borderBottom:"1px solid rgba(255,255,255,0.05)",
          flexShrink:0,
        }}>
          {[
            { value:"theory", label:"📚 Theory", color: phase.color, border: `${phase.color}66`, bg: `${phase.color}18` },
            { value:"code",   label:"💻 Editor",  color: "#818cf8",   border: "#4f46e5",          bg: "rgba(79,70,229,0.18)" },
          ].map(opt => {
            const active = mobileMode === opt.value;
            return (
              <button key={opt.value} onClick={() => setMobileMode(opt.value)} style={{
                flex:1, height:"32px",
                border:`1px solid ${active ? opt.border : "rgba(255,255,255,0.08)"}`,
                borderRadius:"8px",
                background: active ? opt.bg : "transparent",
                color: active ? opt.color : "rgba(255,255,255,0.4)",
                fontFamily:"'JetBrains Mono',monospace",
                fontSize:"11px", fontWeight: active ? 700 : 400,
                cursor:"pointer", transition:"all 0.15s",
              }}>{opt.label}</button>
            );
          })}
        </div>

        {/* ── Row 3: Section nav (Theory) / Sandbox+Pipeline (Editor) ── */}
        {mobileMode === "code" && (
          <div style={{
            display:"flex", gap:"6px", padding:"6px 12px",
            background:"rgba(4,3,15,0.85)",
            borderBottom:"1px solid rgba(255,255,255,0.04)",
            flexShrink:0,
          }}>
            {["sandbox","pipeline"].map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                flex:1, height:"26px",
                border:`1px solid ${mode === m ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.06)"}`,
                borderRadius:"6px",
                background: mode === m
                  ? (m === "pipeline" ? "#4f46e5" : "rgba(255,255,255,0.08)")
                  : "transparent",
                color: mode === m ? "#fff" : "rgba(255,255,255,0.35)",
                fontFamily:"'JetBrains Mono',monospace",
                fontSize:"10px", fontWeight: mode === m ? 700 : 400,
                cursor:"pointer", textTransform:"capitalize",
                transition:"all 0.15s",
              }}>{m}</button>
            ))}
          </div>
        )}
        {mobileMode === "theory" && (
          <div style={{
            padding:"6px 12px",
            background:"rgba(4,3,15,0.85)",
            borderBottom:"1px solid rgba(255,255,255,0.04)",
            flexShrink:0,
          }}>
            <div style={{ position:"relative" }}>
              <div style={{
                position:"absolute", left:"10px", top:"50%", transform:"translateY(-50%)",
                width:5, height:5, borderRadius:"50%",
                background: phase.color, boxShadow:`0 0 5px ${phase.color}`,
                pointerEvents:"none", zIndex:1,
              }}/>
              <select
                value={learnSection}
                onChange={e => setLearnSection(e.target.value)}
                style={{
                  width:"100%", height:"28px",
                  background:"rgba(255,255,255,0.03)",
                  border:`1px solid ${phase.color}33`,
                  borderRadius:"7px",
                  color: phase.color,
                  fontFamily:"'JetBrains Mono',monospace",
                  fontSize:"11px", fontWeight:700,
                  paddingLeft:"22px", paddingRight:"8px",
                  outline:"none", cursor:"pointer",
                  appearance:"none", WebkitAppearance:"none",
                }}
              >
                <option value="structure" style={{ background:"#04030f", color:"#e2eeff" }}>📋 Structure</option>
                <option value="steps"     style={{ background:"#04030f", color:"#e2eeff" }}>📍 Steps</option>
                <option value="tips"      style={{ background:"#04030f", color:"#e2eeff" }}>💡 Tips</option>
              </select>
            </div>
          </div>
        )}

        {/* ── Content area ── */}
        {(() => {
          return (
            <div style={{ flex:1, minHeight:0, overflow:"hidden", display:"flex", flexDirection:"column", position:"relative" }}>
              {authLock}
              {mobileMode === "theory" ? (
                <div style={{ flex:1, minHeight:0, overflow:"hidden", display:"flex", flexDirection:"column" }}>
                  <TheoryPanel phase={phase} activeTab={learnSection} setActiveTab={() => {}} />
                </div>
              ) : (
                <div style={{ flex:1, minHeight:0, overflow:"hidden", display:"flex", flexDirection:"column" }}>
                  <CodeEditor {...editorProps} />
                </div>
              )}
            </div>
          );
        })()}
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════
  // DESKTOP / TABLET LAYOUT (unchanged)
  // ════════════════════════════════════════════════════════════════
  return (
    <div style={{
      display:"flex", flexDirection:"column",
      height:"100vh", background:"#04030f",
      color:"#e2eeff", overflow:"hidden",
      fontFamily:"'Space Grotesk',sans-serif",
    }}>
      <Navbar />
      <BuildHeader phase={phase} mode={mode} onToggleMode={setMode} />
      <PhaseTabs phases={BUILD_PHASES} activePhase={activePhase} selectPhase={selectPhase} />

      <div style={{
        display:"grid",
        gridTemplateColumns: isMobileOrTablet ? "1fr" : "1fr 1fr",
        flex:1,
        overflow: isMobileOrTablet ? "auto" : "hidden",
        position:"relative",
      }}>
        {authLock}

        <PanelWindow title="📚 THEORY REFERENCE" height="auto">
          <TheoryPanel phase={phase} activeTab={activeTab} setActiveTab={setActiveTab} />
        </PanelWindow>

        <PanelWindow title="💻 CODE EDITOR" height="auto">
          <CodeEditor {...editorProps} />
        </PanelWindow>

        <LivePanelWindow
          title="📚 THEORY REFERENCE"
          open={livePanels["THEORY REFERENCE"] || false}
          onClose={() => handleCloseLivePanel("THEORY REFERENCE")}
        >
          <TheoryPanel phase={phase} activeTab={activeTab} setActiveTab={setActiveTab} />
        </LivePanelWindow>

        <LivePanelWindow
          title="💻 CODE EDITOR"
          open={livePanels["CODE EDITOR"] || false}
          onClose={() => handleCloseLivePanel("CODE EDITOR")}
        >
          <CodeEditor {...editorProps} />
        </LivePanelWindow>
      </div>
    </div>
  );
}
