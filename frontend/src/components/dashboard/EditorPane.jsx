export default function EditorPane({ value = "", onChange, readOnly = false }) {
  return (
    <textarea
      value={value}
      onChange={event => onChange?.(event.target.value)}
      readOnly={readOnly}
      spellCheck={false}
      style={{
        width: "100%",
        minHeight: "320px",
        resize: "vertical",
        boxSizing: "border-box",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "8px",
        background: "#070b1a",
        color: "#e2eeff",
        outline: "none",
        padding: "14px",
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: "12px",
        lineHeight: 1.6,
      }}
    />
  );
}
