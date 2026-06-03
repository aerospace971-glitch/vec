export default function BuildLogs({ logs = [] }) {
  if (!logs.length) {
    return (
      <div style={{ color: "rgba(255,255,255,0.25)", fontSize: "12px", fontFamily: "'JetBrains Mono',monospace" }}>
        No build logs yet.
      </div>
    );
  }

  return (
    <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: "#c3e88d", fontSize: "12px", fontFamily: "'JetBrains Mono',monospace" }}>
      {logs.join("\n")}
    </pre>
  );
}
