import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

const STATES = [
  { id: "START", x: 150, y: 350, color: "#00d4ff", sub: "entry" },
  { id: "IDENT", x: 350, y: 150, color: "#a855f7", sub: "identifier" },
  { id: "INTEGER", x: 350, y: 300, color: "#3b82f6", sub: "integer" },
  { id: "FLOAT", x: 550, y: 300, color: "#60a5fa", sub: "decimal" },
  { id: "STRING", x: 350, y: 450, color: "#f59e0b", sub: "literal" },
  { id: "OPERATOR", x: 350, y: 550, color: "#f97316", sub: "symbol" },
  { id: "COMPOUND", x: 550, y: 550, color: "#fb923c", sub: "pair" },
  { id: "SLASH", x: 350, y: 650, color: "#6b7280", sub: "slash" },
  { id: "COMMENT", x: 550, y: 650, color: "#4b5563", sub: "comment" },
  { id: "ACCEPT", x: 750, y: 350, color: "#10b981", sub: "emit", accept: true },
];

const EDGES = [
  { from: "START", to: "IDENT", label: "LETTER", full: "[a-zA-Z_]", desc: "Letter or underscore starts an identifier." },
  { from: "IDENT", to: "IDENT", label: "LETTER/DIGIT", full: "[a-zA-Z0-9_]", desc: "Identifier body stays in IDENT." },
  { from: "IDENT", to: "ACCEPT", label: "END", full: "end of token", desc: "Emit identifier or keyword." },
  { from: "START", to: "INTEGER", label: "DIGIT", full: "[0-9]", desc: "Digit starts a number." },
  { from: "INTEGER", to: "INTEGER", label: "DIGIT", full: "[0-9]", desc: "More digits stay in INTEGER." },
  { from: "INTEGER", to: "FLOAT", label: "DOT", full: "[.]", desc: "Decimal point switches to FLOAT." },
  { from: "FLOAT", to: "FLOAT", label: "DIGIT", full: "[0-9]", desc: "Fraction digits stay in FLOAT." },
  { from: "INTEGER", to: "ACCEPT", label: "END", full: "end of token", desc: "Emit integer literal." },
  { from: "FLOAT", to: "ACCEPT", label: "END", full: "end of token", desc: "Emit floating literal." },
  { from: "START", to: "STRING", label: "QUOTE", full: "[\"]", desc: "Opening quote starts a string." },
  { from: "STRING", to: "STRING", label: "CHAR", full: "[^\"]", desc: "Characters stay inside the string." },
  { from: "STRING", to: "ACCEPT", label: "QUOTE", full: "[\"]", desc: "Closing quote emits the string token." },
  { from: "START", to: "OPERATOR", label: "SYMBOL", full: "[+\\-*/=<>!&|^%]", desc: "Operator symbol starts this path." },
  { from: "OPERATOR", to: "COMPOUND", label: "PAIR", full: "[=+\\->&|]", desc: "Second character forms a compound operator." },
  { from: "OPERATOR", to: "ACCEPT", label: "END", full: "end of token", desc: "Emit single-character operator." },
  { from: "COMPOUND", to: "ACCEPT", label: "END", full: "end of token", desc: "Emit compound operator." },
  { from: "START", to: "SLASH", label: "SLASH", full: "[/]", desc: "Slash may start division or a comment." },
  { from: "SLASH", to: "COMMENT", label: "LINE", full: "[/]", desc: "Second slash starts a line comment." },
  { from: "SLASH", to: "OPERATOR", label: "OTHER", full: "[^/]", desc: "Slash falls back to operator handling." },
  { from: "COMMENT", to: "ACCEPT", label: "NEWLINE", full: "[\\n]", desc: "Newline ends a line comment." },
];

const STATE_BY_ID = Object.fromEntries(STATES.map(state => [state.id, state]));
const EDGE_BY_KEY = Object.fromEntries(EDGES.map(edge => [`${edge.from}-${edge.to}-${edge.label}`, edge]));
const COMPOUND_OPERATORS = new Set(["==", "!=", "<=", ">=", "++", "--", "+=", "-=", "*=", "/=", "%=", "&&", "||", "->", "::", "<<", ">>"]);

function edgeKey(from, to, label) {
  return `${from}-${to}-${label}`;
}

function tokenLabel(token) {
  return String(token?.value ?? token?.type ?? "");
}

function tokenKind(token) {
  const type = String(token?.type || "").toUpperCase();
  const category = String(token?.category || "").toUpperCase();
  const value = tokenLabel(token);
  if (category.includes("IDENTIFIER") || ["TYPE", "CONTROL", "MODIFIER", "TEMPLATE"].includes(category)) return "identifier";
  if (type.includes("INT") || type.includes("FLOAT") || /^-?\d+(\.\d+)?$/.test(value)) return "number";
  if (type.includes("STRING") || type.includes("CHAR") || /^["']/.test(value)) return "string";
  if (category.includes("COMMENT") || value.startsWith("//")) return "comment";
  return "operator";
}

function makeStep(char, state, action, from, to, label) {
  return { char, state, action, edgeKey: from ? edgeKey(from, to, label) : null };
}

function buildSimulation(token) {
  const raw = tokenLabel(token);
  const value = raw || "token";
  const chars = [...value];
  const kind = tokenKind(token);
  const steps = [makeStep("●", "START", "Ready at START")];

  if (!token) return steps;

  if (kind === "identifier") {
    chars.forEach((char, index) => {
      steps.push(makeStep(char, "IDENT", index === 0 ? "Letter → go to IDENT" : "Letter/digit → stay", index === 0 ? "START" : "IDENT", "IDENT", index === 0 ? "LETTER" : "LETTER/DIGIT"));
    });
    steps.push(makeStep("∎", "ACCEPT", "End → emit token", "IDENT", "ACCEPT", "END"));
    return steps;
  }

  if (kind === "number") {
    let state = "START";
    chars.forEach(char => {
      if (char === ".") {
        steps.push(makeStep(char, "FLOAT", "Dot → go to FLOAT", "INTEGER", "FLOAT", "DOT"));
        state = "FLOAT";
      } else {
        const from = state === "START" ? "START" : state;
        const to = state === "FLOAT" ? "FLOAT" : "INTEGER";
        steps.push(makeStep(char, to, state === "START" ? "Digit → go to INTEGER" : "Digit → stay", from, to, "DIGIT"));
        state = to;
      }
    });
    steps.push(makeStep("∎", "ACCEPT", "End → emit token", state === "FLOAT" ? "FLOAT" : "INTEGER", "ACCEPT", "END"));
    return steps;
  }

  if (kind === "string") {
    chars.forEach((char, index) => {
      const isLastQuote = index > 0 && index === chars.length - 1 && (char === "\"" || char === "'");
      if (index === 0 && (char === "\"" || char === "'")) {
        steps.push(makeStep(char, "STRING", "Quote → go to STRING", "START", "STRING", "QUOTE"));
      } else if (isLastQuote) {
        steps.push(makeStep(char, "ACCEPT", "Quote → emit token", "STRING", "ACCEPT", "QUOTE"));
      } else {
        steps.push(makeStep(char, "STRING", "Char → stay", "STRING", "STRING", "CHAR"));
      }
    });
    if (steps[steps.length - 1].state !== "ACCEPT") steps.push(makeStep("∎", "ACCEPT", "End → emit token", "STRING", "ACCEPT", "QUOTE"));
    return steps;
  }

  if (kind === "comment") {
    steps.push(makeStep("/", "SLASH", "Slash → possible comment", "START", "SLASH", "SLASH"));
    steps.push(makeStep("/", "COMMENT", "Slash → line comment", "SLASH", "COMMENT", "LINE"));
    steps.push(makeStep("…", "COMMENT", "Comment text → stay", "COMMENT", "COMMENT", "CHAR"));
    steps.push(makeStep("↵", "ACCEPT", "Newline → finish", "COMMENT", "ACCEPT", "NEWLINE"));
    return steps;
  }

  if (value === "/") {
    steps.push(makeStep("/", "SLASH", "Slash → possible comment", "START", "SLASH", "SLASH"));
    steps.push(makeStep("∎", "OPERATOR", "Other → division operator", "SLASH", "OPERATOR", "OTHER"));
    steps.push(makeStep("∎", "ACCEPT", "End → emit token", "OPERATOR", "ACCEPT", "END"));
    return steps;
  }

  steps.push(makeStep(chars[0] || raw, "OPERATOR", "Symbol → go to OPERATOR", "START", "OPERATOR", "SYMBOL"));
  if (COMPOUND_OPERATORS.has(value) || chars.length > 1) {
    steps.push(makeStep(chars.slice(1).join("") || "pair", "COMPOUND", "Pair → compound operator", "OPERATOR", "COMPOUND", "PAIR"));
    steps.push(makeStep("∎", "ACCEPT", "End → emit token", "COMPOUND", "ACCEPT", "END"));
  } else {
    steps.push(makeStep("∎", "ACCEPT", "End → emit token", "OPERATOR", "ACCEPT", "END"));
  }
  return steps;
}

function edgePath(edge) {
  const source = STATE_BY_ID[edge.from];
  const target = STATE_BY_ID[edge.to];
  if (edge.from === edge.to) {
    return `M ${source.x - 18} ${source.y - 34} C ${source.x - 68} ${source.y - 98}, ${source.x + 68} ${source.y - 98}, ${source.x + 18} ${source.y - 34}`;
  }
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const curve = Math.max(28, Math.min(96, Math.abs(dy) * 0.35));
  const sweep = dy >= 0 ? curve : -curve;
  return `M ${source.x} ${source.y} C ${source.x + dx * 0.45} ${source.y + sweep}, ${target.x - dx * 0.45} ${target.y - sweep}, ${target.x} ${target.y}`;
}

function labelPoint(edge) {
  const source = STATE_BY_ID[edge.from];
  const target = STATE_BY_ID[edge.to];
  if (edge.from === edge.to) return { x: source.x, y: source.y - 90 };
  return { x: (source.x + target.x) / 2, y: (source.y + target.y) / 2 - 14 };
}

export default function DFADiagram({ tokens = [] }) {
  const svgRef = useRef(null);
  const wrapRef = useRef(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [howOpen, setHowOpen] = useState(true);
  const [width, setWidth] = useState(920);

  const candidates = useMemo(() => tokens.filter(token => token?.type !== "EOF" && tokenLabel(token) !== ""), [tokens]);
  const token = candidates[selectedIndex] || candidates[0] || null;
  const steps = useMemo(() => buildSimulation(token), [token]);
  const currentStep = steps[Math.min(stepIndex, steps.length - 1)] || steps[0];
  const currentState = currentStep?.state || "START";
  const activeEdge = currentStep?.edgeKey;
  const traversedEdges = new Set(steps.slice(1, stepIndex + 1).map(step => step.edgeKey).filter(Boolean));
  const visitedStates = new Set(steps.slice(0, stepIndex + 1).map(step => step.state));
  const complete = currentState === "ACCEPT";

  useEffect(() => {
    setSelectedIndex(0);
  }, [tokens]);

  useEffect(() => {
    setStepIndex(0);
    setPlaying(false);
  }, [selectedIndex]);

  useEffect(() => {
    if (!playing) return undefined;
    const timer = setInterval(() => {
      setStepIndex(index => {
        if (index >= steps.length - 1) {
          setPlaying(false);
          return index;
        }
        return index + 1;
      });
    }, 600);
    return () => clearInterval(timer);
  }, [playing, steps.length]);

  useEffect(() => {
    if (!wrapRef.current) return undefined;
    const observer = new ResizeObserver(entries => {
      setWidth(Math.max(520, Math.floor(entries[0].contentRect.width)));
    });
    observer.observe(wrapRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();
    svg.attr("viewBox", "0 70 920 660").attr("width", "100%").attr("height", Math.max(440, width * 0.55));

    const defs = svg.append("defs");
    defs.append("marker")
      .attr("id", "dfa-arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 42)
      .attr("refY", 0)
      .attr("markerWidth", 7)
      .attr("markerHeight", 7)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#8ba3b8");

    const glow = defs.append("filter").attr("id", "dfa-glow").attr("x", "-80%").attr("y", "-80%").attr("width", "260%").attr("height", "260%");
    glow.append("feGaussianBlur").attr("stdDeviation", 4).attr("result", "blur");
    glow.append("feMerge").selectAll("feMergeNode")
      .data(["blur", "SourceGraphic"])
      .join("feMergeNode")
      .attr("in", d => d);

    svg.append("path")
      .attr("d", "M 70 350 L 112 350")
      .attr("stroke", "#00d4ff")
      .attr("stroke-width", 2)
      .attr("marker-end", "url(#dfa-arrow)")
      .attr("opacity", currentState === "START" ? 1 : 0.35);

    const edgeGroup = svg.append("g").attr("class", "dfa-edges");
    edgeGroup.selectAll("path")
      .data(EDGES)
      .join("path")
      .attr("d", edgePath)
      .attr("fill", "none")
      .attr("stroke", edge => {
        const key = edgeKey(edge.from, edge.to, edge.label);
        if (key === activeEdge || traversedEdges.has(key)) return STATE_BY_ID[edge.to].color;
        return "#374151";
      })
      .attr("stroke-width", edge => edgeKey(edge.from, edge.to, edge.label) === activeEdge ? 2.8 : 1.4)
      .attr("stroke-dasharray", edge => edgeKey(edge.from, edge.to, edge.label) === activeEdge ? "8 5" : null)
      .attr("class", edge => edgeKey(edge.from, edge.to, edge.label) === activeEdge ? "dfa-active-edge" : null)
      .attr("opacity", edge => {
        const key = edgeKey(edge.from, edge.to, edge.label);
        if (key === activeEdge) return 1;
        if (traversedEdges.has(key)) return 0.65;
        return 0.25;
      })
      .attr("marker-end", "url(#dfa-arrow)")
      .append("title")
      .text(edge => `${edge.full}\n${edge.desc}`);

    edgeGroup.selectAll("text")
      .data(EDGES)
      .join("text")
      .attr("x", edge => labelPoint(edge).x)
      .attr("y", edge => labelPoint(edge).y)
      .attr("text-anchor", "middle")
      .attr("font-size", 9)
      .attr("font-weight", 800)
      .attr("font-family", "monospace")
      .attr("fill", edge => {
        const key = edgeKey(edge.from, edge.to, edge.label);
        return key === activeEdge || traversedEdges.has(key) ? STATE_BY_ID[edge.to].color : "#64748b";
      })
      .attr("opacity", edge => edgeKey(edge.from, edge.to, edge.label) === activeEdge ? 1 : 0.72)
      .text(edge => edge.label);

    const nodes = svg.append("g").selectAll("g")
      .data(STATES)
      .join("g")
      .attr("transform", state => `translate(${state.x},${state.y})`);

    nodes.append("circle")
      .attr("r", state => state.accept ? 42 : 35)
      .attr("fill", "rgba(13,17,23,0.92)")
      .attr("stroke", state => state.color)
      .attr("stroke-width", state => state.accept ? 2 : 1.5)
      .attr("opacity", state => state.id === currentState ? 1 : visitedStates.has(state.id) ? 0.72 : 0.3)
      .attr("filter", state => state.id === currentState || visitedStates.has(state.id) ? "url(#dfa-glow)" : null)
      .attr("class", state => state.accept ? "dfa-accept-pulse" : state.id === currentState ? "dfa-active-node" : null);

    nodes.filter(state => state.accept).append("circle")
      .attr("r", 35)
      .attr("fill", "none")
      .attr("stroke", "#10b981")
      .attr("stroke-width", 1.8)
      .attr("opacity", complete ? 1 : 0.7);

    nodes.append("text")
      .attr("text-anchor", "middle")
      .attr("y", -2)
      .attr("font-family", "monospace")
      .attr("font-size", 11)
      .attr("font-weight", 900)
      .attr("fill", state => state.id === currentState || visitedStates.has(state.id) ? state.color : "#94a3b8")
      .text(state => state.id);

    nodes.append("text")
      .attr("text-anchor", "middle")
      .attr("y", 13)
      .attr("font-family", "monospace")
      .attr("font-size", 8)
      .attr("fill", "#94a3b8")
      .attr("opacity", state => state.id === currentState || visitedStates.has(state.id) ? 0.9 : 0.45)
      .text(state => state.sub);

    if (complete) {
      svg.append("text")
        .attr("x", 750)
        .attr("y", 420)
        .attr("text-anchor", "middle")
        .attr("font-family", "monospace")
        .attr("font-size", 12)
        .attr("font-weight", 900)
        .attr("fill", "#10b981")
        .text("✓ Token Emitted");
    }
  }, [activeEdge, complete, currentState, traversedEdges, visitedStates, width]);

  const uniquePath = steps.map(step => step.state).filter((state, index, all) => index === 0 || state !== all[index - 1]).join(" → ");

  return (
    <div className="dfa-shell">
      <style>{`
        .dfa-shell { display: grid; grid-template-columns: minmax(0, 1fr) 340px; grid-template-areas: "graph execution" "controls controls"; gap: 14px; background: #0a0a0f; }
        .dfa-panel { background: #0d1117; border: 1px solid #1e2a3a; border-radius: 8px; overflow: hidden; }
        .dfa-panel-title { padding: 10px 12px; border-bottom: 1px solid #1e2a3a; color: #89ddff; font: 800 10px/1 var(--font-mono, monospace); letter-spacing: .11em; text-transform: uppercase; }
        .dfa-graph { grid-area: graph; min-height: 490px; }
        .dfa-execution { grid-area: execution; min-height: 490px; }
        .dfa-controls { grid-area: controls; }
        .dfa-active-edge { animation: dfaDash 0.65s linear infinite; }
        .dfa-accept-pulse { animation: dfaAcceptPulse 1.9s ease-in-out infinite; transform-origin: center; }
        .dfa-active-node { animation: dfaNodePulse 1.2s ease-in-out infinite; transform-origin: center; }
        @keyframes dfaDash { to { stroke-dashoffset: -26; } }
        @keyframes dfaAcceptPulse { 50% { stroke-width: 3.2; opacity: 1; } }
        @keyframes dfaNodePulse { 50% { stroke-width: 3; } }
        @media (max-width: 1024px) {
          .dfa-shell { grid-template-columns: 1fr; grid-template-areas: "graph" "execution" "controls"; }
          .dfa-graph, .dfa-execution { min-height: auto; }
        }
      `}</style>

      <section className="dfa-panel dfa-graph">
        <div className="dfa-panel-title">DFA Graph</div>
        <div ref={wrapRef} style={{ padding: "8px", background: "radial-gradient(circle at 50% 45%, rgba(0,212,255,0.08), transparent 42%)" }}>
          <svg ref={svgRef} role="img" aria-label="Lexer deterministic finite automaton graph" />
        </div>
      </section>

      <aside className="dfa-panel dfa-execution">
        <div className="dfa-panel-title">Execution Panel</div>
        <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
          {token ? (
            <>
              <div style={{ fontFamily: "var(--font-mono, monospace)", color: "#dbeafe", fontSize: 12, lineHeight: 1.75 }}>
                <div>Token: <span style={{ color: "#89ddff", fontWeight: 900 }}>{token.value || token.type}</span></div>
                <div>Type: <span style={{ color: "#a855f7", fontWeight: 900 }}>{token.category || token.type}</span></div>
                <div style={{ height: 1, background: "#1e2a3a", margin: "10px 0" }} />
                <div style={{ color: "#10b981", fontWeight: 800 }}>{uniquePath}</div>
              </div>

              <div style={{ overflowX: "auto", border: "1px solid #1e2a3a", borderRadius: 6 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "var(--font-mono, monospace)", fontSize: 10, color: "#cbd5e1" }}>
                  <thead>
                    <tr style={{ background: "#111827", color: "#89ddff" }}><th style={th}>Char</th><th style={th}>State</th><th style={th}>Action</th></tr>
                  </thead>
                  <tbody>
                    {steps.slice(1).map((step, index) => {
                      const active = index + 1 === stepIndex;
                      return (
                        <tr key={`${step.char}-${index}`} style={{ background: active ? "rgba(16,185,129,0.13)" : "transparent", color: active ? "#ecfeff" : "#cbd5e1" }}>
                          <td style={td}>{step.char}</td>
                          <td style={{ ...td, color: STATE_BY_ID[step.state]?.color || "#cbd5e1", fontWeight: 900 }}>{step.state}</td>
                          <td style={td}>{step.action}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div style={{ color: "#f59e0b", fontSize: 12, lineHeight: 1.6 }}>Write code and compile to simulate real tokens. The static DFA is still available on the left.</div>
          )}

          <button onClick={() => setHowOpen(open => !open)} style={plainButton}>
            How DFA Works {howOpen ? "▴" : "▾"}
          </button>
          {howOpen && (
            <ol style={{ margin: "0 0 0 18px", padding: 0, color: "#94a3b8", fontSize: 11, lineHeight: 1.8 }}>
              <li>Lexer reads one character at a time.</li>
              <li>Current character determines next state.</li>
              <li>DFA keeps reading until no valid transition.</li>
              <li>Final state emits the token type.</li>
              <li>Lexer returns to START for next token.</li>
            </ol>
          )}

          <div style={{ display: "grid", gap: 7 }}>
            {[
              ["#00d4ff", "Cyan = START"],
              ["#a855f7", "Purple = Identifier path"],
              ["#3b82f6", "Blue = Number path"],
              ["#f59e0b", "Yellow = String path"],
              ["#f97316", "Orange = Operator path"],
              ["#6b7280", "Gray = Comment path"],
              ["#10b981", "Green = ACCEPT"],
            ].map(([color, label]) => (
              <span key={label} style={{ display: "flex", alignItems: "center", gap: 8, color: "#cbd5e1", fontSize: 11 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: color, boxShadow: `0 0 8px ${color}` }} />
                {label}
              </span>
            ))}
          </div>
        </div>
      </aside>

      <section className="dfa-panel dfa-controls">
        <div className="dfa-panel-title">Simulation Controls</div>
        <div style={{ padding: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <select value={selectedIndex} onChange={event => setSelectedIndex(Number(event.target.value))} disabled={!candidates.length} style={selectStyle}>
            {candidates.length ? candidates.map((candidate, index) => (
              <option key={`${candidate.type}-${candidate.value}-${index}`} value={index}>{candidate.value || candidate.type} — {candidate.category || candidate.type}</option>
            )) : <option>No tokens yet</option>}
          </select>
          <button onClick={() => setPlaying(true)} disabled={!token || stepIndex >= steps.length - 1} style={controlButton(!token || stepIndex >= steps.length - 1)}>▶ Play</button>
          <button onClick={() => setPlaying(false)} disabled={!playing} style={controlButton(!playing)}>⏸ Pause</button>
          <button onClick={() => setStepIndex(index => Math.min(index + 1, steps.length - 1))} disabled={!token || stepIndex >= steps.length - 1} style={controlButton(!token || stepIndex >= steps.length - 1)}>⏭ Next</button>
          <button onClick={() => { setPlaying(false); setStepIndex(0); }} disabled={!token} style={controlButton(!token)}>↺ Reset</button>
          <span style={{ marginLeft: "auto", color: complete ? "#10b981" : "#94a3b8", fontFamily: "var(--font-mono, monospace)", fontSize: 11, fontWeight: 800 }}>
            {complete ? "✓ Token Emitted" : `State: ${currentState}`}
          </span>
        </div>
      </section>
    </div>
  );
}

const th = { padding: "7px 8px", textAlign: "left", borderBottom: "1px solid #1e2a3a", whiteSpace: "nowrap" };
const td = { padding: "7px 8px", borderBottom: "1px solid rgba(30,42,58,0.75)", verticalAlign: "top" };

const selectStyle = {
  minWidth: 240,
  background: "#111827",
  border: "1px solid #1e2a3a",
  borderRadius: 6,
  color: "#dbeafe",
  padding: "8px 10px",
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 12,
  outline: "none",
};

const plainButton = {
  border: "1px solid #1e2a3a",
  background: "rgba(0,212,255,0.06)",
  color: "#89ddff",
  borderRadius: 6,
  padding: "8px 10px",
  textAlign: "left",
  fontFamily: "var(--font-mono, monospace)",
  fontSize: 11,
  fontWeight: 900,
  cursor: "pointer",
};

function controlButton(disabled) {
  return {
    border: "1px solid rgba(0,212,255,0.32)",
    background: disabled ? "rgba(255,255,255,0.03)" : "rgba(0,212,255,0.10)",
    color: disabled ? "rgba(255,255,255,0.28)" : "#89ddff",
    borderRadius: 6,
    padding: "8px 11px",
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 11,
    fontWeight: 900,
    cursor: disabled ? "not-allowed" : "pointer",
  };
}
