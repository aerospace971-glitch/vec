// src/components/LearnMode/shared/TabBar.jsx
import React from "react";

export default function TabBar({ tabs = [], activeTab, onTabChange, phaseColor }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      {tabs.map(t => {
        const active = activeTab === t;
        return (
          <button
            key={t}
            onClick={() => onTabChange?.(t)}
            style={{
              borderRadius: 20,
              padding: "5px 14px",
              fontSize: 12,
              fontFamily: "system-ui",
              cursor: "pointer",
              border: `1px solid ${active ? phaseColor : "#2a3a55"}`,
              background: active ? `${phaseColor}25` : "transparent",
              color: active ? phaseColor : "#64748b",
            }}
            onMouseOver={e => e.currentTarget.style.borderColor = "#3a4a65"}
            onMouseOut={e => e.currentTarget.style.borderColor = active ? phaseColor : "#2a3a55"}
          >
            {t}
          </button>
        );
      })}
    </div>
  );
}
