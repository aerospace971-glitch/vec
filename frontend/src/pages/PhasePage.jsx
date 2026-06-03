import { useState } from "react";
import { useNavigate }         from "react-router-dom";
import Navbar                  from "../components/Navbar";
import PhasePanel              from "../components/PhasePanel";
import LearnMode               from "../components/LearnMode";
import useCompilerStore from "../store/compilerStore";
import { lookupError }  from "../data/cppErrors.jsx";
import "../App.css";

const PHASE_META = {
  lex:      { label:"01 — Lexer",     title:"Lexical Analysis",         color:"#4488ff" },
  parse:    { label:"02 — Parser",    title:"Syntax Analysis",          color:"#aa44ff" },
  semantic: { label:"03 — Semantic",  title:"Semantic Analysis",        color:"#44aaff" },
  ir:       { label:"04 — IR Gen",    title:"Intermediate Code",        color:"#44ffaa" },
  opt:      { label:"05 — Optimizer", title:"Code Optimization",        color:"#ffaa44" },
  codegen:  { label:"06 — CodeGen",   title:"Code Generation",          color:"#ff4488" },
};

// Warnings that are effectively fatal — invalid IR would be generated even though
// the semantic analyser chose to emit them as warnings rather than errors.
const FATAL_WARNING_PATTERNS = [
  /identifier '.*' may be undeclared/i,   // references an undefined symbol → bad IR
];

function isFatalWarning(err) {
  return err.severity === "warning" &&
    FATAL_WARNING_PATTERNS.some(p => p.test(err.message));
}

// Returns the first upstream phase that has blocking issues, or null if all clear.
function getBlockingPhase(currentPhase, result) {
  if (!result) return null;

  const lexErrors   = (result.lexer_errors   || []);
  const parseErrors = (result.parse_errors   || []);

  // Hard semantic errors + warnings that produce invalid IR
  const semanticHard = (result.semantic_errors || []).filter(
    e => e.severity === "error" || isFatalWarning(e)
  );

  const blocked = {
    // parse is blocked by lex errors
    parse:    lexErrors.length > 0
                ? { phaseKey:"lex", label:"01 — Lexer", errors: lexErrors }
                : null,

    // semantic is blocked by lex → parse errors
    semantic: lexErrors.length > 0
                ? { phaseKey:"lex",   label:"01 — Lexer",  errors: lexErrors }
                : parseErrors.length > 0
                ? { phaseKey:"parse", label:"02 — Parser", errors: parseErrors }
                : null,

    // ir / opt / codegen blocked by lex → parse → semantic hard issues
    ir:       lexErrors.length > 0
                ? { phaseKey:"lex",      label:"01 — Lexer",             errors: lexErrors }
                : parseErrors.length > 0
                ? { phaseKey:"parse",    label:"02 — Parser",            errors: parseErrors }
                : semanticHard.length > 0
                ? { phaseKey:"semantic", label:"03 — Semantic Analysis", errors: semanticHard }
                : null,
  };
  blocked.opt     = blocked.ir;
  blocked.codegen = blocked.ir;

  return blocked[currentPhase] ?? null;
}

function PhaseBlockedView({ blocker, currentMeta, navigate }) {
  return (
    <div style={{
      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
      height:"100%", gap:"20px", textAlign:"center", padding:"40px",
    }}>
      {/* Icon */}
      <div style={{
        fontSize:"56px", lineHeight:1,
        filter:"drop-shadow(0 0 18px #ff446688)",
        opacity:0.85,
      }}>
        ⛔
      </div>

      {/* Headline */}
      <div>
        <p style={{ margin:"0 0 6px", fontFamily:"'Space Grotesk',sans-serif", fontSize:"18px", fontWeight:700, color:"rgba(255,255,255,0.75)" }}>
          {currentMeta.label} — Blocked
        </p>
        <p style={{ margin:0, fontFamily:"'JetBrains Mono',monospace", fontSize:"11px", color:"rgba(255,255,255,0.3)", letterSpacing:"0.4px" }}>
          This phase cannot run because <span style={{ color:"#ff5370" }}>{blocker.label}</span> has {blocker.errors.length} error{blocker.errors.length !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Error list */}
      <div style={{
        width:"100%", maxWidth:"640px",
        background:"rgba(255,68,68,0.05)",
        border:"1px solid rgba(255,83,112,0.25)",
        borderRadius:"14px", overflow:"hidden",
      }}>
        <div style={{ padding:"8px 16px", background:"rgba(255,83,112,0.08)", borderBottom:"1px solid rgba(255,83,112,0.15)", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", fontWeight:700, color:"#ff5370", letterSpacing:"1px", textTransform:"uppercase" }}>
            {blocker.label} — Errors
          </span>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"9px", color:"rgba(255,83,112,0.5)" }}>
            {blocker.errors.length} error{blocker.errors.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div style={{ maxHeight:"320px", overflowY:"auto" }}>
          {blocker.errors.slice(0, 20).map((err, i) => {
            const entry = lookupError(err.message || String(err), blocker.phaseKey);
            return (
              <div key={i} style={{ borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                <div style={{
                  display:"flex", gap:"14px", padding:"8px 16px",
                  fontFamily:"'JetBrains Mono',monospace", fontSize:"11px",
                  alignItems:"flex-start",
                }}>
                  <span style={{ color:"#ff5370", flexShrink:0, fontWeight:700 }}>✕</span>
                  {(err.line !== undefined) && (
                    <span style={{ color:"#ffcb6b", flexShrink:0, minWidth:"80px" }}>
                      L{err.line}{err.col !== undefined ? `:${err.col}` : ""}
                    </span>
                  )}
                  <span style={{ color:"rgba(226,238,248,0.75)", flex:1, textAlign:"left", lineHeight:1.4 }}>
                    {err.message || String(err)}
                  </span>
                </div>
                {entry && (
                  <div style={{ padding:"0 16px 10px 46px", display:"flex", flexDirection:"column", gap:"5px" }}>
                    <div style={{ padding:"7px 10px", background:"rgba(255,83,112,0.07)", border:"1px solid rgba(255,83,112,0.18)", borderLeft:"3px solid #ff5370", borderRadius:"6px" }}>
                      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"8px", fontWeight:700, color:"#ff5370", letterSpacing:"1px", textTransform:"uppercase", marginBottom:"3px" }}>⚡ Impact</div>
                      <p style={{ margin:0, fontFamily:"'Space Grotesk',sans-serif", fontSize:"11px", color:"rgba(226,238,248,0.6)", lineHeight:1.5 }}>{entry.impact}</p>
                    </div>
                    <div style={{ fontFamily:"'Space Grotesk',sans-serif", fontSize:"11px", color:"rgba(226,238,248,0.45)", lineHeight:1.45 }}>
                      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"8px", fontWeight:700, color:"#06ffa5", marginRight:"6px" }}>✓ FIX</span>
                      {entry.fix}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {blocker.errors.length > 20 && (
            <div style={{ padding:"8px 16px", color:"rgba(255,83,112,0.5)", fontFamily:"'JetBrains Mono',monospace", fontSize:"10px" }}>
              … and {blocker.errors.length - 20} more
            </div>
          )}
        </div>
      </div>

      {/* CTA */}
      <button onClick={() => navigate("/app")} style={{
        background:"linear-gradient(135deg,#ff448888,#ff448844)",
        border:"1px solid #ff448844",
        color:"#fff", borderRadius:"10px", padding:"12px 28px",
        fontFamily:"'Space Grotesk',sans-serif", fontSize:"14px",
        fontWeight:700, cursor:"pointer", marginTop:"4px", transition:"all 0.2s",
      }}
      onMouseEnter={e => e.currentTarget.style.transform="scale(1.04)"}
      onMouseLeave={e => e.currentTarget.style.transform="scale(1)"}>
        Fix Errors in Compiler →
      </button>
    </div>
  );
}

export default function PhasePage({ phase }) {
  const navigate    = useNavigate();
  const [learnMode, setLearnMode] = useState(false);
  const { result, source } = useCompilerStore();
  const meta    = PHASE_META[phase];
  const blocker = getBlockingPhase(phase, result);


  return (
    <div style={{
      display:       "flex",
      flexDirection: "column",
      height:        "100vh",
      background:    "#04030f",
      color:         "#e2eeff",
      overflow:      "hidden",
      fontFamily:    "'Space Grotesk',sans-serif",
    }}>

      {/* Shared 7-tab Navbar */}
      <Navbar />

      {/* Phase header */}
      <div style={{
        display:        "flex",
        alignItems:     "center",
        justifyContent: "space-between",
        padding:        "8px 20px",
        background:     "rgba(5,8,18,0.9)",
        borderBottom:   `1px solid ${meta.color}22`,
        flexShrink:     0,
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
          <div style={{
            width:6,height:6,borderRadius:"50%",
            background:meta.color,
            boxShadow:`0 0 6px ${meta.color}`,
          }}/>
          <span style={{
            fontFamily:    "'JetBrains Mono',monospace",
            fontSize:      "10px",
            fontWeight:    700,
            letterSpacing: "1.5px",
            color:         meta.color,
            textTransform: "uppercase",
          }}>
            {meta.label}
          </span>
          <span style={{
            fontFamily: "'Space Grotesk',sans-serif",
            fontSize:   "13px",
            color:      "rgba(255,255,255,0.35)",
          }}>
            — {meta.title}
          </span>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
          {/* Learn toggle */}
          <button onClick={() => setLearnMode(p => !p)} style={{
            fontFamily:    "'JetBrains Mono',monospace",
            fontSize:      "10px",
            fontWeight:    700,
            letterSpacing: "0.5px",
            padding:       "5px 14px",
            borderRadius:  "6px",
            border:        `1px solid ${learnMode ? "#1a56db" : "rgba(255,255,255,0.1)"}`,
            background:    learnMode ? "rgba(26,86,219,0.15)" : "transparent",
            color:         learnMode ? "#4d9fff" : "rgba(255,255,255,0.4)",
            cursor:        "pointer",
            transition:    "all 0.2s",
          }}>
            📖 Learn
          </button>

          {/* Back to editor */}
          <button onClick={() => navigate("/app")} style={{
            fontFamily:    "'JetBrains Mono',monospace",
            fontSize:      "10px",
            fontWeight:    700,
            letterSpacing: "0.5px",
            padding:       "5px 14px",
            borderRadius:  "6px",
            border:        `1px solid ${meta.color}44`,
            background:    `${meta.color}11`,
            color:         meta.color,
            cursor:        "pointer",
            transition:    "all 0.2s",
          }}>
            ← Edit Code
          </button>
        </div>
      </div>

      {/* Content area */}
      <div style={{
        flex:     1,
        overflow: "hidden",
        display:  "flex",
        position: "relative",
      }}>

        {/* Phase output */}
        <div style={{
          flex:      1,
          overflowY: "auto",
          padding:   "20px",
          scrollbarWidth: "thin",
          scrollbarColor: "rgba(255,255,255,0.1) transparent",
        }}>
          {!result ? (
            /* Empty state */
            <div style={{
              display:        "flex",
              flexDirection:  "column",
              alignItems:     "center",
              justifyContent: "center",
              height:         "100%",
              gap:            "16px",
              textAlign:      "center",
            }}>
              <div style={{
                fontSize:   "64px",
                color:      meta.color,
                opacity:    0.3,
                filter:     `drop-shadow(0 0 20px ${meta.color})`,
              }}>
                ⚙
              </div>
              <p style={{
                fontFamily: "'Space Grotesk',sans-serif",
                fontSize:   "18px",
                fontWeight: 600,
                color:      "rgba(255,255,255,0.6)",
              }}>
                No compiled output yet
              </p>
              <p style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize:   "12px",
                color:      "rgba(255,255,255,0.25)",
                letterSpacing:"0.5px",
              }}>
                Go to Compiler → write code → click Compile
              </p>
              <button onClick={() => navigate("/app")} style={{
                background:   `linear-gradient(135deg,${meta.color}88,${meta.color}44)`,
                border:       `1px solid ${meta.color}44`,
                color:        "#fff",
                borderRadius: "10px",
                padding:      "12px 28px",
                fontFamily:   "'Space Grotesk',sans-serif",
                fontSize:     "14px",
                fontWeight:   700,
                cursor:       "pointer",
                marginTop:    "8px",
                transition:   "all 0.2s",
              }}
              onMouseEnter={e=>e.currentTarget.style.transform="scale(1.04)"}
              onMouseLeave={e=>e.currentTarget.style.transform="scale(1)"}>
                Open Compiler →
              </button>
            </div>
          ) : blocker ? (
            <PhaseBlockedView blocker={blocker} currentMeta={meta} navigate={navigate} />
          ) : (
            <PhasePanel phase={phase} data={result} />
          )}
        </div>

        {/* Learn Mode sidebar */}
        {learnMode && (
          <LearnMode
            phase={phase}
            onClose={() => setLearnMode(false)}
            tokens={result?.tokens || []}
            sourceCode={source || ""}
            astData={result?.ast || null}
            symbols={result?.symbols || []}
            scopes={result?.scopes || []}
            irInstructions={result?.tac || []}
            beforeInstructions={result?.tac || []}
            afterInstructions={result?.optimized_tac || []}
            optimizations={result?.opt_changes || []}
            asmInstructions={result?.assembly || []}
            onNavigate={(targetPhase) => {
              const routes = {
                lex: "/lexer",
                parse: "/parser",
                semantic: "/semantic",
                ir: "/ir",
                opt: "/optimizer",
                codegen: "/codegen",
                compiler: "/app",
                runtime: "/runtime",
              };
              if (routes[targetPhase]) navigate(routes[targetPhase]);
            }}
          />
        )}
      </div>
    </div>
  );
}
