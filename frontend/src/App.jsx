import { useState, useEffect, useRef } from "react";
import Editor from "./components/Editor";
import PhasePanel from "./components/PhasePanel";
import ErrorPanel from "./components/ErrorPanel";
import Toolbar from "./components/Toolbar";
import "./App.css";

const PHASES = [
  { id: "lex",      label: "01 Lexer",    desc: "Token Stream"    },
  { id: "parse",    label: "02 Parser",   desc: "Syntax Tree"     },
  { id: "semantic", label: "03 Semantic", desc: "Symbol Table"    },
  { id: "ir",       label: "04 IR Gen",   desc: "3-Address Code"  },
  { id: "opt",      label: "05 Optimize", desc: "Optimized TAC"   },
  { id: "codegen",  label: "06 CodeGen",  desc: "Target Assembly" },
];

const EXAMPLES = {
  "Hello World": `#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}`,
  "Variables & Arithmetic": `#include <iostream>\nusing namespace std;\n\nint main() {\n    int a = 10;\n    int b = 20;\n    int sum = a + b;\n    float avg = (a + b) / 2.0f;\n    cout << sum << endl;\n    return 0;\n}`,
  "If / Else": `#include <iostream>\nusing namespace std;\n\nint main() {\n    int score = 85;\n    if (score >= 90) {\n        cout << "Grade: A" << endl;\n    } else if (score >= 80) {\n        cout << "Grade: B" << endl;\n    } else {\n        cout << "Grade: C" << endl;\n    }\n    return 0;\n}`,
  "For Loop": `#include <iostream>\nusing namespace std;\n\nint main() {\n    int sum = 0;\n    for (int i = 1; i <= 10; i++) {\n        sum += i;\n    }\n    cout << sum << endl;\n    return 0;\n}`,
  "While Loop": `#include <iostream>\nusing namespace std;\n\nint main() {\n    int n = 5;\n    int fact = 1;\n    while (n > 0) {\n        fact *= n;\n        n--;\n    }\n    cout << fact << endl;\n    return 0;\n}`,
  "Class & Object": `#include <iostream>\nusing namespace std;\n\nclass Rectangle {\nprivate:\n    int width;\n    int height;\npublic:\n    Rectangle(int w, int h) {\n        width  = w;\n        height = h;\n    }\n    int area() {\n        return width * height;\n    }\n};\n\nint main() {\n    Rectangle r(5, 3);\n    cout << r.area() << endl;\n    return 0;\n}`,
  "Templates": `#include <iostream>\nusing namespace std;\n\ntemplate <typename T>\nT maxOf(T a, T b) {\n    return (a > b) ? a : b;\n}\n\nint main() {\n    cout << maxOf(3, 7) << endl;\n    return 0;\n}`,
};

// ── Metamic symbol SVG (reusable) ─────────────────────────
function MetamicSymbol({ size = 190, ringClass = "sym-ring-anim", diamondClass = "sym-diamond-anim", showNodes = true, showArcs = true }) {
  return (
    <svg width={size} height={size} viewBox="0 0 190 190">
      <g className={ringClass}>
        <circle cx="95" cy="95" r="88" fill="none" stroke="#1a56db" stroke-width="0.8" strokeDasharray="3 9" opacity="0.35"/>
        <line x1="95" y1="7"   x2="95" y2="17"  stroke="#1a56db" strokeWidth="2" opacity="0.5"/>
        <line x1="95" y1="173" x2="95" y2="183" stroke="#1a56db" strokeWidth="2" opacity="0.5"/>
        <line x1="7"  y1="95"  x2="17" y2="95"  stroke="#1a56db" strokeWidth="2" opacity="0.5"/>
        <line x1="173" y1="95" x2="183" y2="95" stroke="#1a56db" strokeWidth="2" opacity="0.5"/>
      </g>
      <circle cx="95" cy="95" r="72" fill="none" stroke="#1a56db" strokeWidth="0.4" opacity="0.12"/>
      <rect x="58"  y="62" width="11" height="54" rx="2.5" fill="#1a56db"/>
      <rect x="121" y="62" width="11" height="54" rx="2.5" fill="#1a56db"/>
      <rect x="63"  y="59" width="10" height="40" rx="2.5" transform="rotate(38 68 79)"   fill="#1a56db"/>
      <rect x="116" y="59" width="10" height="40" rx="2.5" transform="rotate(-38 121 79)" fill="#1a56db"/>
      <circle cx="58"  cy="62"  r="4.5" fill="#1a56db"/>
      <circle cx="58"  cy="116" r="4.5" fill="#1a56db"/>
      <circle cx="132" cy="62"  r="4.5" fill="#1a56db"/>
      <circle cx="132" cy="116" r="4.5" fill="#1a56db"/>
      <g className={diamondClass}>
        <polygon points="95,74 107,88 95,102 83,88" fill="#1a56db"/>
      </g>
      <rect x="58" y="126" width="74" height="6" rx="3" fill="#1a56db" opacity="0.2"/>
      <rect x="58" y="126" width="24" height="6" rx="3" fill="#1a56db"/>

      {showNodes && <>
        <circle className="sym-node-1" cx="30"  cy="40"  r="11" fill="#1a56db"  opacity="0.15"/>
        <circle cx="30"  cy="40"  r="11" fill="none" stroke="#1a56db"  strokeWidth="1.2"/>
        <circle className="sym-node-2" cx="70"  cy="14"  r="11" fill="#7c3aed" opacity="0.12"/>
        <circle cx="70"  cy="14"  r="11" fill="none" stroke="#7c3aed"  strokeWidth="1.2"/>
        <circle className="sym-node-3" cx="120" cy="14"  r="11" fill="#0891b2" opacity="0.12"/>
        <circle cx="120" cy="14"  r="11" fill="none" stroke="#0891b2"  strokeWidth="1.2"/>
        <circle className="sym-node-4" cx="160" cy="40"  r="11" fill="#059669" opacity="0.12"/>
        <circle cx="160" cy="40"  r="11" fill="none" stroke="#059669"  strokeWidth="1.2"/>
        <circle className="sym-node-5" cx="160" cy="150" r="11" fill="#d97706" opacity="0.12"/>
        <circle cx="160" cy="150" r="11" fill="none" stroke="#d97706"  strokeWidth="1.2"/>
        <circle className="sym-node-6" cx="30"  cy="150" r="11" fill="#dc2626" opacity="0.12"/>
        <circle cx="30"  cy="150" r="11" fill="none" stroke="#dc2626"  strokeWidth="1.2"/>
        <text x="30"  y="44"  textAnchor="middle" fontFamily="'JetBrains Mono',monospace" fontSize="7" fontWeight="700" fill="#1a56db">L</text>
        <text x="70"  y="18"  textAnchor="middle" fontFamily="'JetBrains Mono',monospace" fontSize="7" fontWeight="700" fill="#7c3aed">S</text>
        <text x="120" y="18"  textAnchor="middle" fontFamily="'JetBrains Mono',monospace" fontSize="7" fontWeight="700" fill="#0891b2">M</text>
        <text x="160" y="44"  textAnchor="middle" fontFamily="'JetBrains Mono',monospace" fontSize="7" fontWeight="700" fill="#059669">I</text>
        <text x="160" y="154" textAnchor="middle" fontFamily="'JetBrains Mono',monospace" fontSize="7" fontWeight="700" fill="#d97706">O</text>
        <text x="30"  y="154" textAnchor="middle" fontFamily="'JetBrains Mono',monospace" fontSize="7" fontWeight="700" fill="#dc2626">G</text>
      </>}

      {showArcs && <>
        <path className="sym-arc" d="M 39 33 Q 52 14 60 14"    fill="none" stroke="#1a56db" strokeWidth="0.8" opacity="0.5"/>
        <path className="sym-arc" d="M 81 14 Q 95 8 109 14"    fill="none" stroke="#7c3aed" strokeWidth="0.8" opacity="0.5"/>
        <path className="sym-arc" d="M 131 20 Q 151 24 153 34" fill="none" stroke="#0891b2" strokeWidth="0.8" opacity="0.5"/>
        <path className="sym-arc" d="M 160 51 Q 168 95 160 143" fill="none" stroke="#059669" strokeWidth="0.8" opacity="0.5"/>
        <path className="sym-arc" d="M 152 156 Q 95 174 38 156" fill="none" stroke="#d97706" strokeWidth="0.8" opacity="0.5"/>
        <path className="sym-arc" d="M 30 143 Q 22 95 30 51"   fill="none" stroke="#dc2626" strokeWidth="0.8" opacity="0.5"/>
      </>}

      <circle className="sym-sdot" cx="95" cy="95" r="3.5" fill="#06ffa5"/>
    </svg>
  );
}

// ── Splash screen ──────────────────────────────────────────
function SplashScreen({ onDone }) {
  const symRef    = useRef(null);
  const brandRef  = useRef(null);
  const ulineRef  = useRef(null);
  const overlayRef = useRef(null);

  useEffect(() => {
    const sym    = symRef.current;
    const brand  = brandRef.current;
    const uline  = ulineRef.current;
    const overlay = overlayRef.current;
    if (!sym || !brand || !uline || !overlay) return;

    // ── Timeline ──────────────────────────────────────────

    // 1. Symbol: starts tiny, center
    sym.style.transition = "none";
    sym.style.left       = "50%";
    sym.style.top        = "50%";
    sym.style.transform  = "translate(-50%, -50%) scale(0) rotate(-180deg)";
    sym.style.opacity    = "0";

    // 2. Explode in (fast spin)
    setTimeout(() => {
      sym.style.transition = "all 0.6s cubic-bezier(0.34,1.56,0.64,1)";
      sym.style.transform  = "translate(-50%, -50%) scale(1.1) rotate(10deg)";
      sym.style.opacity    = "1";
    }, 100);

    // Settle
    setTimeout(() => {
      sym.style.transition = "all 0.3s ease";
      sym.style.transform  = "translate(-50%, -50%) scale(1) rotate(0deg)";
    }, 700);

    // 3. Show brand text
    setTimeout(() => {
      brand.classList.add("visible");
    }, 1200);

    // 4. Grow underline
    setTimeout(() => {
      uline.classList.add("grown");
    }, 1800);

    // 5. Hide brand text
    setTimeout(() => {
      brand.classList.add("hiding");
      brand.classList.remove("visible");
    }, 4200);

    // 6. Symbol shoots to top-left
    setTimeout(() => {
      sym.style.transition = "all 0.55s cubic-bezier(0.77,0,0.18,1)";
      sym.style.left       = "20px";
      sym.style.top        = "20px";
      sym.style.transform  = "translate(0, 0) scale(0.22)";
    }, 4800);

    // 7. Symbol comes to center (header center)
    setTimeout(() => {
      sym.style.transition = "all 0.5s cubic-bezier(0.34,1.2,0.64,1)";
      sym.style.left       = "50%";
      sym.style.top        = "26px";
      sym.style.transform  = "translate(-50%, 0) scale(0.22)";
    }, 5600);

    // 8. Symbol slides left to header position
    setTimeout(() => {
      sym.style.transition = "all 0.45s cubic-bezier(0.77,0,0.18,1)";
      sym.style.left       = "20px";
      sym.style.top        = "9px";
      sym.style.transform  = "translate(0, 0) scale(0.22)";
    }, 6300);

    // 9. Fade out splash
    setTimeout(() => {
      overlay.classList.add("hidden");
    }, 7000);

    // 10. Done
    setTimeout(() => {
      onDone();
    }, 7700);

  }, []);

  return (
    <div id="splash-overlay" ref={overlayRef}>

      {/* Symbol */}
      <div id="splash-symbol" ref={symRef} style={{ position: "absolute" }}>
        <MetamicSymbol size={190} ringClass="sym-ring-fast sym-ring-anim" diamondClass="sym-diamond-fast sym-diamond-anim" showNodes={true} showArcs={true} />
      </div>

      {/* Brand text */}
      <div id="splash-brand" ref={brandRef} style={{ marginTop: 220 }}>
        <div className="splash-name">meta<span>mic</span></div>
        <div className="splash-uline" ref={ulineRef}></div>
        <div className="splash-sub">Visual Educational Compiler</div>
        <div className="splash-motto">Transforming Code into Machine Logic</div>
      </div>

    </div>
  );
}

// ── Main App ───────────────────────────────────────────────
export default function App() {
  const [splashDone,  setSplashDone]  = useState(false);
  const [source,      setSource]      = useState(EXAMPLES["Hello World"]);
  const [result,      setResult]      = useState(null);
  const [activePhase, setActivePhase] = useState("lex");
  const [loading,     setLoading]     = useState(false);
  const [errors,      setErrors]      = useState([]);

  async function compile() {
    setLoading(true);
    setErrors([]);
    setResult(null);
    try {
      const res = await fetch("/compile", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ source, phase: "all" }),
      });
      const data = await res.json();
      setResult(data);
      setErrors([...(data.lexer_errors || [])]);
    } catch {
      setErrors([{ message: "Cannot reach compiler server — is server.py running?", line: 0, col: 0 }]);
    }
    setLoading(false);
  }

  function loadExample(name) {
    setSource(EXAMPLES[name]);
    setResult(null);
    setErrors([]);
  }

  const phaseDataMap = {
    lex:      result?.tokens?.length > 0,
    parse:    !!result?.ast,
    semantic: result?.symbols?.length > 0,
    ir:       result?.tac?.length > 0,
    opt:      !!result?.optimized_tac,
    codegen:  !!result?.assembly,
  };

  return (
    <>
      {/* Splash */}
      {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}

      {/* Main App */}
      <div className="app" style={{ opacity: splashDone ? 1 : 0, transition: "opacity 0.6s ease" }}>

        {/* Header */}
        <header className="header">
          <div className="header-left">
            {/* Logo with animated symbol */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: 36, height: 36, flexShrink: 0 }}>
                <MetamicSymbol size={36} ringClass="sym-ring-anim" diamondClass="sym-diamond-anim" showNodes={false} showArcs={false} />
              </div>
              <div className="logo">
                <span className="logo-text">meta</span>
                <span className="logo-bracket" style={{ color: "#1a56db" }}>mic</span>
              </div>
            </div>
            <span className="header-subtitle">Visual Educational Compiler</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div className="status-dot" />
              <span className="header-subtitle" style={{ borderLeft: "none", paddingLeft: 0 }}>SYSTEM ONLINE</span>
            </div>
            <Toolbar onCompile={compile} onLoadExample={loadExample} examples={Object.keys(EXAMPLES)} loading={loading} />
          </div>
        </header>

        {/* Body */}
        <div className="body">
          <div className="editor-section">
            <div className="section-label">
              <span className="label-dot" />
              SOURCE — C++
            </div>
            <Editor value={source} onChange={setSource} errors={errors} />
          </div>

          <div className="output-section">
            <div className="phase-tabs">
              {PHASES.map(p => (
                <button
                  key={p.id}
                  className={["phase-tab", activePhase === p.id ? "active" : "", phaseDataMap[p.id] ? "has-data" : ""].join(" ")}
                  onClick={() => setActivePhase(p.id)}
                >
                  {phaseDataMap[p.id] && <span className="tab-done" />}
                  <span className="tab-label">{p.label}</span>
                  <span className="tab-desc">{p.desc}</span>
                </button>
              ))}
            </div>

            <div className="phase-content">
              {!result && !loading && (
                <div className="empty-state">
                  <div className="empty-icon">&#9654;</div>
                  <p>Press <strong>Compile</strong> to run all 6 phases</p>
                  <p className="empty-sub">Lexer → Parser → Semantic → IR → Optimizer → CodeGen</p>
                </div>
              )}
              {loading && (
                <div className="empty-state">
                  <div className="spinner" />
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: "var(--neon-blue)" }}>COMPILING...</p>
                </div>
              )}
              {result && !loading && <PhasePanel phase={activePhase} data={result} />}
            </div>

            {errors.length > 0 && <ErrorPanel errors={errors} onClose={() => setErrors([])} />}
          </div>
        </div>
      </div>
    </>
  );
}