const BUILD_OPEN_BUTTON = {
  borderRadius: "7px",
  border: "1px solid rgba(249,115,22,0.3)",
  padding: "7px 16px",
  background: "transparent",
  color: "#f97316",
  cursor: "pointer",
  fontFamily: "'JetBrains Mono',monospace",
  fontSize: "11px",
};

export default function BuildHeader({ onOpenBuild }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700 }}>Build</h2>
        <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
          Your compiler construction workspace.
        </p>
      </div>
      <button onClick={onOpenBuild} style={BUILD_OPEN_BUTTON}>
        Open Build -&gt;
      </button>
    </div>
  );
}
