export default function FileTabs({ files = [], activeFileId, onSelect, onClose }) {
  if (!files.length) return null;

  return (
    <div style={{ display: "flex", gap: "4px", overflowX: "auto" }}>
      {files.map(file => {
        const active = file.id === activeFileId;
        return (
          <button
            key={file.id}
            onClick={() => onSelect?.(file)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              border: active ? "1px solid rgba(68,136,255,0.45)" : "1px solid rgba(255,255,255,0.08)",
              borderRadius: "7px",
              background: active ? "rgba(68,136,255,0.12)" : "rgba(255,255,255,0.02)",
              color: active ? "#8fb7ff" : "rgba(255,255,255,0.55)",
              cursor: "pointer",
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: "11px",
              padding: "6px 10px",
            }}
          >
            {file.name}
            {onClose && (
              <span
                onClick={event => {
                  event.stopPropagation();
                  onClose(file);
                }}
                style={{ color: "rgba(255,255,255,0.35)" }}
              >
                x
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
