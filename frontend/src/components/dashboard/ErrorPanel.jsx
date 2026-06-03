export default function ErrorPanel({ errors = [] }) {
  if (!errors.length) return null;

  return (
    <div style={{ display: "grid", gap: "6px" }}>
      {errors.map((error, index) => (
        <div key={error.id || index} style={{ border: "1px solid rgba(239,68,68,0.25)", borderRadius: "8px", background: "rgba(239,68,68,0.06)", color: "#fca5a5", padding: "8px 10px", fontSize: "12px", fontFamily: "'JetBrains Mono',monospace" }}>
          {error.message || error}
        </div>
      ))}
    </div>
  );
}
