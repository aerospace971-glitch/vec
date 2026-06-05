import { useState } from "react";
import { useResponsive } from "../../hooks/useResponsive";

export default function TheoryPanel({ phase, activeTab, setActiveTab }) {
  const { isMobile } = useResponsive();
  const [activeFile, setActiveFile] = useState(0);

  // Reset file tab when phase changes
  const fileList = phase.theory.files || [];

  return (
    <div style={{
      display:       "flex",
      flexDirection: "column",
      overflow:      "hidden",
      height:        "100%",
      minHeight:     0,
    }}>

      {/* ── What / Overview ─────────────────────────── */}
      <div style={{
        padding:      "14px 20px",
        borderBottom: `1px solid ${phase.color}22`,
        flexShrink:   0,
      }}>
        <p style={{
          fontFamily: "'Space Grotesk',sans-serif",
          fontSize:   "12px",
          color:      "rgba(255,255,255,0.55)",
          lineHeight: 1.65,
          margin:     0,
        }}>
          {phase.theory.what}
        </p>
      </div>

      {/* ── Sub tabs — desktop only (mobile: BuildPage owns section nav) ── */}
      {!isMobile && (
        <div style={{
          display:     "flex",
          borderBottom:"1px solid rgba(255,255,255,0.05)",
          flexShrink:  0,
        }}>
          {[
            { id:"structure", label:"📋 Structure" },
            { id:"steps",     label:"📍 Steps"     },
            { id:"tips",      label:"💡 Tips"      },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); if (tab.id === "structure") setActiveFile(0); }}
              style={{
                flex:         1,
                padding:      "10px",
                background:   "transparent",
                border:       "none",
                borderBottom: activeTab === tab.id ? `2px solid ${phase.color}` : "2px solid transparent",
                color:        activeTab === tab.id ? phase.color : "rgba(255,255,255,0.3)",
                fontFamily:   "'JetBrains Mono',monospace",
                fontSize:     "10px",
                fontWeight:   activeTab === tab.id ? 700 : 400,
                cursor:       "pointer",
                transition:   "all 0.15s",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Tab content ───────────────────────────────── */}
      <div style={{
        flex:       1,
        overflowY:  "auto",
        scrollbarWidth: "thin",
        scrollbarColor: "rgba(255,255,255,0.1) transparent",
      }}>

        {/* ── STRUCTURE ──────────────────────────────── */}
        {activeTab === "structure" && (
          <div style={{ display:"flex", flexDirection:"column", height:"100%" }}>

            {/* Section label */}
            <div style={{
              padding:       "10px 20px 0",
              fontFamily:    "'JetBrains Mono',monospace",
              fontSize:      "9px",
              letterSpacing: "1.5px",
              color:         phase.color,
              opacity:       0.7,
            }}>
              REFERENCE ARCHITECTURE
            </div>

            {/* File tabs */}
            <div style={{
              display:     "flex",
              gap:         "4px",
              padding:     "8px 16px",
              overflowX:   "auto",
              flexShrink:  0,
              scrollbarWidth: "none",
            }}>
              {fileList.map((f, i) => {
                const isHpp = f.name.endsWith(".hpp");
                const active = activeFile === i;
                const fileColor = isHpp ? "#89ddff" : phase.color;
                return (
                  <button
                    key={f.name}
                    onClick={() => setActiveFile(i)}
                    style={{
                      padding:      "5px 12px",
                      borderRadius: "6px 6px 0 0",
                      border:       `1px solid ${active ? fileColor + "55" : "rgba(255,255,255,0.08)"}`,
                      borderBottom: active ? `1px solid ${fileColor}` : "1px solid transparent",
                      background:   active ? `${fileColor}10` : "transparent",
                      color:        active ? fileColor : "rgba(255,255,255,0.3)",
                      fontFamily:   "'JetBrains Mono',monospace",
                      fontSize:     "10px",
                      fontWeight:   active ? 700 : 400,
                      cursor:       "pointer",
                      whiteSpace:   "nowrap",
                      transition:   "all 0.12s",
                    }}
                  >
                    {/* File type dot */}
                    <span style={{
                      display:      "inline-block",
                      width:        5, height: 5,
                      borderRadius: "50%",
                      background:   fileColor,
                      marginRight:  "6px",
                      opacity:      active ? 1 : 0.4,
                      verticalAlign: "middle",
                    }}/>
                    {f.name}
                  </button>
                );
              })}
            </div>

            {/* Code block for active file */}
            {fileList[activeFile] && (
              <div style={{ flex:1, padding:"0 16px 16px", overflow:"hidden" }}>
                <pre style={{
                  margin:       0,
                  padding:      "14px",
                  background:   "rgba(0,0,0,0.45)",
                  border:       `1px solid ${phase.color}18`,
                  borderRadius: "0 8px 8px 8px",
                  fontFamily:   "'JetBrains Mono',monospace",
                  fontSize:     "10.5px",
                  lineHeight:   1.75,
                  color:        "rgba(255,255,255,0.72)",
                  overflowX:    "auto",
                  overflowY:    "auto",
                  whiteSpace:   "pre",
                  maxHeight:    "420px",
                }}>
                  {fileList[activeFile].content}
                </pre>
              </div>
            )}
          </div>
        )}

        {/* ── STEPS ──────────────────────────────────── */}
        {activeTab === "steps" && (
          <div style={{ display:"flex", flexDirection:"column", gap:"8px", padding:"16px 20px" }}>
            <div style={{
              fontFamily:    "'JetBrains Mono',monospace",
              fontSize:      "9px",
              letterSpacing: "1.5px",
              color:         phase.color,
              marginBottom:  "6px",
              opacity:       0.7,
            }}>
              IMPLEMENTATION STEPS
            </div>
            {phase.theory.steps.map((step, i) => (
              <div key={i} style={{
                display:      "flex",
                alignItems:   "flex-start",
                gap:          "12px",
                padding:      "10px 14px",
                background:   `${phase.color}08`,
                border:       `1px solid ${phase.color}18`,
                borderRadius: "8px",
              }}>
                <div style={{
                  fontFamily: "'JetBrains Mono',monospace",
                  fontSize:   "10px",
                  fontWeight: 700,
                  color:      phase.color,
                  minWidth:   "20px",
                  opacity:    0.8,
                }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{
                  fontFamily: "'Space Grotesk',sans-serif",
                  fontSize:   "12px",
                  color:      "rgba(255,255,255,0.65)",
                  lineHeight: 1.5,
                }}>
                  {step}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TIPS ───────────────────────────────────── */}
        {activeTab === "tips" && (
          <div style={{ display:"flex", flexDirection:"column", gap:"8px", padding:"16px 20px" }}>
            <div style={{
              fontFamily:    "'JetBrains Mono',monospace",
              fontSize:      "9px",
              letterSpacing: "1.5px",
              color:         phase.color,
              marginBottom:  "6px",
              opacity:       0.7,
            }}>
              PRO TIPS
            </div>
            {phase.theory.tips.map((tip, i) => (
              <div key={i} style={{
                display:      "flex",
                alignItems:   "flex-start",
                gap:          "10px",
                padding:      "10px 14px",
                background:   "rgba(255,255,255,0.02)",
                border:       "1px solid rgba(255,255,255,0.06)",
                borderRadius: "8px",
              }}>
                <span style={{ color:phase.color, fontSize:"14px", flexShrink:0 }}>💡</span>
                <div style={{
                  fontFamily: "'Space Grotesk',sans-serif",
                  fontSize:   "12px",
                  color:      "rgba(255,255,255,0.6)",
                  lineHeight: 1.5,
                }}>
                  {tip}
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
}
