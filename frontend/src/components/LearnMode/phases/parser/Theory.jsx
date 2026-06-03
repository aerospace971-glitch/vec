// src/components/LearnMode/phases/parser/Theory.jsx
import React from "react";
import { cardBase, sectionLabel, bodyText } from "../../shared/CardStyles";

export default function ParserTheory({ phaseColor, data, onNavigate }) {
  const t = data.theory || {};
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1120 }}>
      <div style={{ fontSize: 17, fontWeight: 500, lineHeight: 1.4, maxWidth: 720, color: "#f1f5f9" }}>{t.quote}</div>
      <section style={cardBase(phaseColor)}>
        <div style={sectionLabel(phaseColor)}>The big picture</div>
        <p style={bodyText}>{t.bigPicture}</p>
      </section>
      <section style={cardBase(phaseColor)}>
        <div style={sectionLabel(phaseColor)}>Key insight</div>
        <p style={bodyText}>{t.keyInsight}</p>
      </section>
      <section style={{ background: "#1e293b", border: "1px solid #2a3a55", borderRadius: 10, padding: 14 }}>
        <div style={sectionLabel(phaseColor)}>How it works</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(t.howItWorks || []).map((s, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "24px 1fr", gap: 10, alignItems: "start" }}>
              <span style={{ width: 20, height: 20, borderRadius: 999, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: phaseColor, background: `${phaseColor}26` }}>{i + 1}</span>
              <span style={bodyText}>{s}</span>
            </div>
          ))}
        </div>
      </section>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 40px 1fr", alignItems: "center", gap: 10 }}>
        <div style={{ background: "#1e293b", border: "1px solid #2a3a55", borderRadius: 999, padding: "10px 14px" }}>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Input</div>
          <strong style={{ color: "#f1f5f9" }}>{t.input}</strong>
        </div>
        <div style={{ textAlign: "center", fontWeight: 700, color: phaseColor }}>to</div>
        <div style={{ background: "#1e293b", border: "1px solid #2a3a55", borderRadius: 999, padding: "10px 14px" }}>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>Output</div>
          <strong style={{ color: "#f1f5f9" }}>{t.output}</strong>
        </div>
      </div>
      <section style={{ background: "#1e293b", border: "1px solid #2a3a55", borderRadius: 10, padding: 14, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#cbd5e1" }}>{t.nextLabel}</span>
        {t.nextPhase ? <button onClick={() => onNavigate?.(t.nextPhase)} style={{ border: `1px solid ${phaseColor}66`, color: phaseColor, background: "transparent", padding: "8px 12px", borderRadius: 8 }}>Go</button> : <span style={{ color: "#94a3b8" }}>Runtime</span>}
      </section>
    </div>
  );
}
