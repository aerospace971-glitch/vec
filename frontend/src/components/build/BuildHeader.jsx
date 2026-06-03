{/* Header */}
export default function BuildHeader({ phase, mode = "sandbox", onToggleMode }) {
 return(
   <div style={{
        padding:        "10px 20px",
        background:     "rgba(5,8,18,0.9)",
        borderBottom:   `1px solid ${phase.color}22`,
        flexShrink:     0,
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        gap:            "12px",
    }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
        <div style={{
            width:6, height:6, borderRadius:"50%",
            background:  "#f97316",
            boxShadow:   "0 0 6px #f97316",
        }}/>
        <span style={{
            fontFamily:    "'JetBrains Mono',monospace",
            fontSize:      "10px",
            fontWeight:    700,
            letterSpacing: "1.5px",
            color:         "#f97316",
            textTransform: "uppercase",
        }}>
            Let's Build — Your Own Language
        </span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:"14px" }}>
          <span style={{
            fontFamily: "'JetBrains Mono',monospace",
            fontSize:   "11px",
            color:      "rgba(255,255,255,0.25)",
          }}>
            Learn by building each compiler phase from scratch
          </span>
          {/* Mode toggle */}
          <div style={{ display:"flex", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:7, overflow:"hidden", flexShrink:0 }}>
            <button
              onClick={() => onToggleMode?.("sandbox")}
              style={{ padding:"5px 14px", border:"none", cursor:"pointer", fontFamily:"'JetBrains Mono',monospace", fontSize:10, fontWeight: mode==="sandbox" ? 700 : 400, background: mode==="sandbox" ? "rgba(255,255,255,0.09)" : "transparent", color: mode==="sandbox" ? "#e2eeff" : "rgba(255,255,255,0.35)", transition:"all 0.12s", borderRight:"1px solid rgba(255,255,255,0.07)" }}
            >Sandbox</button>
            <button
              onClick={() => onToggleMode?.("pipeline")}
              style={{ padding:"5px 14px", border:"none", cursor:"pointer", fontFamily:"'JetBrains Mono',monospace", fontSize:10, fontWeight: mode==="pipeline" ? 700 : 400, background: mode==="pipeline" ? "#4f46e5" : "transparent", color: mode==="pipeline" ? "#fff" : "rgba(255,255,255,0.35)", transition:"all 0.12s" }}
            >Pipeline</button>
          </div>
        </div>
    </div>
 );
}