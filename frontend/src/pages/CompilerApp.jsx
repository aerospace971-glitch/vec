import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Editor, { useMonaco } from "@monaco-editor/react";
import Toolbar from "../components/Toolbar";
import Navbar  from "../components/Navbar";
import useAuthStore from "../store/authStore";
import { TOKEN_COLORS } from "../editor/TokenColors";
import useCompilerStore from "../store/compilerStore";
import { useMetamicSettings } from "../utils/metamicSettings";
import "../App.css";

// ── VFS helpers ────────────────────────────────────────────
const vfsKey  = (uid) => `metamic_vfs_${uid}`;
const loadVFS = (uid) => {
  try { return JSON.parse(localStorage.getItem(vfsKey(uid))) || { folders:[], files:[] }; }
  catch { return { folders:[], files:[] }; }
};
const saveVFS = (uid, vfs) => localStorage.setItem(vfsKey(uid), JSON.stringify(vfs));
const genId   = () => Math.random().toString(36).slice(2,10);

function getFolderPath(folders, folderId) {
  if (!folderId) return "/ root";
  const parts = [];
  let cur = folderId;
  while (cur) {
    const f = folders.find(x => x.id === cur);
    if (!f) break;
    parts.unshift(f.name);
    cur = f.parentId;
  }
  return "/" + parts.join("/");
}

// ── Examples ───────────────────────────────────────────────
const EXAMPLES = {
  "Hello World": `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}`,
  "Variables & Arithmetic": `#include <iostream>\nusing namespace std;\n\nint main() {\n    int a = 10;\n    int b = 20;\n    int sum = a + b;\n    float avg = (a + b) / 2.0f;\n    cout << sum << endl;\n    return 0;\n}`,
  "If / Else": `#include <iostream>\nusing namespace std;\n\nint main() {\n    int score = 85;\n    if (score >= 90) {\n        cout << "Grade: A" << endl;\n    } else if (score >= 80) {\n        cout << "Grade: B" << endl;\n    } else {\n        cout << "Grade: C" << endl;\n    }\n    return 0;\n}`,
  "For Loop": `#include <iostream>\nusing namespace std;\n\nint main() {\n    int sum = 0;\n    for (int i = 1; i <= 10; i++) {\n        sum += i;\n    }\n    cout << sum << endl;\n    return 0;\n}`,
  "While Loop": `#include <iostream>\nusing namespace std;\n\nint main() {\n    int n = 5;\n    int fact = 1;\n    while (n > 0) {\n        fact *= n;\n        n--;\n    }\n    cout << fact << endl;\n    return 0;\n}`,
  "Class & Object": `#include <iostream>\nusing namespace std;\n\nclass Rectangle {\nprivate:\n    int width;\n    int height;\npublic:\n    Rectangle(int w, int h) {\n        width = w;\n        height = h;\n    }\n    int area() { return width * height; }\n};\n\nint main() {\n    Rectangle r(5, 3);\n    cout << r.area() << endl;\n    return 0;\n}`,
  "Recursion": `#include <iostream>\nusing namespace std;\n\nint factorial(int n) {\n    if (n <= 1) return 1;\n    return n * factorial(n-1);\n}\n\nint main() {\n    cout << factorial(6) << endl;\n    return 0;\n}`,
  "Templates": `#include <iostream>\nusing namespace std;\n\ntemplate <typename T>\nT maxOf(T a, T b) {\n    return (a > b) ? a : b;\n}\n\nint main() {\n    cout << maxOf(3, 7) << endl;\n    return 0;\n}`,
};

// ── Modal shared styles ────────────────────────────────────
const OVERLAY   = { position:"fixed",inset:0,background:"rgba(0,0,0,0.72)",backdropFilter:"blur(5px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 };
const MODAL_BOX = { background:"#080d1e",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:24,width:370,fontFamily:"'Space Grotesk',sans-serif",maxHeight:"90vh",overflowY:"auto" };
const MH_STYLE  = { display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:"#e2eeff",letterSpacing:"0.5px" };
const CLOSE_BTN = { background:"transparent",border:"none",color:"rgba(255,255,255,0.35)",cursor:"pointer",fontSize:14,padding:0 };
const LABEL_S   = { display:"block",fontSize:11,color:"rgba(255,255,255,0.45)",fontFamily:"'JetBrains Mono',monospace",marginBottom:6 };
const INPUT_S   = { width:"100%",boxSizing:"border-box",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:"9px 12px",color:"#e2eeff",fontFamily:"'JetBrains Mono',monospace",fontSize:12,outline:"none" };
const GHOST_S   = { background:"transparent",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,color:"rgba(255,255,255,0.5)",padding:"7px 14px",cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontSize:11 };
const PRIM_S    = { background:"#4f46e5",border:"none",borderRadius:6,color:"#fff",padding:"7px 16px",cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:600 };
const BROWSE_ROW = { padding:"6px 12px",cursor:"pointer",fontSize:12,fontFamily:"'JetBrains Mono',monospace",display:"flex",alignItems:"center",gap:6,borderRadius:3,color:"rgba(255,255,255,0.6)" };

export default function CompilerApp() {
  const monaco = useMonaco();
  const [editorReady, setEditorReady] = useState(false);
  const navigate  = useNavigate();
  const { source, setSource, errors, setErrors, compiled, setCompiled, setResult } = useCompilerStore();
  const editorSettings = useMetamicSettings();
  const [loading,     setLoading]     = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const { result } = useCompilerStore();
  const user  = useAuthStore((s) => s.user);

  // ── Tab system ────────────────────────────────────────────
  const tabCountRef = useRef(0);
  const [tabs, setTabs] = useState([
    { id:"t0", name:"untitled.cpp", content: source, savedFileId:null, dirty:false }
  ]);
  const [activeTabId, setActiveTabId] = useState("t0");

  // ── VFS ───────────────────────────────────────────────────
  const [vfs, setVfsState] = useState(() =>
    user ? loadVFS(user.id) : { folders:[], files:[] }
  );
  function updateVfs(v) {
    setVfsState(v);
    if (user) saveVFS(user.id, v);
  }
  useEffect(() => {
    setVfsState(user ? loadVFS(user.id) : { folders:[], files:[] });
  }, [user?.id]);

  // ── Explorer ──────────────────────────────────────────────
  const [showExplorer,    setShowExplorer]    = useState(true);
  const [explorerOpen,    setExplorerOpen]    = useState(true);
  const [expanded,        setExpanded]        = useState({});

  // ── Modal state ───────────────────────────────────────────
  const [modal, setModal] = useState(null); // "saveFile"|"newFolder"|"nfFromSave"|"openFile"|"openFolder"
  const [saveStep,     setSaveStep]     = useState(1);
  const [saveName,     setSaveName]     = useState("");
  const [saveFolderId, setSaveFolderId] = useState(null);
  const [nfName,       setNfName]       = useState("untitledFolder");
  const [nfParentId,   setNfParentId]   = useState(null);
  const [browseFid,    setBrowseFid]    = useState(null);

  useEffect(() => {
    const prefill = sessionStorage.getItem("metamic_prefill") || window.__METAMIC_SOURCE__;
    if (!prefill) return;
    sessionStorage.removeItem("metamic_prefill");
    window.__METAMIC_SOURCE__ = "";
    setSource(prefill);
    setTabs(prev => prev.map(t =>
      t.id === activeTabId ? { ...t, content:prefill, dirty:true } : t
    ));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Active tab helper ─────────────────────────────────────
  const getActive = () => tabs.find(t => t.id === activeTabId) || tabs[0];

  // sync active tab → source when tab switches
  useEffect(() => {
    const tab = getActive();
    if (tab) setSource(tab.content);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  // ── Monaco theme (unchanged) ──────────────────────────────
  useEffect(() => {
    if (!monaco) return;
    monaco.editor.defineTheme("metamic", {
      base:"vs-dark", inherit:true,
      rules:[
        { token:"keyword",  foreground:"c792ea" },
        { token:"type",     foreground:"82aaff" },
        { token:"string",   foreground:"c3e88d" },
        { token:"number",   foreground:"f78c6c" },
        { token:"comment",  foreground:"546e7a" },
        { token:"delimiter",foreground:"89ddff" },
        { token:"operator", foreground:"89ddff" },
      ],
      colors:{
        "editor.background":"#04030f",
        "editor.lineHighlightBackground":"#101426",
        "editorCursor.foreground":"#06ffa5",
        "editor.selectionBackground":"#2a2f55",
        "editor.inactiveSelectionBackground":"#1c2140",
        "editorLineNumber.foreground":"#46506b",
        "editorLineNumber.activeForeground":"#cdd6f4",
        "editorIndentGuide.background":"#1a1f35",
        "editorIndentGuide.activeBackground":"#2c3355",
      },
    });
    setEditorReady(true);
  }, [monaco]);

  // ── Compile (unchanged) ───────────────────────────────────
  const normalizeSource = (text) =>
    String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean).join("\n").trim();
  const isExampleSource = (value) =>
    Object.values(EXAMPLES).some(e => normalizeSource(e) === normalizeSource(value));
  const canCompile = Boolean(user || isExampleSource(source));

  async function compile() {
    if (!user && !isExampleSource(source)) {
      setErrors([{ message:"Sign in to compile custom code. Load an example or sign in first.", line:0, col:0 }]);
      return;
    }
    setLoading(true); setErrors([]);
    try {
      const res  = await fetch("/compile", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ source, phase:"all" }),
      });
      const data = await res.json();
      console.log(data.tac); console.log(data.assembly);
      setResult(data);
      setErrors([...(data.lexer_errors || [])]);
      setCompiled(true);
    } catch {
      setErrors([{ message:"Cannot reach compiler server — is server.py running?", line:0, col:0 }]);
    }
    setLoading(false);
  }

  // ── Load example (unchanged) ──────────────────────────────
  function loadExample(name) {
    setSource(EXAMPLES[name]);
    setErrors([]);
    setCompiled(false);
    setTabs(prev => prev.map(t =>
      t.id === activeTabId ? { ...t, content:EXAMPLES[name], dirty:true } : t
    ));
  }

  // ── Editor change ─────────────────────────────────────────
  function handleEditorChange(value) {
    const v = value || "";
    if (user) {
      setSource(v);
      setTabs(prev => prev.map(t =>
        t.id === activeTabId ? { ...t, content:v, dirty:true } : t
      ));
    }
  }

  // ── Tab actions ───────────────────────────────────────────
  function newTab() {
    tabCountRef.current++;
    const id   = genId();
    const name = `untitled${tabCountRef.current}.cpp`;
    setTabs(prev => [...prev, { id, name, content:"", savedFileId:null, dirty:false }]);
    setActiveTabId(id);
    setSource("");
  }

  function closeTab(tabId, e) {
    e?.stopPropagation();
    setTabs(prev => {
      if (prev.length === 1) return prev;
      const next = prev.filter(t => t.id !== tabId);
      if (tabId === activeTabId) {
        const idx      = prev.findIndex(t => t.id === tabId);
        const newActive = next[Math.max(0, idx - 1)];
        setActiveTabId(newActive.id);
        setSource(newActive.content);
      }
      return next;
    });
  }

  function switchTab(tabId) {
    if (tabId === activeTabId) return;
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;
    setActiveTabId(tabId);
    setSource(tab.content);
  }

  // ── Open file from VFS ────────────────────────────────────
  function openVFSFile(file) {
    const existing = tabs.find(t => t.savedFileId === file.id);
    if (existing) { switchTab(existing.id); setModal(null); return; }
    const id = genId();
    setTabs(prev => [...prev, { id, name:file.name, content:file.content||"", savedFileId:file.id, dirty:false }]);
    setActiveTabId(id);
    setSource(file.content || "");
    setModal(null);
  }

  // ── Save File to VFS ──────────────────────────────────────
  function openSaveModal() {
    if (!user) return;
    const tab = getActive();
    setSaveName(tab.name.replace(/\.cpp$/, ""));
    setSaveFolderId(null);
    setSaveStep(1);
    setModal("saveFile");
  }

  function confirmSaveFile() {
    const tab      = getActive();
    const raw      = saveName.trim() || "untitled";
    const fname    = raw.endsWith(".cpp") ? raw : raw + ".cpp";
    const newVfs   = { folders:[...vfs.folders], files:[...vfs.files] };
    const existing = tab.savedFileId && newVfs.files.find(f => f.id === tab.savedFileId);
    if (existing) {
      newVfs.files = newVfs.files.map(f =>
        f.id === tab.savedFileId ? { ...f, name:fname, content:tab.content, folderId:saveFolderId } : f
      );
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, name:fname, dirty:false } : t));
    } else {
      const fileId = genId();
      newVfs.files.push({ id:fileId, name:fname, folderId:saveFolderId, content:tab.content });
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, name:fname, savedFileId:fileId, dirty:false } : t));
    }
    updateVfs(newVfs);
    setModal(null);
    setSaveMessage("Saved to Files.");
    setTimeout(() => setSaveMessage(""), 2000);
  }

  // ── New Folder ────────────────────────────────────────────
  function openNewFolderModal(returnTo) {
    if (!user) return;
    setNfName("untitledFolder");
    setNfParentId(saveFolderId);
    setModal(returnTo ? "nfFromSave" : "newFolder");
  }

  function confirmNewFolder(returnTo) {
    const name = nfName.trim() || "untitledFolder";
    const id   = genId();
    const newVfs = { ...vfs, folders:[...vfs.folders, { id, name, parentId:nfParentId }] };
    updateVfs(newVfs);
    setExpanded(p => ({ ...p, [id]:true }));
    if (returnTo) { setSaveFolderId(id); setModal("saveFile"); }
    else setModal(null);
  }

  // ── Open Folder ───────────────────────────────────────────
  function selectOpenFolder(folderId) {
    setExpanded(p => ({ ...p, [folderId]:true }));
    setShowExplorer(true);
    setModal(null);
  }

  // ── Recursive render helpers ──────────────────────────────
  function renderFolderSelectTree(folderId, depth, selectedId, onSelect) {
    const subs = vfs.folders.filter(f => f.parentId === folderId);
    return subs.map(folder => (
      <div key={folder.id}>
        <div
          onClick={() => onSelect(folder.id)}
          style={{ padding:`5px 12px 5px ${12+depth*14}px`, cursor:"pointer", fontSize:12, fontFamily:"'JetBrains Mono',monospace", color: selectedId===folder.id ? "#82aaff" : "rgba(255,255,255,0.55)", background: selectedId===folder.id ? "rgba(130,170,255,0.1)" : "transparent", borderRadius:3, display:"flex", alignItems:"center", gap:5 }}
          onMouseEnter={e=>{ if(selectedId!==folder.id) e.currentTarget.style.background="rgba(255,255,255,0.04)"; }}
          onMouseLeave={e=>{ if(selectedId!==folder.id) e.currentTarget.style.background="transparent"; }}
        >
          <span style={{color:"#fbbf24"}}>📁</span>{folder.name}
        </div>
        {renderFolderSelectTree(folder.id, depth+1, selectedId, onSelect)}
      </div>
    ));
  }

  function renderFolderNode(folderId, depth) {
    const subs  = vfs.folders.filter(f => f.parentId === folderId);
    const files = vfs.files.filter(f => f.folderId === folderId);
    return (
      <>
        {subs.map(folder => {
          const isOpen = expanded[folder.id];
          return (
            <div key={folder.id}>
              <div
                onClick={() => setExpanded(p => ({ ...p, [folder.id]:!p[folder.id] }))}
                style={{ display:"flex", alignItems:"center", gap:4, padding:`3px 8px 3px ${12+depth*12}px`, cursor:"pointer", fontSize:12, color:"rgba(255,255,255,0.65)", fontFamily:"'JetBrains Mono',monospace", borderRadius:3 }}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.05)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}
              >
                <span style={{fontSize:9,opacity:0.6}}>{isOpen?"▼":"▶"}</span>
                <span style={{color:"#fbbf24",fontSize:13}}>📁</span>
                {folder.name}
              </div>
              {isOpen && renderFolderNode(folder.id, depth+1)}
            </div>
          );
        })}
        {files.map(file => {
          const isActive = tabs.some(t => t.savedFileId===file.id && t.id===activeTabId);
          return (
            <div key={file.id} onClick={() => openVFSFile(file)} style={{ padding:`3px 8px 3px ${20+depth*12}px`, cursor:"pointer", fontSize:12, color: isActive?"#82aaff":"rgba(255,255,255,0.55)", fontFamily:"'JetBrains Mono',monospace", borderRadius:3, background: isActive?"rgba(130,170,255,0.08)":"transparent", display:"flex", alignItems:"center", gap:5 }}
              onMouseEnter={e=>{ if(!isActive) e.currentTarget.style.background="rgba(255,255,255,0.04)"; }}
              onMouseLeave={e=>{ if(!isActive) e.currentTarget.style.background="transparent"; }}
            >
              <span style={{fontSize:11,opacity:0.5}}>📄</span>{file.name}
            </div>
          );
        })}
      </>
    );
  }

  function renderBrowseTree(folderId, depth, onClickFolder) {
    const subs = vfs.folders.filter(f => f.parentId === folderId);
    return subs.map(folder => (
      <div key={folder.id}>
        <div style={{...BROWSE_ROW, paddingLeft: 12+depth*14}} onClick={() => onClickFolder(folder.id)}
          onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.05)"}
          onMouseLeave={e=>e.currentTarget.style.background="transparent"}
        >
          <span style={{color:"#fbbf24"}}>📁</span>{folder.name}/
        </div>
        {renderBrowseTree(folder.id, depth+1, onClickFolder)}
      </div>
    ));
  }

  // ── Sub-toolbar button style ──────────────────────────────
  const SB = (active) => ({
    background: active ? "rgba(255,255,255,0.07)" : "transparent",
    border:"none",
    color: active ? "#e2eeff" : "rgba(255,255,255,0.45)",
    cursor:"pointer",
    fontFamily:"'JetBrains Mono',monospace",
    fontSize:11,
    padding:"0 11px",
    height:32,
    borderRadius:4,
    transition:"all 0.12s",
    whiteSpace:"nowrap",
    display:"flex", alignItems:"center", gap:4,
  });

  const activeTab = getActive();

  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:"#04030f", color:"#e2eeff", overflow:"hidden", fontFamily:"'Space Grotesk',sans-serif" }}>

      <Navbar />

      {/* ── Toolbar strip (unchanged) ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 20px", background:"rgba(5,8,18,0.9)", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:"8px", fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", letterSpacing:"1.5px", color:"#3a5070", textTransform:"uppercase" }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:"#06ffa5", boxShadow:"0 0 5px #06ffa5", animation:"pulse 2s ease-in-out infinite" }}/>
          Source — C++
          {compiled && (
            <span style={{ marginLeft:"12px", fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", color:"#06ffa5", background:"rgba(6,255,165,0.08)", border:"1px solid rgba(6,255,165,0.2)", borderRadius:"4px", padding:"2px 8px", letterSpacing:"0.5px" }}>
              ✓ Compiled — open any phase tab
            </span>
          )}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"14px", width:"100%", justifyContent:"space-between" }}>
          <Toolbar onCompile={compile} onLoadExample={loadExample} examples={Object.keys(EXAMPLES)} loading={loading} disabled={!canCompile} />
          <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
            <button onClick={openSaveModal} disabled={!user} style={{ borderRadius:"999px", border:"1px solid rgba(255,255,255,0.14)", background: user ? "#10b981" : "rgba(255,255,255,0.04)", color: user ? "#ffffff" : "rgba(255,255,255,0.6)", padding:"10px 18px", cursor: user ? "pointer" : "not-allowed", fontFamily:"'JetBrains Mono',monospace", fontSize:"11px" }}>
              Save File
            </button>
            <span style={{ fontSize:"12px", color:"#94a3b8" }}>{saveMessage}</span>
          </div>
        </div>
      </div>

      {/* ── Sub-toolbar: file system ── */}
      {user && (
        <div style={{ display:"flex", alignItems:"center", height:32, background:"#06091a", borderBottom:"1px solid rgba(255,255,255,0.05)", flexShrink:0, paddingLeft:6, gap:2 }}>
          <button onClick={() => setShowExplorer(p => !p)} style={SB(showExplorer)} title="Toggle Explorer">☰</button>
          <div style={{ width:1, height:16, background:"rgba(255,255,255,0.08)", margin:"0 3px" }}/>
          <button onClick={newTab}                         style={SB(false)}>New File</button>
          <button onClick={() => openNewFolderModal(false)} style={SB(false)}>New Folder</button>
          <button onClick={() => { setBrowseFid(null); setModal("openFile"); }}   style={SB(false)}>Open File</button>
          <button onClick={() => { setBrowseFid(null); setModal("openFolder"); }} style={SB(false)}>Open Folder</button>
        </div>
      )}

      {/* ── Guest banner (unchanged) ── */}
      {!user && (
        <div style={{ padding:"16px 20px", color:"#f8fafc", background:"#111827", borderBottom:"1px solid rgba(255,255,255,0.08)", display:"flex", alignItems:"center", justifyContent:"space-between", gap:"12px" }}>
          <div><strong style={{color:"#bae6fd"}}>Guest mode active:</strong> only example code is available. Sign in to edit, compile, and save your own source.</div>
          <button onClick={() => navigate("/signin")} style={{ borderRadius:"999px", border:"1px solid rgba(56,189,248,0.4)", background:"rgba(56,189,248,0.12)", color:"#7dd3fc", padding:"10px 18px", cursor:"pointer", fontFamily:"'JetBrains Mono',monospace", fontSize:"12px" }}>Sign In</button>
        </div>
      )}

      {/* ── Body: explorer + editor ── */}
      <div style={{ flex:1, overflow:"hidden", display:"flex", background:"#04030f" }}>

        {/* Explorer sidebar */}
        {showExplorer && user && (
          <div style={{ width:220, background:"#040610", borderRight:"1px solid rgba(255,255,255,0.05)", display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden" }}>
            {/* Collapsible EXPLORER header */}
            <div
              onClick={() => setExplorerOpen(p => !p)}
              style={{ padding:"8px 12px 8px 10px", display:"flex", alignItems:"center", justifyContent:"space-between", flexShrink:0, cursor:"pointer", userSelect:"none" }}
              onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.03)"}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}
            >
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:9,color:"#3a5070",opacity:0.8}}>{explorerOpen?"▼":"▶"}</span>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, letterSpacing:"1.5px", color:"#3a5070", textTransform:"uppercase" }}>Explorer</span>
              </div>
              {explorerOpen && (
                <div style={{display:"flex",gap:4}} onClick={e=>e.stopPropagation()}>
                  <button onClick={newTab} title="New File" style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:14,padding:"0 3px"}}
                    onMouseEnter={e=>e.currentTarget.style.color="#e2eeff"} onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.3)"}>+</button>
                  <button onClick={() => openNewFolderModal(false)} title="New Folder" style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:12,padding:"0 3px"}}
                    onMouseEnter={e=>e.currentTarget.style.color="#e2eeff"} onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.3)"}>📁</button>
                </div>
              )}
            </div>
            {explorerOpen && (
              <div style={{ flex:1, overflowY:"auto", scrollbarWidth:"thin", scrollbarColor:"#1a2040 transparent" }}>
                {vfs.folders.length === 0 && vfs.files.length === 0 ? (
                  <div style={{ padding:"20px 12px", textAlign:"center", color:"rgba(255,255,255,0.15)", fontSize:11, fontFamily:"'JetBrains Mono',monospace", lineHeight:1.9 }}>
                    No files yet.<br/>
                    <span style={{color:"#82aaff",cursor:"pointer"}} onClick={newTab}>New File</span>
                    {" or "}
                    <span style={{color:"#82aaff",cursor:"pointer"}} onClick={() => openNewFolderModal(false)}>New Folder</span>
                  </div>
                ) : (
                  <>
                    {vfs.files.filter(f => !f.folderId).map(file => {
                      const isActive = tabs.some(t => t.savedFileId===file.id && t.id===activeTabId);
                      return (
                        <div key={file.id} onClick={() => openVFSFile(file)} style={{ padding:"3px 8px 3px 20px", cursor:"pointer", fontSize:12, color: isActive?"#82aaff":"rgba(255,255,255,0.55)", fontFamily:"'JetBrains Mono',monospace", borderRadius:3, background: isActive?"rgba(130,170,255,0.08)":"transparent", display:"flex", alignItems:"center", gap:5 }}
                          onMouseEnter={e=>{ if(!isActive) e.currentTarget.style.background="rgba(255,255,255,0.04)"; }}
                          onMouseLeave={e=>{ if(!isActive) e.currentTarget.style.background="transparent"; }}
                        >
                          <span style={{fontSize:11,opacity:0.4}}>📄</span>{file.name}
                        </div>
                      );
                    })}
                    {renderFolderNode(null, 0)}
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Editor area */}
        <div style={{ flex:1, overflow:"hidden", display:"flex", flexDirection:"column" }}>

          {/* File tabs — above Monaco only */}
          {user && (
            <div style={{ display:"flex", alignItems:"center", height:34, background:"#050812", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0, overflowX:"auto", scrollbarWidth:"none" }}>
              {tabs.map(tab => {
                const active = tab.id === activeTabId;
                return (
                  <div key={tab.id} onClick={() => switchTab(tab.id)} style={{ display:"flex", alignItems:"center", gap:5, padding:"0 10px 0 13px", height:"100%", borderRight:"1px solid rgba(255,255,255,0.05)", borderBottom: active ? "2px solid #82aaff" : "2px solid transparent", background: active ? "rgba(130,170,255,0.06)" : "transparent", cursor:"pointer", fontFamily:"'JetBrains Mono',monospace", fontSize:11, color: active ? "#e2eeff" : "rgba(255,255,255,0.38)", whiteSpace:"nowrap", flexShrink:0, userSelect:"none" }}
                    onMouseEnter={e=>{ if(!active) e.currentTarget.style.color="#e2eeff"; }}
                    onMouseLeave={e=>{ if(!active) e.currentTarget.style.color="rgba(255,255,255,0.38)"; }}
                  >
                    <span style={{fontSize:10,opacity:0.4}}>📄</span>
                    {tab.name}
                    {tab.dirty && <span style={{color:"#82aaff",fontSize:8,marginLeft:1}}>●</span>}
                    <button onClick={e => closeTab(tab.id, e)} style={{ background:"transparent", border:"none", color:"rgba(255,255,255,0.25)", cursor:"pointer", fontSize:11, padding:"0 1px", marginLeft:3, lineHeight:1, borderRadius:2 }}
                      onMouseEnter={e=>{ e.stopPropagation(); e.currentTarget.style.color="#e2eeff"; }}
                      onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.25)"}
                    >✕</button>
                  </div>
                );
              })}
              <button onClick={newTab} style={{ background:"transparent", border:"none", color:"rgba(255,255,255,0.25)", cursor:"pointer", padding:"0 13px", height:"100%", fontSize:18, fontFamily:"'JetBrains Mono',monospace" }}
                onMouseEnter={e=>e.currentTarget.style.color="#e2eeff"}
                onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.25)"}
              >+</button>
            </div>
          )}

          {!editorReady ? (
            <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:"14px", background:"#04030f" }}>
              <div style={{ width:"32px", height:"32px", border:"3px solid rgba(255,255,255,0.08)", borderTop:"3px solid #06ffa5", borderRadius:"50%", animation:"spin 0.8s linear infinite" }}/>
              <div style={{ fontFamily:"JetBrains Mono", fontSize:"11px", letterSpacing:"1px", color:"#546e7a", textTransform:"uppercase" }}>Loading Monaco Editor</div>
            </div>
          ) : (
            <Editor
              height="100%"
              defaultLanguage="cpp"
              value={source}
              onChange={handleEditorChange}
              theme="metamic"
              options={{ fontSize:editorSettings.fontSize, minimap:{enabled:false}, fontFamily:"JetBrains Mono", smoothScrolling:true, automaticLayout:true, tabSize:editorSettings.tabSize, scrollBeyondLastLine:false, cursorBlinking:"smooth", cursorSmoothCaretAnimation:"on", roundedSelection:true, padding:{top:14}, renderLineHighlight:"gutter", bracketPairColorization:{enabled:true}, folding:true, lineNumbers:"on", readOnly:!user }}
            />
          )}
        </div>
      </div>

      {/* ── Error strip (unchanged) ── */}
      {errors.length > 0 && (
        <div style={{ background:"rgba(18,8,8,0.95)", borderTop:"1px solid #dc2626", flexShrink:0, maxHeight:"120px", overflowY:"auto", padding:"8px 20px" }}>
          {errors.map((e,i) => (
            <div key={i} style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px", color:"#e2eeff", padding:"3px 0", display:"flex", gap:"16px" }}>
              <span style={{color:"#fbbf24"}}>Line {e.line}, Col {e.col}</span>
              {e.message}
            </div>
          ))}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODALS
      ══════════════════════════════════════════════════════ */}

      {/* Save File */}
      {modal === "saveFile" && (
        <div style={OVERLAY}>
          <div style={MODAL_BOX}>
            <div style={MH_STYLE}>
              Save File — Step {saveStep} of 2
              <button onClick={() => setModal(null)} style={CLOSE_BTN}>✕</button>
            </div>

            {saveStep === 1 && (
              <>
                <label style={LABEL_S}>File name</label>
                <input autoFocus value={saveName} onChange={e => setSaveName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") setSaveStep(2); }}
                  placeholder="untitled.cpp" style={INPUT_S} />
                <div style={{display:"flex",justifyContent:"flex-end",marginTop:16,gap:8}}>
                  <button onClick={() => setModal(null)} style={GHOST_S}>Cancel</button>
                  <button onClick={() => setSaveStep(2)}  style={PRIM_S}>Next →</button>
                </div>
              </>
            )}

            {saveStep === 2 && (
              <>
                <label style={LABEL_S}>Choose location</label>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontFamily:"'JetBrains Mono',monospace",marginBottom:8}}>
                  {getFolderPath(vfs.folders, saveFolderId)}
                </div>
                <div style={{maxHeight:190,overflowY:"auto",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"4px 0",marginBottom:8}}>
                  <div onClick={() => setSaveFolderId(null)} style={{ ...BROWSE_ROW, background: saveFolderId===null?"rgba(130,170,255,0.1)":"transparent", color: saveFolderId===null?"#82aaff":"rgba(255,255,255,0.55)" }}
                    onMouseEnter={e=>{ if(saveFolderId!==null) e.currentTarget.style.background="rgba(255,255,255,0.04)"; }}
                    onMouseLeave={e=>{ if(saveFolderId!==null) e.currentTarget.style.background="transparent"; }}
                  >/ root</div>
                  {renderFolderSelectTree(null, 0, saveFolderId, setSaveFolderId)}
                </div>
                <button onClick={() => openNewFolderModal(true)} style={{...GHOST_S,fontSize:10,marginBottom:12}}>+ New Folder</button>
                <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
                  <button onClick={() => setSaveStep(1)} style={GHOST_S}>← Back</button>
                  <button onClick={confirmSaveFile}       style={PRIM_S}>Save</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* New Folder (standalone) */}
      {modal === "newFolder" && (
        <div style={OVERLAY}>
          <div style={MODAL_BOX}>
            <div style={MH_STYLE}>New Folder <button onClick={() => setModal(null)} style={CLOSE_BTN}>✕</button></div>
            <label style={LABEL_S}>Folder name</label>
            <input autoFocus value={nfName} onChange={e => setNfName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") confirmNewFolder(false); }}
              style={INPUT_S} />
            <label style={{...LABEL_S, marginTop:12}}>Parent location</label>
            <div style={{maxHeight:150,overflowY:"auto",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"4px 0",marginBottom:16}}>
              <div onClick={() => setNfParentId(null)} style={{...BROWSE_ROW, background: nfParentId===null?"rgba(130,170,255,0.1)":"transparent", color: nfParentId===null?"#82aaff":"rgba(255,255,255,0.55)"}}>/ root</div>
              {renderFolderSelectTree(null, 0, nfParentId, setNfParentId)}
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
              <button onClick={() => setModal(null)}    style={GHOST_S}>Cancel</button>
              <button onClick={() => confirmNewFolder(false)} style={PRIM_S}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* New Folder from Save flow */}
      {modal === "nfFromSave" && (
        <div style={OVERLAY}>
          <div style={MODAL_BOX}>
            <div style={MH_STYLE}>New Folder <button onClick={() => setModal("saveFile")} style={CLOSE_BTN}>✕</button></div>
            <label style={LABEL_S}>Folder name</label>
            <input autoFocus value={nfName} onChange={e => setNfName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") confirmNewFolder(true); }}
              style={INPUT_S} />
            <label style={{...LABEL_S, marginTop:12}}>Parent location</label>
            <div style={{maxHeight:150,overflowY:"auto",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"4px 0",marginBottom:16}}>
              <div onClick={() => setNfParentId(null)} style={{...BROWSE_ROW, background: nfParentId===null?"rgba(130,170,255,0.1)":"transparent", color: nfParentId===null?"#82aaff":"rgba(255,255,255,0.55)"}}>/ root</div>
              {renderFolderSelectTree(null, 0, nfParentId, setNfParentId)}
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
              <button onClick={() => setModal("saveFile")}     style={GHOST_S}>Cancel</button>
              <button onClick={() => confirmNewFolder(true)}   style={PRIM_S}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Open File */}
      {modal === "openFile" && (
        <div style={OVERLAY}>
          <div style={{...MODAL_BOX, width:460}}>
            <div style={MH_STYLE}>Open File <button onClick={() => setModal(null)} style={CLOSE_BTN}>✕</button></div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontFamily:"'JetBrains Mono',monospace",marginBottom:8}}>
              {getFolderPath(vfs.folders, browseFid)}
            </div>
            {browseFid && (
              <button onClick={() => setBrowseFid(vfs.folders.find(f=>f.id===browseFid)?.parentId ?? null)} style={{...GHOST_S,fontSize:10,marginBottom:8}}>← Back</button>
            )}
            <div style={{maxHeight:300,overflowY:"auto",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"4px 0"}}>
              {vfs.folders.filter(f => f.parentId === browseFid).map(folder => (
                <div key={folder.id} onClick={() => setBrowseFid(folder.id)} style={BROWSE_ROW}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.05)"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                >
                  <span style={{color:"#fbbf24"}}>📁</span>{folder.name}/
                </div>
              ))}
              {vfs.files.filter(f => f.folderId === browseFid).map(file => (
                <div key={file.id} onClick={() => openVFSFile(file)} style={{...BROWSE_ROW, color:"rgba(255,255,255,0.7)"}}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(130,170,255,0.08)"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                >
                  <span style={{opacity:0.45}}>📄</span>{file.name}
                </div>
              ))}
              {vfs.folders.filter(f=>f.parentId===browseFid).length===0 && vfs.files.filter(f=>f.folderId===browseFid).length===0 && (
                <div style={{padding:"20px 12px",textAlign:"center",color:"rgba(255,255,255,0.15)",fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>No files here</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Open Folder */}
      {modal === "openFolder" && (
        <div style={OVERLAY}>
          <div style={{...MODAL_BOX, width:380}}>
            <div style={MH_STYLE}>Open Folder <button onClick={() => setModal(null)} style={CLOSE_BTN}>✕</button></div>
            <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontFamily:"'JetBrains Mono',monospace",marginBottom:8}}>
              {getFolderPath(vfs.folders, browseFid)}
            </div>
            {browseFid && (
              <button onClick={() => setBrowseFid(vfs.folders.find(f=>f.id===browseFid)?.parentId ?? null)} style={{...GHOST_S,fontSize:10,marginBottom:8}}>← Back</button>
            )}
            <div style={{maxHeight:280,overflowY:"auto",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"4px 0"}}>
              {vfs.folders.filter(f => f.parentId === browseFid).map(folder => (
                <div key={folder.id} style={{display:"flex",alignItems:"center"}}>
                  <div onClick={() => setBrowseFid(folder.id)} style={{...BROWSE_ROW,flex:1}}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.05)"}
                    onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                  >
                    <span style={{color:"#fbbf24"}}>📁</span>{folder.name}/
                  </div>
                  <button onClick={() => selectOpenFolder(folder.id)} style={{...GHOST_S,fontSize:10,margin:"0 6px",padding:"3px 9px"}}>Open</button>
                </div>
              ))}
              {vfs.folders.filter(f=>f.parentId===browseFid).length===0 && (
                <div style={{padding:"20px 12px",textAlign:"center",color:"rgba(255,255,255,0.15)",fontSize:11,fontFamily:"'JetBrains Mono',monospace"}}>No folders</div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}} @keyframes spin{0%{transform:rotate(0deg)}100%{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
