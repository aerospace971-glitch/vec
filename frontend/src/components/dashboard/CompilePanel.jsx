export default function CompilePanel({ status = "idle", result, onCompile }) {
  return (
    <div style={{ display: "grid", gap: "10px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.55)", fontFamily: "'JetBrains Mono',monospace" }}>
          Status: {status}
        </span>
        {onCompile && (
          <button
            onClick={onCompile}
            style={{ border: "none", borderRadius: "7px", background: "#4f46e5", color: "#fff", padding: "7px 14px", cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", fontWeight: 700 }}
          >
            Compile
          </button>
        )}
      </div>
      {result && (
        <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: "#c3e88d", fontSize: "12px", fontFamily: "'JetBrains Mono',monospace" }}>
          {result}
        </pre>
      )}
    </div>
  );
}
