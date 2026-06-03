import { useState, useEffect, useRef } from "react";
import { loadBuildVFS, fetchVFS, pushVFS, genId } from "../../../utils/vfs";
import { downloadFile } from "../../../utils/fileHelpers";
import { GHOST_BTN } from "../../../constants/dashboardStyles";
import BuildHeader from "../BuildHeader";
import BuildQueue from "../BuildQueue";

const BUILD_PHASES = [
  { id: "lexer",     label: "Lexer",     color: "#4488ff" },
  { id: "parser",    label: "Parser",    color: "#aa44ff" },
  { id: "semantic",  label: "Semantic",  color: "#44aaff" },
  { id: "ir",        label: "IR Gen",    color: "#44ffaa" },
  { id: "optimizer", label: "Optimizer", color: "#ffaa44" },
  { id: "codegen",   label: "CodeGen",   color: "#ff4488" },
];

export default function BuildSection({ user, token, navigate }) {
  const [buildVfs, setBuildVfs]         = useState(() => user ? loadBuildVFS(user.id) : { folders: [], files: [] });
  const [expandedPhase, setExpandedPhase]     = useState(null);
  const [expandedFolders, setExpandedFolders] = useState({});
  const [renameId,    setRenameId]    = useState(null);
  const [renameName,  setRenameName]  = useState("");
  const [renameType,  setRenameType]  = useState("");
  const [createPhase, setCreatePhase] = useState(null);
  const [createType,  setCreateType]  = useState("file");
  const [createName,  setCreateName]  = useState("");
  const buildImportRef      = useRef(null);
  const buildImportPhaseRef = useRef(null);

  useEffect(() => {
    fetchVFS(token, "build").then(serverData => {
      const hasServer = serverData && (serverData.folders?.length > 0 || serverData.files?.length > 0);
      const local     = user ? loadBuildVFS(user.id) : { folders: [], files: [] };
      const hasLocal  = local.folders.length > 0 || local.files.length > 0;
      if (hasServer) {
        setBuildVfs(serverData);
        if (user) localStorage.setItem(`metamic_build_vfs_${user.id}`, JSON.stringify(serverData));
      } else if (hasLocal) {
        pushVFS(token, local, "build");
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function saveBuildVfs(updated) {
    setBuildVfs(updated);
    if (user) localStorage.setItem(`metamic_build_vfs_${user.id}`, JSON.stringify(updated));
    pushVFS(token, updated, "build");
  }

  function startRename(type, id, name, e) {
    e.stopPropagation();
    setRenameType(type); setRenameId(id); setRenameName(name);
  }

  function commitRename() {
    if (!renameName.trim()) { setRenameId(null); return; }
    if (renameType === "folder") {
      saveBuildVfs({ ...buildVfs, folders: buildVfs.folders.map(f => f.id === renameId ? { ...f, name: renameName.trim() } : f) });
    } else {
      saveBuildVfs({ ...buildVfs, files: buildVfs.files.map(f => f.id === renameId ? { ...f, name: renameName.trim() } : f) });
    }
    setRenameId(null);
  }

  function handleDeleteFolder(id, e) {
    e.stopPropagation();
    const toRemove = new Set([id]);
    function collect(fid) {
      buildVfs.folders.filter(f => f.parentId === fid).forEach(f => { toRemove.add(f.id); collect(f.id); });
    }
    collect(id);
    saveBuildVfs({ folders: buildVfs.folders.filter(f => !toRemove.has(f.id)), files: buildVfs.files.filter(f => !toRemove.has(f.folderId)) });
  }

  function handleDeleteFile(id, e) {
    e.stopPropagation();
    saveBuildVfs({ ...buildVfs, files: buildVfs.files.filter(f => f.id !== id) });
  }

  function handleCreate(phaseId) {
    const name = createName.trim();
    if (!name) return;
    const updated = { folders: [...buildVfs.folders], files: [...buildVfs.files] };
    let phaseFolder = updated.folders.find(f => f.name === phaseId && f.parentId == null);
    if (!phaseFolder) {
      phaseFolder = { id: genId(), name: phaseId, parentId: null };
      updated.folders.push(phaseFolder);
    }
    if (createType === "folder") {
      updated.folders.push({ id: genId(), name, parentId: phaseFolder.id });
    } else {
      const fname = name.endsWith(".cpp") || name.endsWith(".hpp") ? name : name + ".cpp";
      updated.files.push({ id: genId(), name: fname, folderId: phaseFolder.id, content: "" });
    }
    saveBuildVfs(updated);
    setCreateName(""); setCreatePhase(null); setExpandedPhase(phaseId);
  }

  function triggerBuildImport(phaseId) {
    buildImportPhaseRef.current = phaseId;
    buildImportRef.current?.click();
  }

  function handleBuildImport(e) {
    const fileList = Array.from(e.target.files || []);
    e.target.value = "";
    if (!fileList.length) return;
    const phaseId = buildImportPhaseRef.current;
    Promise.all(fileList.map(f => new Promise(res => {
      const r = new FileReader();
      r.onload = ev => res({ name: f.name, content: ev.target.result });
      r.readAsText(f);
    }))).then(results => {
      setBuildVfs(prev => {
        const updated = { folders: [...prev.folders], files: [...prev.files] };
        let phaseFolder = updated.folders.find(f => f.name === phaseId && f.parentId == null);
        if (!phaseFolder) {
          phaseFolder = { id: genId(), name: phaseId, parentId: null };
          updated.folders.push(phaseFolder);
        }
        results.forEach(({ name, content }) => {
          updated.files.push({ id: genId(), name, folderId: phaseFolder.id, content });
        });
        if (user) localStorage.setItem(`metamic_build_vfs_${user.id}`, JSON.stringify(updated));
        pushVFS(token, updated, "build");
        return updated;
      });
      setExpandedPhase(phaseId);
    });
  }

  function countFiles(folderId) {
    const direct = buildVfs.files.filter(f => f.folderId === folderId).length;
    return buildVfs.folders.filter(f => f.parentId === folderId)
      .reduce((s, sf) => s + countFiles(sf.id), direct);
  }

  function renderTree(folderId, depth, phaseId) {
    const subs  = buildVfs.folders.filter(f => f.parentId === folderId);
    const files = buildVfs.files.filter(f => f.folderId === folderId);
    return (
      <>
        {subs.map(folder => {
          const open = expandedFolders[folder.id];
          return (
            <div key={folder.id}>
              <div
                onClick={() => { if (renameId !== folder.id) setExpandedFolders(p => ({ ...p, [folder.id]: !p[folder.id] })); }}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: `5px 8px 5px ${8 + depth * 14}px`, cursor: "pointer", fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "'JetBrains Mono',monospace", borderRadius: 4 }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.04)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <span style={{ fontSize: 8, opacity: 0.5 }}>{open ? "▼" : "▶"}</span>
                <span style={{ color: "#fbbf24" }}>📁</span>
                {renameId === folder.id ? (
                  <input value={renameName} onChange={e => setRenameName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenameId(null); }}
                    onClick={e => e.stopPropagation()} autoFocus
                    style={{ flex: 1, background: "#090d1f", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 4, color: "#e2eeff", padding: "2px 6px", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", outline: "none" }} />
                ) : (
                  <>
                    <span style={{ flex: 1 }}>{folder.name}</span>
                    <span style={{ fontSize: 9, color: "rgba(255,255,255,0.2)", fontFamily: "'JetBrains Mono',monospace" }}>{countFiles(folder.id)} files</span>
                  </>
                )}
                <div style={{ display: "flex", gap: 2, flexShrink: 0, marginLeft: 4 }} onClick={e => e.stopPropagation()}>
                  <button onClick={e => startRename("folder", folder.id, folder.name, e)} title="Rename"
                    style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 11, padding: "0 2px" }}
                    onMouseEnter={e => e.currentTarget.style.color = "#e2eeff"}
                    onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}>✏</button>
                  <button onClick={e => handleDeleteFolder(folder.id, e)} title="Delete"
                    style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 11, padding: "0 2px" }}
                    onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                    onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}>✕</button>
                </div>
              </div>
              {open && renderTree(folder.id, depth + 1, phaseId)}
            </div>
          );
        })}
        {files.map(file => {
          const isCpp = file.name?.endsWith(".cpp");
          const isHpp = file.name?.endsWith(".hpp");
          const fc    = isCpp ? "#4488ff" : isHpp ? "#aa44ff" : "#06ffa5";
          const tag   = isCpp ? ".cpp" : isHpp ? ".hpp" : "file";
          return (
            <div key={file.id}
              onClick={() => navigate("/build", { state: { phaseId, fileId: file.id } })}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: `4px 8px 4px ${20 + depth * 14}px`, fontSize: 11, fontFamily: "'JetBrains Mono',monospace", cursor: "pointer", borderRadius: 4 }}
              onMouseEnter={e => { if (renameId !== file.id) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <span style={{ color: fc, fontSize: 9, flexShrink: 0 }}>●</span>
              {renameId === file.id ? (
                <input value={renameName} onChange={e => setRenameName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenameId(null); }}
                  onClick={e => e.stopPropagation()} autoFocus
                  style={{ flex: 1, background: "#090d1f", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 4, color: "#e2eeff", padding: "2px 6px", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", outline: "none" }} />
              ) : (
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "rgba(255,255,255,0.6)" }}>{file.name}</span>
              )}
              <span style={{ fontSize: 9, color: fc, opacity: 0.7, flexShrink: 0 }}>{tag}</span>
              <div style={{ display: "flex", gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                <button onClick={e => { e.stopPropagation(); downloadFile(file.name, file.content); }} title="Download"
                  style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 11, padding: "0 2px" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#06ffa5"}
                  onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}>⬇</button>
                <button onClick={e => startRename("file", file.id, file.name, e)} title="Rename"
                  style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 11, padding: "0 2px" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#e2eeff"}
                  onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}>✏</button>
                <button onClick={e => handleDeleteFile(file.id, e)} title="Delete"
                  style={{ background: "none", border: "none", color: "rgba(255,255,255,0.3)", cursor: "pointer", fontSize: 11, padding: "0 2px" }}
                  onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                  onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.3)"}>✕</button>
              </div>
            </div>
          );
        })}
      </>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <BuildHeader onOpenBuild={() => navigate("/build")} />
      <input ref={buildImportRef} type="file" accept=".cpp,.hpp,.exe" multiple style={{ display: "none" }} onChange={handleBuildImport} />

      <BuildQueue>
        {BUILD_PHASES.map(phase => {
          const phaseFolder = buildVfs.folders.find(f => f.name === phase.id && f.parentId == null);
          const fileCount   = phaseFolder ? countFiles(phaseFolder.id) : 0;
          const isExpanded  = expandedPhase === phase.id;
          const hasContent  = phaseFolder && (
            buildVfs.folders.filter(f => f.parentId === phaseFolder.id).length > 0 ||
            buildVfs.files.filter(f => f.folderId === phaseFolder.id).length > 0
          );

          return (
            <div key={phase.id} style={{ borderRadius: "10px", background: "rgba(255,255,255,0.02)", border: `1px solid ${isExpanded ? phase.color + "44" : phase.color + "18"}`, overflow: "hidden", transition: "border-color 0.15s" }}>
              <div
                onClick={() => setExpandedPhase(isExpanded ? null : phase.id)}
                style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 16px", cursor: "pointer" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: phase.color, boxShadow: `0 0 5px ${phase.color}`, flexShrink: 0 }} />
                <span style={{ fontSize: "14px", fontWeight: 600, flex: 1 }}>{phase.label}</span>
                <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)", fontFamily: "'JetBrains Mono',monospace" }}>{fileCount} {fileCount === 1 ? "file" : "files"}</span>
                <button
                  onClick={e => { e.stopPropagation(); setCreatePhase(createPhase === phase.id ? null : phase.id); setCreateName(""); setCreateType("file"); setExpandedPhase(phase.id); }}
                  style={{ background: "none", border: `1px solid ${phase.color}44`, borderRadius: 4, color: phase.color, cursor: "pointer", fontSize: 14, lineHeight: 1, padding: "1px 6px", flexShrink: 0 }}
                  onMouseEnter={e => e.currentTarget.style.background = `${phase.color}18`}
                  onMouseLeave={e => e.currentTarget.style.background = "none"}
                >+</button>
                <span style={{ fontSize: 9, color: phase.color, opacity: 0.55 }}>{isExpanded ? "▼" : "▶"}</span>
              </div>

              {isExpanded && (
                <div style={{ borderTop: `1px solid ${phase.color}18` }}>
                  {createPhase === phase.id && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 12px", background: "rgba(255,255,255,0.02)", borderBottom: `1px solid ${phase.color}18` }}>
                      <div style={{ display: "flex", borderRadius: 5, overflow: "hidden", border: "1px solid rgba(255,255,255,0.1)", flexShrink: 0 }}>
                        <button onClick={() => setCreateType("file")} style={{ padding: "3px 8px", border: "none", cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: 10, background: createType === "file" ? "rgba(255,255,255,0.1)" : "transparent", color: createType === "file" ? "#e2eeff" : "rgba(255,255,255,0.35)" }}>File</button>
                        <button onClick={() => setCreateType("folder")} style={{ padding: "3px 8px", border: "none", cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: 10, background: createType === "folder" ? "rgba(255,255,255,0.1)" : "transparent", color: createType === "folder" ? "#e2eeff" : "rgba(255,255,255,0.35)" }}>Folder</button>
                      </div>
                      <input autoFocus value={createName} onChange={e => setCreateName(e.target.value)}
                        onKeyDown={e => { if (e.key === "Enter") handleCreate(phase.id); if (e.key === "Escape") setCreatePhase(null); }}
                        placeholder={createType === "file" ? "filename.cpp" : "folder name"}
                        style={{ flex: 1, background: "#090d1f", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 5, color: "#e2eeff", padding: "4px 8px", fontSize: 11, fontFamily: "'JetBrains Mono',monospace", outline: "none" }} />
                      <button onClick={() => handleCreate(phase.id)} style={{ background: "#4f46e5", border: "none", borderRadius: 5, color: "#fff", padding: "4px 10px", cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 600, flexShrink: 0 }}>Create</button>
                      <button onClick={() => setCreatePhase(null)} style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 5, color: "rgba(255,255,255,0.4)", padding: "4px 8px", cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: 10, flexShrink: 0 }}>✕</button>
                    </div>
                  )}
                  {!hasContent ? (
                    <div style={{ padding: "18px 16px", textAlign: "center", color: "rgba(255,255,255,0.18)", fontSize: "11px", fontFamily: "'JetBrains Mono',monospace" }}>
                      No files saved in {phase.id}/ yet.
                    </div>
                  ) : (
                    <div style={{ padding: "4px 0 6px" }}>{renderTree(phaseFolder.id, 0, phase.id)}</div>
                  )}
                  <div style={{ padding: "6px 12px 10px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <button onClick={() => triggerBuildImport(phase.id)} style={{ ...GHOST_BTN, fontSize: "10px", padding: "4px 12px", border: `1px solid ${phase.color}30`, color: phase.color }}>⬆ Import</button>
                    <button onClick={() => navigate("/build")} style={{ ...GHOST_BTN, fontSize: "10px", padding: "4px 12px", border: `1px solid ${phase.color}30`, color: phase.color }}>Open in Build →</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </BuildQueue>
    </div>
  );
}
