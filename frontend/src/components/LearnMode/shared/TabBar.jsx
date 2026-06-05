import React from "react";
import { useResponsive } from "../../../hooks/useResponsive";

export default function TabBar({ tabs = [], activeTab, onTabChange, phaseColor }) {
  const { isMobile } = useResponsive();

  const currentIdx = tabs.indexOf(activeTab);

  function prev() {
    const idx = (currentIdx - 1 + tabs.length) % tabs.length;
    onTabChange?.(tabs[idx]);
  }

  function next() {
    const idx = (currentIdx + 1) % tabs.length;
    onTabChange?.(tabs[idx]);
  }

  // ── Mobile: ← Theory → ─────────────────────────────────────────
  if (isMobile) {
    const btnStyle = {
      background:   "transparent",
      border:       `1px solid ${phaseColor}55`,
      borderRadius: "6px",
      color:        phaseColor,
      cursor:       "pointer",
      fontFamily:   "'JetBrains Mono',monospace",
      fontSize:     "13px",
      fontWeight:   700,
      padding:      "0 12px",
      height:       "30px",
      flexShrink:   0,
      display:      "flex",
      alignItems:   "center",
    };

    return (
      <div style={{ display:"flex", alignItems:"center", gap:"10px", width:"100%" }}>
        <button style={btnStyle} onClick={prev}>←</button>

        <div style={{
          flex:       1,
          textAlign:  "center",
          fontFamily: "'JetBrains Mono',monospace",
          fontSize:   "12px",
          fontWeight: 700,
          color:      phaseColor,
          letterSpacing: "0.5px",
        }}>
          {activeTab}
        </div>

        <button style={btnStyle} onClick={next}>→</button>
      </div>
    );
  }

  // ── Desktop: pill tab buttons ───────────────────────────────────
  return (
    <div style={{ display:"flex", gap:8 }}>
      {tabs.map(t => {
        const active = activeTab === t;
        return (
          <button
            key={t}
            onClick={() => onTabChange?.(t)}
            style={{
              borderRadius: 20,
              padding:      "5px 14px",
              fontSize:     12,
              fontFamily:   "system-ui",
              cursor:       "pointer",
              border:       `1px solid ${active ? phaseColor : "#2a3a55"}`,
              background:   active ? `${phaseColor}25` : "transparent",
              color:        active ? phaseColor : "#64748b",
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = "#3a4a65"}
            onMouseOut={e  => e.currentTarget.style.borderColor = active ? phaseColor : "#2a3a55"}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}
