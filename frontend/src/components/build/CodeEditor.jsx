import { useState, useRef, useEffect, useMemo } from "react";
import Editor from "@monaco-editor/react";
import useAuthStore from "../../store/authStore";
import { useMetamicSettings } from "../../utils/metamicSettings";

// ── Build phase fixed folders ────────────────────────────────────────────────
const BUILD_PHASE_FOLDERS = ["lexer", "parser", "semantic", "ir", "optimizer", "codegen"];

const PHASE_COLORS = {
  lexer:"#4488ff", parser:"#aa44ff", semantic:"#44aaff",
  ir:"#44ffaa", optimizer:"#ffaa44", codegen:"#ff4488",
};

// ── ZIP generation templates ─────────────────────────────────────────────────
const MAKEFILE_TMPL =
`CXX      = g++
CXXFLAGS = -std=c++17 -Wall -Wextra \\
           -I./src/lexer \\
           -I./src/parser \\
           -I./src/semantic \\
           -I./src/ir \\
           -I./src/optimizer \\
           -I./src/codegen

SRCS = $(shell find src -name '*.cpp')
OBJS = $(SRCS:.cpp=.o)

.PHONY: all clean

all: compiler

compiler: $(OBJS)
\t$(CXX) $(CXXFLAGS) -o $@ $^

%.o: %.cpp
\t$(CXX) $(CXXFLAGS) -c $< -o $@

clean:
\tfind src -name '*.o' -delete
\trm -f compiler
`;

const CMAKE_TMPL =
`cmake_minimum_required(VERSION 3.16)
project(MyCompiler CXX)
set(CMAKE_CXX_STANDARD 17)

include_directories(src/lexer src/parser src/semantic src/ir src/optimizer src/codegen)
file(GLOB_RECURSE SRCS src/**/*.cpp)
add_executable(compiler \${SRCS})
`;

const VSCODE_TASKS_TMPL = JSON.stringify({
  version: "2.0.0",
  tasks: [
    {
      label: "Build Compiler", type: "shell", command: "make",
      group: { kind: "build", isDefault: true },
      presentation: { reveal: "always", panel: "shared" },
      problemMatcher: ["$gcc"],
    },
    {
      label: "Run Compiler", type: "shell", command: "./compiler ${file}",
      dependsOn: "Build Compiler", group: "test",
      presentation: { reveal: "always", panel: "shared" },
    },
  ],
}, null, 2);

// ── Build VFS helpers (separate from Compiler VFS) ───────────────────────────
const vfsKey  = (uid) => `metamic_build_vfs_${uid}`;
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

// ── Modal shared styles ──────────────────────────────────────────────────────
const OVERLAY    = { position:"fixed",inset:0,background:"rgba(0,0,0,0.72)",backdropFilter:"blur(5px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000 };
const MODAL_BOX  = { background:"#080d1e",border:"1px solid rgba(255,255,255,0.1)",borderRadius:12,padding:24,width:370,fontFamily:"'Space Grotesk',sans-serif",maxHeight:"90vh",overflowY:"auto" };
const MH_STYLE   = { display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:"#e2eeff",letterSpacing:"0.5px" };
const CLOSE_BTN  = { background:"transparent",border:"none",color:"rgba(255,255,255,0.35)",cursor:"pointer",fontSize:14,padding:0 };
const LABEL_S    = { display:"block",fontSize:11,color:"rgba(255,255,255,0.45)",fontFamily:"'JetBrains Mono',monospace",marginBottom:6 };
const INPUT_S    = { width:"100%",boxSizing:"border-box",background:"rgba(255,255,255,0.04)",border:"1px solid rgba(255,255,255,0.1)",borderRadius:6,padding:"9px 12px",color:"#e2eeff",fontFamily:"'JetBrains Mono',monospace",fontSize:12,outline:"none" };
const GHOST_S    = { background:"transparent",border:"1px solid rgba(255,255,255,0.12)",borderRadius:6,color:"rgba(255,255,255,0.5)",padding:"7px 14px",cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontSize:11 };
const PRIM_S     = { background:"#4f46e5",border:"none",borderRadius:6,color:"#fff",padding:"7px 16px",cursor:"pointer",fontFamily:"'JetBrains Mono',monospace",fontSize:11,fontWeight:600 };
const BROWSE_ROW = { padding:"6px 12px",cursor:"pointer",fontSize:12,fontFamily:"'JetBrains Mono',monospace",display:"flex",alignItems:"center",gap:6,borderRadius:3,color:"rgba(255,255,255,0.6)" };

export default function CodeEditor({
  phase,
  workspaceContents,
  setWorkspaceContents,
  activeFile,
  setActiveFile,
  navigate,
  disabled = false,
  mode = "sandbox",
  initialOpenFileId = null,
  onInitialFileOpened,
}) {
  const user = useAuthStore(s => s.user);
  const editorSettings = useMetamicSettings();

  const [showOutput,   setShowOutput]   = useState(false);
  const [runSimulated, setRunSimulated] = useState(false);

  // ── VFS state ────────────────────────────────────────────
  const vfsTabCountRef = useRef(0);
  const [vfsTabs,       setVfsTabs]       = useState([]);
  const [vfsActiveTabId,setVfsActiveTabId]= useState(null); // null = workspace tab active
  const [vfs,           setVfsState]      = useState(() =>
    user ? loadVFS(user.id) : { folders:[], files:[] }
  );
  function updateVfs(v) {
    setVfsState(v);
    if (user) saveVFS(user.id, v);
  }
  useEffect(() => {
    if (!user) { setVfsState({ folders:[], files:[] }); return; }

    // ── Migration: remove phase folders that leaked into the compiler VFS ──
    const COMPILER_KEY = `metamic_vfs_${user.id}`;
    try {
      const cv = JSON.parse(localStorage.getItem(COMPILER_KEY)) || { folders:[], files:[] };
      const phaseSet = new Set(BUILD_PHASE_FOLDERS);
      const leakedIds = new Set(
        cv.folders.filter(f => phaseSet.has(f.name) && f.parentId == null).map(f => f.id)
      );
      if (leakedIds.size > 0) {
        const toRemove = new Set();
        function collect(fid) {
          toRemove.add(fid);
          cv.folders.filter(f => f.parentId === fid).forEach(f => collect(f.id));
        }
        leakedIds.forEach(fid => collect(fid));
        cv.folders = cv.folders.filter(f => !toRemove.has(f.id));
        cv.files   = cv.files.filter(f => !toRemove.has(f.folderId));
        localStorage.setItem(COMPILER_KEY, JSON.stringify(cv));
      }
    } catch {}

    // ── Load VFS without auto-creating phase folders ────────────────────────
    // Phase folders are now created on-demand when user explicitly creates them
    const current = loadVFS(user.id);
    setVfsState(current);
  }, [user?.id]);

  // Auto-open file when navigated from dashboard
  useEffect(() => {
    if (!initialOpenFileId) return;
    const file = vfs.files.find(f => f.id === initialOpenFileId);
    if (!file) return;
    const existing = vfsTabs.find(t => t.savedFileId === file.id);
    if (existing) {
      setVfsActiveTabId(existing.id);
    } else {
      const id = genId();
      setVfsTabs(prev => [...prev, { id, name:file.name, content:file.content||"", savedFileId:file.id, dirty:false }]);
      setVfsActiveTabId(id);
    }
    onInitialFileOpened?.();
  }, [initialOpenFileId]);

  const [showExplorer, setShowExplorer] = useState(true);
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [expanded,     setExpanded]     = useState({});

  // ── Modal state ───────────────────────────────────────────
  const [modal,        setModal]        = useState(null);
  const [saveStep,     setSaveStep]     = useState(1);
  const [saveName,     setSaveName]     = useState("");
  const [saveFolderId, setSaveFolderId] = useState(null);
  const [nfName,       setNfName]       = useState("untitledFolder");
  const [nfParentId,   setNfParentId]   = useState(null);
  const [browseFid,    setBrowseFid]    = useState(null);
  const [saveMsg,      setSaveMsg]      = useState("");

  // ── Rename/Delete state ────────────────────────────────────
  const [renameType,   setRenameType]   = useState(null); // "file" or "folder"
  const [renameId,     setRenameId]     = useState(null);
  const [renameName,   setRenameName]   = useState("");

  const files        = phase.workspaceFiles || [];
  const activeVfsTab = vfsTabs.find(t => t.id === vfsActiveTabId);
  const code         = activeVfsTab ? activeVfsTab.content : (workspaceContents[activeFile] ?? "");
  const displayFile  = activeVfsTab ? activeVfsTab.name : activeFile;
  const isHpp        = displayFile.endsWith(".hpp");
  const fileColor    = isHpp ? "#89ddff" : phase.color;

  // The fixed VFS folder for this phase (e.g. "lexer/")
  const phaseVfsFolder = vfs.folders.find(f => f.name === phase.id && f.parentId == null);

  // ── Pipeline: completion per phase ───────────────────────
  const phaseCompletion = useMemo(() => {
    const result = {};
    BUILD_PHASE_FOLDERS.forEach(phaseName => {
      const rootFolder = vfs.folders.find(f => f.name === phaseName && f.parentId == null);
      if (!rootFolder) { result[phaseName] = false; return; }
      const ids = new Set([rootFolder.id]);
      function collectIds(fid) {
        vfs.folders.filter(f => f.parentId === fid).forEach(f => { ids.add(f.id); collectIds(f.id); });
      }
      collectIds(rootFolder.id);
      result[phaseName] = vfs.files.some(f => ids.has(f.folderId));
    });
    return result;
  }, [vfs]);

  const allPhasesComplete = Object.values(phaseCompletion).every(Boolean);

  const phaseIndex       = BUILD_PHASE_FOLDERS.indexOf(phase.id);
  const prevPhaseName    = phaseIndex > 0 ? BUILD_PHASE_FOLDERS[phaseIndex - 1] : null;
  const isPhaseLocked    = mode === "pipeline" && prevPhaseName !== null && !phaseCompletion[prevPhaseName];

  // ── ZIP generation ────────────────────────────────────────
  async function generateBuildZip() {
    const { default: JSZip } = await import("jszip");
    const zip  = new JSZip();
    const root = "my-compiler";

    function addFolderContent(zipDir, folderId) {
      vfs.folders.filter(f => f.parentId === folderId).forEach(f => {
        addFolderContent(zipDir.folder(f.name), f.id);
      });
      vfs.files.filter(f => f.folderId === folderId).forEach(f => {
        zipDir.file(f.name, f.content || "");
      });
    }

    const src = zip.folder(`${root}/src`);
    BUILD_PHASE_FOLDERS.forEach(phaseName => {
      const phaseRoot = vfs.folders.find(f => f.name === phaseName && f.parentId == null);
      const phaseDir  = src.folder(phaseName);
      if (phaseRoot) addFolderContent(phaseDir, phaseRoot.id);
    });

    zip.file(`${root}/Makefile`, MAKEFILE_TMPL);
    zip.file(`${root}/CMakeLists.txt`, CMAKE_TMPL);
    zip.file(`${root}/.vscode/tasks.json`, VSCODE_TASKS_TMPL);

    const guideLines = [
      "MY CUSTOM LANGUAGE — Language Reference Guide",
      "=============================================",
      "Generated by VEC Compiler Builder",
      "",
      "PHASES BUILT",
      "------------",
      ...BUILD_PHASE_FOLDERS.map(p => `[${phaseCompletion[p] ? "x" : " "}] ${p}`),
      "",
      "HOW TO BUILD",
      "------------",
      "Prerequisites: g++ with C++17 support",
      "",
      "  1. Extract this ZIP",
      "  2. cd my-compiler",
      "  3. make",
      "  4. Your compiler is at: ./compiler",
      "",
      "USING WITH VSCODE",
      "-----------------",
      "A .vscode/tasks.json is included.",
      "Press Ctrl+Shift+B to build, then use 'Run Compiler' task.",
      "",
      "LANGUAGE SYNTAX",
      "---------------",
      "(Fill in based on your language design)",
      "",
      "Keywords:   int, float, if, else, while, return",
      "Operators:  +, -, *, /, %, =, ==, !=, <, <=, >, >=",
      "Comments:   // single-line",
      "Statements: end with semicolon ;",
      "Blocks:     enclosed in { }",
      "",
      "EXAMPLE",
      "-------",
      "int main() {",
      "    int x = 42;",
      "    if (x > 0) { return x; }",
      "    return 0;",
      "}",
    ];
    zip.file(`${root}/LANGUAGE_GUIDE.txt`, guideLines.join("\n"));

    const blob = await zip.generateAsync({ type: "blob" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "my-compiler.zip";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleEditorChange(val) {
    if (disabled) return;
    const v = val || "";
    if (activeVfsTab) {
      setVfsTabs(prev => prev.map(t => t.id === vfsActiveTabId ? { ...t, content:v, dirty:true } : t));
    } else {
      setWorkspaceContents(prev => ({ ...prev, [activeFile]: v }));
    }
  }

  function handleReset() {
    if (activeVfsTab) return;
    const fresh = {};
    files.forEach(f => { fresh[f.name] = f.content; });
    setWorkspaceContents(fresh);
  }

  function handleCopy() {
    navigator.clipboard.writeText(code);
  }

  function handleTryInCompiler() {
    window.__METAMIC_SOURCE__ = code;
    sessionStorage.setItem("metamic_prefill", code);
    navigate("/app");
  }

  function handleRunSim() {
    if (activeVfsTab) return;
    setShowOutput(true);
    setRunSimulated(false);
    setTimeout(() => setRunSimulated(true), 700);
  }

  // ── VFS tab actions ───────────────────────────────────────
  function openVFSFile(file) {
    const existing = vfsTabs.find(t => t.savedFileId === file.id);
    if (existing) { setVfsActiveTabId(existing.id); setModal(null); return; }
    const id = genId();
    setVfsTabs(prev => [...prev, { id, name:file.name, content:file.content||"", savedFileId:file.id, dirty:false }]);
    setVfsActiveTabId(id);
    setModal(null);
  }

  function closeVfsTab(tabId, e) {
    e?.stopPropagation();
    setVfsTabs(prev => {
      const next = prev.filter(t => t.id !== tabId);
      if (tabId === vfsActiveTabId) {
        const idx = prev.findIndex(t => t.id === tabId);
        const newActive = next[Math.max(0, idx - 1)];
        setVfsActiveTabId(newActive?.id ?? null);
      }
      return next;
    });
  }

  function newVfsTab() {
    if (!user) return;
    vfsTabCountRef.current++;
    const id = genId();
    setVfsTabs(prev => [...prev, { id, name:`untitled${vfsTabCountRef.current}.cpp`, content:"", savedFileId:null, dirty:false }]);
    setVfsActiveTabId(id);
  }

  // ── VFS Save ──────────────────────────────────────────────
  function openSaveModal() {
    if (!user) return;
    const name = activeVfsTab ? activeVfsTab.name : activeFile;
    setSaveName(name.replace(/\.(cpp|hpp)$/, ""));
    setSaveFolderId(phaseVfsFolder?.id ?? null);
    setSaveStep(1);
    setModal("saveFile");
  }

  function confirmSaveFile() {
    const raw   = saveName.trim() || "untitled";
    const base  = raw.replace(/\.(cpp|hpp)$/, "");
    const ext   = raw.endsWith(".hpp") ? ".hpp" : ".cpp";
    const fname = (base || "untitled") + ext;
    const content = code;
    const newVfs  = { folders:[...vfs.folders], files:[...vfs.files] };

    // ── Auto-create phase folder on first save ────────────────────────────
    let effectiveFolderId = saveFolderId;
    let currentPhaseFolder = newVfs.folders.find(f => f.name === phase.id && f.parentId == null);
    if (!currentPhaseFolder) {
      currentPhaseFolder = { id: genId(), name: phase.id, parentId: null };
      newVfs.folders.push(currentPhaseFolder);
      // If user hasn't selected a location, default to the newly created phase folder
      if (!effectiveFolderId) effectiveFolderId = currentPhaseFolder.id;
    }

    if (activeVfsTab?.savedFileId && newVfs.files.find(f => f.id === activeVfsTab.savedFileId)) {
      newVfs.files = newVfs.files.map(f =>
        f.id === activeVfsTab.savedFileId
          ? { ...f, name:fname, content, folderId:effectiveFolderId }
          : f
      );
      setVfsTabs(prev => prev.map(t => t.id === vfsActiveTabId ? { ...t, name:fname, dirty:false } : t));
    } else {
      const fileId = genId();
      newVfs.files.push({ id:fileId, name:fname, folderId:effectiveFolderId, content });
      if (activeVfsTab) {
        setVfsTabs(prev => prev.map(t => t.id === vfsActiveTabId ? { ...t, name:fname, savedFileId:fileId, dirty:false } : t));
      }
    }
    updateVfs(newVfs);
    setModal(null);
    setSaveMsg("Saved to Files.");
    setTimeout(() => setSaveMsg(""), 2000);
  }

  // ── New Folder ────────────────────────────────────────────
  function openNewFolderModal(returnTo) {
    if (!user) return;
    setNfName("untitledFolder");
    // default parent: inside the save location (or phase root if no selection)
    setNfParentId(returnTo ? saveFolderId : (phaseVfsFolder?.id ?? null));
    setModal(returnTo ? "nfFromSave" : "newFolder");
  }

  function confirmNewFolder(returnTo) {
    const name   = nfName.trim() || "untitledFolder";
    const id     = genId();
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
  // ── Rename/Delete actions ──────────────────────────────
  function openRenameModal(type, id, currentName) {
    setRenameType(type);
    setRenameId(id);
    setRenameName(currentName);
    setModal("rename");
  }

  function confirmRename() {
    if (!renameName.trim()) { setModal(null); return; }
    const newVfs = { folders:[...vfs.folders], files:[...vfs.files] };
    
    if (renameType === "file") {
      newVfs.files = newVfs.files.map(f => f.id === renameId ? { ...f, name:renameName } : f);
      setVfsTabs(prev => prev.map(t => t.savedFileId === renameId ? { ...t, name:renameName } : t));
    } else if (renameType === "folder") {
      newVfs.folders = newVfs.folders.map(f => f.id === renameId ? { ...f, name:renameName } : f);
    }
    
    updateVfs(newVfs);
    setModal(null);
  }

  function deleteItem(type, id) {
    const newVfs = { folders:[...vfs.folders], files:[...vfs.files] };
    
    if (type === "file") {
      newVfs.files = newVfs.files.filter(f => f.id !== id);
      setVfsTabs(prev => prev.filter(t => t.savedFileId !== id));
    } else if (type === "folder") {
      const toRemove = new Set([id]);
      function collect(fid) {
        toRemove.add(fid);
        newVfs.folders.filter(f => f.parentId === fid).forEach(f => collect(f.id));
      }
      collect(id);
      newVfs.folders = newVfs.folders.filter(f => !toRemove.has(f.id));
      newVfs.files = newVfs.files.filter(f => !toRemove.has(f.folderId));
    }
    
    updateVfs(newVfs);
  }
  // ── Recursive render helpers ──────────────────────────────
  function renderFolderSelectTree(folderId, depth, selectedId, onSelect) {
    return vfs.folders.filter(f => f.parentId === folderId).map(folder => (
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
    const subs     = vfs.folders.filter(f => f.parentId === folderId);
    const vfsFiles = vfs.files.filter(f => f.folderId === folderId);
    return (
      <>
        {subs.map(folder => {
          const isOpen = expanded[folder.id];
          return (
            <div key={folder.id}>
              <div
                onClick={() => setExpanded(p => ({ ...p, [folder.id]:!p[folder.id] }))}
                style={{ display:"flex", alignItems:"center", gap:4, padding:`3px 8px 3px ${12+depth*12}px`, cursor:"pointer", fontSize:12, color:"rgba(255,255,255,0.65)", fontFamily:"'JetBrains Mono',monospace", borderRadius:3, justifyContent:"space-between" }}
                onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.05)"}
                onMouseLeave={e=>e.currentTarget.style.background="transparent"}
              >
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontSize:9,opacity:0.6}}>{isOpen?"▼":"▶"}</span>
                  <span style={{color:"#fbbf24",fontSize:13}}>📁</span>
                  {folder.name}
                </div>
                <div style={{display:"flex",gap:2}}>
                  <button
                    onClick={e => { e.stopPropagation(); openRenameModal("folder", folder.id, folder.name); }}
                    title="Rename"
                    style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.35)",cursor:"pointer",fontSize:11,padding:"0 3px"}}
                    onMouseEnter={e=>e.currentTarget.style.color="#e2eeff"}
                    onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.35)"}
                  >✏</button>
                  <button
                    onClick={e => { e.stopPropagation(); deleteItem("folder", folder.id); }}
                    title="Delete"
                    style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.35)",cursor:"pointer",fontSize:11,padding:"0 3px"}}
                    onMouseEnter={e=>e.currentTarget.style.color="#ff6b6b"}
                    onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.35)"}
                  >🗑</button>
                </div>
              </div>
              {isOpen && renderFolderNode(folder.id, depth+1)}
            </div>
          );
        })}
        {vfsFiles.map(file => {
          const isActive = vfsTabs.some(t => t.savedFileId===file.id && t.id===vfsActiveTabId);
          return (
            <div key={file.id}
              style={{ padding:`3px 8px 3px ${20+depth*12}px`, cursor:"pointer", fontSize:12, color: isActive?"#82aaff":"rgba(255,255,255,0.55)", fontFamily:"'JetBrains Mono',monospace", borderRadius:3, background: isActive?"rgba(130,170,255,0.08)":"transparent", display:"flex", alignItems:"center", justifyContent:"space-between", gap:5 }}
              onClick={() => openVFSFile(file)}
              onMouseEnter={e=>{ if(!isActive) e.currentTarget.style.background="rgba(255,255,255,0.04)"; }}
              onMouseLeave={e=>{ if(!isActive) e.currentTarget.style.background="transparent"; }}
            >
              <div style={{display:"flex",alignItems:"center",gap:5}}>
                <span style={{fontSize:11,opacity:0.5}}>📄</span>{file.name}
              </div>
              <div style={{display:"flex",gap:2}}>
                <button
                  onClick={e => { e.stopPropagation(); openRenameModal("file", file.id, file.name); }}
                  title="Rename"
                  style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.35)",cursor:"pointer",fontSize:11,padding:"0 3px"}}
                  onMouseEnter={e=>e.currentTarget.style.color="#e2eeff"}
                  onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.35)"}
                >✏</button>
                <button
                  onClick={e => { e.stopPropagation(); deleteItem("file", file.id); }}
                  title="Delete"
                  style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.35)",cursor:"pointer",fontSize:11,padding:"0 3px"}}
                  onMouseEnter={e=>e.currentTarget.style.color="#ff6b6b"}
                  onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.35)"}
                >🗑</button>
              </div>
            </div>
          );
        })}
      </>
    );
  }

  return (
    <div style={{ display:"flex", flexDirection:"column", overflow:"hidden", background:"#04030f", height:"100%", position:"relative" }}>

      {/* ── Pipeline Progress Bar ────────────────────────── */}
      {mode === "pipeline" && (
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"7px 14px", background:"#060918", borderBottom:"1px solid rgba(255,255,255,0.06)", flexShrink:0, gap:6, flexWrap:"wrap" }}>
          <div style={{ display:"flex", alignItems:"center", gap:3, flexWrap:"wrap" }}>
            {BUILD_PHASE_FOLDERS.map((phaseName, i) => {
              const done      = phaseCompletion[phaseName];
              const isCurrent = phase.id === phaseName;
              const col       = PHASE_COLORS[phaseName];
              return (
                <div key={phaseName} style={{ display:"flex", alignItems:"center", gap:3 }}>
                  <div style={{
                    display:"flex", alignItems:"center", gap:5, padding:"3px 9px", borderRadius:5,
                    background: isCurrent ? `${col}18` : "transparent",
                    border:     isCurrent ? `1px solid ${col}44` : "1px solid transparent",
                  }}>
                    <span style={{ fontSize:10, color: done ? "#06ffa5" : "rgba(255,255,255,0.2)" }}>
                      {done ? "✓" : "○"}
                    </span>
                    <span style={{
                      fontFamily:"'JetBrains Mono',monospace", fontSize:10,
                      color: done ? "#06ffa5" : (isCurrent ? col : "rgba(255,255,255,0.3)"),
                      fontWeight: isCurrent ? 700 : 400,
                    }}>
                      {phaseName}
                    </span>
                  </div>
                  {i < 5 && <span style={{ color:"rgba(255,255,255,0.15)", fontSize:10 }}>→</span>}
                </div>
              );
            })}
          </div>
          {allPhasesComplete ? (
            <button onClick={generateBuildZip} style={{
              fontFamily:"'JetBrains Mono',monospace", fontSize:11, padding:"6px 16px",
              borderRadius:6, border:"none", background:"linear-gradient(135deg,#10b981,#059669)",
              color:"#fff", cursor:"pointer", fontWeight:700, flexShrink:0, whiteSpace:"nowrap",
              boxShadow:"0 0 12px rgba(16,185,129,0.3)",
            }}>
              ⬇ Build ZIP
            </button>
          ) : (
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:"rgba(255,255,255,0.25)", flexShrink:0, whiteSpace:"nowrap" }}>
              {Object.values(phaseCompletion).filter(Boolean).length}/6 phases saved
            </span>
          )}
        </div>
      )}

      {/* ── Toolbar ─────────────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"9px 14px", background:"rgba(5,8,18,0.9)", borderBottom:"1px solid rgba(255,255,255,0.05)", flexShrink:0, gap:"8px", flexWrap:"wrap" }}>
        <div style={{ display:"flex", alignItems:"center", gap:"7px" }}>
          <div style={{ width:6, height:6, borderRadius:"50%", background:fileColor, boxShadow:`0 0 5px ${fileColor}`, flexShrink:0 }}/>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", color:fileColor, letterSpacing:"0.5px" }}>{displayFile}</span>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"9px", color:"rgba(255,255,255,0.2)", marginLeft:"4px" }}>{phase.label}</span>
        </div>
        <div style={{ display:"flex", gap:"6px", flexWrap:"wrap", alignItems:"center" }}>
          {!activeVfsTab && <button onClick={handleReset} style={GHOST_BTN}>↺ Reset</button>}
          <button onClick={handleCopy} style={GHOST_BTN}>⧉ Copy</button>
          {!activeVfsTab && (
            <button onClick={handleRunSim} style={{ ...GHOST_BTN, border:`1px solid ${phase.color}44`, background:`${phase.color}11`, color:phase.color }}>
              ▶ Run Simulation
            </button>
          )}
          <button onClick={handleTryInCompiler} style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", padding:"4px 14px", borderRadius:"5px", border:"none", background:`linear-gradient(135deg,${phase.color}cc,${phase.color}88)`, color:"#000", cursor:"pointer", fontWeight:700, transition:"all 0.15s" }}>
            ▶ Try in Compiler
          </button>
          {user && (
            <button onClick={openSaveModal} style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", padding:"4px 10px", borderRadius:"5px", border:"1px solid rgba(255,255,255,0.15)", background:"rgba(79,70,229,0.2)", color:"#a5b4fc", cursor:"pointer", transition:"all 0.15s" }}>
              💾 Save File
            </button>
          )}
          {saveMsg && <span style={{fontSize:10,color:"#06ffa5",fontFamily:"'JetBrains Mono',monospace"}}>{saveMsg}</span>}
        </div>
      </div>

      {/* ── Sub-toolbar: file system (logged-in only) ─── */}
      {user && (
        <div style={{ display:"flex", alignItems:"center", height:32, background:"#06091a", borderBottom:"1px solid rgba(255,255,255,0.05)", flexShrink:0, paddingLeft:6, gap:2 }}>
          <button onClick={() => setShowExplorer(p => !p)} style={SB(showExplorer)} title="Toggle Explorer">☰</button>
          <div style={{ width:1, height:16, background:"rgba(255,255,255,0.08)", margin:"0 3px" }}/>
          <button onClick={newVfsTab}                                                style={SB(false)}>New File</button>
          <button onClick={() => openNewFolderModal(false)}                          style={SB(false)}>New Folder</button>
          <button onClick={() => { setBrowseFid(phaseVfsFolder?.id ?? null); setModal("openFile"); }}      style={SB(false)}>Open File</button>
          <button onClick={() => { setBrowseFid(phaseVfsFolder?.id ?? null); setModal("openFolder"); }} style={SB(false)}>Open Folder</button>
        </div>
      )}

      {/* ── Body: explorer + editor column ──────────────── */}
      <div style={{ flex:1, overflow:"hidden", display:"flex", position:"relative" }}>

        {/* Pipeline phase-locked overlay */}
        {isPhaseLocked && (
          <div style={{
            position:"absolute", inset:0, zIndex:6,
            background:"rgba(4,3,15,0.88)", backdropFilter:"blur(4px)",
            display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:14,
          }}>
            <span style={{ fontSize:32 }}>🔒</span>
            <div style={{ textAlign:"center" }}>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:16, color:"#e2eeff", marginBottom:6 }}>
                Complete <span style={{ color: PHASE_COLORS[prevPhaseName] }}>{prevPhaseName}/</span> first
              </div>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:"rgba(255,255,255,0.35)" }}>
                Save at least one file in the <strong style={{color:"rgba(255,255,255,0.55)"}}>{prevPhaseName}</strong> phase to unlock this phase
              </div>
            </div>
          </div>
        )}


        {/* Explorer sidebar */}
        {showExplorer && user && (
          <div style={{ width:200, background:"#040610", borderRight:"1px solid rgba(255,255,255,0.05)", display:"flex", flexDirection:"column", flexShrink:0, overflow:"hidden" }}>
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
                  <button onClick={newVfsTab} title="New File"
                    style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:14,padding:"0 3px"}}
                    onMouseEnter={e=>e.currentTarget.style.color="#e2eeff"}
                    onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.3)"}>+</button>
                  <button onClick={() => openNewFolderModal(false)} title="New Folder"
                    style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:12,padding:"0 3px"}}
                    onMouseEnter={e=>e.currentTarget.style.color="#e2eeff"}
                    onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.3)"}>📁</button>
                </div>
              )}
            </div>
            {explorerOpen && (
              <div style={{ flex:1, overflowY:"auto", scrollbarWidth:"thin", scrollbarColor:"#1a2040 transparent" }}>
                {vfs.folders.length === 0 && vfs.files.length === 0 ? (
                  <div style={{ padding:"20px 12px", textAlign:"center", color:"rgba(255,255,255,0.15)", fontSize:11, fontFamily:"'JetBrains Mono',monospace", lineHeight:1.9 }}>
                    No files yet.<br/>
                    <span style={{color:"#82aaff",cursor:"pointer"}} onClick={newVfsTab}>New File</span>
                    {" or "}
                    <span style={{color:"#82aaff",cursor:"pointer"}} onClick={() => openNewFolderModal(false)}>New Folder</span>
                  </div>
                ) : (
                  <>
                    {vfs.files.filter(f => !f.folderId).map(file => {
                      const isActive = vfsTabs.some(t => t.savedFileId===file.id && t.id===vfsActiveTabId);
                      return (
                        <div key={file.id}
                          style={{ padding:"3px 8px 3px 20px", cursor:"pointer", fontSize:12, color: isActive?"#82aaff":"rgba(255,255,255,0.55)", fontFamily:"'JetBrains Mono',monospace", borderRadius:3, background: isActive?"rgba(130,170,255,0.08)":"transparent", display:"flex", alignItems:"center", justifyContent:"space-between", gap:5 }}
                          onClick={() => openVFSFile(file)}
                          onMouseEnter={e=>{ if(!isActive) e.currentTarget.style.background="rgba(255,255,255,0.04)"; }}
                          onMouseLeave={e=>{ if(!isActive) e.currentTarget.style.background="transparent"; }}
                        >
                          <div style={{display:"flex",alignItems:"center",gap:5}}>
                            <span style={{fontSize:11,opacity:0.4}}>📄</span>{file.name}
                          </div>
                          <div style={{display:"flex",gap:2}}>
                            <button
                              onClick={e => { e.stopPropagation(); openRenameModal("file", file.id, file.name); }}
                              title="Rename"
                              style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.35)",cursor:"pointer",fontSize:11,padding:"0 3px"}}
                              onMouseEnter={e=>e.currentTarget.style.color="#e2eeff"}
                              onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.35)"}
                            >✏</button>
                            <button
                              onClick={e => { e.stopPropagation(); deleteItem("file", file.id); }}
                              title="Delete"
                              style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.35)",cursor:"pointer",fontSize:11,padding:"0 3px"}}
                              onMouseEnter={e=>e.currentTarget.style.color="#ff6b6b"}
                              onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.35)"}
                            >🗑</button>
                          </div>
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

        {/* Editor column */}
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

          {/* ── File tabs ─────────────────────────────── */}
          <div style={{ display:"flex", gap:"2px", padding:"0 6px 0 0", background:"rgba(4,4,16,0.8)", borderBottom:"1px solid rgba(255,255,255,0.05)", flexShrink:0, overflowX:"auto", scrollbarWidth:"none" }}>

            {/* Phase workspace file tabs */}
            {files.map(f => {
              const fIsHpp  = f.name.endsWith(".hpp");
              const fColor  = fIsHpp ? "#89ddff" : phase.color;
              const isActive = f.name === activeFile && !vfsActiveTabId;
              return (
                <button key={f.name}
                  onClick={() => { setActiveFile(f.name); setVfsActiveTabId(null); }}
                  style={{ padding:"7px 14px", background: isActive ? "rgba(255,255,255,0.04)" : "transparent", border:"none", borderBottom: isActive ? `2px solid ${fColor}` : "2px solid transparent", color: isActive ? fColor : "rgba(255,255,255,0.3)", fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", fontWeight: isActive ? 700 : 400, cursor:"pointer", whiteSpace:"nowrap", transition:"all 0.12s", flexShrink:0 }}
                  onMouseEnter={e=>{ if(!isActive) e.currentTarget.style.color="#e2eeff"; }}
                  onMouseLeave={e=>{ if(!isActive) e.currentTarget.style.color="rgba(255,255,255,0.3)"; }}
                >
                  <span style={{ display:"inline-block", width:5, height:5, borderRadius:"50%", background:fColor, opacity: isActive ? 1 : 0.35, marginRight:"6px", verticalAlign:"middle" }}/>
                  {f.name}
                </button>
              );
            })}

            {/* VFS file tabs */}
            {vfsTabs.map(tab => {
              const isActive = tab.id === vfsActiveTabId;
              return (
                <div key={tab.id} onClick={() => setVfsActiveTabId(tab.id)}
                  style={{ display:"flex", alignItems:"center", gap:5, padding:"0 10px 0 13px", height:"100%", borderRight:"1px solid rgba(255,255,255,0.05)", borderBottom: isActive ? "2px solid #82aaff" : "2px solid transparent", background: isActive ? "rgba(130,170,255,0.06)" : "transparent", cursor:"pointer", fontFamily:"'JetBrains Mono',monospace", fontSize:10, color: isActive ? "#e2eeff" : "rgba(255,255,255,0.38)", whiteSpace:"nowrap", flexShrink:0, userSelect:"none" }}
                  onMouseEnter={e=>{ if(!isActive) e.currentTarget.style.color="#e2eeff"; }}
                  onMouseLeave={e=>{ if(!isActive) e.currentTarget.style.color="rgba(255,255,255,0.38)"; }}
                >
                  <span style={{fontSize:10,opacity:0.4}}>📄</span>
                  {tab.name}
                  {tab.dirty && <span style={{color:"#82aaff",fontSize:8,marginLeft:1}}>●</span>}
                  <button onClick={e => closeVfsTab(tab.id, e)}
                    style={{ background:"transparent", border:"none", color:"rgba(255,255,255,0.25)", cursor:"pointer", fontSize:11, padding:"0 1px", marginLeft:3, lineHeight:1, borderRadius:2 }}
                    onMouseEnter={e=>{ e.stopPropagation(); e.currentTarget.style.color="#e2eeff"; }}
                    onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.25)"}
                  >✕</button>
                </div>
              );
            })}

            {/* + new VFS tab */}
            {user && (
              <button onClick={newVfsTab}
                style={{ background:"transparent", border:"none", color:"rgba(255,255,255,0.25)", cursor:"pointer", padding:"0 13px", height:"100%", fontSize:18, fontFamily:"'JetBrains Mono',monospace" }}
                onMouseEnter={e=>e.currentTarget.style.color="#e2eeff"}
                onMouseLeave={e=>e.currentTarget.style.color="rgba(255,255,255,0.25)"}
              >+</button>
            )}

            {/* Output console toggle */}
            <button onClick={() => setShowOutput(v => !v)}
              style={{ marginLeft:"auto", padding:"7px 12px", background: showOutput ? "rgba(6,255,165,0.08)" : "transparent", border:"none", borderBottom: showOutput ? "2px solid #06ffa5" : "2px solid transparent", color: showOutput ? "#06ffa5" : "rgba(255,255,255,0.25)", fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", cursor:"pointer", whiteSpace:"nowrap", flexShrink:0, transition:"all 0.12s" }}
            >
              ⬛ Output
            </button>
          </div>

          {/* ── Editor area ───────────────────────────── */}
          <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden" }}>

            {/* Monaco editor */}
            <div style={{ flex: showOutput ? "0 0 55%" : "1", overflow:"hidden" }}>
              <Editor
                height="100%"
                defaultLanguage="cpp"
                value={code}
                onChange={handleEditorChange}
                theme="vs-dark"
                options={{ fontSize:editorSettings.fontSize, minimap:{enabled:false}, fontFamily:"JetBrains Mono", smoothScrolling:true, cursorBlinking:"smooth", cursorSmoothCaretAnimation:"on", roundedSelection:true, automaticLayout:true, tabSize:editorSettings.tabSize, padding:{top:14}, scrollBeyondLastLine:false, renderLineHighlight:"gutter", wordWrap:"off", readOnly:disabled }}
              />
            </div>

            {/* Output console */}
            {showOutput && (
              <div style={{ flex:"1", display:"flex", flexDirection:"column", borderTop:"1px solid rgba(6,255,165,0.15)", background:"#020b10", overflow:"hidden" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"6px 14px", borderBottom:"1px solid rgba(255,255,255,0.05)", flexShrink:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                    <div style={{ width:8, height:8, borderRadius:"50%", background: runSimulated ? "#06ffa5" : "#ffcb6b", boxShadow: runSimulated ? "0 0 6px #06ffa5" : "0 0 6px #ffcb6b", animation: runSimulated ? "none" : "rtpulse 1s ease-in-out infinite" }}/>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"9px", letterSpacing:"1.5px", color: runSimulated ? "#06ffa5" : "#ffcb6b" }}>
                      {runSimulated ? "OUTPUT — SIMULATION COMPLETE" : "RUNNING SIMULATION…"}
                    </span>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"9px", color:"rgba(255,255,255,0.2)" }}>{phase.label}</span>
                  </div>
                  <button onClick={() => setShowOutput(false)} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.3)", cursor:"pointer", fontSize:"12px", padding:"2px 6px" }}>✕</button>
                </div>
                <div style={{ flex:1, overflowY:"auto", padding:"12px 16px", fontFamily:"'JetBrains Mono',monospace", fontSize:"11.5px", lineHeight:1.75, scrollbarWidth:"thin", scrollbarColor:"rgba(6,255,165,0.2) transparent" }}>
                  {!runSimulated ? (
                    <div style={{ color:"#ffcb6b", opacity:0.7 }}>Running simulation…</div>
                  ) : (
                    (phase.outputSample || "").split("\n").map((line, i) => {
                      let color = "rgba(255,255,255,0.55)";
                      if (line.startsWith("✓"))                                                       color = "#06ffa5";
                      else if (line.startsWith("[FOLD]")||line.startsWith("[PROP]")||line.startsWith("[DEAD]")) color = "#ffcb6b";
                      else if (line.startsWith("[DECLARE]")||line.startsWith("[SCOPE]")||line.startsWith("[TYPE]")||line.startsWith("[ASSIGN]")) color = "#89ddff";
                      else if (line.startsWith(";"))                                                  color = "rgba(255,255,255,0.25)";
                      else if (line.startsWith("["))                                                  color = "#c3e88d";
                      else if (/^\s*(t\d|R\d|L\d)/.test(line))                                       color = "#c792ea";
                      else if (line.match(/^(Before|After|Tokenizing|Parsing|Semantic|Generating|Optimizing):/)) color = "#4d9fff";
                      else if (line.trim() === "")                                                    color = "transparent";
                      return <div key={i} style={{ color, marginBottom: line.trim() ? "0" : "6px" }}>{line || " "}</div>;
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ══════════════════════ MODALS ══════════════════════ */}

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
                <div style={{display:"flex",gap:6,alignItems:"center"}}>
                  <input autoFocus value={saveName} onChange={e => setSaveName(e.target.value.replace(/\.(cpp|hpp)$/, ""))}
                    onKeyDown={e => { if (e.key === "Enter") setSaveStep(2); }}
                    placeholder="filename" style={{...INPUT_S, flex:1}} />
                  <select value={saveName.endsWith(".hpp") ? ".hpp" : ".cpp"}
                    onChange={e => {
                      const base = saveName.replace(/\.(cpp|hpp)$/, "");
                      setSaveName(base + e.target.value);
                    }}
                    style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:6, padding:"9px 8px", color:"#e2eeff", fontFamily:"'JetBrains Mono',monospace", fontSize:12, outline:"none", cursor:"pointer" }}
                  >
                    <option value=".cpp">.cpp</option>
                    <option value=".hpp">.hpp</option>
                  </select>
                </div>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.25)",fontFamily:"'JetBrains Mono',monospace",marginTop:6}}>
                  Build only accepts .cpp and .hpp files
                </div>
                <div style={{display:"flex",justifyContent:"flex-end",marginTop:14,gap:8}}>
                  <button onClick={() => setModal(null)} style={GHOST_S}>Cancel</button>
                  <button onClick={() => setSaveStep(2)}  style={PRIM_S}>Next →</button>
                </div>
              </>
            )}
            {saveStep === 2 && (
              <>
                <label style={LABEL_S}>Choose location inside <span style={{color:phase.color}}>{phase.id}/</span></label>
                <div style={{fontSize:10,color:"rgba(255,255,255,0.3)",fontFamily:"'JetBrains Mono',monospace",marginBottom:8}}>
                  {phaseVfsFolder
                    ? (saveFolderId === phaseVfsFolder.id
                        ? `/${phase.id}`
                        : getFolderPath(vfs.folders, saveFolderId))
                    : `/${phase.id} (will be created on save)`}
                </div>
                <div style={{maxHeight:190,overflowY:"auto",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"4px 0",marginBottom:8}}>
                  {/* Phase root row */}
                  {phaseVfsFolder && (
                    <div
                      onClick={() => setSaveFolderId(phaseVfsFolder.id)}
                      style={{ ...BROWSE_ROW, background: saveFolderId===phaseVfsFolder.id?"rgba(130,170,255,0.1)":"transparent", color: saveFolderId===phaseVfsFolder.id?"#82aaff":"rgba(255,255,255,0.55)" }}
                      onMouseEnter={e=>{ if(saveFolderId!==phaseVfsFolder.id) e.currentTarget.style.background="rgba(255,255,255,0.04)"; }}
                      onMouseLeave={e=>{ if(saveFolderId!==phaseVfsFolder.id) e.currentTarget.style.background="transparent"; }}
                    >
                      <span style={{color:"#fbbf24"}}>📁</span>{phase.id}/
                    </div>
                  )}
                  {/* Subfolders inside the phase folder only */}
                  {phaseVfsFolder && renderFolderSelectTree(phaseVfsFolder.id, 1, saveFolderId, setSaveFolderId)}
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
            <label style={{...LABEL_S, marginTop:12}}>Parent — inside <span style={{color:phase.color}}>{phase.id}/</span></label>
            <div style={{maxHeight:150,overflowY:"auto",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"4px 0",marginBottom:16}}>
              {phaseVfsFolder && (
                <div onClick={() => setNfParentId(phaseVfsFolder.id)}
                  style={{...BROWSE_ROW, background: nfParentId===phaseVfsFolder.id?"rgba(130,170,255,0.1)":"transparent", color: nfParentId===phaseVfsFolder.id?"#82aaff":"rgba(255,255,255,0.55)"}}>
                  <span style={{color:"#fbbf24"}}>📁</span>{phase.id}/
                </div>
              )}
              {phaseVfsFolder && renderFolderSelectTree(phaseVfsFolder.id, 1, nfParentId, setNfParentId)}
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
              <button onClick={() => setModal(null)}            style={GHOST_S}>Cancel</button>
              <button onClick={() => confirmNewFolder(false)}   style={PRIM_S}>Create</button>
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
            <label style={{...LABEL_S, marginTop:12}}>Parent — inside <span style={{color:phase.color}}>{phase.id}/</span></label>
            <div style={{maxHeight:150,overflowY:"auto",border:"1px solid rgba(255,255,255,0.08)",borderRadius:6,padding:"4px 0",marginBottom:16}}>
              {phaseVfsFolder && (
                <div onClick={() => setNfParentId(phaseVfsFolder.id)}
                  style={{...BROWSE_ROW, background: nfParentId===phaseVfsFolder.id?"rgba(130,170,255,0.1)":"transparent", color: nfParentId===phaseVfsFolder.id?"#82aaff":"rgba(255,255,255,0.55)"}}>
                  <span style={{color:"#fbbf24"}}>📁</span>{phase.id}/
                </div>
              )}
              {phaseVfsFolder && renderFolderSelectTree(phaseVfsFolder.id, 1, nfParentId, setNfParentId)}
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8}}>
              <button onClick={() => setModal("saveFile")}   style={GHOST_S}>Cancel</button>
              <button onClick={() => confirmNewFolder(true)} style={PRIM_S}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Modal */}
      {modal === "rename" && (
        <div style={OVERLAY}>
          <div style={MODAL_BOX}>
            <div style={MH_STYLE}>Rename {renameType} <button onClick={() => setModal(null)} style={CLOSE_BTN}>✕</button></div>
            <label style={LABEL_S}>New name</label>
            <input autoFocus value={renameName} onChange={e => setRenameName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") confirmRename(); }}
              style={INPUT_S} />
            <div style={{display:"flex",justifyContent:"flex-end",marginTop:14,gap:8}}>
              <button onClick={() => setModal(null)} style={GHOST_S}>Cancel</button>
              <button onClick={confirmRename}        style={PRIM_S}>Rename</button>
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

      <style>{`@keyframes rtpulse { 0%,100%{opacity:1} 50%{opacity:.35} }`}</style>
    </div>
  );
}

const GHOST_BTN = {
  fontFamily:  "'JetBrains Mono',monospace",
  fontSize:    "10px",
  padding:     "4px 12px",
  borderRadius:"5px",
  border:      "1px solid rgba(255,255,255,0.1)",
  background:  "transparent",
  color:       "rgba(255,255,255,0.35)",
  cursor:      "pointer",
  transition:  "all 0.15s",
};
