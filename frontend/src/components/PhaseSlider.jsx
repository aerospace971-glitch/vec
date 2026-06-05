import { useEffect, useState } from "react";
import { useResponsive } from "../hooks/useResponsive";

export default function PhaseSlider() {
  const { isMobile, isTablet } = useResponsive();

  const phases = [
    {
      phase:"01",
      title:"Lexical Analysis",
      subtitle:"Converts source code into tokens",
      color:"#4488ff",
      input:`int x = 10;`,
      output:`[INT] [ID] [ASSIGN] [NUM]`,
    },
    {
      phase:"02",
      title:"Syntax Parsing",
      subtitle:"Builds Abstract Syntax Tree",
      color:"#aa44ff",
      input:`x = a + b * c`,
      output:
`Assign
 ├─ x
 └─ BinOp(+)
    ├─ a
    └─ BinOp(*)`,
    },
    {
      phase:"03",
      title:"Semantic Analysis",
      subtitle:"Validates types and scope",
      color:"#44ffaa",
      input:`int x = "hello"`,
      output:
`ERROR:
Type mismatch`,
    },
    {
      phase:"04",
      title:"IR Generation",
      subtitle:"Creates intermediate code",
      color:"#ffaa44",
      input:`x = a + b * c`,
      output:
`t1 = b * c
t2 = a + t1
x = t2`,
    },
    {
      phase:"05",
      title:"Optimization",
      subtitle:"Improves execution efficiency",
      color:"#ff8844",
      input:
`t1 = 3 + 4
x = t1`,
      output:`x = 7`,
    },
    {
      phase:"06",
      title:"Code Generation",
      subtitle:"Produces machine instructions",
      color:"#ff4488",
      input:`x = 7`,
      output:
`MOV R1,#7
RET`,
    },
  ];

  const [active, setActive] = useState(0);

  useEffect(() => {
    const t = setInterval(() => {
      setActive(prev => (prev + 1) % phases.length);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const p = phases[active];

  const outerMargin  = isMobile ? "60px auto 40px" : isTablet ? "80px auto 60px" : "150px auto 100px";
  const outerPadding = isMobile ? "0 12px" : "0 28px";
  const innerCols    = isMobile ? "1fr" : "0.95fr 1.05fr";
  const innerMinH    = isMobile ? "auto" : "560px";
  const leftPad      = isMobile ? "32px 24px" : isTablet ? "48px" : "70px";
  const h2Size       = isMobile ? "clamp(24px, 8vw, 38px)" : "clamp(42px, 5vw, 72px)";
  const h2Spacing    = isMobile ? "-2px" : "-4px";
  const paraSize     = isMobile ? "14px" : "18px";
  const dotsMargin   = isMobile ? "20px" : "42px";
  const rightPad     = isTablet ? "32px" : "48px";

  return (
    <div style={{
      width: "100%",
      maxWidth: "1850px",
      margin: outerMargin,
      padding: outerPadding,
      position: "relative",
      zIndex: 2,
    }}>
      <div style={{
        position: "relative",
        overflow: "hidden",
        borderRadius: isMobile ? "20px" : "34px",
        border: "1px solid rgba(255,255,255,0.08)",
        background: "rgba(8,10,24,0.78)",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        boxShadow: "0 40px 120px rgba(0,0,0,0.55)",
        minHeight: isMobile ? "auto" : "320px",
      }}>

        {/* Glow */}
        <div style={{
          position: "absolute",
          width: isMobile ? "280px" : "520px",
          height: isMobile ? "280px" : "520px",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${p.color}22, transparent 70%)`,
          right: "-8%",
          top: "-10%",
          filter: "blur(60px)",
          pointerEvents: "none",
        }}/>

        <div style={{
          display: "grid",
          gridTemplateColumns: innerCols,
          minHeight: innerMinH,
        }}>

          {/* LEFT — always shown */}
          <div style={{
            padding: leftPad,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
          }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: isMobile ? "10px" : "12px",
              letterSpacing: "4px",
              color: p.color,
              marginBottom: isMobile ? "12px" : "20px",
            }}>
              PHASE {p.phase}
            </div>

            <h2 style={{
              fontSize: h2Size,
              fontWeight: 800,
              lineHeight: 1,
              wordBreak: "break-word",
              letterSpacing: h2Spacing,
              color: "#ffffff",
              margin: `0 0 ${isMobile ? "14px" : "22px"} 0`,
              maxWidth: "600px",
            }}>
              {p.title}
            </h2>

            <p style={{
              fontSize: paraSize,
              lineHeight: 1.8,
              color: "rgba(255,255,255,0.58)",
              maxWidth: "460px",
              margin: 0,
            }}>
              {p.subtitle}
            </p>

            {/* Mobile: compact code preview inline */}
            {isMobile && (
              <div style={{
                marginTop: "20px",
                borderRadius: "14px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                overflow: "hidden",
              }}>
                <div style={{
                  padding: "10px 14px",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "9px",
                  letterSpacing: "1px",
                  color: "rgba(255,255,255,0.3)",
                }}>
                  compiler transformation
                </div>
                <div style={{ padding: "16px 14px", display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"9px", letterSpacing:"2px", color:"rgba(255,255,255,0.3)", marginBottom:"6px" }}>INPUT</div>
                    <pre style={{ margin:0, fontFamily:"'JetBrains Mono',monospace", fontSize:"13px", lineHeight:1.6, color:"#dbe7ff", whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{p.input}</pre>
                  </div>
                  <div style={{ textAlign:"center", fontSize:"18px", color:p.color }}>↓</div>
                  <div>
                    <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"9px", letterSpacing:"2px", color:"rgba(255,255,255,0.3)", marginBottom:"6px" }}>OUTPUT</div>
                    <pre style={{ margin:0, fontFamily:"'JetBrains Mono',monospace", fontSize:"13px", lineHeight:1.6, color:p.color, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{p.output}</pre>
                  </div>
                </div>
              </div>
            )}

            {/* Indicators */}
            <div style={{
              display: "flex",
              gap: "10px",
              marginTop: dotsMargin,
            }}>
              {phases.map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: active === i ? "48px" : "12px",
                    height: "12px",
                    borderRadius: "999px",
                    background: active === i ? p.color : "rgba(255,255,255,0.12)",
                    transition: "all .35s ease",
                  }}
                />
              ))}
            </div>
          </div>

          {/* RIGHT — hidden on mobile (shown inline above) */}
          {!isMobile && (
            <div style={{
              padding: rightPad,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <div style={{
                width: "100%",
                maxWidth: "900px",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "28px",
                overflow: "hidden",
                boxShadow: "0 20px 60px rgba(0,0,0,0.45)",
              }}>
                {/* Top Bar */}
                <div style={{
                  padding: "18px 24px",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: "11px",
                  letterSpacing: "1px",
                  color: "rgba(255,255,255,0.35)",
                }}>
                  compiler transformation
                </div>

                {/* Main Content */}
                <div style={{
                  padding: isTablet ? "28px" : "42px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "28px",
                }}>
                  {/* INPUT */}
                  <div>
                    <div style={{
                      fontSize: "11px",
                      letterSpacing: "2px",
                      marginBottom: "12px",
                      color: "rgba(255,255,255,0.35)",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      INPUT
                    </div>
                    <pre style={{
                      margin: 0,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: isTablet ? "16px" : "20px",
                      lineHeight: 1.8,
                      color: "#dbe7ff",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}>
                      {p.input}
                    </pre>
                  </div>

                  {/* Arrow */}
                  <div style={{
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    fontSize: "32px",
                    color: p.color,
                  }}>
                    ↓
                  </div>

                  {/* OUTPUT */}
                  <div>
                    <div style={{
                      fontSize: "11px",
                      letterSpacing: "2px",
                      marginBottom: "12px",
                      color: "rgba(255,255,255,0.35)",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      OUTPUT
                    </div>
                    <pre style={{
                      margin: 0,
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: isTablet ? "13px" : "16px",
                      lineHeight: 1.9,
                      color: p.color,
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}>
                      {p.output}
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
