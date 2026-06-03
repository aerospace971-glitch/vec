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

function initWorkspace(phase) {
  const contents = {};
  (phase.workspaceFiles || []).forEach(f => { contents[f.name] = f.content; });
  return contents;
}

export default function BuildPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const user  = useAuthStore(s => s.user);

  const [activePhase, setActivePhase] = useState(0);
  const [activeTab,   setActiveTab]   = useState("structure");
  const [mode,        setMode]        = useState("sandbox");

  const [initialOpenFileId, setInitialOpenFileId] = useState(null);

  // Live panel windows state
  const [livePanels, setLivePanels] = useState({});

  // Multi-file workspace state
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

  // Handle opening live panels
  function handleOpenLivePanel(panelName) {
    setLivePanels(prev => ({ ...prev, [panelName]: true }));
  }

  // Handle closing live panels
  function handleCloseLivePanel(panelName) {
    setLivePanels(prev => ({ ...prev, [panelName]: false }));
  }

  // Open file from dashboard navigation state
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

  // Listen for custom events to open live panels
  useEffect(() => {
    function handleOpenPanelEvent(e) {
      const panelName = e.detail?.title || "Panel";
      handleOpenLivePanel(panelName);
    }
    window.addEventListener("open-live-panel", handleOpenPanelEvent);
    return () => window.removeEventListener("open-live-panel", handleOpenPanelEvent);
  }, []);

  return (
    <div style={{
      display:       "flex",
      flexDirection: "column",
      height:        "100vh",
      background:    "#04030f",
      color:         "#e2eeff",
      overflow:      "hidden",
      fontFamily:    "'Space Grotesk',sans-serif",
    }}>
      <Navbar />
      <BuildHeader phase={phase} mode={mode} onToggleMode={setMode} />
      <PhaseTabs
        phases={BUILD_PHASES}
        activePhase={activePhase}
        selectPhase={selectPhase}
      />

      {/* Main content: theory LEFT + workspace RIGHT */}
      <div style={{
        display:              "grid",
        gridTemplateColumns:  "1fr 1fr",
        flex:                 1,
        overflow:             "hidden",
        position:             "relative",
      }}>
        {/* Locked overlay for unauthenticated users */}
        {!user && (
          <div style={{
            position:       "absolute",
            inset:          0,
            zIndex:         10,
            display:        "flex",
            flexDirection:  "column",
            justifyContent: "center",
            alignItems:     "center",
            gap:            "16px",
            padding:        "24px",
            background:     "rgba(4,3,15,0.95)",
            color:          "#e2eeff",
            textAlign:      "center",
          }}>
            <h2 style={{ margin:0, fontSize:"28px" }}>Build access locked</h2>
            <p style={{ maxWidth:"520px", color:"#94a3b8" }}>
              Sign in or sign up to unlock the interactive build experience
              and save your progress to your dashboard.
            </p>
            <div style={{ display:"flex", gap:"12px", flexWrap:"wrap", justifyContent:"center" }}>
              <button onClick={() => navigate("/signin")} style={{ borderRadius:"999px", background:"#2563eb", color:"#fff", padding:"12px 22px", border:"none", cursor:"pointer" }}>
                Sign In
              </button>
              <button onClick={() => navigate("/signup")} style={{ borderRadius:"999px", background:"#0f766e", color:"#fff", padding:"12px 22px", border:"none", cursor:"pointer" }}>
                Sign Up
              </button>
            </div>
          </div>
        )}

        {/* LEFT: Theory panel wrapped in PanelWindow */}
        <PanelWindow title="📚 THEORY REFERENCE" height="auto">
          <TheoryPanel
            phase={phase}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        </PanelWindow>

        {/* RIGHT: Multi-file workspace editor wrapped in PanelWindow */}
        <PanelWindow title="💻 CODE EDITOR" height="auto">
          <CodeEditor
            phase={phase}
            workspaceContents={workspaceContents}
            setWorkspaceContents={setWorkspaceContents}
            activeFile={activeFile}
            setActiveFile={setActiveFile}
            navigate={navigate}
            disabled={!user}
            mode={mode}
            initialOpenFileId={initialOpenFileId}
            onInitialFileOpened={() => setInitialOpenFileId(null)}
          />
        </PanelWindow>

        {/* Live panel for Theory */}
        <LivePanelWindow
          title="📚 THEORY REFERENCE"
          open={livePanels["THEORY REFERENCE"] || false}
          onClose={() => handleCloseLivePanel("THEORY REFERENCE")}
        >
          <TheoryPanel
            phase={phase}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        </LivePanelWindow>

        {/* Live panel for Code Editor */}
        <LivePanelWindow
          title="💻 CODE EDITOR"
          open={livePanels["CODE EDITOR"] || false}
          onClose={() => handleCloseLivePanel("CODE EDITOR")}
        >
          <CodeEditor
            phase={phase}
            workspaceContents={workspaceContents}
            setWorkspaceContents={setWorkspaceContents}
            activeFile={activeFile}
            setActiveFile={setActiveFile}
            navigate={navigate}
            disabled={!user}
            mode={mode}
            initialOpenFileId={initialOpenFileId}
            onInitialFileOpened={() => setInitialOpenFileId(null)}
          />
        </LivePanelWindow>
      </div>
    </div>
  );
}
