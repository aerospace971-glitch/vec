import { TOKEN_COLORS } from "./Editor";
import { useCallback, useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import useCompilerStore from "../store/compilerStore";
import { lookupError } from "../data/cppErrors.jsx";
import DFADiagram from "./DFADiagram.jsx";
import ParseTree from "./ParseTree.jsx";
import ScopeTree from "./ScopeTree.jsx";
import TypeChecking from "./TypeChecking.jsx";
import BasicBlocks from "./BasicBlocks.jsx";
import CFG from "./CFG.jsx";
import OptimizerOverview from "./OptimizerOverview.jsx";
import OptimizerImpact from "./OptimizerImpact.jsx";
import SourceMap from "./SourceMap.jsx";
import {
  downloadAssembly_ASM,
  downloadAssembly_CSV,
  downloadAssembly_JSON,
  downloadAST_JSON,
  downloadAST_PNG,
  downloadOptimizedIR_CSV,
  downloadOptimizedIR_JSON,
  downloadSymbols_CSV,
  downloadSymbols_JSON,
  downloadTAC_CSV,
  downloadTAC_JSON,
  downloadTokens_CSV,
  downloadTokens_JSON,
} from "../downloads";

export default function PhasePanel({ phase, data }) {
  if (!data) return null;
  switch (phase) {
    case "lex":      return <LexerView data={data} />;
    case "parse":    return <ParserView data={data} />;
    case "semantic": return <SemanticView data={data} />;
    case "ir":       return <IRView data={data} />;
    case "opt":      return <OptView data={data} />;
    case "codegen":  return <CodeGenView data={data} />;
    default:         return null;
  }
}

// ── Shared components ─────────────────────────────────────────────

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: "flex", gap: "2px", borderBottom: "1px solid var(--border)" }}>
      {tabs.map(tab => (
        <button key={tab.id} onClick={() => onChange(tab.id)} style={{
          fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700,
          letterSpacing: "0.5px", padding: "6px 16px", border: "none",
          borderBottom: active === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
          background: active === tab.id ? "var(--bg3)" : "transparent",
          color: active === tab.id ? "var(--accent)" : "var(--text3)",
          cursor: "pointer", borderRadius: "6px 6px 0 0", transition: "all 0.15s",
        }}>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function DownloadMenu({ options }) {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", marginLeft: "auto" }}>
      <button onClick={() => setOpen(v => !v)} style={{
        border: "1px solid rgba(6,255,165,0.28)", borderRadius: "5px",
        background: "rgba(6,255,165,0.06)", color: "var(--neon-green)",
        cursor: "pointer", fontFamily: "var(--font-mono)", fontSize: "10px",
        fontWeight: 700, padding: "4px 10px",
      }}>
        Download ▾
      </button>
      {open && (
        <span style={{
          position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 20,
          minWidth: "120px", display: "flex", flexDirection: "column", gap: "3px",
          padding: "6px", border: "1px solid var(--border2)", borderRadius: "6px",
          background: "var(--bg2)", boxShadow: "0 10px 24px rgba(0,0,0,0.35)",
        }}>
          {options.map(option => (
            <button key={option.label} onClick={() => { setOpen(false); option.onClick(); }} style={{
              border: "none", borderRadius: "4px", background: "transparent",
              color: "var(--text2)", cursor: "pointer", fontFamily: "var(--font-mono)",
              fontSize: "10px", fontWeight: 700, padding: "6px 8px", textAlign: "left",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(6,255,165,0.08)"; e.currentTarget.style.color = "var(--neon-green)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text2)"; }}>
              {option.label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

// ── Token category explanations ───────────────────────────────────

const OPERATOR_CATEGORIES = ["ARITHMETIC", "ASSIGNMENT", "COMPARISON", "LOGICAL", "INCDEC", "MEMBER"];

const TOKEN_GUIDE_CATEGORIES = [
  {
    name: "IDENTIFIER",
    matchCategories: ["IDENTIFIER"],
    definition: "User-defined names for variables, functions, classes, objects, and namespaces.",
    rule: "[a-zA-Z_][a-zA-Z0-9_]*",
    examples: ["main", "count", "studentName"],
    why: "Identifiers let later compiler phases connect each use of a name back to the variable, function, class, or namespace it refers to.",
    sample: { code: "int count = 10;", marker: "    ^^^^^", label: "IDENTIFIER" },
  },
  {
    name: "TYPE",
    matchCategories: ["TYPE"],
    definition: "Reserved words that describe the kind of value a declaration can store or return.",
    rule: "\\b(int|float|double|char|bool|void|string|auto|long|short|unsigned)\\b",
    examples: ["int", "float", "void"],
    why: "Types give semantic analysis enough information to catch invalid operations and guide code generation.",
    sample: { code: "int count = 10;", marker: "^^^", label: "TYPE" },
  },
  {
    name: "CONTROL",
    matchCategories: ["CONTROL"],
    definition: "Keywords that change the normal top-to-bottom execution order of a program.",
    rule: "\\b(if|else|for|while|do|break|continue|return|switch|case|default)\\b",
    examples: ["if", "while", "return"],
    why: "Control tokens become branch, loop, and return structures in the parser and later become jumps in generated code.",
    sample: { code: "if (count > 0) return count;", marker: "^^", label: "CONTROL" },
  },
  {
    name: "LITERAL",
    matchCategories: ["LITERAL"],
    definition: "Values written directly in source code, such as numbers, strings, characters, and booleans.",
    rule: "\\d+(\\.\\d+)? | \"[^\"]*\" | '[^']' | \\b(true|false)\\b",
    examples: ["10", "\"hello\"", "true"],
    why: "Literals become constant values in the AST and can often be optimized before runtime.",
    sample: { code: "int count = 10;", marker: "            ^^", label: "LITERAL" },
  },
  {
    name: "OPERATOR",
    matchCategories: OPERATOR_CATEGORIES,
    definition: "Symbols that perform arithmetic, assignment, comparison, logical, increment, or member-access operations.",
    rule: "\\+|-|\\*|/|%|=|\\+=|-=|==|!=|<|<=|>|>=|&&|\\|\\||!|\\+\\+|--|\\.|->|::",
    examples: ["=", "+", "=="],
    why: "Operators tell the parser how expressions combine values and tell code generation which machine operation to emit.",
    sample: { code: "count = count + 1;", marker: "      ^       ^", label: "OPERATOR" },
  },
  {
    name: "BITWISE",
    matchCategories: ["BITWISE"],
    definition: "Operators that manipulate individual bits inside integer values.",
    rule: "&|\\||\\^|~|<<|>>",
    examples: ["&", "|", "<<"],
    why: "Bitwise tokens enable low-level flags, masks, and shifts that the compiler must preserve precisely.",
    sample: { code: "mask = flags & 1;", marker: "             ^", label: "BITWISE" },
  },
  {
    name: "DELIMITER",
    matchCategories: ["DELIMITER", "PUNCTUATION"],
    matchTypes: ["LPAREN", "RPAREN", "LBRACE", "RBRACE", "LBRACKET", "RBRACKET", "SEMICOLON", "COMMA"],
    definition: "Characters that separate or bound parts of the program: statements, blocks, parameters, and indexes.",
    rule: "[(){}\\[\\];,]",
    examples: ["(", "}", ";"],
    why: "Delimiters provide the boundaries the parser needs to build correct nested program structure.",
    sample: { code: "main() { return 0; }", marker: "    ^^ ^         ^ ^", label: "DELIMITER" },
  },
  {
    name: "PUNCTUATION",
    matchCategories: ["PUNCTUATION"],
    matchTypes: ["COLON", "QUESTION", "DOT", "COMMA", "SEMICOLON"],
    definition: "Small structural marks that separate clauses, labels, arguments, or expression parts.",
    rule: "[:?,.;]",
    examples: [";", ",", ":"],
    why: "Punctuation tokens prevent ambiguous parsing by marking where one syntactic unit ends and another begins.",
    sample: { code: "cout << x, y;", marker: "         ^  ^", label: "PUNCTUATION" },
  },
  {
    name: "PREPROCESSOR",
    matchCategories: ["PREPROCESSOR"],
    definition: "Directives handled before normal compilation, usually starting with #.",
    rule: "#\\s*(include|define|ifdef|ifndef|endif).*",
    examples: ["#include", "#define", "#ifdef"],
    why: "Preprocessor directives can add declarations, macros, and conditional code before the lexer-parser pipeline continues.",
    sample: { code: "#include <iostream>", marker: "^^^^^^^^", label: "PREPROCESSOR" },
  },
  {
    name: "TEMPLATE",
    matchCategories: ["TEMPLATE"],
    definition: "Keywords and symbols used to define generic C++ code that works with different types.",
    rule: "\\b(template|typename)\\b|<|>",
    examples: ["template", "typename", "<T>"],
    why: "Template tokens tell the compiler that a declaration describes a reusable pattern rather than one fixed type.",
    sample: { code: "template <typename T>", marker: "^^^^^^^^  ^^^^^^^^ ^", label: "TEMPLATE" },
  },
  {
    name: "MODIFIER",
    matchCategories: ["MODIFIER"],
    definition: "Keywords that refine storage, mutability, linkage, or function behavior.",
    rule: "\\b(const|static|inline|extern|volatile|register)\\b",
    examples: ["const", "static", "inline"],
    why: "Modifiers carry constraints that semantic analysis must enforce and code generation may treat specially.",
    sample: { code: "const int limit = 5;", marker: "^^^^^", label: "MODIFIER" },
  },
  {
    name: "MEMORY",
    matchCategories: ["MEMORY"],
    definition: "Keywords or operators used for explicit memory allocation and release.",
    rule: "\\b(new|delete)\\b|\\*|&",
    examples: ["new", "delete", "*"],
    why: "Memory tokens affect ownership, addresses, allocation, and deallocation, which are critical for runtime correctness.",
    sample: { code: "int* p = new int;", marker: "         ^^^", label: "MEMORY" },
  },
];

function tokenMatchesGuideCategory(token, guide) {
  const categoryMatch = guide.matchCategories?.includes(token.category);
  const typeMatch = guide.matchTypes?.includes(token.type);
  return Boolean(categoryMatch || typeMatch);
}

function guideCategoryColor(guide) {
  if (guide.name === "OPERATOR") return "#44ffaa";
  if (guide.name === "DELIMITER") return TOKEN_COLORS.DELIMITER || TOKEN_COLORS.PUNCTUATION || "#ffcb6b";
  return TOKEN_COLORS[guide.name] || TOKEN_COLORS[guide.matchCategories?.[0]] || "#888";
}

// ── Phase 1 — Lexer ───────────────────────────────────────────────

function LexerView({ data }) {
  const [tab, setTab] = useState("dfa"); // Changed default tab to DFA Diagram
  const [selectedGuideCategory, setSelectedGuideCategory] = useState(null);
  const tokens = (data.tokens || []).filter(t => t.type !== "EOF");
  const errors = data.lexer_errors || [];
  const categoryCounts = {};
  tokens.forEach(t => { categoryCounts[t.category] = (categoryCounts[t.category] || 0) + 1; });
  const categories = Object.keys(categoryCounts).sort();
  const selectedGuide = TOKEN_GUIDE_CATEGORIES.find(g => g.name === selectedGuideCategory);

  return (
    <div className="phase-view">
      <div className="phase-header">
        <span className="phase-title">Lexical Analysis</span>
        <span className="phase-badge">{tokens.length} tokens</span>
        <span className="phase-badge">{errors.length} errors</span>
        <span className="phase-badge">{Object.keys(categoryCounts).length} categories</span>
        <DownloadMenu options={[
          { label: "JSON", onClick: () => downloadTokens_JSON(tokens) },
          { label: "CSV",  onClick: () => downloadTokens_CSV(tokens) },
        ]} />
      </div>

      <TabBar
        tabs={[
          { id: "stream", label: "Token Stream" },
          { id: "guide",  label: "Token Guide" },
          { id: "dfa",    label: "DFA Diagram" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "guide" && (
        <TokenGuideTab
          tokens={tokens}
          selectedCategory={selectedGuideCategory}
          onSelectCategory={setSelectedGuideCategory}
          onOpenStream={() => setTab("stream")}
        />
      )}
      {tab === "dfa"   && <DFADiagram tokens={tokens} />}

      {tab === "stream" && <div style={{ display: "contents" }}>
      <div className="token-legend">
        {categories.map(cat => (
          <span key={cat} className="legend-item">
            <span className="legend-dot" style={{ background: TOKEN_COLORS[cat] || "#888" }} />
            {cat}<span style={{ color: "var(--text3)", marginLeft: 2 }}>({categoryCounts[cat]})</span>
          </span>
        ))}
        {selectedGuide && (
          <button
            onClick={() => setSelectedGuideCategory(null)}
            style={{
              border: "1px solid rgba(6,255,165,0.25)",
              borderRadius: "999px",
              background: "rgba(6,255,165,0.07)",
              color: "var(--neon-green)",
              cursor: "pointer",
              fontFamily: "var(--font-mono)",
              fontSize: "10px",
              padding: "4px 10px",
            }}
          >
            Highlighting {selectedGuide.name} ×
          </button>
        )}
      </div>

      <div className="token-table-wrap">
        <table className="token-table">
          <thead><tr><th>#</th><th>Category</th><th>Type</th><th>Value</th><th>Line</th><th>Col</th></tr></thead>
          <tbody>
            {tokens.map((tok, i) => {
              const color = TOKEN_COLORS[tok.category] || "#888";
              const highlighted = selectedGuide ? tokenMatchesGuideCategory(tok, selectedGuide) : false;
              const dimmed = selectedGuide && !highlighted;
              return (
                <tr key={i} className="token-row" style={{
                  background: highlighted ? `${guideCategoryColor(selectedGuide)}18` : undefined,
                  boxShadow: highlighted ? `inset 3px 0 0 ${guideCategoryColor(selectedGuide)}` : "none",
                  opacity: dimmed ? 0.35 : 1,
                  transition: "all 0.15s",
                }}>
                  <td className="tok-idx">{i + 1}</td>
                  <td><span className="tok-type-badge" style={{ background: color + "18", color, borderColor: color + "44" }}>{tok.category}</span></td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text2)" }}>{tok.type}</td>
                  <td className="tok-value">
                    <code style={{ color }}>
                      {tok.value === "" ? <span style={{ color: "var(--text3)", fontStyle: "italic" }}>(empty)</span> : tok.value}
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
          <div style={{ padding: "8px 14px", fontSize: "10px", fontWeight: 700, color: "var(--red)", letterSpacing: "0.1em", textTransform: "uppercase", borderBottom: "1px solid #3d1515" }}>Lexer Errors</div>
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
          { label: "Total Tokens", value: tokens.length,                                                                                                      color: "var(--accent)"  },
          { label: "Keywords",     value: tokens.filter(t => ["TYPE","CONTROL","MODIFIER"].includes(t.category)).length,                                       color: "var(--purple)"  },
          { label: "Identifiers",  value: tokens.filter(t => t.category === "IDENTIFIER").length,                                                              color: "var(--cyan)"    },
          { label: "Literals",     value: tokens.filter(t => t.category === "LITERAL").length,                                                                 color: "var(--orange)"  },
          { label: "Operators",    value: tokens.filter(t => ["ARITHMETIC","ASSIGNMENT","COMPARISON","LOGICAL","BITWISE","INCDEC","MEMBER"].includes(t.category)).length, color: "var(--green)" },
          { label: "Lexer Errors", value: errors.length, color: errors.length > 0 ? "var(--red)" : "var(--green)" },
        ].map(stat => (
          <div key={stat.label} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 14px" }}>
            <div style={{ fontSize: "10px", color: "var(--text3)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>{stat.label}</div>
            <div style={{ fontSize: "24px", fontWeight: 700, color: stat.color, fontFamily: "var(--font-mono)" }}>{stat.value}</div>
          </div>
        ))}
      </div>
      </div>}
    </div>
  );
}

function TokenGuideTab({ tokens, selectedCategory, onSelectCategory, onOpenStream }) {
  const [selectedGuideName, setSelectedGuideName] = useState(selectedCategory || TOKEN_GUIDE_CATEGORIES[0].name);
  const rowRefs = useRef({});
  const guide = TOKEN_GUIDE_CATEGORIES.find(g => g.name === selectedGuideName) || TOKEN_GUIDE_CATEGORIES[0];
  const color = guideCategoryColor(guide);
  const found = tokens.filter(t => tokenMatchesGuideCategory(t, guide));
  const foundValues = [...new Set(
    found
      .map(t => t.value)
      .filter(v => v !== "" && v !== undefined && v !== null)
      .map(String)
  )];

  function selectGuide(name) {
    setSelectedGuideName(name);
    rowRefs.current[name]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div className="token-legend" style={{ marginBottom: 0 }}>
        {TOKEN_GUIDE_CATEGORIES.map(guide => {
          const guideColor = guideCategoryColor(guide);
          const count = tokens.filter(t => tokenMatchesGuideCategory(t, guide)).length;
          const active = selectedGuideName === guide.name;
          return (
            <button key={guide.name} onClick={() => selectGuide(guide.name)} style={{
              display: "flex", alignItems: "center", gap: "6px", padding: "5px 9px",
              borderRadius: "999px", background: active ? `${guideColor}18` : "rgba(255,255,255,0.03)",
              border: `1px solid ${active ? guideColor + "66" : "rgba(255,255,255,0.05)"}`,
              color: active ? guideColor : "var(--text2)", cursor: "pointer",
              fontFamily: "var(--font-mono)", fontSize: "10px",
            }}>
              <span className="legend-dot" style={{ background: guideColor }} />
              {guide.name}<span style={{ color: active ? guideColor : "var(--text3)" }}>({count})</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", height: "calc(100vh - 220px)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", background: "var(--bg2)" }}>
        <div style={{ borderRight: "1px solid var(--border)", overflowY: "auto" }}>
          <div style={{ background: "var(--bg3)", padding: "8px 14px", fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", color: "var(--text3)", borderBottom: "1px solid var(--border)", fontWeight: 800, letterSpacing: "0.08em" }}>
            {TOKEN_GUIDE_CATEGORIES.length} Categories
          </div>
          {TOKEN_GUIDE_CATEGORIES.map(item => {
            const itemColor = guideCategoryColor(item);
            const count = tokens.filter(t => tokenMatchesGuideCategory(t, item)).length;
            const active = item.name === selectedGuideName;
            return (
              <div
                key={item.name}
                ref={el => { rowRefs.current[item.name] = el; }}
                onClick={() => selectGuide(item.name)}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = "var(--bg3)"; }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                style={{
                  padding: "9px 14px",
                  display: "flex",
                  gap: 10,
                  alignItems: "center",
                  cursor: "pointer",
                  borderLeft: `3px solid ${active ? itemColor : "transparent"}`,
                  background: active ? `${itemColor}15` : "transparent",
                  transition: "all 0.15s",
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: itemColor, flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700, color: active ? itemColor : "var(--text2)", flex: 1 }}>
                  {item.name}
                </span>
                <span style={{ background: `${itemColor}20`, color: itemColor, fontFamily: "var(--font-mono)", fontSize: 9, padding: "1px 6px", borderRadius: 999, opacity: count === 0 ? 0.4 : 1 }}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", flexDirection: "column", minWidth: 0, overflowY: "auto" }}>
          <div style={{ padding: "14px 16px", borderBottom: `1px solid ${color}40` }}>
            <div style={{ fontSize: 16, fontWeight: 500, color, marginBottom: 6 }}>{guide.name}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.6 }}>{guide.definition}</div>
          </div>

          <div style={{ flex: 1, padding: "14px 16px", display: "grid", gridTemplateColumns: "1fr 32px 1fr", gap: 14 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
              <TokenGuideLabel>Recognition Rule</TokenGuideLabel>
              <code style={{ display: "block", fontFamily: "var(--font-mono)", fontSize: 10, color, background: "var(--bg4)", border: "1px solid var(--border)", borderRadius: 5, padding: "6px 8px", wordBreak: "break-all" }}>
                {guide.rule}
              </code>

              <TokenGuideLabel>Example Tokens</TokenGuideLabel>
              <TokenPills values={guide.examples} color={color} />

              <TokenGuideLabel>Syntax Sample</TokenGuideLabel>
              <pre style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 10, lineHeight: 1.6, background: "var(--bg4)", border: "1px solid var(--border)", borderRadius: 5, padding: "6px 8px", overflowX: "auto" }}>
                <code style={{ color: "var(--text)" }}>{guide.sample.code}{`\n`}</code>
                <code style={{ color }}>{guide.sample.marker}{`\n`}</code>
                <code style={{ color }}>{guide.sample.label}</code>
              </pre>
            </div>

            <svg width="32" height="190" viewBox="0 0 32 190" style={{ alignSelf: "center", overflow: "visible" }}>
              <defs>
                <marker id={`token-guide-arrow-${guide.name}`} markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L8,4 L0,8 Z" fill={color} />
                </marker>
              </defs>
              <line x1="16" y1="20" x2="16" y2="80" stroke={color} strokeWidth="1.5" opacity="0.7" markerEnd={`url(#token-guide-arrow-${guide.name})`} />
              <line x1="16" y1="110" x2="16" y2="170" stroke={color} strokeWidth="1.5" opacity="0.7" markerEnd={`url(#token-guide-arrow-${guide.name})`} />
            </svg>

            <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
              <TokenGuideLabel>Found In Your Program</TokenGuideLabel>
              {foundValues.length > 0 ? (
                <TokenPills values={foundValues.slice(0, 14)} color={color} mutedSuffix={foundValues.length > 14 ? `+${foundValues.length - 14} more` : ""} />
              ) : (
                <span style={{ color: "#4a6080", fontStyle: "italic", fontSize: 11 }}>Not used in this program</span>
              )}

              <TokenGuideLabel>Why It Matters</TokenGuideLabel>
              <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.6 }}>{guide.why}</div>

              <TokenGuideLabel>Occurrence Count</TokenGuideLabel>
              <div style={{ fontSize: 28, fontWeight: 500, fontFamily: "var(--font-mono)", color }}>{found.length}</div>
            </div>
          </div>

          <div style={{ borderTop: "1px solid var(--border)", padding: "10px 16px", display: "flex", justifyContent: "flex-end" }}>
            <button onClick={() => { onSelectCategory(guide.name); onOpenStream(); }} style={{
              background: `${color}10`,
              border: `1px solid ${color}40`,
              color,
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              padding: "5px 14px",
              borderRadius: 6,
              cursor: "pointer",
            }}>
              Highlight In Token Stream ↗
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TokenGuideLabel({ children }) {
  return (
    <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#4a6080", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
      {children}
    </div>
  );
}

function GuideBlock({ title, children }) {
  return (
    <div style={{ marginTop: "10px" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text3)", fontWeight: 800, letterSpacing: "0.9px", textTransform: "uppercase", marginBottom: "4px" }}>
        {title}
      </div>
      <div style={{ fontSize: "12px", color: "var(--text2)", lineHeight: 1.55 }}>
        {children}
      </div>
    </div>
  );
}

function TokenPills({ values, color, mutedSuffix = "" }) {
  return (
    <span style={{ display: "flex", gap: "5px", flexWrap: "wrap", alignItems: "center" }}>
      {values.map(value => (
        <code key={value} style={{
          fontFamily: "var(--font-mono)", fontSize: "10px", background: `${color}14`, color,
          padding: "2px 7px", borderRadius: "4px", border: `1px solid ${color}33`,
        }}>
          {value}
        </code>
      ))}
      {mutedSuffix && <span style={{ fontSize: "10px", color: "var(--text3)" }}>{mutedSuffix}</span>}
    </span>
  );
}

// ── Lexer DFA Diagram ─────────────────────────────────────────────

const DFA_LANES = [
  {
    id: "identifier",
    title: "Identifiers & Keywords",
    color: "#c792ea",
    categories: ["IDENTIFIER", "TYPE", "CONTROL", "MODIFIER", "TEMPLATE"],
    states: [
      { id: "START", label: "START", sub: "read char", color: "#06ffa5" },
      { id: "IDENT", label: "IDENT", sub: "letters/digits", color: "#c792ea" },
      { id: "ACCEPT", label: "ACCEPT", sub: "emit token", color: "#06ffa5", accept: true },
    ],
    transitions: [
      { label: "LETTER", rule: "[a-zA-Z_]", desc: "Valid identifier starting character." },
      { label: "END", rule: "not [a-zA-Z0-9_]", desc: "Identifier stops when the next character no longer belongs to it." },
    ],
  },
  {
    id: "number",
    title: "Numbers",
    color: "#f78c6c",
    categories: ["LITERAL"],
    types: ["INT_LITERAL", "FLOAT_LITERAL"],
    states: [
      { id: "START", label: "START", sub: "read char", color: "#06ffa5" },
      { id: "INTEGER", label: "INTEGER", sub: "digits", color: "#f78c6c" },
      { id: "FLOAT", label: "FLOAT", sub: "decimal part", color: "#ffcb6b" },
      { id: "ACCEPT", label: "ACCEPT", sub: "emit number", color: "#06ffa5", accept: true },
    ],
    transitions: [
      { label: "DIGIT", rule: "[0-9]", desc: "A digit starts an integer literal." },
      { label: "DOT", rule: "\\.", desc: "A decimal point moves the DFA into a float state when present." },
      { label: "END", rule: "not digit/dot", desc: "The number token ends when the next character is not part of the number." },
    ],
  },
  {
    id: "string",
    title: "Strings",
    color: "#c3e88d",
    categories: ["LITERAL"],
    types: ["STRING_LITERAL", "CHAR_LITERAL"],
    states: [
      { id: "START", label: "START", sub: "read char", color: "#06ffa5" },
      { id: "STRING", label: "STRING", sub: "inside quotes", color: "#c3e88d" },
      { id: "ACCEPT", label: "ACCEPT", sub: "emit literal", color: "#06ffa5", accept: true },
    ],
    transitions: [
      { label: "QUOTE", rule: "\" or '", desc: "A quote opens a string or character literal." },
      { label: "CHAR", rule: "[^\"']*", desc: "Characters are consumed until the matching closing quote." },
    ],
  },
  {
    id: "operator",
    title: "Operators",
    color: "#89ddff",
    categories: ["ARITHMETIC", "ASSIGNMENT", "COMPARISON", "LOGICAL", "BITWISE", "INCDEC", "MEMBER"],
    states: [
      { id: "START", label: "START", sub: "read char", color: "#06ffa5" },
      { id: "OPERATOR", label: "OP", sub: "symbol", color: "#89ddff" },
      { id: "COMPOUND", label: "PAIR", sub: "two chars", color: "#4d9fff" },
      { id: "ACCEPT", label: "ACCEPT", sub: "emit op", color: "#06ffa5", accept: true },
    ],
    transitions: [
      { label: "SYMBOL", rule: "[+\\-*/%=!<>&|^~.;,(){}\\[\\]]", desc: "A punctuation or operator symbol starts this path." },
      { label: "PAIR", rule: "== != <= >= ++ -- += -> :: && ||", desc: "Some symbols combine with the next character into a compound operator." },
      { label: "END", rule: "otherwise", desc: "Single-character operators and delimiters emit immediately." },
    ],
  },
  {
    id: "delimiter",
    title: "Delimiters & Punctuation",
    color: "#f07178",
    categories: ["PUNCTUATION", "DELIMITER"],
    states: [
      { id: "START", label: "START", sub: "read char", color: "#06ffa5" },
      { id: "DELIM", label: "SYMBOL", sub: "match", color: "#f07178" },
      { id: "ACCEPT", label: "ACCEPT", sub: "emit token", color: "#06ffa5", accept: true },
    ],
    transitions: [
      { label: "PUNCT", rule: "[(){}\\[\\];,.:?]", desc: "A structural symbol." },
      { label: "END", rule: "immediate", desc: "Delimiters are single characters and emit immediately." },
    ],
  },
  {
    id: "comment",
    title: "Comments",
    color: "#546e7a",
    categories: ["COMMENT"],
    states: [
      { id: "START", label: "START", sub: "read char", color: "#06ffa5" },
      { id: "SLASH", label: "SLASH", sub: "/", color: "#7a88a8" },
      { id: "COMMENT", label: "COMMENT", sub: "skip text", color: "#546e7a" },
      { id: "ACCEPT", label: "ACCEPT", sub: "discard", color: "#06ffa5", accept: true },
    ],
    transitions: [
      { label: "SLASH", rule: "/", desc: "A slash may begin division or a comment." },
      { label: "/ or *", rule: "// or /*", desc: "A second slash or star confirms a comment." },
      { label: "END", rule: "\\n or */", desc: "Line comments end at newline; block comments end at */." },
    ],
  },
  {
    id: "preprocessor",
    title: "Preprocessor",
    color: "#546e7a",
    categories: ["PREPROCESSOR"],
    states: [
      { id: "START", label: "START", sub: "read char", color: "#06ffa5" },
      { id: "HASH", label: "HASH", sub: "#", color: "#546e7a" },
      { id: "DIRECTIVE", label: "DIRECTIVE", sub: "include/define", color: "#82aaff" },
      { id: "ACCEPT", label: "ACCEPT", sub: "emit directive", color: "#06ffa5", accept: true },
    ],
    transitions: [
      { label: "HASH", rule: "#", desc: "A hash starts a preprocessor directive." },
      { label: "WORD", rule: "include|define|ifdef|endif", desc: "The directive name follows the hash." },
      { label: "LINE END", rule: "\\n", desc: "Most directives continue until the end of the line." },
    ],
  },
];

function tokenLane(token) {
  return DFA_LANES.find(lane => {
    const categoryMatch = lane.categories?.includes(token.category);
    const typeMatch = lane.types?.includes(token.type);
    return categoryMatch && (!lane.types || typeMatch || token.category !== "LITERAL");
  }) || DFA_LANES[0];
}

function buildDfaWalk(token) {
  if (!token) return [];
  const value = String(token.value || token.type || "");
  const lane = tokenLane(token);
  const chars = value ? [...value] : [token.type || token.category];

  if (lane.id === "identifier") {
    return [
      { state: "START", char: "start", note: "Lexer begins at START." },
      ...chars.map(ch => ({ state: "IDENT", char: ch, note: `${ch} matches LETTER or DIGIT.` })),
      { state: "ACCEPT", char: "end", note: "Next character does not belong to the identifier, so emit token." },
    ];
  }

  if (lane.id === "number") {
    const hasDot = value.includes(".");
    const steps = [{ state: "START", char: "start", note: "Lexer begins at START." }];
    chars.forEach(ch => {
      steps.push({ state: ch === "." || hasDot ? (ch === "." ? "FLOAT" : hasDot ? "FLOAT" : "INTEGER") : "INTEGER", char: ch, note: ch === "." ? "Decimal point switches to FLOAT." : `${ch} matches DIGIT.` });
    });
    steps.push({ state: "ACCEPT", char: "end", note: "Number is complete, so emit literal." });
    return steps;
  }

  if (lane.id === "string") {
    return [
      { state: "START", char: "start", note: "Lexer waits for opening quote." },
      ...chars.map(ch => ({ state: "STRING", char: ch, note: ch === "\"" || ch === "'" ? "Quote boundary." : "Character belongs to literal body." })),
      { state: "ACCEPT", char: "end", note: "Closing quote completes the literal." },
    ];
  }

  if (lane.id === "operator") {
    const compound = value.length > 1;
    return [
      { state: "START", char: "start", note: "Lexer reads an operator symbol." },
      { state: "OPERATOR", char: chars[0] || token.type, note: "Symbol starts an operator." },
      ...(compound ? [{ state: "COMPOUND", char: chars.slice(1).join("") || "pair", note: "Second symbol forms a compound token." }] : []),
      { state: "ACCEPT", char: "end", note: "Operator is emitted." },
    ];
  }

  if (lane.id === "delimiter") {
    return [
      { state: "START", char: "start", note: "Lexer sees a structural character." },
      { state: "DELIM", char: chars[0] || token.type, note: "Character is recognized as a delimiter/punctuation." },
      { state: "ACCEPT", char: "end", note: "Token is emitted immediately." },
    ];
  }

  if (lane.id === "comment") {
    return [
      { state: "START", char: "start", note: "Lexer sees slash." },
      { state: "SLASH", char: "/", note: "Slash may begin a comment." },
      { state: "COMMENT", char: "body", note: "Comment text is skipped." },
      { state: "ACCEPT", char: "end", note: "Comment ends and no parser token is emitted." },
    ];
  }

  return [
    { state: "START", char: "start", note: "Lexer sees hash." },
    { state: "HASH", char: "#", note: "Hash begins directive." },
    { state: "DIRECTIVE", char: value.replace(/^#\s*/, "").split(/\s+/)[0] || "directive", note: "Directive keyword is read." },
    { state: "ACCEPT", char: "line end", note: "Directive line is emitted as a preprocessor token." },
  ];
}

function DFATab({ tokens }) {
  const candidates = tokens.filter(t => t.value !== "" && t.type !== "EOF");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const token = candidates[selectedIndex] || candidates[0] || null;
  const lane = token ? tokenLane(token) : DFA_LANES[0];
  const walk = buildDfaWalk(token);
  const visibleSteps = walk.slice(0, stepIndex + 1);
  const activeState = visibleSteps[visibleSteps.length - 1]?.state;
  const pathStates = new Set(visibleSteps.map(s => s.state));

  useEffect(() => {
    setStepIndex(0);
    setPlaying(true); // Auto-play animation on token change
  }, [selectedIndex]);

  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => {
      setStepIndex(current => {
        if (current >= walk.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 650);
    return () => clearInterval(id);
  }, [playing, walk.length]);

  const activeLaneIds = new Set([lane.id]);

  return (
    <div style={{ display:"grid", gridTemplateColumns:"minmax(0, 1fr) 320px", gap:"14px", alignItems:"start" }}>
      <style>{`
        @keyframes dfaPulse {
          0% { transform: scale(1); box-shadow: 0 0 15px rgba(255,255,255,0.05); }
          50% { transform: scale(1.05); box-shadow: 0 0 25px rgba(255,255,255,0.25); }
          100% { transform: scale(1); box-shadow: 0 0 15px rgba(255,255,255,0.05); }
        }
      `}</style>
      <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
        <div style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:"14px 16px", fontSize:"12px", color:"var(--text2)", lineHeight:1.65 }}>
          <span style={{ color:"var(--accent)", fontWeight:800 }}>DFA — Deterministic Finite Automaton</span>
          <span> reads one character at a time, changes state, and emits a token when it reaches ACCEPT. The diagram is grouped into common lexer paths so the flow stays left to right.</span>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:"10px", flexWrap:"wrap", background:"rgba(255,255,255,0.025)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:"12px 14px" }}>
          <span style={{ fontFamily:"var(--font-mono)", fontSize:"10px", color:"var(--text3)", fontWeight:800, letterSpacing:"1px" }}>TOKEN</span>
          <select value={selectedIndex} onChange={e => setSelectedIndex(Number(e.target.value))} style={{
            background:"var(--bg3)", border:"1px solid var(--border2)", borderRadius:"8px", color:"var(--text)",
            padding:"8px 10px", fontFamily:"var(--font-mono)", fontSize:"12px", outline:"none", minWidth:"220px",
          }}>
            {candidates.map((t, i) => (
              <option key={`${t.type}-${i}`} value={i}>{t.value || t.type} — {t.category}</option>
            ))}
          </select>
          <button onClick={() => setPlaying(true)} disabled={!walk.length || stepIndex >= walk.length - 1} style={dfaControlStyle(!walk.length || stepIndex >= walk.length - 1)}>Play</button>
          <button onClick={() => setPlaying(false)} disabled={!playing} style={dfaControlStyle(!playing)}>Pause</button>
          <button onClick={() => setStepIndex(i => Math.min(i + 1, walk.length - 1))} disabled={!walk.length || stepIndex >= walk.length - 1} style={dfaControlStyle(!walk.length || stepIndex >= walk.length - 1)}>Next Character</button>
          <button onClick={() => { setPlaying(false); setStepIndex(0); }} style={dfaControlStyle(false)}>Reset</button>
        </div>

        <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
          {DFA_LANES.map(currentLane => {
            const focused = activeLaneIds.has(currentLane.id);
            return (
              <div key={currentLane.id} style={{
                border:`1px solid ${focused ? currentLane.color + "55" : "rgba(255,255,255,0.06)"}`,
                borderRadius:"18px",
                background: focused ? `${currentLane.color}08` : "rgba(255,255,255,0.015)",
                padding:"14px",
                opacity: focused ? 1 : 0.34,
                transition:"all 0.2s",
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"12px" }}>
                  <span style={{ width:8, height:8, borderRadius:"50%", background:currentLane.color, boxShadow: focused ? `0 0 10px ${currentLane.color}` : "none" }} />
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:"11px", fontWeight:900, color:focused ? currentLane.color : "var(--text3)", letterSpacing:"0.7px" }}>{currentLane.title}</span>
                  {focused && <span style={{ marginLeft:"auto", fontFamily:"var(--font-mono)", fontSize:"9px", color:currentLane.color }}>CURRENT TOKEN PATH</span>}
                </div>
                <div style={{ display:"grid", gridTemplateColumns:`repeat(${currentLane.states.length * 2 - 1}, max-content)`, alignItems:"center", gap:"12px", overflowX:"auto", paddingBottom:"4px" }}>
                  {currentLane.states.map((state, i) => {
                    const active = focused && state.id === activeState;
                    const visited = focused && pathStates.has(state.id);
                    return (
                      <span key={state.id} style={{ display:"contents" }}>
                        <DfaState state={state} active={active} visited={visited} dim={!focused} />
                        {i < currentLane.transitions.length && (
                          <DfaTransition transition={currentLane.transitions[i]} active={focused && stepIndex > i} color={currentLane.color} />
                        )}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:"12px", position:"sticky", top:0 }}>
        <DfaSidePanel title="Show Current Token Path">
          {token ? (
            <>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:"13px", color:lane.color, fontWeight:800, marginBottom:"8px" }}>
                Token: {token.value || token.type}
              </div>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:"11px", color:"var(--text2)", lineHeight:1.8 }}>
                {walk.map(s => s.state).filter((s, i, arr) => i === 0 || s !== arr[i - 1]).join(" -> ")}
              </div>
              <div style={{ marginTop:"10px", borderTop:"1px solid var(--border)", paddingTop:"10px", fontSize:"11px", color:"var(--text3)", lineHeight:1.6 }}>
                Current: <span style={{ color:lane.color }}>{visibleSteps[visibleSteps.length - 1]?.char}</span> — {visibleSteps[visibleSteps.length - 1]?.note}
              </div>
            </>
          ) : (
            <div style={{ color: "var(--orange)", padding: "10px 0", lineHeight: 1.5 }}>⚠️ Please write some code and click <b>Compile</b> to see the DFA in action.</div>
          )}
        </DfaSidePanel>

        <DfaSidePanel title="Example Walkthrough">
          <div style={{ display:"flex", flexDirection:"column", gap:"7px" }}>
            {visibleSteps.map((step, i) => (
              <div key={`${step.state}-${i}`} style={{ display:"grid", gridTemplateColumns:"46px 1fr", gap:"8px", fontFamily:"var(--font-mono)", fontSize:"10px", color:i === visibleSteps.length - 1 ? lane.color : "var(--text2)" }}>
                <span>{step.char}</span>
                <span>{i === 0 ? "START" : step.state}</span>
              </div>
            ))}
          </div>
        </DfaSidePanel>

        <DfaSidePanel title="How DFA Works">
          <ol style={{ margin:"0 0 0 16px", padding:0, color:"var(--text2)", fontSize:"11px", lineHeight:1.75 }}>
            <li>Lexer reads one character.</li>
            <li>DFA changes state.</li>
            <li>Characters continue matching.</li>
            <li>Token completes.</li>
            <li>ACCEPT emits the token.</li>
          </ol>
        </DfaSidePanel>

        <DfaSidePanel title="Legend">
          {[
            ["#06ffa5", "Green = Accept / active emit state"],
            ["#c792ea", "Purple = Identifier path"],
            ["#89ddff", "Blue = Operator path"],
            ["#f07178", "Red = Delimiter / Brackets"],
            ["#ffcb6b", "Yellow = Numeric / Float detail"],
            ["#546e7a", "Gray = Inactive or skipped text"],
          ].map(([color, text]) => (
            <div key={text} style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"8px", color:"var(--text2)", fontSize:"11px" }}>
              <span style={{ width:9, height:9, borderRadius:"50%", background:color, boxShadow:`0 0 8px ${color}55` }} />
              {text}
            </div>
          ))}
        </DfaSidePanel>
      </div>
    </div>
  );
}

function DfaState({ state, active, visited, dim }) {
  const opacity = active ? 1 : visited ? 0.78 : dim ? 0.3 : 0.55;
  return (
    <div style={{
      width: state.accept ? 116 : 104,
      height: state.accept ? 74 : 66,
      borderRadius: state.accept ? "999px" : "16px",
      border: state.accept ? `3px double ${state.color}` : `2px solid ${active || visited ? state.color : "rgba(255,255,255,0.12)"}`,
      background: active || visited ? `${state.color}14` : "rgba(255,255,255,0.025)",
      boxShadow: active ? `0 0 22px ${state.color}66` : visited ? `0 0 10px ${state.color}22` : "none",
      display:"flex",
      flexDirection:"column",
      justifyContent:"center",
      alignItems:"center",
      opacity,
      animation: active ? "dfaPulse 1.2s ease-in-out infinite" : "none",
      flexShrink:0,
      transition:"all 0.3s ease",
    }}>
      <span style={{ fontFamily:"var(--font-mono)", fontSize:"11px", fontWeight:900, color:active || visited ? state.color : "var(--text3)", letterSpacing:"0.5px" }}>{state.accept ? "ACCEPT" : state.label}</span>
      <span style={{ fontFamily:"var(--font-mono)", fontSize:"8px", color:state.accept ? "#06ffa5" : "var(--text3)", marginTop:"4px" }}>{state.accept ? "Emit Token" : state.sub}</span>
    </div>
  );
}

function DfaTransition({ transition, active, color }) {
  return (
    <div title={`${transition.rule}\n${transition.desc}`} style={{
      minWidth:96,
      display:"flex",
      alignItems:"center",
      gap:"7px",
      color:active ? color : "rgba(255,255,255,0.18)",
      opacity: active ? 1 : 0.55,
      flexShrink:0,
      transition:"all 0.3s ease",
    }}>
      <span style={{ height:2, flex:1, background:active ? color : "rgba(255,255,255,0.14)", boxShadow:active ? `0 0 8px ${color}` : "none", transition:"all 0.3s ease" }} />
      <span style={{ fontFamily:"var(--font-mono)", fontSize:"9px", fontWeight:800, border:`1px solid ${active ? color + "55" : "rgba(255,255,255,0.08)"}`, borderRadius:"999px", padding:"3px 7px", background:active ? `${color}10` : "rgba(255,255,255,0.02)", whiteSpace:"nowrap", transition:"all 0.3s ease" }}>
        {transition.label}
      </span>
      <span style={{ fontSize:"14px" }}>→</span>
    </div>
  );
}

function DfaSidePanel({ title, children }) {
  return (
    <div style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", padding:"14px" }}>
      <div style={{ fontFamily:"var(--font-mono)", fontSize:"10px", color:"var(--accent)", fontWeight:900, letterSpacing:"0.9px", marginBottom:"10px" }}>{title}</div>
      {children}
    </div>
  );
}

function dfaControlStyle(disabled) {
  return {
    border:"1px solid rgba(77,159,255,0.24)",
    borderRadius:"999px",
    background:disabled ? "rgba(255,255,255,0.03)" : "rgba(77,159,255,0.10)",
    color:disabled ? "rgba(255,255,255,0.24)" : "#89ddff",
    cursor:disabled ? "not-allowed" : "pointer",
    fontFamily:"var(--font-mono)",
    fontSize:"10px",
    fontWeight:800,
    padding:"7px 12px",
    whiteSpace:"nowrap",
  };
}

// ── Phase 2 — Parser / AST ────────────────────────────────────────

const NODE_COLORS = {
  root: "#4d9fff", declaration: "#c792ea", statement: "#c3e88d",
  expression: "#ffcb6b", literal: "#f78c6c", type: "#89ddff",
  exception: "#ff5370", identifier: "#82aaff", unknown: "#546e7a",
};

const AST_NODE_EXPLANATIONS = {
  function_declaration:   "Defines a named function with its parameter list and body.",
  variable_declaration:   "Declares a variable and optionally initializes it.",
  class_declaration:      "Defines a class blueprint with members and methods.",
  parameter_declaration:  "A formal parameter in a function signature.",
  if_statement:           "Executes its body only when the condition evaluates to true.",
  while_statement:        "Repeats its body as long as the loop condition holds.",
  for_statement:          "A loop with explicit init, condition, and update expressions.",
  do_while_statement:     "Executes body at least once, then repeats while condition holds.",
  return_statement:       "Exits the current function, optionally returning a value.",
  block:                  "A sequence of statements enclosed in curly braces {}.",
  expression_statement:   "An expression evaluated for its side effect (e.g., assignment, call).",
  binary_expression:      "An operation on two operands (e.g., a + b, x == y).",
  unary_expression:       "An operation on a single operand (e.g., -x, !flag).",
  assignment_expression:  "Assigns the right-hand value into the left-hand variable.",
  call_expression:        "Invokes a function and passes arguments to it.",
  member_expression:      "Accesses a field or method of an object (e.g., obj.field).",
  integer_literal:        "A constant integer value embedded in source code.",
  float_literal:          "A constant floating-point value embedded in source code.",
  string_literal:         "A sequence of characters between double quotes.",
  bool_literal:           "A boolean constant — either true or false.",
  type_specifier:         "Declares the data type of a variable or function return.",
  identifier:             "A user-defined name referencing a variable or function.",
};

function ParserView({ data }) {
  const svgRef        = useRef(null);
  const astTreeContainerRef = useRef(null);
  const [tab, setTab] = useState("tree");
  const [selectedNode, setSelectedNode] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [highlightNodeId, setHighlightNodeId] = useState(null);
  const [highlightSourceLine, setHighlightSourceLine] = useState(null);
  const source        = useCompilerStore(s => s.source);
  const ast           = data.ast;
  const errors        = data.parse_errors || [];

  function handleViewInAST(node) {
    const nodeData = node?.raw || node;
    const nodeValue = nodeData?.value || nodeData?.name || "";
    const key = `${nodeData?.type || ""}-${nodeData?.line || ""}-${nodeValue}` || nodeData?.id;
    setSelectedNode(nodeData);
    setPanelOpen(true);
    setTab("tree");
    setHighlightNodeId(key);
  }

  const renderAstGraph = useCallback(() => {
    if (!ast || !svgRef.current) return;
    const container = astTreeContainerRef.current || svgRef.current.parentElement;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const W = rect.width || 800;
    const H = rect.height || 500;
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
      .attr("transform", d => `translate(${d.x + offsetX}, ${d.y + offsetY})`).style("cursor", "pointer");
    const BOX_W = 130, BOX_H = 44;
    const rects = node.append("rect")
      .attr("x", -BOX_W/2).attr("y", -BOX_H/2).attr("width", BOX_W).attr("height", BOX_H).attr("rx", 6)
      .attr("fill",   d => (NODE_COLORS[d.data.category] || "#888") + "22")
      .attr("stroke", d =>  NODE_COLORS[d.data.category] || "#888").attr("stroke-width", 1);
    node.append("text").attr("y", -7).attr("text-anchor", "middle")
      .attr("font-family", "'JetBrains Mono', monospace").attr("font-size", 10).attr("font-weight", 600)
      .attr("fill", d => NODE_COLORS[d.data.category] || "#888").text(d => d.data.type);
    node.append("text").attr("y", 10).attr("text-anchor", "middle")
      .attr("font-family", "'JetBrains Mono', monospace").attr("font-size", 11).attr("fill", "#e2e8f8")
      .text(d => { const v = d.data.value || ""; return v.length > 12 ? v.slice(0,12)+"…" : v; });
    node.append("text").attr("y", 24).attr("text-anchor", "middle")
      .attr("font-family", "'JetBrains Mono', monospace").attr("font-size", 9).attr("fill", "#4a5578")
      .text(d => d.data.dataType ? `(${d.data.dataType})` : "");
    node.append("title").text(d => `Type: ${d.data.type}\nValue: ${d.data.value}\nDataType: ${d.data.dataType}\nLine: ${d.data.line}`);

    // Click handler — highlight selected node, open panel and update React state
    node.on("click", (event, d) => {
      event.stopPropagation();
      rects.attr("stroke-width", 1);
      d3.select(event.currentTarget).select("rect").attr("stroke-width", 3);
      setSelectedNode(d.data);
      setPanelOpen(true);
    });
    // Click on SVG background clears selection and closes panel
    svg.on("click", () => {
      rects.attr("stroke-width", 1);
      setSelectedNode(null);
      setPanelOpen(false);
    });

    if (highlightNodeId) {
      node.each(function(d) {
        const value = d.data.value || d.data.name || "";
        const candidates = [
          d.data.id,
          `${d.data.type || ""}-${d.data.line || ""}-${value}`,
          `${d.data.type || ""}-${d.data.line || ""}`,
          d.data.line,
        ];

        if (candidates.includes(highlightNodeId)) {
          rects.attr("stroke-width", 1);
          d3.select(this).select("rect").attr("stroke-width", 3).attr("stroke", "#8b5cf6");
          setSelectedNode(d.data);
          setPanelOpen(true);
          setHighlightNodeId(null);
        }
      });
    }
  }, [ast, highlightNodeId]);

  useEffect(() => {
    const timer = setTimeout(renderAstGraph, 50);
    const container = astTreeContainerRef.current;
    const observer = container
      ? new ResizeObserver(entries => {
          const rect = entries[0]?.contentRect;
          if (rect?.width > 0 && rect?.height > 0) renderAstGraph();
        })
      : null;

    if (container && observer) observer.observe(container);
    return () => {
      clearTimeout(timer);
      observer?.disconnect();
    };
  }, [ast, tab, renderAstGraph, highlightNodeId]);

  function countNodes(n) { if (!n) return 0; return 1 + (n.children||[]).reduce((s,c)=>s+countNodes(c),0); }
  const totalNodes = countNodes(ast);
  if (!ast) return <ComingSoon phase="Parser" desc="Abstract Syntax Tree" step="2" hint="Compile a program" />;

  return (
    <div className="phase-view">
      <div className="phase-header">
        <span className="phase-title">Syntax Analysis</span>
        <span className="phase-badge">{totalNodes} nodes</span>
        <span className="phase-badge">{errors.length} errors</span>
        <span className="phase-badge">click node for details</span>
        <DownloadMenu options={[
          { label: "JSON", onClick: () => downloadAST_JSON(ast) },
          { label: "PNG",  onClick: () => downloadAST_PNG(svgRef.current) },
        ]} />
      </div>

      <TabBar
        tabs={[
          { id: "tree",   label: "AST Tree" },
          { id: "source", label: "Source Map" },
          { id: "ptree",  label: "Parse Tree" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "tree" && <div style={{ display: "contents" }}>
        <div className="token-legend">
          {Object.entries(NODE_COLORS).map(([cat, color]) => (
            <span key={cat} className="legend-item"><span className="legend-dot" style={{ background: color }} />{cat}</span>
          ))}
        </div>

        <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div ref={astTreeContainerRef} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden", height: "500px", position: "relative", transition: "all 0.25s ease" }}>
              <svg ref={svgRef} style={{ width: "100%", height: "100%" }} />
              <div style={{ position: "absolute", bottom: 10, right: 14, fontSize: "10px", color: "var(--text3)", fontFamily: "var(--font-mono)" }}>
                scroll to zoom · drag to pan · click node for details
              </div>
            </div>
          </div>

          {/* Slide-in Source Map Panel */}
          <div style={{ width: panelOpen ? 300 : 0, opacity: panelOpen ? 1 : 0, transition: "width 0.25s ease, opacity 0.2s ease", overflow: "hidden", background: "#0d1424", borderLeft: panelOpen ? "1px solid #2a3a55" : "none", display: "flex", flexDirection: "column" }}>
            {selectedNode ? (
              <div style={{ padding: 12, color: "#cbd5e1", display: "flex", flexDirection: "column", height: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 40 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <div style={{ background: (NODE_COLORS[selectedNode.category] || "#6b7280") + "22", border: `1px solid ${NODE_COLORS[selectedNode.category] || "#6b7280"}`, color: NODE_COLORS[selectedNode.category] || "#6b7280", fontFamily: "monospace", fontSize: 9, padding: "2px 7px", borderRadius: 20, textTransform: "uppercase", fontWeight: 800 }}>{selectedNode.type}</div>
                    <div style={{ color: "#e2e8f0", fontWeight: 800 }}>{selectedNode.value || selectedNode.name || "(unnamed)"}</div>
                  </div>
                  <button onClick={() => { setPanelOpen(false); setSelectedNode(null); }} style={{ background: "transparent", border: "none", color: "#4a6080", cursor: "pointer" }}>✕</button>
                </div>

                <div style={{ height: 8, borderBottom: "1px solid #172233", margin: "8px 0" }} />

                <div style={{ fontSize: 9, fontFamily: "monospace", color: "#4a6080", textTransform: "uppercase", marginBottom: 6 }}>NODE DETAILS</div>
                <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: 6, fontFamily: "monospace", fontSize: 11, marginBottom: 10 }}>
                  <div style={{ color: "#4a6080" }}>Type</div><div style={{ color: "#e2e8f0" }}>{selectedNode.type}</div>
                  <div style={{ color: "#4a6080" }}>Value</div><div style={{ color: "#e2e8f0" }}>{selectedNode.value ?? ""}</div>
                  <div style={{ color: "#4a6080" }}>DataType</div><div style={{ color: "#e2e8f0" }}>{selectedNode.dataType ?? "-"}</div>
                  <div style={{ color: "#4a6080" }}>Line</div><div style={{ color: "#e2e8f0" }}>{selectedNode.line ?? "-"}</div>
                  <div style={{ color: "#4a6080" }}>Children</div><div style={{ color: "#e2e8f0" }}>{(selectedNode.children || []).length}</div>
                  <div style={{ color: "#4a6080" }}>Parent</div><div style={{ color: "#e2e8f0" }}>{selectedNode.parentType ?? "-"}</div>
                </div>

                <div style={{ fontSize: 9, fontFamily: "monospace", color: NODE_COLORS[selectedNode.category] || "#8b5cf6", textTransform: "uppercase", marginBottom: 6 }}>SOURCE MAP</div>
                <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>Lines where this node appears:</div>
                <div style={{ overflow: "auto", flex: 1, paddingRight: 6 }}>
                  {(function getNodeSourceLines(node) {
                    const lines = source ? source.split("\n") : [];
                    const nodeLine = node.line || 0;
                    const all = new Set(); all.add(nodeLine);
                    function collect(n, depth) { if (depth > 2 || !n) return; if (n.line) all.add(n.line); (n.children || []).forEach(c => collect(c, depth+1)); }
                    collect(node, 0);
                    return [...all].sort((a,b)=>a-b).map(l => ({ number: l, text: lines[l-1] || "", isPrimary: l === nodeLine }));
                  })(selectedNode).map(line => (
                    <div key={line.number} onClick={() => { setHighlightSourceLine(line.number); setTab("source"); }} style={{ display: "flex", gap: 8, padding: "6px 8px", borderRadius: "0 4px 4px 0", cursor: "pointer", marginBottom: 6, background: line.isPrimary ? (NODE_COLORS[selectedNode.category] || "#6b7280") + "15" : "transparent", borderLeft: line.isPrimary ? `3px solid ${NODE_COLORS[selectedNode.category] || "#6b7280"}` : "3px solid transparent" }}>
                      <div style={{ width: 24, fontFamily: "monospace", color: "#4a6080", fontSize: 11 }}>{line.number}</div>
                      <div style={{ fontFamily: "monospace", color: line.isPrimary ? "#e2e8f0" : "#64748b", fontSize: 11, flex: 1 }}>{line.text || (source ? "" : `Line ${line.number}, Col ${selectedNode.col || "?"}`)}</div>
                      {line.isPrimary && (
                        <div style={{ color: NODE_COLORS[selectedNode.category] || "#6b7280", cursor: "pointer", textDecoration: "underline", fontFamily: "monospace", fontSize: 11 }}>
                          ← this node
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div style={{ height: 10 }} />
                <div style={{ fontSize: 9, fontFamily: "monospace", color: "#4a6080", textTransform: "uppercase", marginBottom: 6 }}>CHILDREN</div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(selectedNode.children || []).length ? (selectedNode.children || []).map((c, i) => (
                    <div key={i} style={{ background: (NODE_COLORS[c.category] || "#6b7280") + "22", border: `1px solid ${(NODE_COLORS[c.category] || "#6b7280") }88`, color: NODE_COLORS[c.category] || "#6b7280", fontFamily: "monospace", fontSize: 9, padding: "2px 7px", borderRadius: 4 }}>{c.type}</div>
                  )) : <div style={{ fontStyle: "italic", color: "#64748b" }}>terminal node</div>}
                </div>
              </div>
            ) : null}
          </div>
        </div>
        

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
          {[
            { label: "Total Nodes",  value: totalNodes,                              color: "var(--accent)"  },
            { label: "Declarations", value: countNodesByCategory(ast,"declaration"), color: "var(--purple)"  },
            { label: "Statements",   value: countNodesByCategory(ast,"statement"),   color: "var(--green)"   },
            { label: "Expressions",  value: countNodesByCategory(ast,"expression"),  color: "var(--yellow)"  },
            { label: "Literals",     value: countNodesByCategory(ast,"literal"),     color: "var(--orange)"  },
            { label: "Parse Errors", value: errors.length, color: errors.length > 0 ? "var(--red)" : "var(--green)" },
          ].map(stat => (
            <div key={stat.label} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 14px" }}>
              <div style={{ fontSize: "10px", color: "var(--text3)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>{stat.label}</div>
              <div style={{ fontSize: "24px", fontWeight: 700, color: stat.color, fontFamily: "var(--font-mono)" }}>{stat.value}</div>
            </div>
          ))}
        </div>
      </div>}

      {tab === "ptree" && (
        <ParseTree
          astData={ast}
          onNodeSelect={setSelectedNode}
          onViewInAST={handleViewInAST}
        />
      )}

      {tab === "source" && (
        <SourceMap
          astData={ast}
          sourceCode={source}
          selectedNode={selectedNode}
          highlightLine={highlightSourceLine}
          onViewInAST={handleViewInAST}
          onSwitchTab={(t) => setTab(t)}
          phaseColor="#8b5cf6"
        />
      )}
    </div>
  );
}

function countNodesByCategory(node, category) {
  if (!node) return 0;
  let count = node.category === category ? 1 : 0;
  (node.children || []).forEach(c => { count += countNodesByCategory(c, category); });
  return count;
}

// Flatten AST into a line → nodes map
function buildLineNodeMap(ast) {
  const map = {};
  function traverse(node) {
    if (!node) return;
    if (node.line) {
      if (!map[node.line]) map[node.line] = [];
      map[node.line].push(node);
    }
    (node.children || []).forEach(traverse);
  }
  traverse(ast);
  return map;
}

function ASTSourceMapTab({ source, ast, selectedNode, onSelectNode }) {
  const lineNodeMap   = buildLineNodeMap(ast);
  const lines         = source ? source.split("\n") : [];
  const highlightLine = selectedNode?.line;

  if (lines.length === 0) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--text3)", fontFamily: "var(--font-mono)", fontSize: "12px", fontStyle: "italic" }}>
        Source code not available. Compile from the editor first.
      </div>
    );
  }

  return (
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      <div style={{
        padding: "8px 14px", background: "var(--bg3)", borderBottom: "1px solid var(--border)",
        fontSize: "10px", fontWeight: 700, letterSpacing: "1px",
        color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase",
        display: "flex", gap: "12px", alignItems: "center",
      }}>
        <span>Source ↔ AST Mapping</span>
        <span style={{ fontWeight: 400, color: "var(--accent)" }}>
          {Object.keys(lineNodeMap).length} lines with nodes · click a chip to inspect
        </span>
      </div>

      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "12px", lineHeight: "1.8", overflowX: "auto" }}>
        {lines.map((line, i) => {
          const lineNum  = i + 1;
          const nodes    = lineNodeMap[lineNum] || [];
          const isSelected = lineNum === highlightLine;
          const hasNodes = nodes.length > 0;

          return (
            <div key={lineNum} style={{
              display: "flex", alignItems: "flex-start",
              borderLeft: isSelected
                ? "3px solid var(--yellow)"
                : hasNodes
                ? "3px solid var(--accent)"
                : "3px solid transparent",
              background: isSelected
                ? "rgba(255,203,107,0.08)"
                : hasNodes
                ? "rgba(6,255,165,0.02)"
                : "transparent",
              paddingRight: "16px",
            }}>
              {/* Line number */}
              <span style={{
                minWidth: "42px", textAlign: "right", paddingRight: "16px", paddingLeft: "10px",
                color: hasNodes ? "var(--accent)" : "var(--text3)",
                fontSize: "10px", userSelect: "none", lineHeight: "1.8", flexShrink: 0,
              }}>
                {lineNum}
              </span>

              {/* Line content + AST node chips */}
              <div style={{ flex: 1 }}>
                <span style={{
                  color: isSelected ? "var(--yellow)" : hasNodes ? "var(--text)" : "var(--text3)",
                  display: "block",
                }}>
                  {line || " "}
                </span>
                {hasNodes && (
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", paddingBottom: "4px" }}>
                    {nodes.map((n, j) => {
                      const nc = NODE_COLORS[n.category] || "#888";
                      const isActive = selectedNode === n;
                      return (
                        <span
                          key={j}
                          onClick={() => onSelectNode && onSelectNode(n)}
                          style={{
                            fontFamily: "var(--font-mono)", fontSize: "9px",
                            padding: "1px 7px", borderRadius: "3px", cursor: "pointer",
                            background: isActive ? nc + "30" : nc + "12",
                            color: nc,
                            border: `1px solid ${isActive ? nc + "88" : nc + "33"}`,
                            fontWeight: isActive ? 700 : 400,
                            transition: "all 0.1s",
                          }}
                        >
                          {n.type}{n.value ? ` "${n.value}"` : ""}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Parse Tree View ──────────────────────────────────────────────

const GRAMMAR_RULES = {
  function_declaration:   "FuncDecl  →  Type IDENT '(' Params ')' Block",
  variable_declaration:   "VarDecl   →  Type IDENT [ '=' Expr ] ';'",
  class_declaration:      "ClassDecl →  'class' IDENT '{' Members '}'",
  parameter_declaration:  "ParamDecl →  Type IDENT",
  if_statement:           "IfStmt    →  'if' '(' Expr ')' Stmt [ 'else' Stmt ]",
  while_statement:        "WhileStmt →  'while' '(' Expr ')' Stmt",
  for_statement:          "ForStmt   →  'for' '(' Init ';' Cond ';' Update ')' Stmt",
  do_while_statement:     "DoWhile   →  'do' Stmt 'while' '(' Expr ')' ';'",
  return_statement:       "RetStmt   →  'return' [ Expr ] ';'",
  block:                  "Block     →  '{' Stmt* '}'",
  expression_statement:   "ExprStmt  →  Expr ';'",
  binary_expression:      "BinExpr   →  Expr BinOp Expr",
  unary_expression:       "UnExpr    →  UnOp Expr",
  assignment_expression:  "AssignExpr →  Expr AssignOp Expr",
  call_expression:        "CallExpr  →  IDENT '(' ArgList ')'",
  member_expression:      "MemberExpr →  Expr '.' IDENT",
  integer_literal:        "IntLit    →  [0-9]+",
  float_literal:          "FloatLit  →  [0-9]+ '.' [0-9]*",
  string_literal:         'StrLit    →  \'"\' chars \'"\'',
  bool_literal:           "BoolLit   →  'true' | 'false'",
  type_specifier:         "TypeSpec  →  'int'|'float'|'char'|'bool'|'void'|'string'",
  identifier:             "IDENT     →  [a-zA-Z_][a-zA-Z0-9_]*",
};

function ParseTreeNode({ node, depth, collapsed, onToggle }) {
  const key = `${node.type}-${node.line}-${depth}-${node.value}`;
  const isOpen = !collapsed.has(key);
  const hasChildren = (node.children || []).length > 0;
  const isLeaf = !hasChildren;
  const color = NODE_COLORS[node.category] || "#888";
  const rule = GRAMMAR_RULES[node.type];

  return (
    <div>
      <div
        onClick={() => hasChildren && onToggle(key)}
        style={{
          display:"flex", alignItems:"flex-start", gap:"6px",
          padding:"3px 6px", paddingLeft:`${6 + depth * 16}px`,
          borderRadius:"4px", cursor: hasChildren ? "pointer" : "default",
          background: isLeaf ? "transparent" : `${color}06`,
        }}
      >
        <span style={{ minWidth:"14px", fontSize:"9px", color:"var(--text3)", paddingTop:"1px", flexShrink:0 }}>
          {hasChildren ? (isOpen ? "▼" : "▶") : "○"}
        </span>

        {/* Non-terminal / terminal badge */}
        <span style={{
          fontSize:"8px", fontWeight:700, letterSpacing:"0.3px",
          padding:"1px 5px", borderRadius:"3px", flexShrink:0,
          background: isLeaf ? color + "14" : color + "20",
          color, border:`1px solid ${color}33`,
          fontFamily:"var(--font-mono)",
        }}>
          {isLeaf ? "T" : "NT"}
        </span>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:"6px", flexWrap:"wrap" }}>
            <code style={{ fontFamily:"var(--font-mono)", fontSize:"11px", color, fontWeight:600 }}>
              {node.type}
            </code>
            {node.value && (
              <span style={{ fontFamily:"var(--font-mono)", fontSize:"10px", color:"var(--orange)" }}>
                = "{node.value}"
              </span>
            )}
            {node.dataType && (
              <span style={{ fontFamily:"var(--font-mono)", fontSize:"9px", color:"var(--cyan)" }}>
                : {node.dataType}
              </span>
            )}
            {node.line && (
              <span style={{ fontFamily:"var(--font-mono)", fontSize:"9px", color:"var(--text3)", marginLeft:"auto" }}>
                L{node.line}
              </span>
            )}
          </div>
          {rule && !isLeaf && (
            <div style={{ fontFamily:"var(--font-mono)", fontSize:"8px", color:"var(--text3)", marginTop:"1px", lineHeight:1.3 }}>
              {rule}
            </div>
          )}
        </div>
      </div>

      {isOpen && hasChildren && (
        <div style={{ borderLeft:`1px dashed ${color}25`, marginLeft:`${14 + depth * 16}px` }}>
          {node.children.map((child, i) => (
            <ParseTreeNode key={i} node={child} depth={depth+1} collapsed={collapsed} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}

function ParseTreeTab({ ast }) {
  const [collapsed, setCollapsed] = useState(new Set());
  const [filter, setFilter] = useState("all");

  if (!ast) return <div style={{ padding:"30px", textAlign:"center", color:"var(--text3)", fontFamily:"var(--font-mono)", fontSize:"12px" }}>No AST data.</div>;

  function toggle(key) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  function collapseAll(node, depth = 0) {
    const keys = new Set();
    function visit(n, d) {
      if ((n.children || []).length > 0) {
        keys.add(`${n.type}-${n.line}-${d}-${n.value}`);
        n.children.forEach(c => visit(c, d + 1));
      }
    }
    visit(node, depth);
    return keys;
  }

  // Filter categories for display
  const filterOpts = ["all", "declaration", "statement", "expression", "literal"];

  function shouldShow(node) {
    if (filter === "all") return true;
    if (node.category === filter) return true;
    return (node.children || []).some(c => shouldShow(c));
  }

  function filteredNode(node) {
    if (!shouldShow(node)) return null;
    const fc = (node.children || []).map(filteredNode).filter(Boolean);
    return { ...node, children: fc };
  }

  const displayAst = filteredNode(ast) || ast;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
      <div style={{ display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap" }}>
        <span style={{ fontFamily:"var(--font-mono)", fontSize:"9px", fontWeight:700, letterSpacing:"1px", color:"var(--text3)", textTransform:"uppercase" }}>
          Filter:
        </span>
        {filterOpts.map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            fontFamily:"var(--font-mono)", fontSize:"9px", fontWeight:700,
            padding:"3px 10px", borderRadius:"4px",
            border:`1px solid ${filter===f ? "var(--accent)" : "var(--border)"}`,
            background: filter===f ? "rgba(6,255,165,0.1)" : "transparent",
            color: filter===f ? "var(--accent)" : "var(--text3)",
            cursor:"pointer",
          }}>{f}</button>
        ))}
        <button onClick={() => setCollapsed(collapseAll(ast))} style={{
          marginLeft:"auto", fontFamily:"var(--font-mono)", fontSize:"9px",
          padding:"3px 10px", borderRadius:"4px", border:"1px solid var(--border)",
          background:"transparent", color:"var(--text3)", cursor:"pointer",
        }}>Collapse All</button>
        <button onClick={() => setCollapsed(new Set())} style={{
          fontFamily:"var(--font-mono)", fontSize:"9px",
          padding:"3px 10px", borderRadius:"4px", border:"1px solid var(--border)",
          background:"transparent", color:"var(--text3)", cursor:"pointer",
        }}>Expand All</button>
      </div>

      <div style={{ display:"flex", gap:"10px", fontFamily:"var(--font-mono)", fontSize:"9px", color:"var(--text3)" }}>
        <span><span style={{ background:"rgba(255,255,255,0.12)", borderRadius:"3px", padding:"1px 5px", marginRight:"4px" }}>NT</span>Non-terminal — grammar rule with children</span>
        <span><span style={{ background:"rgba(255,255,255,0.08)", borderRadius:"3px", padding:"1px 5px", marginRight:"4px" }}>T</span>Terminal — leaf node (concrete token)</span>
      </div>

      <div style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", overflow:"auto", maxHeight:"600px" }}>
        <div style={{ padding:"10px 12px" }}>
          <ParseTreeNode node={displayAst} depth={0} collapsed={collapsed} onToggle={toggle} />
        </div>
      </div>
    </div>
  );
}

// ── Phase 3 — Semantic Analysis ───────────────────────────────────

const KIND_COLORS = {
  function: "#4d9fff", variable: "#c792ea", parameter: "#c3e88d",
  class: "#ffcb6b", struct: "#f78c6c", enum: "#89ddff",
  enum_value: "#82aaff", namespace: "#ff5370", typedef: "#22d3ee", unknown: "#546e7a",
};

function SemanticView({ data }) {
  const [tab, setTab] = useState("table");
  const symbols = data.symbols || [];
  const errors  = data.semantic_errors || [];
  const kindCounts = {};
  symbols.forEach(s => { kindCounts[s.kind] = (kindCounts[s.kind] || 0) + 1; });

  return (
    <div className="phase-view">
      <div className="phase-header">
        <span className="phase-title">Semantic Analysis</span>
        <span className="phase-badge">{symbols.length} symbols</span>
        <span className="phase-badge">{errors.length} issues</span>
        <DownloadMenu options={[
          { label: "JSON", onClick: () => downloadSymbols_JSON(symbols) },
          { label: "CSV",  onClick: () => downloadSymbols_CSV(symbols) },
        ]} />
      </div>

      <TabBar
        tabs={[
          { id: "table", label: "Symbol Table" },
          { id: "scope", label: "Scope Tree" },
          { id: "types", label: "Type Checking" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "table" && (
        <>
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
              <thead><tr><th>#</th><th>Name</th><th>Kind</th><th>Type</th><th>Scope</th><th>Line</th><th>Used</th><th>Init</th></tr></thead>
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
                        <span style={{ display: "inline-block", background: "var(--bg4)", border: "1px solid var(--border2)", borderRadius: "4px", padding: "1px 7px", fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text2)" }}>{sym.scopeLevel}</span>
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
          {errors.length > 0 && <SemanticErrorPanel errors={errors} />}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "10px" }}>
            {[
              { label: "Total Symbols", value: symbols.length,                                   color: "var(--accent)"  },
              { label: "Functions",     value: symbols.filter(s => s.kind==="function").length,   color: "var(--cyan)"    },
              { label: "Variables",     value: symbols.filter(s => s.kind==="variable").length,   color: "var(--purple)"  },
              { label: "Parameters",   value: symbols.filter(s => s.kind==="parameter").length,  color: "var(--green)"   },
              { label: "Unused",        value: symbols.filter(s => !s.isUsed).length,             color: "var(--yellow)"  },
              { label: "Issues",        value: errors.length, color: errors.length > 0 ? "var(--red)" : "var(--green)" },
            ].map(stat => (
              <div key={stat.label} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 14px" }}>
                <div style={{ fontSize: "10px", color: "var(--text3)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>{stat.label}</div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: stat.color, fontFamily: "var(--font-mono)" }}>{stat.value}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "scope" && <ScopeTree symbols={symbols} scopes={data.scopes || []} />}
      {tab === "types" && (
        <TypeChecking
          symbols={symbols}
          typeErrors={errors}
          expressions={data.expressions || data.type_expressions || data.typeChecks || []}
          onSymbolSelect={() => setTab("table")}
        />
      )}
    </div>
  );
}

function SemanticErrorPanel({ errors }) {
  const [openIdx, setOpenIdx] = useState(null);
  return (
    <div style={{ background: "#1a0f0f", border: "1px solid var(--red)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      <div style={{ padding: "8px 14px", fontSize: "10px", fontWeight: 700, color: "var(--red)", letterSpacing: "0.1em", textTransform: "uppercase", borderBottom: "1px solid #3d1515", display: "flex", gap: "10px", alignItems: "center" }}>
        <span>Semantic Issues</span>
        <span style={{ fontWeight: 400, color: "rgba(255,83,112,0.5)", fontSize: "9px" }}>click row to see impact</span>
      </div>
      {errors.map((e, i) => {
        const isOpen = openIdx === i;
        const entry  = lookupError(e.message, "semantic");
        const color  = e.severity === "error" ? "var(--red)" : "var(--yellow)";
        return (
          <div key={i} style={{ borderBottom: "1px solid #1e0f0f" }}>
            <div
              onClick={() => entry && setOpenIdx(isOpen ? null : i)}
              style={{ display: "flex", gap: "12px", padding: "7px 14px", fontFamily: "var(--font-mono)", fontSize: "12px", cursor: entry ? "pointer" : "default", background: isOpen ? "rgba(255,83,112,0.06)" : "transparent", alignItems: "flex-start" }}
            >
              <span style={{ color, minWidth: 60, fontWeight: 600, flexShrink: 0, fontSize: "10px", paddingTop: "1px" }}>{e.severity?.toUpperCase()}</span>
              <span style={{ color: "var(--yellow)", minWidth: 90, flexShrink: 0, fontSize: "11px", paddingTop: "1px" }}>L{e.line}:{e.col}</span>
              <span style={{ color: "var(--text)", flex: 1 }}>{e.message}</span>
              {entry && <span style={{ color: isOpen ? "var(--red)" : "rgba(255,255,255,0.2)", fontSize: "9px", flexShrink: 0 }}>{isOpen ? "▲" : "▼"}</span>}
            </div>
            {isOpen && entry && (
              <div style={{ padding: "10px 14px", background: "rgba(0,0,0,0.3)", display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ padding: "8px 10px", background: "rgba(255,83,112,0.08)", border: "1px solid rgba(255,83,112,0.2)", borderLeft: "3px solid var(--red)", borderRadius: "6px" }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700, color: "var(--red)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: "4px" }}>⚡ Impact</div>
                  <p style={{ margin: 0, fontSize: "11px", color: "rgba(226,238,248,0.7)", lineHeight: 1.55 }}>{entry.impact}</p>
                </div>
                <div style={{ fontSize: "11px", color: "rgba(226,238,248,0.5)", lineHeight: 1.5 }}>
                  <span style={{ color: "#06ffa5", fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700, marginRight: "6px" }}>✓ FIX</span>
                  {entry.fix}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// Scope Tree tab

function buildScopeTree(symbols) {
  const rootChildren = [];
  const stack = [{ level: -1, children: rootChildren }];
  for (const sym of symbols) {
    while (stack.length > 1 && stack[stack.length - 1].level >= sym.scopeLevel) stack.pop();
    const node = { sym, children: [] };
    stack[stack.length - 1].children.push(node);
    if (['function','class','struct','namespace'].includes(sym.kind)) {
      stack.push({ level: sym.scopeLevel, children: node.children });
    }
  }
  return rootChildren;
}

function ScopeNode({ node, depth, collapsed, onToggle }) {
  const key  = `${node.sym.name}-${node.sym.line}-${depth}`;
  const open = !collapsed.has(key);
  const hasChildren = node.children.length > 0;
  const color = KIND_COLORS[node.sym.kind] || "#888";
  const isContainer = ['function','class','struct','namespace'].includes(node.sym.kind);

  return (
    <div>
      <div
        onClick={() => hasChildren && onToggle(key)}
        style={{
          display: "flex", alignItems: "center", gap: "6px",
          padding: "5px 8px", paddingLeft: `${8 + depth * 18}px`,
          borderRadius: "5px", marginBottom: "2px",
          cursor: hasChildren ? "pointer" : "default",
          background: isContainer ? `${color}08` : "transparent",
        }}
      >
        <span style={{ minWidth: "12px", color: "var(--text3)", fontSize: "10px" }}>
          {hasChildren ? (open ? "▼" : "▶") : "·"}
        </span>
        <span style={{
          fontSize: "9px", fontWeight: 700, letterSpacing: "0.5px",
          padding: "1px 6px", borderRadius: "3px",
          background: color + "18", color, border: `1px solid ${color}44`,
          fontFamily: "var(--font-mono)", textTransform: "uppercase", flexShrink: 0,
        }}>
          {node.sym.kind}
        </span>
        <code style={{ color, fontWeight: 600, fontSize: "12px", fontFamily: "var(--font-mono)" }}>
          {node.sym.name}
        </code>
        {node.sym.type && (
          <span style={{ color: "var(--cyan)", fontSize: "11px", fontFamily: "var(--font-mono)" }}>
            : {node.sym.type}
          </span>
        )}
        <span style={{ marginLeft: "auto", display: "flex", gap: "8px", fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text3)" }}>
          <span>scope {node.sym.scopeLevel}</span>
          <span style={{ color: node.sym.isUsed ? "var(--green)" : "var(--red)" }}>
            {node.sym.isUsed ? "✓" : "✗"}
          </span>
        </span>
      </div>
      {open && hasChildren && (
        <div style={{ borderLeft: `1px dashed ${color}30`, marginLeft: `${16 + depth * 18}px` }}>
          {node.children.map((child, i) => (
            <ScopeNode key={i} node={child} depth={depth + 1} collapsed={collapsed} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}

function ScopeTreeTab({ symbols }) {
  const [collapsed, setCollapsed] = useState(new Set());
  const tree = buildScopeTree(symbols);

  function toggle(key) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
      <div style={{
        padding: "8px 14px", background: "var(--bg3)", borderBottom: "1px solid var(--border)",
        fontSize: "10px", fontWeight: 700, letterSpacing: "1px",
        color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase",
        display: "flex", gap: "10px",
      }}>
        <span>Scope Hierarchy</span>
        <span style={{ fontWeight: 400 }}>— click containers to collapse</span>
      </div>
      <div style={{ padding: "10px 14px" }}>
        <div style={{
          display: "flex", alignItems: "center", gap: "8px",
          padding: "4px 0", marginBottom: "6px",
          fontFamily: "var(--font-mono)", fontSize: "10px",
          fontWeight: 700, color: "var(--accent)", letterSpacing: "1px",
        }}>
          ◉ Global Scope
        </div>
        {tree.length === 0 ? (
          <div style={{ padding: "20px", textAlign: "center", color: "var(--text3)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
            No symbols to display
          </div>
        ) : (
          tree.map((node, i) => (
            <ScopeNode key={i} node={node} depth={0} collapsed={collapsed} onToggle={toggle} />
          ))
        )}
      </div>
    </div>
  );
}

// Type Check tab

function TypeCheckTab({ symbols, errors }) {
  const TYPE_COLORS = {
    int: "#4d9fff", float: "#c3e88d", double: "#c3e88d", bool: "#ffcb6b",
    char: "#f78c6c", string: "#f78c6c", void: "#546e7a", auto: "#89ddff",
  };

  const typeGroups = {};
  symbols.forEach(sym => {
    const t = sym.type || "void";
    if (!typeGroups[t]) typeGroups[t] = [];
    typeGroups[t].push(sym);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Type distribution */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
        <div style={{ padding: "8px 14px", background: "var(--bg3)", borderBottom: "1px solid var(--border)", fontSize: "10px", fontWeight: 700, letterSpacing: "1px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
          Type Distribution
        </div>
        <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
          {Object.entries(typeGroups).map(([type, syms]) => {
            const color = TYPE_COLORS[type] || "#82aaff";
            const pct = symbols.length > 0 ? Math.round((syms.length / symbols.length) * 100) : 0;
            return (
              <div key={type}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color, fontWeight: 700 }}>{type}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--text3)" }}>
                    {syms.length} symbol{syms.length !== 1 ? "s" : ""} ({pct}%)
                  </span>
                </div>
                <div style={{ height: "4px", background: "var(--bg4)", borderRadius: "2px", overflow: "hidden", marginBottom: "6px" }}>
                  <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: "2px" }} />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {syms.map((s, i) => {
                    const kc = KIND_COLORS[s.kind] || "#888";
                    return (
                      <span key={i} style={{
                        fontFamily: "var(--font-mono)", fontSize: "10px",
                        padding: "1px 8px", borderRadius: "3px",
                        background: kc + "12", color: kc, border: `1px solid ${kc}33`,
                      }}>
                        {s.kind[0]}: {s.name}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {Object.keys(typeGroups).length === 0 && (
            <div style={{ color: "var(--text3)", fontFamily: "var(--font-mono)", fontSize: "12px", fontStyle: "italic" }}>No symbols.</div>
          )}
        </div>
      </div>

      {/* Semantic errors */}
      {errors.length > 0 && <SemanticErrorPanel errors={errors} />}

      {/* Sorted symbol table */}
      <div style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
        <div style={{ padding: "8px 14px", background: "var(--bg3)", borderBottom: "1px solid var(--border)", fontSize: "10px", fontWeight: 700, letterSpacing: "1px", color: "var(--text3)", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
          Symbols — Sorted by Type
        </div>
        <div className="token-table-wrap">
          <table className="token-table">
            <thead><tr><th>Name</th><th>Kind</th><th>Type</th><th>Scope</th><th>Line</th><th>Used</th><th>Init</th></tr></thead>
            <tbody>
              {[...symbols].sort((a, b) => (a.type || "").localeCompare(b.type || "")).map((sym, i) => {
                const kc = KIND_COLORS[sym.kind] || "#888";
                const tc = TYPE_COLORS[sym.type] || "#82aaff";
                return (
                  <tr key={i} className="token-row">
                    <td><code style={{ color: kc, fontFamily: "var(--font-mono)", fontWeight: 600 }}>{sym.name}</code></td>
                    <td><span className="tok-type-badge" style={{ background: kc+"18", color: kc, borderColor: kc+"44" }}>{sym.kind}</span></td>
                    <td><span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: tc, fontWeight: 700 }}>{sym.type || "void"}</span></td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{ background: "var(--bg4)", border: "1px solid var(--border2)", borderRadius: "4px", padding: "1px 7px", fontSize: "11px", fontFamily: "var(--font-mono)", color: "var(--text2)" }}>{sym.scopeLevel}</span>
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
      </div>
    </div>
  );
}

// ── Phase 4 — IR Generation ───────────────────────────────────────

const TAC_OP_COLORS = {
  "func_begin":"#4d9fff","func_end":"#4d9fff","param":"#89ddff",
  "=":"#c792ea","copy":"#c792ea",
  "+":"#c3e88d","-":"#c3e88d","*":"#c3e88d","/":"#c3e88d","%":"#c3e88d",
  "==":"#ffcb6b","!=":"#ffcb6b","<":"#ffcb6b",">":"#ffcb6b","<=":"#ffcb6b",">=":"#ffcb6b",
  "&&":"#ffcb6b","||":"#ffcb6b","!":"#ff5370",
  "label":"#546e7a","goto":"#f78c6c","if_goto":"#f78c6c","ifnot_goto":"#f78c6c",
  "return":"#ff5370","call":"#22d3ee","print":"#22d3ee",
};

function IRView({ data }) {
  const [tab, setTab] = useState("tac");
  const tac = data.tac || [];

  return (
    <div className="phase-view">
      <div className="phase-header">
        <span className="phase-title">IR Generation</span>
        <span className="phase-badge">{tac.length} instructions</span>
        <span className="phase-badge">{tac.filter(i => i.op === "func_begin").length} functions</span>
        <span className="phase-badge">{tac.filter(i => i.result && i.result.startsWith("t")).length} temporaries</span>
        <DownloadMenu options={[
          { label: "JSON", onClick: () => downloadTAC_JSON(tac) },
          { label: "CSV",  onClick: () => downloadTAC_CSV(tac) },
        ]} />
      </div>

      <TabBar
        tabs={[
          { id: "tac",    label: "TAC Table" },
          { id: "blocks", label: "Basic Blocks" },
          { id: "cfg",    label: "CFG" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "tac" && (
        <>
          <div className="token-table-wrap">
            <table className="token-table">
              <thead><tr><th>#</th><th>Op</th><th>Instruction</th><th>Result</th><th>Arg1</th><th>Arg2</th><th>Line</th></tr></thead>
              <tbody>
                {tac.map((instr, i) => {
                  const color       = TAC_OP_COLORS[instr.op] || "#888";
                  const isLabel     = instr.op === "label";
                  const isFuncBegin = instr.op === "func_begin";
                  const isFuncEnd   = instr.op === "func_end";
                  return (
                    <tr key={i} className="token-row" style={{
                      background: isFuncBegin ? "#4d9fff11" : isFuncEnd ? "#4d9fff08" : isLabel ? "var(--bg3)" : "",
                    }}>
                      <td className="tok-idx" style={{ color: "var(--text3)" }}>{instr.id}</td>
                      <td><span className="tok-type-badge" style={{ background: color+"18", color, borderColor: color+"44", fontFamily: "var(--font-mono)" }}>{instr.op}</span></td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: isLabel ? "var(--text3)" : isFuncBegin || isFuncEnd ? color : "var(--text)", paddingLeft: isLabel ? "8px" : "14px", fontStyle: isLabel ? "italic" : "normal" }}>{instr.code}</td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: instr.result?.startsWith("t") ? "var(--purple)" : "var(--text2)" }}>{instr.result || "—"}</td>
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
              { label: "Total Instructions", value: tac.length,                                                             color: "var(--accent)"  },
              { label: "Temporaries",        value: tac.filter(i => i.result?.startsWith("t")).length,                      color: "var(--purple)"  },
              { label: "Labels",             value: tac.filter(i => i.op === "label").length,                               color: "var(--text2)"   },
              { label: "Jumps",              value: tac.filter(i => ["goto","if_goto","ifnot_goto"].includes(i.op)).length, color: "var(--orange)"  },
              { label: "Arithmetic",         value: tac.filter(i => ["+","-","*","/","%"].includes(i.op)).length,           color: "var(--green)"   },
              { label: "Function Calls",     value: tac.filter(i => i.op === "call").length,                                color: "var(--cyan)"    },
            ].map(stat => (
              <div key={stat.label} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 14px" }}>
                <div style={{ fontSize: "10px", color: "var(--text3)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "6px" }}>{stat.label}</div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: stat.color, fontFamily: "var(--font-mono)" }}>{stat.value}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "blocks" && <BasicBlocks tac={tac} blocks={data.basic_blocks || data.basicBlocks || []} />}
      {tab === "cfg"    && <CFG tac={tac} blocks={data.basic_blocks || data.basicBlocks || []} onViewInBasicBlocks={() => setTab("blocks")} />}
    </div>
  );
}

// Basic Blocks tab

function parseBasicBlocks(instructions) {
  const blocks = [];
  let current = null;

  function flush() {
    if (current && current.instrs.length > 0) { blocks.push(current); }
    current = null;
  }
  function startBlock(label) {
    flush();
    current = { label, instrs: [], exits: [] };
  }

  startBlock("entry");

  for (const instr of instructions) {
    if (instr.op === "func_begin") {
      const name = instr.result || (instr.code || "").replace(/func_begin\s+/i, "").trim() || `func_${blocks.length}`;
      startBlock(name);
      current.instrs.push(instr);
    } else if (instr.op === "label") {
      const name = instr.result || (instr.code || "").replace(/:$/, "").trim() || `L${blocks.length}`;
      startBlock(name);
      current.instrs.push(instr);
    } else {
      if (!current) startBlock("block");
      current.instrs.push(instr);

      if (instr.op === "goto") {
        current.exits.push({ label: instr.arg1 || instr.result || "?", type: "jump" });
        startBlock(null);
      } else if (instr.op === "if_goto") {
        current.exits.push({ label: instr.arg2 || "?", type: "branch-true" });
        current.exits.push({ label: "fall-through", type: "fall" });
        startBlock(null);
      } else if (instr.op === "ifnot_goto") {
        current.exits.push({ label: instr.arg2 || "?", type: "branch-false" });
        current.exits.push({ label: "fall-through", type: "fall" });
        startBlock(null);
      } else if (instr.op === "return") {
        current.exits.push({ label: "RETURN", type: "return" });
        startBlock(null);
      } else if (instr.op === "func_end") {
        startBlock(null);
      }
    }
  }
  flush();
  return blocks.filter(b => b.instrs.length > 0);
}

const EXIT_COLORS = { jump: "#f78c6c", "branch-true": "#c3e88d", "branch-false": "#ff5370", fall: "#546e7a", return: "#ff5370" };

function BasicBlocksTab({ tac }) {
  const blocks = parseBasicBlocks(tac);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text3)", letterSpacing: "1px", textTransform: "uppercase", fontWeight: 700 }}>
        {blocks.length} Basic Block{blocks.length !== 1 ? "s" : ""} detected
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "10px" }}>
        {blocks.map((block, i) => (
          <div key={i} style={{ background: "var(--bg2)", border: "1px solid var(--border2)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
            {/* Header */}
            <div style={{
              padding: "6px 12px", background: block.label?.match(/^(main|[a-z]\w*)$/) ? "rgba(77,159,255,0.1)" : "var(--bg3)",
              borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: "8px",
            }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700, color: "var(--text3)", background: "var(--bg4)", border: "1px solid var(--border)", borderRadius: "3px", padding: "1px 5px" }}>B{i}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "10px", fontWeight: 700, color: "#4d9fff" }}>{block.label || `block_${i}`}</span>
              <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text3)" }}>{block.instrs.length} instr{block.instrs.length !== 1 ? "s" : ""}</span>
            </div>
            {/* Instructions */}
            <div style={{ padding: "4px 0" }}>
              {block.instrs.map((instr, j) => {
                const color = TAC_OP_COLORS[instr.op] || "#888";
                const isTerminator = ["goto","if_goto","ifnot_goto","return","func_end"].includes(instr.op);
                return (
                  <div key={j} style={{
                    padding: "3px 12px", fontFamily: "var(--font-mono)", fontSize: "10px",
                    color: isTerminator ? color : "var(--text2)",
                    borderLeft: isTerminator ? `2px solid ${color}` : "2px solid transparent",
                    background: isTerminator ? `${color}08` : "transparent",
                    display: "flex", gap: "6px", alignItems: "center",
                  }}>
                    <span style={{ color, fontSize: "9px", fontWeight: 700, minWidth: "48px", display: "inline-block" }}>{instr.op}</span>
                    <span style={{ flex: 1 }}>{instr.code}</span>
                  </div>
                );
              })}
            </div>
            {/* Exits */}
            {block.exits.length > 0 && (
              <div style={{ padding: "5px 12px", borderTop: "1px solid var(--border)", display: "flex", gap: "5px", flexWrap: "wrap" }}>
                {block.exits.map((exit, j) => {
                  const ec = EXIT_COLORS[exit.type] || "#888";
                  return (
                    <span key={j} style={{
                      fontFamily: "var(--font-mono)", fontSize: "9px", fontWeight: 700,
                      padding: "2px 7px", borderRadius: "3px",
                      background: ec + "15", color: ec, border: `1px solid ${ec}44`,
                    }}>
                      → {exit.label}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── CFG (Control Flow Graph) ──────────────────────────────────────

function CFGTab({ tac }) {
  const svgRef = useRef(null);
  const [selectedBlock, setSelectedBlock] = useState(null);

  const blocks = parseBasicBlocks(tac);

  useEffect(() => {
    if (!svgRef.current || blocks.length === 0) return;
    const container = svgRef.current.parentElement;
    const W = container.clientWidth || 720;
    const H = Math.max(500, blocks.length * 70);

    d3.select(svgRef.current).selectAll("*").remove();
    const svg = d3.select(svgRef.current).attr("width", W).attr("height", H);
    const g = svg.append("g");
    svg.call(d3.zoom().scaleExtent([0.25, 2]).on("zoom", e => g.attr("transform", e.transform)));

    // Arrow marker
    svg.append("defs").append("marker")
      .attr("id", "cfg-arrow")
      .attr("viewBox", "0 -5 10 10").attr("refX", 5).attr("refY", 0)
      .attr("markerWidth", 6).attr("markerHeight", 6).attr("orient", "auto")
      .append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", "rgba(255,255,255,0.35)");

    // Build node positions — column layout grouped by function
    const COLS = Math.max(1, Math.min(3, Math.ceil(blocks.length / 6)));
    const COL_W = Math.floor(W / COLS);
    const NODE_W = 160, NODE_H = 50, VERT_GAP = 80;

    const nodePos = {};
    let col = 0, row = 0, lastFunc = null;
    blocks.forEach((block, i) => {
      // New column when entering a new function
      const isNewFunc = block.label && !block.label.match(/^(L|label|block|null|entry)/i)
                        && block.label !== lastFunc;
      if (isNewFunc && i > 0) { col = (col + 1) % COLS; if (col === 0) row += 1; lastFunc = block.label; }
      nodePos[i] = {
        x: col * COL_W + COL_W/2 - NODE_W/2,
        y: row * (VERT_GAP + NODE_H) + 30,
      };
      row++;
    });

    // Build label → block index map
    const labelToIdx = {};
    blocks.forEach((block, i) => { if (block.label) labelToIdx[block.label] = i; });

    // Draw edges from exit info
    blocks.forEach((block, i) => {
      const src = nodePos[i];
      if (!src) return;
      block.exits.forEach(exit => {
        const targetIdx = labelToIdx[exit.label] ?? (
          exit.type === "fall" ? i + 1 : null
        );
        const tgt = targetIdx !== null ? nodePos[targetIdx] : null;
        if (!tgt) return;

        const ec = EXIT_COLORS[exit.type] || "#888";
        const sx = src.x + NODE_W/2, sy = src.y + NODE_H;
        const tx = tgt.x + NODE_W/2, ty = tgt.y;

        g.append("line")
          .attr("x1", sx).attr("y1", sy).attr("x2", tx).attr("y2", ty - 8)
          .attr("stroke", ec).attr("stroke-width", 1.5).attr("opacity", 0.6)
          .attr("marker-end", "url(#cfg-arrow)");

        // Edge label
        const mx = (sx + tx) / 2 + 12, my = (sy + ty) / 2;
        g.append("text").attr("x", mx).attr("y", my)
          .attr("font-family", "'JetBrains Mono',monospace").attr("font-size", 8)
          .attr("fill", ec).attr("opacity", 0.8).text(exit.type);
      });

      // Fall-through edge to next block (if no exits)
      if (block.exits.length === 0 && i + 1 < blocks.length) {
        const tgt = nodePos[i + 1];
        if (tgt) {
          const sx = src.x + NODE_W/2, sy = src.y + NODE_H;
          const tx = tgt.x + NODE_W/2, ty = tgt.y;
          g.append("line")
            .attr("x1", sx).attr("y1", sy).attr("x2", tx).attr("y2", ty - 8)
            .attr("stroke", "#546e7a").attr("stroke-width", 1).attr("opacity", 0.4)
            .attr("stroke-dasharray", "4 3").attr("marker-end", "url(#cfg-arrow)");
        }
      }
    });

    // Draw nodes
    blocks.forEach((block, i) => {
      const pos = nodePos[i];
      if (!pos) return;
      const isFuncEntry = block.label && !block.label.match(/^(L\d|null|entry|block)/);
      const bg = isFuncEntry ? "#4d9fff" : "#888";

      const ng = g.append("g").style("cursor", "pointer")
        .on("click", (event) => {
          event.stopPropagation();
          setSelectedBlock(block);
        });

      ng.append("rect")
        .attr("x", pos.x).attr("y", pos.y)
        .attr("width", NODE_W).attr("height", NODE_H)
        .attr("rx", 6)
        .attr("fill", isFuncEntry ? "rgba(77,159,255,0.12)" : "rgba(255,255,255,0.04)")
        .attr("stroke", isFuncEntry ? "#4d9fff" : "rgba(255,255,255,0.15)")
        .attr("stroke-width", isFuncEntry ? 1.5 : 1);

      ng.append("text").attr("x", pos.x + 6).attr("y", pos.y + 16)
        .attr("font-family", "'JetBrains Mono',monospace").attr("font-size", 9)
        .attr("font-weight", 700).attr("fill", bg)
        .text(`B${i}: ${block.label || "block"}`);

      ng.append("text").attr("x", pos.x + 6).attr("y", pos.y + 30)
        .attr("font-family", "'JetBrains Mono',monospace").attr("font-size", 8)
        .attr("fill", "rgba(255,255,255,0.35)")
        .text(`${block.instrs.length} instr${block.instrs.length !== 1 ? "s" : ""} · ${block.exits.length} exit${block.exits.length !== 1 ? "s" : ""}`);

      // Exit type indicators
      block.exits.forEach((exit, j) => {
        const ec = EXIT_COLORS[exit.type] || "#888";
        ng.append("circle")
          .attr("cx", pos.x + NODE_W - 12 - j * 12).attr("cy", pos.y + NODE_H - 10)
          .attr("r", 4).attr("fill", ec).attr("opacity", 0.7);
      });
    });

    svg.on("click", () => setSelectedBlock(null));
  }, [tac]);

  if (blocks.length === 0) return (
    <div style={{ padding:"30px", textAlign:"center", color:"var(--text3)", fontFamily:"var(--font-mono)", fontSize:"12px" }}>
      No basic blocks found. Compile a program first.
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"10px" }}>
      <div style={{ fontFamily:"var(--font-mono)", fontSize:"10px", color:"var(--text3)", display:"flex", gap:"12px", flexWrap:"wrap" }}>
        <span style={{ fontWeight:700, color:"var(--text2)" }}>CFG — Control Flow Graph</span>
        <span>{blocks.length} blocks</span>
        <span>click a node for details</span>
        <span>scroll to zoom · drag to pan</span>
      </div>

      {/* Legend */}
      <div style={{ display:"flex", gap:"10px", flexWrap:"wrap" }}>
        {Object.entries(EXIT_COLORS).map(([type, color]) => (
          <span key={type} style={{ display:"flex", alignItems:"center", gap:"5px", fontFamily:"var(--font-mono)", fontSize:"9px", color:"var(--text3)" }}>
            <span style={{ width:10, height:10, borderRadius:"50%", background:color, display:"inline-block" }} />
            {type}
          </span>
        ))}
      </div>

      <div style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", overflow:"hidden", height:"500px", position:"relative" }}>
        <svg ref={svgRef} style={{ width:"100%", height:"100%" }} />
        <div style={{ position:"absolute", bottom:10, right:14, fontSize:"10px", color:"var(--text3)", fontFamily:"var(--font-mono)" }}>
          scroll to zoom · drag to pan · click block for details
        </div>
      </div>

      {selectedBlock && (
        <div style={{ background:"var(--bg2)", border:"1px solid #4d9fff44", borderRadius:"var(--radius-lg)", padding:"12px 14px" }}>
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"10px" }}>
            <span style={{ fontFamily:"var(--font-mono)", fontSize:"10px", fontWeight:700, color:"#4d9fff", letterSpacing:"1px" }}>
              BLOCK: {selectedBlock.label || "unnamed"}
            </span>
            <button onClick={() => setSelectedBlock(null)} style={{ border:"none", background:"transparent", color:"var(--text3)", cursor:"pointer", fontSize:"14px", padding:"0 4px" }}>✕</button>
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:"3px", marginBottom:"10px" }}>
            {selectedBlock.instrs.map((instr, i) => {
              const color = TAC_OP_COLORS[instr.op] || "#888";
              return (
                <div key={i} style={{ fontFamily:"var(--font-mono)", fontSize:"10px", display:"flex", gap:"8px", alignItems:"center", padding:"2px 0" }}>
                  <span style={{ color, fontSize:"9px", minWidth:"60px", fontWeight:700 }}>{instr.op}</span>
                  <span style={{ color:"var(--text2)" }}>{instr.code}</span>
                </div>
              );
            })}
          </div>
          {selectedBlock.exits.length > 0 && (
            <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
              {selectedBlock.exits.map((exit, i) => {
                const ec = EXIT_COLORS[exit.type] || "#888";
                return (
                  <span key={i} style={{ fontFamily:"var(--font-mono)", fontSize:"9px", fontWeight:700, padding:"2px 8px", borderRadius:"3px", background:ec+"15", color:ec, border:`1px solid ${ec}44` }}>
                    → {exit.label} [{exit.type}]
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Phase 5 — Optimizer ───────────────────────────────────────────

const PASS_EXPLANATIONS = {
  "Constant Folding": {
    color: "#06ffa5",
    what: "Evaluates constant expressions at compile time.",
    why: "Avoids computing the same result at runtime on every execution.",
    example: "t0 = 3 + 4  →  t0 = 7",
  },
  "Constant Propagation": {
    color: "#4d9fff",
    what: "Replaces variables holding known constants with their constant values.",
    why: "Exposes more constant expressions for further folding.",
    example: "x = 5; t0 = x + 2  →  t0 = 5 + 2",
  },
  "Copy Propagation": {
    color: "#c792ea",
    what: "Replaces copies of a variable with the original source.",
    why: "Reduces redundant assignments and may expose dead code.",
    example: "y = x; t0 = y + 1  →  t0 = x + 1",
  },
  "Dead Code Elimination": {
    color: "#ff5370",
    what: "Removes instructions whose results are never used.",
    why: "Shrinks code size and eliminates unnecessary computation.",
    example: "t0 = a + b  (t0 never read)  →  (removed)",
  },
};

function OptView({ data }) {
  const original  = data.tac           || [];
  const optimized = data.optimized_tac || [];
  const changes   = data.opt_changes   || [];
  const stats     = data.opt_stats     || {};
  const [tab, setTab]               = useState("overview");
  const originalCount = stats.original_count ?? stats.original ?? original.length;
  const optimizedCount = stats.optimized_count ?? stats.optimized ?? optimized.length;
  const removedCount = stats.removed_count ?? stats.removed ?? Math.max(0, originalCount - optimizedCount);
  const changesCount = stats.changes_count ?? stats.changes ?? changes.length;
  const passNames = [...new Set(changes.map(c => c.pass).filter(Boolean))];

  return (
    <div className="phase-view">
      <div className="phase-header">
        <span className="phase-title">Optimizer — Before / After</span>
        <span className="phase-badge">{originalCount} → {optimizedCount} instructions</span>
        <span className="phase-badge" style={{ color: "var(--neon-green)", borderColor: "var(--neon-green)" }}>
          -{removedCount} removed
        </span>
        <span className="phase-badge">{changesCount} optimizations</span>
        <DownloadMenu options={[
          { label: "JSON", onClick: () => downloadOptimizedIR_JSON(optimized) },
          { label: "CSV",  onClick: () => downloadOptimizedIR_CSV(optimized) },
        ]} />
      </div>

      <TabBar
        tabs={[
          { id: "overview", label: "Overview" },
          { id: "impact",   label: "Impact Analysis" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "impact" && (
        <OptimizerImpact
          beforeInstructions={original}
          afterInstructions={optimized}
          optimizations={changes}
          passes={passNames}
        />
      )}
      {tab === "overview" && (
        <OptimizerOverview
          beforeInstructions={original}
          afterInstructions={optimized}
          optimizations={changes}
          passes={passNames}
        />
      )}
    </div>
  );
}

// ── Impact Analysis tab ───────────────────────────────────────────

function ImpactAnalysisTab({ original, optimized, changes, stats }) {
  const PASS_COLORS = {
    "Constant Folding":     "#06ffa5",
    "Constant Propagation": "#4d9fff",
    "Copy Propagation":     "#c792ea",
    "Dead Code Elimination":"#ff5370",
  };

  // Per-pass change counts
  const passStats = {};
  changes.forEach(c => {
    if (!passStats[c.pass]) passStats[c.pass] = { changes:0, removed:0 };
    passStats[c.pass].changes++;
    if (c.after === "-- REMOVED --") passStats[c.pass].removed++;
  });
  const maxChanges = Math.max(1, ...Object.values(passStats).map(s => s.changes));

  // Instruction category breakdown helper
  function categorize(instrs) {
    const cats = { arithmetic:0, moves:0, jumps:0, calls:0, labels:0, other:0 };
    instrs.forEach(i => {
      if (["+","-","*","/","%","==","!=","<",">","<=",">=","&&","||","!"].includes(i.op)) cats.arithmetic++;
      else if (["=","copy"].includes(i.op)) cats.moves++;
      else if (["goto","if_goto","ifnot_goto"].includes(i.op)) cats.jumps++;
      else if (["call","return"].includes(i.op)) cats.calls++;
      else if (["label","func_begin","func_end"].includes(i.op)) cats.labels++;
      else cats.other++;
    });
    return cats;
  }

  const origCats = categorize(original);
  const optCats  = categorize(optimized);

  const catColors = { arithmetic:"#c3e88d", moves:"#c792ea", jumps:"#f78c6c", calls:"#22d3ee", labels:"#546e7a", other:"#888" };

  const reduction = stats.original_count > 0
    ? Math.round(((stats.original_count - stats.optimized_count) / stats.original_count) * 100)
    : 0;

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"12px" }}>
      {/* Top KPI cards */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit, minmax(140px,1fr))", gap:"8px" }}>
        {[
          { label:"Original Instructions",  value:stats.original_count  || 0, color:"var(--text2)" },
          { label:"Optimized Instructions", value:stats.optimized_count || 0, color:"var(--neon-green)" },
          { label:"Instructions Removed",   value:stats.removed_count   || 0, color:"var(--red)" },
          { label:"Code Size Reduction",    value:`${reduction}%`,            color:"var(--yellow)" },
          { label:"Optimizations Applied",  value:stats.changes_count   || 0, color:"var(--cyan)" },
          { label:"Passes Active",          value:Object.keys(passStats).length, color:"var(--purple)" },
        ].map(k => (
          <div key={k.label} style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:"var(--radius)", padding:"12px 14px" }}>
            <div style={{ fontSize:"9px", color:"var(--text3)", fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:"5px", fontFamily:"var(--font-mono)" }}>{k.label}</div>
            <div style={{ fontSize:"22px", fontWeight:700, color:k.color, fontFamily:"var(--font-mono)" }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Per-pass bar chart */}
      <div style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", overflow:"hidden" }}>
        <div style={{ padding:"8px 14px", background:"var(--bg3)", borderBottom:"1px solid var(--border)", fontSize:"10px", fontWeight:700, letterSpacing:"1px", color:"var(--text3)", fontFamily:"var(--font-mono)", textTransform:"uppercase" }}>
          Changes Per Pass
        </div>
        <div style={{ padding:"14px", display:"flex", flexDirection:"column", gap:"12px" }}>
          {Object.entries(passStats).length === 0 ? (
            <div style={{ color:"var(--text3)", fontFamily:"var(--font-mono)", fontSize:"12px", fontStyle:"italic" }}>No optimizations were applied to this program.</div>
          ) : Object.entries(passStats).map(([pass, ps]) => {
            const color = PASS_COLORS[pass] || "#888";
            const pct = Math.round((ps.changes / maxChanges) * 100);
            return (
              <div key={pass}>
                <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"5px" }}>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:"11px", color, fontWeight:700 }}>{pass}</span>
                  <span style={{ fontFamily:"var(--font-mono)", fontSize:"10px", color:"var(--text3)" }}>
                    {ps.changes} change{ps.changes !== 1 ? "s" : ""} · {ps.removed} removed
                  </span>
                </div>
                <div style={{ height:"6px", background:"var(--bg4)", borderRadius:"3px", overflow:"hidden", marginBottom:"4px" }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:"3px", transition:"width 0.4s" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Instruction category breakdown — before vs after */}
      <div style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", overflow:"hidden" }}>
        <div style={{ padding:"8px 14px", background:"var(--bg3)", borderBottom:"1px solid var(--border)", fontSize:"10px", fontWeight:700, letterSpacing:"1px", color:"var(--text3)", fontFamily:"var(--font-mono)", textTransform:"uppercase" }}>
          Instruction Mix — Before vs After
        </div>
        <div style={{ padding:"14px", display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
          {[
            { label:"Before", cats:origCats, total:stats.original_count || 1 },
            { label:"After",  cats:optCats,  total:stats.optimized_count || 1 },
          ].map(side => (
            <div key={side.label}>
              <div style={{ fontFamily:"var(--font-mono)", fontSize:"10px", fontWeight:700, color:"var(--text3)", marginBottom:"10px", textTransform:"uppercase", letterSpacing:"1px" }}>{side.label}</div>
              <div style={{ display:"flex", flexDirection:"column", gap:"7px" }}>
                {Object.entries(side.cats).map(([cat, count]) => {
                  const color = catColors[cat];
                  const pct = Math.round((count / side.total) * 100);
                  return (
                    <div key={cat}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:"3px" }}>
                        <span style={{ fontFamily:"var(--font-mono)", fontSize:"10px", color }}>{cat}</span>
                        <span style={{ fontFamily:"var(--font-mono)", fontSize:"9px", color:"var(--text3)" }}>{count} ({pct}%)</span>
                      </div>
                      <div style={{ height:"4px", background:"var(--bg4)", borderRadius:"2px", overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${pct}%`, background:color, borderRadius:"2px" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Optimization timeline — order of changes */}
      {changes.length > 0 && (
        <div style={{ background:"var(--bg2)", border:"1px solid var(--border)", borderRadius:"var(--radius-lg)", overflow:"hidden" }}>
          <div style={{ padding:"8px 14px", background:"var(--bg3)", borderBottom:"1px solid var(--border)", fontSize:"10px", fontWeight:700, letterSpacing:"1px", color:"var(--text3)", fontFamily:"var(--font-mono)", textTransform:"uppercase" }}>
            Optimization Timeline ({changes.length} changes)
          </div>
          <div style={{ display:"flex", overflowX:"auto", padding:"12px 14px", gap:"3px" }}>
            {changes.map((c, i) => {
              const color = PASS_COLORS[c.pass] || "#888";
              return (
                <div key={i} title={`${c.pass}: ${c.before} → ${c.after}`} style={{
                  flexShrink:0, width:`${Math.max(6, Math.floor(600 / changes.length))}px`,
                  height:"30px", borderRadius:"2px",
                  background: c.after === "-- REMOVED --" ? "#ff537044" : color + "44",
                  border:`1px solid ${c.after === "-- REMOVED --" ? "#ff5370" : color}66`,
                  cursor:"default",
                }} />
              );
            })}
          </div>
          <div style={{ padding:"0 14px 10px", display:"flex", gap:"12px", flexWrap:"wrap" }}>
            {Object.entries(PASS_COLORS).filter(([p]) => changes.some(c => c.pass === p)).map(([pass, color]) => (
              <span key={pass} style={{ display:"flex", alignItems:"center", gap:"5px", fontFamily:"var(--font-mono)", fontSize:"9px", color:"var(--text3)" }}>
                <span style={{ width:10, height:10, borderRadius:"2px", background:color+"44", border:`1px solid ${color}`, display:"inline-block" }} />
                {pass}
              </span>
            ))}
            <span style={{ display:"flex", alignItems:"center", gap:"5px", fontFamily:"var(--font-mono)", fontSize:"9px", color:"var(--text3)" }}>
              <span style={{ width:10, height:10, borderRadius:"2px", background:"#ff537044", border:"1px solid #ff5370", display:"inline-block" }} />
              Removed
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Phase 6 — Code Generation ─────────────────────────────────────

const ASM_OP_COLORS = {
  ";":"#3a5070","FUNC_BEGIN":"#4d9fff","FUNC_END":"#4d9fff",
  "MOV":"#c792ea","LOAD":"#c792ea","STORE":"#c792ea",
  "PUSH":"#89ddff","POP":"#89ddff",
  "ADD":"#c3e88d","SUB":"#c3e88d","MUL":"#c3e88d","DIV":"#c3e88d","MOD":"#c3e88d","NEG":"#c3e88d",
  "CMP":"#ffcb6b","SETE":"#ffcb6b","SETNE":"#ffcb6b","SETL":"#ffcb6b","SETG":"#ffcb6b","SETLE":"#ffcb6b","SETGE":"#ffcb6b",
  "AND":"#f78c6c","OR":"#f78c6c","NOT":"#f78c6c","XOR":"#f78c6c",
  "JMP":"#f78c6c","JZ":"#f78c6c","JNZ":"#f78c6c",
  "CALL":"#22d3ee","RET":"#ff5370","PRINT":"#22d3ee","NOP":"#3a5070","LABEL":"#546e7a",
};

function CodeGenView({ data }) {
  const [tab, setTab] = useState("asm");
  const assembly = data.assembly || [];
  const tac      = data.optimized_tac || data.tac || [];
  console.log("CodeGenView assembly:", assembly?.length, assembly?.[5]);
  const [hoveredId, setHoveredId] = useState(null);
  const real = assembly.filter(i => i.op !== ";");
  const opCounts = {};
  assembly.forEach(i => { if (i.op !== ";") opCounts[i.op] = (opCounts[i.op] || 0) + 1; });

  return (
    <div className="phase-view">
      <div className="phase-header">
        <span className="phase-title">Target Assembly — VRM</span>
        <span className="phase-badge">{assembly.length} instructions</span>
        <span className="phase-badge">{real.length} real ops</span>
        <span className="phase-badge">R0 — R7 registers</span>
        <DownloadMenu options={[
          { label: "ASM",  onClick: () => downloadAssembly_ASM(assembly) },
          { label: "JSON", onClick: () => downloadAssembly_JSON(assembly) },
          { label: "CSV",  onClick: () => downloadAssembly_CSV(assembly) },
        ]} />
      </div>

      <TabBar
        tabs={[
          { id: "asm", label: "Assembly" },
          { id: "map", label: "TAC ↔ ASM Map" },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === "asm" && (
        <>
          <div className="token-legend">
            {["R0","R1","R2","R3","R4","R5","R6","R7"].map((r, i) => (
              <span key={r} className="legend-item">
                <span className="legend-dot" style={{ background: `hsl(${i * 45}, 70%, 60%)` }} />{r}
              </span>
            ))}
          </div>
          <div className="token-table-wrap">
            <table className="token-table">
              <thead><tr><th>#</th><th>Op</th><th>Assembly</th><th>DST</th><th>SRC1</th><th>SRC2</th></tr></thead>
              <tbody>
                {assembly.map((instr, i) => {
                  const color       = ASM_OP_COLORS[instr.op] || "#888";
                  const isComment   = instr.op === ";";
                  const isFuncBegin = instr.op === "FUNC_BEGIN";
                  const isFuncEnd   = instr.op === "FUNC_END";
                  const isRet       = instr.op === "RET";
                  const isJump      = ["JMP","JZ","JNZ"].includes(instr.op);
                  const isHovered   = hoveredId === instr.id;
                  return (
                    <tr key={i} className="token-row"
                      onMouseEnter={() => setHoveredId(instr.id)}
                      onMouseLeave={() => setHoveredId(null)}
                      style={{
                        background: isHovered ? "var(--bg4)" : isFuncBegin ? "rgba(77,159,255,0.08)" : isFuncEnd ? "rgba(77,159,255,0.05)" : isComment ? "transparent" : isRet ? "rgba(255,83,112,0.06)" : "",
                        opacity: isComment ? 0.5 : 1,
                      }}>
                      <td className="tok-idx" style={{ color: "var(--text3)" }}>{instr.id}</td>
                      <td>
                        {isComment ? (
                          <span style={{ color: "var(--text3)", fontFamily: "var(--font-mono)", fontSize: "10px" }}>;</span>
                        ) : (
                          <span className="tok-type-badge" style={{ background: color + "18", color, borderColor: color + "44", fontFamily: "var(--font-mono)" }}>{instr.op}</span>
                        )}
                      </td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "12px", color: isComment ? "var(--text3)" : isFuncBegin || isFuncEnd ? color : isRet ? "var(--red)" : isJump ? "var(--orange)" : "var(--text)", fontStyle: isComment ? "italic" : "normal" }}>
                        {instr.code.split("\\n").map((line, li) => (<div key={li}>{line}</div>))}
                      </td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: instr.dst?.startsWith("R") ? "#82aaff" : "var(--text2)" }}>{instr.dst || "—"}</td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: instr.src1?.startsWith("#") ? "var(--orange)" : instr.src1?.startsWith("R") ? "#82aaff" : "var(--text2)" }}>{instr.src1 || "—"}</td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: instr.src2?.startsWith("#") ? "var(--orange)" : instr.src2?.startsWith("R") ? "#82aaff" : "var(--text2)" }}>{instr.src2 || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px" }}>
            {[
              { label: "Total Instrs", value: assembly.length,                                                            color: "var(--accent)"  },
              { label: "MOV ops",      value: opCounts["MOV"]  || 0,                                                      color: "var(--purple)"  },
              { label: "Arithmetic",   value: (opCounts["ADD"]||0)+(opCounts["SUB"]||0)+(opCounts["MUL"]||0)+(opCounts["DIV"]||0), color: "var(--green)" },
              { label: "Jumps",        value: (opCounts["JMP"]||0)+(opCounts["JZ"]||0)+(opCounts["JNZ"]||0),              color: "var(--orange)"  },
              { label: "Comparisons",  value: opCounts["CMP"]  || 0,                                                      color: "var(--yellow)"  },
              { label: "RET calls",    value: opCounts["RET"]  || 0,                                                      color: "var(--red)"     },
            ].map(stat => (
              <div key={stat.label} style={{ background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: "12px 14px" }}>
                <div style={{ fontSize: "9px", color: "var(--text3)", fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "6px", fontFamily: "var(--font-mono)" }}>{stat.label}</div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: stat.color, fontFamily: "var(--font-mono)" }}>{stat.value}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "map" && <TACASMMapTab tac={tac} assembly={assembly} />}
    </div>
  );
}

// TAC ↔ ASM Mapping tab

function splitByFuncTAC(instructions) {
  const funcs = [];
  let current = null;
  for (const instr of instructions) {
    if (instr.op === "func_begin") {
      const name = instr.result || (instr.code || "").replace(/func_begin\s+/i, "").trim() || `func_${funcs.length}`;
      current = { name, instrs: [instr] };
      funcs.push(current);
    } else if (instr.op === "func_end") {
      if (current) { current.instrs.push(instr); current = null; }
    } else {
      if (!current) {
        current = { name: "(global)", instrs: [] };
        funcs.push(current);
      }
      current.instrs.push(instr);
    }
  }
  return funcs;
}

function splitByFuncASM(instructions) {
  const funcs = [];
  let current = null;
  for (const instr of instructions) {
    if (instr.op === "FUNC_BEGIN") {
      const name = instr.dst || (instr.code || "").replace(/FUNC_BEGIN\s+/i, "").trim() || `func_${funcs.length}`;
      current = { name, instrs: [instr] };
      funcs.push(current);
    } else if (instr.op === "FUNC_END") {
      if (current) { current.instrs.push(instr); current = null; }
    } else {
      if (!current) {
        current = { name: "(global)", instrs: [] };
        funcs.push(current);
      }
      current.instrs.push(instr);
    }
  }
  return funcs;
}

function TACASMMapTab({ tac, assembly }) {
  const tacFuncs = splitByFuncTAC(tac);
  const asmFuncs = splitByFuncASM(assembly);

  const pairs = tacFuncs.map(tf => ({
    name: tf.name,
    tac: tf.instrs,
    asm: asmFuncs.find(af => af.name === tf.name)?.instrs || [],
  }));
  asmFuncs.forEach(af => {
    if (!pairs.find(p => p.name === af.name)) {
      pairs.push({ name: af.name, tac: [], asm: af.instrs });
    }
  });

  if (pairs.length === 0) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "var(--text3)", fontFamily: "var(--font-mono)", fontSize: "12px" }}>
        No function-level TAC or ASM data available.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "10px", color: "var(--text3)", letterSpacing: "1px", textTransform: "uppercase", fontWeight: 700 }}>
        Grouped by function — TAC (IR) on left, Assembly (VRM) on right
      </div>
      {pairs.map((pair, i) => (
        <div key={i} style={{ background: "var(--bg2)", border: "1px solid var(--border2)", borderRadius: "var(--radius-lg)", overflow: "hidden" }}>
          {/* Function header */}
          <div style={{
            padding: "8px 14px", background: "rgba(77,159,255,0.08)",
            borderBottom: "1px solid var(--border)",
            display: "flex", alignItems: "center", gap: "10px",
          }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "#4d9fff", fontWeight: 700 }}>
              fn {pair.name}
            </span>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "9px", color: "var(--text3)" }}>
              {pair.tac.length} TAC instr{pair.tac.length !== 1 ? "s" : ""} → {pair.asm.length} ASM instr{pair.asm.length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Side-by-side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
            {/* TAC column */}
            <div style={{ borderRight: "1px solid var(--border)" }}>
              <div style={{ padding: "5px 12px", background: "var(--bg3)", fontSize: "9px", fontWeight: 700, letterSpacing: "1px", color: "#c792ea", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
                IR / TAC
              </div>
              {pair.tac.map((instr, j) => {
                const color = TAC_OP_COLORS[instr.op] || "#888";
                return (
                  <div key={j} style={{
                    padding: "4px 12px", fontFamily: "var(--font-mono)", fontSize: "10px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex", gap: "6px", alignItems: "center",
                  }}>
                    <span style={{ color: "var(--text3)", minWidth: "20px", fontSize: "9px" }}>{instr.id}</span>
                    <span style={{
                      fontSize: "8px", fontWeight: 700, minWidth: "48px",
                      padding: "1px 4px", borderRadius: "2px", textAlign: "center",
                      background: color + "15", color, border: `1px solid ${color}33`,
                      fontFamily: "var(--font-mono)", flexShrink: 0,
                    }}>
                      {instr.op}
                    </span>
                    <span style={{ color: "var(--text2)", fontSize: "10px", wordBreak: "break-all" }}>{instr.code}</span>
                  </div>
                );
              })}
              {pair.tac.length === 0 && (
                <div style={{ padding: "12px", color: "var(--text3)", fontFamily: "var(--font-mono)", fontSize: "10px", fontStyle: "italic" }}>No TAC.</div>
              )}
            </div>

            {/* ASM column */}
            <div>
              <div style={{ padding: "5px 12px", background: "var(--bg3)", fontSize: "9px", fontWeight: 700, letterSpacing: "1px", color: "#ff5370", fontFamily: "var(--font-mono)", textTransform: "uppercase" }}>
                Assembly (VRM)
              </div>
              {pair.asm.map((instr, j) => {
                const color = ASM_OP_COLORS[instr.op] || "#888";
                const isComment = instr.op === ";";
                return (
                  <div key={j} style={{
                    padding: "4px 12px", fontFamily: "var(--font-mono)", fontSize: "10px",
                    borderBottom: "1px solid var(--border)",
                    display: "flex", gap: "6px", alignItems: "center",
                    opacity: isComment ? 0.4 : 1,
                  }}>
                    <span style={{ color: "var(--text3)", minWidth: "20px", fontSize: "9px" }}>{instr.id}</span>
                    {!isComment && (
                      <span style={{
                        fontSize: "8px", fontWeight: 700, minWidth: "48px",
                        padding: "1px 4px", borderRadius: "2px", textAlign: "center",
                        background: color + "15", color, border: `1px solid ${color}33`,
                        fontFamily: "var(--font-mono)", flexShrink: 0,
                      }}>
                        {instr.op}
                      </span>
                    )}
                    <span style={{ color: isComment ? "var(--text3)" : "var(--text2)", fontSize: "10px", fontStyle: isComment ? "italic" : "normal", wordBreak: "break-all" }}>
                      {instr.code}
                    </span>
                  </div>
                );
              })}
              {pair.asm.length === 0 && (
                <div style={{ padding: "12px", color: "var(--text3)", fontFamily: "var(--font-mono)", fontSize: "10px", fontStyle: "italic" }}>No ASM.</div>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Coming soon placeholder ───────────────────────────────────────

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
