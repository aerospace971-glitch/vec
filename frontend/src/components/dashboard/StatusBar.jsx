export default function StatusBar({ status = "Ready", branch, cursor }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", color: "rgba(255,255,255,0.35)", fontSize: "10px", fontFamily: "'JetBrains Mono',monospace" }}>
      <span>{status}</span>
      <span>
        {branch ? `branch: ${branch}` : ""}
        {branch && cursor ? " | " : ""}
        {cursor ? `Ln ${cursor.line}, Col ${cursor.column}` : ""}
      </span>
    </div>
  );
}
