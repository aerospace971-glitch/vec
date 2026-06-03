// ── Phase card ─────────────────────────────────────────────
import { useState } from "react";
export default function PhaseCard({ phase, isActive, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:   hovered || isActive
          ? `linear-gradient(135deg,rgba(10,13,28,0.95),${phase.color}15)`
          : "rgba(10,13,28,0.6)",
        border:       `1px solid ${isActive ? phase.color+"66" : hovered ? phase.color+"33" : "rgba(255,255,255,0.06)"}`,
        borderRadius: "12px",
        padding:      "14px 18px",
        cursor:       "pointer",
        textAlign:    "left",
        transition:   "all 0.2s",
        transform:    hovered && !isActive ? "translateY(-2px)" : "none",
        position:     "relative",
        overflow:     "hidden",
        minWidth:     "140px",
      }}
    >
      {/* Top accent */}
      <div style={{
        position:   "absolute",
        top:0, left:0, right:0,
        height:     "2px",
        background: isActive || hovered ? phase.color : "transparent",
        opacity:    isActive ? 1 : 0.4,
        transition: "all 0.2s",
      }}/>

      <div style={{
        fontFamily:    "'JetBrains Mono',monospace",
        fontSize:      "9px",
        letterSpacing: "1.5px",
        color:         phase.color,
        opacity:       0.7,
        marginBottom:  "6px",
      }}>
        PHASE {phase.num}
      </div>

      <div style={{
        fontSize:   "20px",
        color:      phase.color,
        marginBottom:"4px",
        filter:     isActive ? `drop-shadow(0 0 6px ${phase.color})` : "none",
      }}>
        {phase.icon}
      </div>

      <div style={{
        fontFamily:  "'Space Grotesk',sans-serif",
        fontSize:    "12px",
        fontWeight:  700,
        color:       isActive ? "#fff" : "rgba(255,255,255,0.6)",
        lineHeight:  1.3,
      }}>
        {phase.label.split(" — ")[0]}
      </div>

      {isActive && (
        <div style={{
          position:      "absolute",
          right:         "8px", top: "50%",
          transform:     "translateY(-50%)",
          width:         "6px", height: "6px",
          borderRadius:  "50%",
          background:    phase.color,
          boxShadow:     `0 0 8px ${phase.color}`,
        }}/>
      )}
    </button>
  );
}
