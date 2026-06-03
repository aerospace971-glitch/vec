import { useState, useEffect, useRef } from "react";
import { loadVFS, saveVFS, pushVFS, fetchVFS, genId } from "../../../utils/vfs";
import { downloadFile, getAllChildIds, getBreadcrumb } from "../../../utils/fileHelpers";
import { GHOST_BTN, PRIMARY_BTN, ICON_BTN } from "../../../constants/dashboardStyles";

export default function FilesSection({ user, token, setSource, navigate }) {
  const [vfs, setVfs]               = useState(() => loadVFS(user.id));
  const [activeFolder, setActiveFolder]   = useState(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showNewFile,   setShowNewFile]   = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [newFileName,   setNewFileName]   = useState("");
  const [renameId,   setRenameId]   = useState(null);
  const [renameName, setRenameName] = useState("");
  const [renameType, setRenameType] = useState("");
  const importRef = useRef(null);

  useEffect(() => {
    fetchVFS(token, "compiler").then(serverData => {
      const hasServer = serverData && (serverData.folders?.length > 0 || serverData.files?.length > 0);
      const local     = loadVFS(user.id);
      const hasLocal  = local.folders.length > 0 || local.files.length > 0;
      if (hasServer) {
        setVfs(serverData);
        saveVFS(user.id, serverData);
      } else if (hasLocal) {
        pushVFS(token, local, "compiler");
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function persist(updated) {
    setVfs(updated);
    saveVFS(user.id, updated);
    pushVFS(token, updated, "compiler");
  }

  function handleImport(e) {
    const fileList = Array.from(e.target.files || []);
    e.target.value = "";
    if (!fileList.length) return;
    const folder = activeFolder;
    Promise.all(fileList.map(f => new Promise(res => {
      const r = new FileReader();
      r.onload = ev => res({ name: f.name, content: ev.target.result });
      r.readAsText(f);
    }))).then(results => {
      setVfs(prev => {
        const updated = { ...prev, files: [...prev.files, ...results.map(({ name, content }) => ({ id: genId(), name, folderId: folder, content }))] };
        saveVFS(user.id, updated);
        pushVFS(token, updated, "compiler");
        return updated;
      });
    });
  }

  function createFolder() {
    if (!newFolderName.trim()) return;
    persist({ ...vfs, folders: [...vfs.folders, { id: genId(), name: newFolderName.trim(), parentId: activeFolder }] });
    setNewFolderName(""); setShowNewFolder(false);
  }

  function createFile() {
    if (!newFileName.trim()) return;
    const raw  = newFileName.trim();
    const name = raw.endsWith(".cpp") ? raw : raw + ".cpp";
    persist({ ...vfs, files: [...vfs.files, { id: genId(), name, folderId: activeFolder, content: `#include <iostream>\nusing namespace std;\n\nint main() {\n    return 0;\n}\n` }] });
    setNewFileName(""); setShowNewFile(false);
  }

  function deleteFolder(id) {
    const dead = [id, ...getAllChildIds(vfs.folders, id)];
    persist({ folders: vfs.folders.filter(f => !dead.includes(f.id)), files: vfs.files.filter(f => !dead.includes(f.folderId)) });
    if (activeFolder === id) setActiveFolder(null);
  }

  function deleteFile(id) { persist({ ...vfs, files: vfs.files.filter(f => f.id !== id) }); }

  function commitRename() {
    if (!renameName.trim()) { setRenameId(null); return; }
    if (renameType === "folder") {
      persist({ ...vfs, folders: vfs.folders.map(f => f.id === renameId ? { ...f, name: renameName.trim() } : f) });
    } else {
      const name = renameName.trim().endsWith(".cpp") ? renameName.trim() : renameName.trim() + ".cpp";
      persist({ ...vfs, files: vfs.files.map(f => f.id === renameId ? { ...f, name } : f) });
    }
    setRenameId(null); setRenameName("");
  }

  function openInCompiler(file) { setSource(file.content); navigate("/app"); }

  const breadcrumb     = getBreadcrumb(vfs.folders, activeFolder);
  const currentFolders = vfs.folders.filter(f => f.parentId === activeFolder);
  const currentFiles   = vfs.files.filter(f => f.folderId === activeFolder);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700 }}>Files</h2>
          <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>Manage your C++ project files.</p>
        </div>
        <div style={{ display: "flex", gap: "6px" }}>
          <button onClick={() => { setShowNewFolder(v => !v); setShowNewFile(false); }} style={GHOST_BTN}>+ Folder</button>
          <button onClick={() => { setShowNewFile(v => !v); setShowNewFolder(false); }} style={GHOST_BTN}>+ File</button>
          <label style={{ ...GHOST_BTN, display: "flex", alignItems: "center", cursor: "pointer" }} title="Import .cpp / .exe file(s)">
            ⬆ Import
            <input ref={importRef} type="file" accept=".cpp,.exe" multiple style={{ display: "none" }} onChange={handleImport} />
          </label>
        </div>
      </div>

      {/* Breadcrumb */}
      <div style={{ display: "flex", alignItems: "center", gap: "5px", fontFamily: "'JetBrains Mono',monospace", fontSize: "11px" }}>
        <button onClick={() => setActiveFolder(null)} style={{ background: "none", border: "none", color: activeFolder ? "#4488ff" : "#e2eeff", cursor: activeFolder ? "pointer" : "default", padding: 0, fontFamily: "inherit", fontSize: "inherit" }}>
          root
        </button>
        {breadcrumb.map((bc, i) => (
          <span key={bc.id} style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ color: "rgba(255,255,255,0.2)" }}>/</span>
            <button onClick={() => setActiveFolder(bc.id)} style={{ background: "none", border: "none", color: i === breadcrumb.length - 1 ? "#e2eeff" : "#4488ff", cursor: i === breadcrumb.length - 1 ? "default" : "pointer", padding: 0, fontFamily: "inherit", fontSize: "inherit" }}>
              {bc.name}
            </button>
          </span>
        ))}
      </div>

      {/* Create inputs */}
      {showNewFolder && (
        <div style={{ display: "flex", gap: "8px" }}>
          <input value={newFolderName} onChange={e => setNewFolderName(e.target.value)} onKeyDown={e => e.key === "Enter" && createFolder()} placeholder="folder name" autoFocus
            style={{ flex: 1, borderRadius: "8px", border: "1px solid rgba(255,255,255,0.12)", background: "#090d1f", color: "#e2eeff", padding: "8px 12px", fontSize: "12px", fontFamily: "'JetBrains Mono',monospace", outline: "none" }} />
          <button onClick={createFolder} style={PRIMARY_BTN}>Create</button>
          <button onClick={() => { setShowNewFolder(false); setNewFolderName(""); }} style={GHOST_BTN}>✕</button>
        </div>
      )}
      {showNewFile && (
        <div style={{ display: "flex", gap: "8px" }}>
          <input value={newFileName} onChange={e => setNewFileName(e.target.value)} onKeyDown={e => e.key === "Enter" && createFile()} placeholder="filename.cpp" autoFocus
            style={{ flex: 1, borderRadius: "8px", border: "1px solid rgba(255,255,255,0.12)", background: "#090d1f", color: "#e2eeff", padding: "8px 12px", fontSize: "12px", fontFamily: "'JetBrains Mono',monospace", outline: "none" }} />
          <button onClick={createFile} style={PRIMARY_BTN}>Create</button>
          <button onClick={() => { setShowNewFile(false); setNewFileName(""); }} style={GHOST_BTN}>✕</button>
        </div>
      )}

      {/* Tree */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {currentFolders.map(folder => (
          <div key={folder.id} onClick={() => { if (renameId !== folder.id) setActiveFolder(folder.id); }}
            style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", cursor: "pointer" }}>
            <span style={{ fontSize: "13px", flexShrink: 0 }}>▶</span>
            {renameId === folder.id ? (
              <input value={renameName} onChange={e => setRenameName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenameId(null); }}
                onClick={e => e.stopPropagation()} autoFocus
                style={{ flex: 1, background: "#090d1f", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "6px", color: "#e2eeff", padding: "3px 8px", fontSize: "12px", fontFamily: "'JetBrains Mono',monospace", outline: "none" }} />
            ) : (
              <span style={{ flex: 1, fontSize: "13px" }}>{folder.name}</span>
            )}
            <span style={{ fontSize: "9px", color: "rgba(255,255,255,0.2)", fontFamily: "'JetBrains Mono',monospace" }}>folder</span>
            <button onClick={e => { e.stopPropagation(); setRenameId(folder.id); setRenameName(folder.name); setRenameType("folder"); }} style={ICON_BTN}>✎</button>
            <button onClick={e => { e.stopPropagation(); deleteFolder(folder.id); }} style={{ ...ICON_BTN, color: "rgba(239,68,68,0.5)" }}>✕</button>
          </div>
        ))}

        {currentFiles.map(file => (
          <div key={file.id} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 14px", borderRadius: "8px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
            <span style={{ fontSize: "13px", flexShrink: 0, color: "#c3e88d" }}>◻</span>
            {renameId === file.id ? (
              <input value={renameName} onChange={e => setRenameName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenameId(null); }}
                autoFocus
                style={{ flex: 1, background: "#090d1f", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "6px", color: "#e2eeff", padding: "3px 8px", fontSize: "12px", fontFamily: "'JetBrains Mono',monospace", outline: "none" }} />
            ) : (
              <span style={{ flex: 1, fontSize: "12px", color: "#c3e88d", fontFamily: "'JetBrains Mono',monospace" }}>{file.name}</span>
            )}
            <button onClick={() => openInCompiler(file)} style={{ ...GHOST_BTN, fontSize: "10px", padding: "3px 10px" }}>Open</button>
            <button onClick={() => downloadFile(file.name, file.content)} title="Download" style={{ ...ICON_BTN, fontSize: "11px" }}>⬇</button>
            <button onClick={() => { setRenameId(file.id); setRenameName(file.name); setRenameType("file"); }} style={ICON_BTN}>✎</button>
            <button onClick={() => deleteFile(file.id)} style={{ ...ICON_BTN, color: "rgba(239,68,68,0.5)" }}>✕</button>
          </div>
        ))}

        {currentFolders.length === 0 && currentFiles.length === 0 && (
          <div style={{ color: "rgba(255,255,255,0.18)", fontSize: "13px", padding: "28px", textAlign: "center", border: "1px dashed rgba(255,255,255,0.07)", borderRadius: "10px" }}>
            Empty. Use the buttons above to create a folder or file.
          </div>
        )}
      </div>
    </div>
  );
}
