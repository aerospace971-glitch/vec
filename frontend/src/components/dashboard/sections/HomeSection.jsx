import { loadVFS, loadBuildVFS } from "../../../utils/vfs";

export default function HomeSection({ user, navigate, isMobile = false }) {
  const vfs        = user ? loadVFS(user.id) : { folders: [], files: [] };
  const allFiles   = vfs.files   || [];
  const allFolders = vfs.folders || [];

  const cppFiles   = allFiles.filter(f => f.name?.endsWith(".cpp"));
  const hppFiles   = allFiles.filter(f => f.name?.endsWith(".hpp"));
  const otherFiles = allFiles.filter(f => !f.name?.endsWith(".cpp") && !f.name?.endsWith(".hpp"));

  const buildVfs      = user ? loadBuildVFS(user.id) : { folders: [], files: [] };
  const allBuildFiles = buildVfs.files || [];
  const exeFiles      = [...allFiles, ...allBuildFiles].filter(f => f.name?.toLowerCase().endsWith(".exe"));

  const recentFiles = [...allFiles].reverse().slice(0, 6);

  const STAT_ROWS = [
    [
      { label: "Total Folders", value: allFolders.length, color: "#fbbf24", sub: "in workspace" },
      { label: "Total Files",   value: allFiles.length,   color: "#06ffa5", sub: ".cpp + .hpp + other" },
      { label: ".exe Files",    value: exeFiles.length,   color: "#f97316", sub: "compiled outputs" },
    ],
    [
      { label: ".cpp Files",  value: cppFiles.length,   color: "#4488ff", sub: "source files" },
      { label: ".hpp Files",  value: hppFiles.length,   color: "#aa44ff", sub: "header files" },
      { label: "Other Files", value: otherFiles.length, color: "#44aaff", sub: "non-cpp/hpp" },
    ],
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700 }}>Overview</h2>
        <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
          Your compiler workspace at a glance.
        </p>
      </div>

      {STAT_ROWS.map((row, ri) => (
        <div key={ri} style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(3,1fr)", gap: "12px" }}>
          {row.map(s => (
            <div key={s.label} style={{ padding: "18px 16px", borderRadius: "12px", background: "rgba(255,255,255,0.02)", border: `1px solid ${s.color}22`, position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "2px", background: s.color, opacity: 0.5, borderRadius: "12px 12px 0 0" }} />
              <div style={{ fontSize: "32px", fontWeight: 800, color: s.color, fontFamily: "'JetBrains Mono',monospace", lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.7)", marginTop: "8px", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.3px" }}>{s.label}</div>
              <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)", marginTop: "2px", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.5px" }}>{s.sub}</div>
            </div>
          ))}
        </div>
      ))}

      <div>
        <div style={{ fontSize: "10px", letterSpacing: "1.2px", color: "rgba(255,255,255,0.25)", marginBottom: "10px", fontFamily: "'JetBrains Mono',monospace" }}>QUICK ACTIONS</div>
        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          {[
            { label: "⚡ Compiler", path: "/app",     color: "#4488ff" },
            { label: "🔨 Build",    path: "/build",   color: "#f97316" },
            { label: "▶ Runtime",   path: "/runtime", color: "#06ffa5" },
            { label: "⬡ Lexer",     path: "/lexer",   color: "#4488ff" },
          ].map(a => (
            <button key={a.path} onClick={() => navigate(a.path)} style={{
              padding: "8px 16px", borderRadius: "8px",
              border: `1px solid ${a.color}30`, background: `${a.color}0d`,
              color: a.color, cursor: "pointer",
              fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", fontWeight: 600,
            }}>{a.label}</button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: "10px", letterSpacing: "1.2px", color: "rgba(255,255,255,0.25)", marginBottom: "10px", fontFamily: "'JetBrains Mono',monospace" }}>RECENT FILES</div>
        {recentFiles.length === 0 ? (
          <div style={{ color: "rgba(255,255,255,0.25)", fontSize: "13px", padding: "20px", textAlign: "center", border: "1px dashed rgba(255,255,255,0.07)", borderRadius: "10px" }}>
            No files yet. Go to Files → New File to create one.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {recentFiles.map(file => {
              const isCpp    = file.name?.endsWith(".cpp");
              const isHpp    = file.name?.endsWith(".hpp");
              const dotColor = isCpp ? "#4488ff" : isHpp ? "#aa44ff" : "#06ffa5";
              const tag      = isCpp ? ".cpp" : isHpp ? ".hpp" : "file";
              const folder   = allFolders.find(f => f.id === file.folderId);
              return (
                <div key={file.id} style={{ padding: "10px 14px", borderRadius: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", display: "flex", alignItems: "center", gap: "10px" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "12px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: "'JetBrains Mono',monospace" }}>{file.name}</div>
                    <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.28)", marginTop: "2px", fontFamily: "'JetBrains Mono',monospace" }}>
                      {tag}{folder ? ` · 📁 ${folder.name}` : " · / root"}
                    </div>
                  </div>
                  <div style={{ fontSize: "10px", color: dotColor, fontFamily: "'JetBrains Mono',monospace", opacity: 0.8 }}>{tag}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
