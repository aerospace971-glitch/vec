import { TOKEN_COLORS } from "./Editor";
import { useEffect, useRef } from "react";
import * as d3 from "d3";

export default function PhasePanel({ phase, data }) {
  if (!data) return null;

  switch (phase) {
    case "lex":      return <LexerView data={data} />;
    case "parse":    return <ParserView data={data} />;
    case "semantic": return <SemanticView data={data} />;
    case "ir":       return <IRView data={data} />;
    case "opt":      return <ComingSoon phase="Optimizer"       desc="Optimized TAC"    step="5" hint="Build optimizer.hpp and optimizer.cpp" />;
    case "codegen":  return <ComingSoon phase="Code Generation" desc="Target Assembly"  step="6" hint="Build codegen.hpp and codegen.cpp" />;
    default:         return null;
  }
}

// ══════════════════════════════════════════════════════════
//  Phase 1 — Lexer
// ══════════════════════════════════════════════════════════

function LexerView({ data }) {
  const tokens = (data.tokens || []).filter(t => t.type !== "EOF");
  const errors = data.lexer_errors || [];

  const categoryCounts = {};
  tokens.forEach(t => {
    categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1;
  });
  const categories = Object.keys(categoryCounts).sort();

  return (
    <div className="phase-view">
      <div className="phase-header">
        <span className="phase-title">Token Stream</span>
        <span className="phase-badge">{tokens.length} tokens</span>
        <span className="phase-badge">{errors.length} errors</span>
        <span className="phase-badge">{Object.keys(categoryCounts).length} categories</span>
      </div>

      <div className="token-legend">
        {categories.map(cat => (
          <span key={cat} className="legend-item">
            <span className="legend-dot" style={{ background: TOKEN_COLORS[cat] || "#888" }} />
            {cat}
            <span style={{ color: "var(--text3)", marginLeft: 2 }}>({categoryCounts[cat]})</span>
          </span>
        ))}
      </div>

      <div className="token-table-wrap">
        <table className="token-table">
          <thead>
            <tr><th>#</th><th>Category</th><th>Type</th><th>Value</th><th>Line</th><th>Col</th></tr>
          </thead>
          <tbody>
            {tokens.map((tok, i) => {
              const color = TOKEN_COLORS[tok.category] || "#888";
              return (
                <tr key={i} className="token-row">
                  <td className="tok-idx">{i + 1}</td>
                  <td>
                    <span className="tok-type-badge" style={{
                      background: color + "18", color, borderColor: color + "44"
                    }}>
                      {tok.category}
                    </span>
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text2)" }}>
                    {tok.type}
                  </td>
                  <td className="tok-value">
                    <code style={{ color }}>
                      {tok.value === ""
                        ? <span style={{ color: "var(--text3)", fontStyle: "italic" }}>(empty)</span>
                        : tok.value}
                    </code>
                  </td>
                  <td className="tok-pos">{tok.line}</td>
                  <td className="tok-pos">{tok.col}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {errors.length > 0 && (
        <div style={{ background: "#1a0f0f", border: "1px solid var(--red)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          <div style={{ padding: "8px 14px", fontSize: "10px", fontWeight: 700, color: "var(--red)", letterSpacing: "0.1em", textTransform: "uppercase", borderBottom: "1px solid #3d1515" }}>
            Lexer Errors
          </div>
          {errors.map((e, i) => (
            <div key={i} style={{ display: "flex", gap: "16px", padding: "6px 14px", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
              <span style={{ color: "var(--yellow)", minWidth: 110 }}>Line {e.line}, Col {e.col}</span>
              <span style={{ color: "var(--text)" }}>{e.message}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px", marginTop: "4px" }}>
        {[
          { label: "Total Tokens", value: tokens.length,                                                                                    color: "var(--accent)"  },
          { label: "Keywords",     value: tokens.filter(t => ["TYPE","CONTROL","MODIFIER"].includes(t.category)).length,                    color: "var(--purple)"  },
          { label: "Identifiers",  value: tokens.filter(t => t.category === "IDENTIFIER").length,                                           color: "var(--cyan)"    },
          { label: "Literals",     value: tokens.filter(t => t.category === "LITERAL").length,                                              color: "var(--orange)"  },
          { label: "Operators",    value: tokens.filter(t => ["ARITHMETIC","ASSIGNMENT","COMPARISON","LOGICAL","BITWISE","INCDEC","MEMBER"].includes(t.category)).length, color: "var(--green)" },
          { label: "Lexer Errors", value: errors.length, color: errors.length > 0 ? "var(--red)" : "var(--green)" },
        ].map(stat => (
          <div key={stat.label} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 14px" }}>
            <div style={{ fontSize: "10px", color: "var(--text3)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>
              {stat.label}
            </div>
            <div style={{ fontSize: "24px", fontWeight: 700, color: stat.color, fontFamily: "var(--font-mono)" }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Phase 2 — Parser / AST viewer
// ══════════════════════════════════════════════════════════

const NODE_COLORS = {
  root:        "#4d9fff",
  declaration: "#c792ea",
  statement:   "#c3e88d",
  expression:  "#ffcb6b",
  literal:     "#f78c6c",
  type:        "#89ddff",
  exception:   "#ff5370",
  identifier:  "#82aaff",
  unknown:     "#546e7a",
};

function ParserView({ data }) {
  const svgRef = useRef(null);
  const ast    = data.ast;
  const errors = data.parse_errors || [];

  useEffect(() => {
    if (!ast || !svgRef.current) return;
    const container = svgRef.current.parentElement;
    const W = container.clientWidth  || 800;
    const H = container.clientHeight || 500;
    d3.select(svgRef.current).selectAll("*").remove();
    const svg = d3.select(svgRef.current).attr("width", W).attr("height", H);
    const g   = svg.append("g");
    svg.call(d3.zoom().scaleExtent([0.1, 3]).on("zoom", e => g.attr("transform", e.transform)));

    const root       = d3.hierarchy(ast, d => d.children);
    const treeLayout = d3.tree().nodeSize([160, 80]).separation((a, b) => a.parent === b.parent ? 1.2 : 1.8);
    treeLayout(root);

    const nodes  = root.descendants();
    const minX   = d3.min(nodes, d => d.x);
    const maxX   = d3.max(nodes, d => d.x);
    const minY   = d3.min(nodes, d => d.y);
    const offsetX = W / 2 - (minX + maxX) / 2;
    const offsetY = 60 - minY;

    g.selectAll(".link").data(root.links()).join("path")
      .attr("fill", "none").attr("stroke", "#1e2d4a").attr("stroke-width", 1.5)
      .attr("d", d3.linkVertical().x(d => d.x + offsetX).y(d => d.y + offsetY));

    const node = g.selectAll(".node").data(nodes).join("g")
      .attr("transform", d => `translate(${d.x + offsetX}, ${d.y + offsetY})`)
      .style("cursor", "pointer");

    const BOX_W = 130, BOX_H = 44;
    node.append("rect")
      .attr("x", -BOX_W/2).attr("y", -BOX_H/2)
      .attr("width", BOX_W).attr("height", BOX_H).attr("rx", 6)
      .attr("fill",   d => (NODE_COLORS[d.data.category] || "#888") + "22")
      .attr("stroke", d =>  NODE_COLORS[d.data.category] || "#888")
      .attr("stroke-width", 1);

    node.append("text").attr("y", -7).attr("text-anchor", "middle")
      .attr("font-family", "'JetBrains Mono', monospace").attr("font-size", 10).attr("font-weight", 600)
      .attr("fill", d => NODE_COLORS[d.data.category] || "#888")
      .text(d => d.data.type);

    node.append("text").attr("y", 10).attr("text-anchor", "middle")
      .attr("font-family", "'JetBrains Mono', monospace").attr("font-size", 11).attr("fill", "#e2e8f8")
      .text(d => { const v = d.data.value || ""; return v.length > 12 ? v.slice(0,12)+"…" : v; });

    node.append("text").attr("y", 24).attr("text-anchor", "middle")
      .attr("font-family", "'JetBrains Mono', monospace").attr("font-size", 9).attr("fill", "#4a5578")
      .text(d => d.data.dataType ? `(${d.data.dataType})` : "");

    node.append("title").text(d =>
      `Type: ${d.data.type}\nValue: ${d.data.value}\nDataType: ${d.data.dataType}\nLine: ${d.data.line}`);
  }, [ast]);

  function countNodes(n) { if (!n) return 0; return 1 + (n.children||[]).reduce((s,c)=>s+countNodes(c),0); }
  const totalNodes = countNodes(ast);

  if (!ast) return <ComingSoon phase="Parser" desc="Abstract Syntax Tree" step="2" hint="Compile a program" />;

  return (
    <div className="phase-view">
      <div className="phase-header">
        <span className="phase-title">Abstract Syntax Tree</span>
        <span className="phase-badge">{totalNodes} nodes</span>
        <span className="phase-badge">{errors.length} errors</span>
        <span className="phase-badge">scroll to zoom · drag to pan</span>
      </div>

      <div className="token-legend">
        {Object.entries(NODE_COLORS).map(([cat, color]) => (
          <span key={cat} className="legend-item">
            <span className="legend-dot" style={{ background: color }} />{cat}
          </span>
        ))}
      </div>

      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", height: "500px", position: "relative" }}>
        <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
        <div style={{ position: "absolute", bottom: 10, right: 14, fontSize: "10px", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
          scroll to zoom · drag to pan
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
        {[
          { label: "Total Nodes",   value: totalNodes,                               color: "var(--accent)"  },
          { label: "Declarations",  value: countNodesByCategory(ast,"declaration"),  color: "var(--purple)"  },
          { label: "Statements",    value: countNodesByCategory(ast,"statement"),     color: "var(--green)"   },
          { label: "Expressions",   value: countNodesByCategory(ast,"expression"),    color: "var(--yellow)"  },
          { label: "Literals",      value: countNodesByCategory(ast,"literal"),       color: "var(--orange)"  },
          { label: "Parse Errors",  value: errors.length, color: errors.length > 0 ? "var(--red)" : "var(--green)" },
        ].map(stat => (
          <div key={stat.label} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 14px" }}>
            <div style={{ fontSize: "10px", color: "var(--text3)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>{stat.label}</div>
            <div style={{ fontSize: "24px", fontWeight: 700, color: stat.color, fontFamily: "var(--font-mono)" }}>{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function countNodesByCategory(node, category) {
  if (!node) return 0;
  let count = node.category === category ? 1 : 0;
  (node.children || []).forEach(c => { count += countNodesByCategory(c, category); });
  return count;
}

// ══════════════════════════════════════════════════════════
//  Phase 3 — Semantic Analysis / Symbol Table
// ══════════════════════════════════════════════════════════

const KIND_COLORS = {
  function:   "#4d9fff",
  variable:   "#c792ea",
  parameter:  "#c3e88d",
  class:      "#ffcb6b",
  struct:     "#f78c6c",
  enum:       "#89ddff",
  enum_value: "#82aaff",
  namespace:  "#ff5370",
  typedef:    "#22d3ee",
  unknown:    "#546e7a",
};

function SemanticView({ data }) {
  const symbols = data.symbols || [];
  const errors  = data.semantic_errors || [];
  const kindCounts = {};
  symbols.forEach(s => { kindCounts[s.kind] = (kindCounts[s.kind] || 0) + 1; });

  return (
    <div className="phase-view">
      <div className="phase-header">
        <span className="phase-title">Symbol Table</span>
        <span className="phase-badge">{symbols.length} symbols</span>
        <span className="phase-badge">{errors.length} issues</span>
      </div>

      <div className="token-legend">
        {Object.entries(kindCounts).map(([kind, count]) => (
          <span key={kind} className="legend-item">
            <span className="legend-dot" style={{ background: KIND_COLORS[kind] || "#888" }} />
            {kind}<span style={{ color: "var(--text3)", marginLeft: 2 }}>({count})</span>
          </span>
        ))}
      </div>

      <div className="token-table-wrap">
        <table className="token-table">
          <thead>
            <tr><th>#</th><th>Name</th><th>Kind</th><th>Type</th><th>Scope</th><th>Line</th><th>Used</th><th>Init</th></tr>
          </thead>
          <tbody>
            {symbols.map((sym, i) => {
              const color = KIND_COLORS[sym.kind] || "#888";
              return (
                <tr key={i} className="token-row">
                  <td className="tok-idx">{i + 1}</td>
                  <td><code style={{ color, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{sym.name}</code></td>
                  <td><span className="tok-type-badge" style={{ background: color+"18", color, borderColor: color+"44" }}>{sym.kind}</span></td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--cyan)" }}>{sym.type || "—"}</td>
                  <td style={{ textAlign: "center" }}>
                    <span style={{ display: "inline-block", background: "var(--bg4)", border: "1px solid var(--border2)", borderRadius: "4px", padding: "1px 7px", fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text2)" }}>
                      {sym.scopeLevel}
                    </span>
                  </td>
                  <td className="tok-pos">{sym.line}</td>
                  <td style={{ textAlign: "center" }}><span style={{ color: sym.isUsed ? "var(--green)" : "var(--red)", fontSize: "14px" }}>{sym.isUsed ? "✓" : "✗"}</span></td>
                  <td style={{ textAlign: "center" }}><span style={{ color: sym.isInitialized ? "var(--green)" : "var(--yellow)", fontSize: "14px" }}>{sym.isInitialized ? "✓" : "✗"}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {errors.length > 0 && (
        <div style={{ background: "#1a0f0f", border: "1px solid var(--red)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          <div style={{ padding: "8px 14px", fontSize: "10px", fontWeight: 700, color: "var(--red)", letterSpacing: "0.1em", textTransform: "uppercase", borderBottom: "1px solid #3d1515" }}>
            Semantic Issues
          </div>
          {errors.map((e, i) => (
            <div key={i} style={{ display: "flex", gap: "12px", padding: "6px 14px", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
              <span style={{ color: e.severity === "error" ? "var(--red)" : "var(--yellow)", minWidth: 60, fontWeight: 600 }}>{e.severity.toUpperCase()}</span>
              <span style={{ color: "var(--yellow)", minWidth: 110 }}>Line {e.line}, Col {e.col}</span>
              <span style={{ color: "var(--text)" }}>{e.message}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
        {[
          { label: "Total Symbols", value: symbols.length,                                         color: "var(--accent)"  },
          { label: "Functions",     value: symbols.filter(s => s.kind === "function").length,       color: "var(--cyan)"    },
          { label: "Variables",     value: symbols.filter(s => s.kind === "variable").length,       color: "var(--purple)"  },
          { label: "Parameters",    value: symbols.filter(s => s.kind === "parameter").length,      color: "var(--green)"   },
          { label: "Unused",        value: symbols.filter(s => !s.isUsed).length,                  color: "var(--yellow)"  },
          { label: "Issues",        value: errors.length, color: errors.length > 0 ? "var(--red)" : "var(--green)" },
        ].map(stat => (
          <div key={stat.label} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 14px" }}>
            <div style={{ fontSize: "10px", color: "var(--text3)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>{stat.label}</div>
            <div style={{ fontSize: "24px", fontWeight: 700, color: stat.color, fontFamily: "var(--font-mono)" }}>{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Phase 4 — IR Generation / TAC viewer
// ══════════════════════════════════════════════════════════

const TAC_OP_COLORS = {
  "func_begin": "#4d9fff",
  "func_end":   "#4d9fff",
  "param":      "#89ddff",
  "=":          "#c792ea",
  "copy":       "#c792ea",
  "+":          "#c3e88d",
  "-":          "#c3e88d",
  "*":          "#c3e88d",
  "/":          "#c3e88d",
  "%":          "#c3e88d",
  "==":         "#ffcb6b",
  "!=":         "#ffcb6b",
  "<":          "#ffcb6b",
  ">":          "#ffcb6b",
  "<=":         "#ffcb6b",
  ">=":         "#ffcb6b",
  "&&":         "#ffcb6b",
  "||":         "#ffcb6b",
  "!":          "#ff5370",
  "label":      "#546e7a",
  "goto":       "#f78c6c",
  "if_goto":    "#f78c6c",
  "ifnot_goto": "#f78c6c",
  "return":     "#ff5370",
  "call":       "#22d3ee",
  "print":      "#22d3ee",
};

function IRView({ data }) {
  const tac = data.tac || [];

  return (
    <div className="phase-view">
      <div className="phase-header">
        <span className="phase-title">Three-Address Code</span>
        <span className="phase-badge">{tac.length} instructions</span>
        <span className="phase-badge">{tac.filter(i => i.op === "func_begin").length} functions</span>
        <span className="phase-badge">{tac.filter(i => i.result && i.result.startsWith("t")).length} temporaries</span>
      </div>

      <div className="token-table-wrap">
        <table className="token-table">
          <thead>
            <tr><th>#</th><th>Op</th><th>Instruction</th><th>Result</th><th>Arg1</th><th>Arg2</th><th>Line</th></tr>
          </thead>
          <tbody>
            {tac.map((instr, i) => {
              const color       = TAC_OP_COLORS[instr.op] || "#888";
              const isLabel     = instr.op === "label";
              const isFuncBegin = instr.op === "func_begin";
              const isFuncEnd   = instr.op === "func_end";
              return (
                <tr key={i} className="token-row" style={{
                  background: isFuncBegin ? "#4d9fff11" : isFuncEnd ? "#4d9fff08" : isLabel ? "var(--bg3)" : ""
                }}>
                  <td className="tok-idx" style={{ color: "var(--text3)" }}>{instr.id}</td>
                  <td>
                    <span className="tok-type-badge" style={{ background: color+"18", color, borderColor: color+"44", fontFamily: "var(--font-mono)" }}>
                      {instr.op}
                    </span>
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: isLabel ? "var(--text3)" : isFuncBegin || isFuncEnd ? color : "var(--text)", paddingLeft: isLabel ? "8px" : "14px", fontStyle: isLabel ? "italic" : "normal" }}>
                    {instr.code}
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: instr.result?.startsWith("t") ? "var(--purple)" : "var(--text2)" }}>
                    {instr.result || "—"}
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text2)" }}>{instr.arg1 || "—"}</td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text2)" }}>{instr.arg2 || "—"}</td>
                  <td className="tok-pos">{instr.line || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
        {[
          { label: "Total Instructions", value: tac.length,                                                                    color: "var(--accent)"  },
          { label: "Temporaries",        value: tac.filter(i => i.result?.startsWith("t")).length,                             color: "var(--purple)"  },
          { label: "Labels",             value: tac.filter(i => i.op === "label").length,                                      color: "var(--text2)"   },
          { label: "Jumps",              value: tac.filter(i => ["goto","if_goto","ifnot_goto"].includes(i.op)).length,        color: "var(--orange)"  },
          { label: "Arithmetic",         value: tac.filter(i => ["+","-","*","/","%"].includes(i.op)).length,                  color: "var(--green)"   },
          { label: "Function Calls",     value: tac.filter(i => i.op === "call").length,                                       color: "var(--cyan)"    },
        ].map(stat => (
          <div key={stat.label} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 14px" }}>
            <div style={{ fontSize: "10px", color: "var(--text3)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>{stat.label}</div>
            <div style={{ fontSize: "24px", fontWeight: 700, color: stat.color, fontFamily: "var(--font-mono)" }}>{stat.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
//  Coming soon placeholder
// ══════════════════════════════════════════════════════════

function ComingSoon({ phase, desc, step, hint }) {
  return (
    <div className="coming-soon">
      <div className="coming-icon">&#9881;</div>
      <p className="coming-title">Phase {step} — {phase}</p>
      <p className="coming-sub">{desc}</p>
      <div className="coming-steps">
        <div className="coming-step"><span>01</span> Build the C++ phase files</div>
        <div className="coming-step"><span>02</span> Add JSON output to main.cpp</div>
        <div className="coming-step"><span>03</span> Update PhasePanel.jsx to display it</div>
        <div className="coming-step" style={{ color: "var(--accent)" }}><span>&#9432;</span> {hint}</div>
      </div>
    </div>
  );
}