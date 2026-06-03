// src/components/LearnMode/shared/CardStyles.jsx
const cardBase = (phaseColor) => ({
  background: "#1e293b",
  borderLeft: `3px solid ${phaseColor}`,
  borderRadius: "0 8px 8px 0",
  padding: "12px 14px",
  marginBottom: "10px",
});

const sectionLabel = (phaseColor) => ({
  fontSize: "10px",
  fontWeight: 600,
  letterSpacing: "1.2px",
  textTransform: "uppercase",
  color: phaseColor,
  marginBottom: "6px",
  fontFamily: "system-ui",
});

const bodyText = {
  fontSize: "13px",
  color: "#cbd5e1",
  lineHeight: 1.65,
  fontFamily: "system-ui",
};

const codeBlock = {
  background: "#111827",
  border: "1px solid #2a3a55",
  borderRadius: "6px",
  padding: "10px 12px",
  fontFamily: "monospace",
  fontSize: "12px",
  color: "#e2e8f0",
  margin: "6px 0",
};

export { cardBase, sectionLabel, bodyText, codeBlock };
