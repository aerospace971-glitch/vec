// src/components/LearnMode/phases/lexer/Description.jsx
import React, { useMemo } from "react";
import { cardBase, sectionLabel, bodyText } from "../../shared/CardStyles";

const CATEGORY_COLORS = {
  IDENTIFIER: "#3b82f6",
  TYPE: "#8b5cf6",
  CONTROL: "#f59e0b",
  LITERAL: "#10b981",
  OPERATOR: "#f97316",
  DELIMITER: "#06b6d4",
  PUNCTUATION: "#ec4899",
  PREPROCESSOR: "#84cc16",
  TEMPLATE: "#f43f5e",
  MODIFIER: "#14b8a6",
  ASSIGNMENT: "#a78bfa",
  DEFAULT: "#6b7280",
};

const EXPLANATIONS = {
  IDENTIFIER: "User-defined names for variables, functions, and classes. Matched using [a-zA-Z_][a-zA-Z0-9_]*. These names are resolved later in the symbol table.",
  TYPE: "Built-in keywords like int, float, bool. Recognized before identifiers due to keyword priority. Tell the compiler what data type a variable holds.",
  CONTROL: "Flow keywords — if, else, for, while, return. Emitted as distinct tokens from identifiers. Parser uses them to build branch and loop AST nodes.",
  LITERAL: "Actual values — numbers and strings. Integer literals matched by [0-9]+, strings by \"[^\"]*\". Become constant nodes in the AST.",
  OPERATOR: "Operation symbols — arithmetic, comparison. Multi-character operators like <= matched as one token. Parser uses them to build expression nodes.",
  DELIMITER: "Bounding characters — ( ) { } [ ]. Each emitted as single-character token. Parser uses pairs to define blocks and calls.",
  PUNCTUATION: "Structural marks — ; : , Semicolons mark statement boundaries. Commas separate list items.",
  PREPROCESSOR: "Hash directives processed before compilation. Entire directive emitted as one token. Handled separately from the rest of compilation.",
  TEMPLATE: "Generic programming keywords — template, using. Recognized as distinct from identifiers. Trigger special parsing rules.",
  ASSIGNMENT: "Assignment operators — = += -= *= /= Compound tokens matched by longest match rule. Parser builds assignment expression nodes.",
  MODIFIER: "Qualifiers — const, static, virtual, inline. Recognized as keywords not identifiers. Modify how declarations are handled.",
  DEFAULT: "Other recognized token in your program.",
};

function groupByCategory(tokens) {
  return tokens.reduce((acc, t) => {
    const cat = (t.category || t.type || "DEFAULT").toUpperCase();
    acc[cat] = acc[cat] || [];
    acc[cat].push(t);
    return acc;
  }, {});
}

function groupByLine(tokens) {
  return tokens.reduce((acc, t) => {
    const ln = t.line || t.l || 1;
    acc[ln] = acc[ln] || [];
    acc[ln].push(t);
    return acc;
  }, {});
}

export default function LexerDescription({ phaseColor = "#3b82f6", tokens = [], sourceCode = "" }) {
  const cats = useMemo(() => groupByCategory(tokens), [tokens]);
  const byLine = useMemo(() => groupByLine(tokens), [tokens]);
  const sourceLines = (sourceCode || "").split("\n");
  const stats = useMemo(() => ({
    Identifiers: (cats.IDENTIFIER || []).length || 0,
    Literals: (cats.LITERAL || []).length || 0,
    Operators: (cats.OPERATOR || []).length || 0,
    Keywords: (cats.TYPE || cats.KEYWORD || []).length || 0,
    Delimiters: (cats.DELIMITER || []).length || 0,
    Punctuation: (cats.PUNCTUATION || []).length || 0,
  }), [cats]);

  const skipped = [];
  if ((cats.WHITESPACE || []).length) skipped.push("Whitespace");
  if ((cats.BLANK || []).length) skipped.push("Blank lines");
  if ((cats.COMMENT || []).length) skipped.push("Comments");

  return (
    <div style={{ display: "grid", gridTemplateColumns: "42% 58%", gap: 16, maxWidth: 1120 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <section style={{ ...cardBase(phaseColor), borderLeft: `3px solid ${phaseColor}` }}>
          <div style={sectionLabel(phaseColor)}>Summary</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 8 }}>
            {[
              ["Identifiers", stats.Identifiers],
              ["Literals", stats.Literals],
              ["Operators", stats.Operators],
              ["Keywords", stats.Keywords],
              ["Delimiters", stats.Delimiters],
              ["Punctuation", stats.Punctuation],
            ].map(([label, value]) => (
              <div key={label} style={{ background: "#0f172a", border: "1px solid #1f2937", padding: 10, borderRadius: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{label}</div>
                <div style={{ fontFamily: "monospace", color: phaseColor, fontWeight: 800, fontSize: 18 }}>{value}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={cardBase(phaseColor)}>
          <div style={sectionLabel(phaseColor)}>Your code line by line</div>
          <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
            {sourceLines.map((text, idx) => {
              const ln = idx + 1;
              const toks = byLine[ln] || [];
              return (
                <div key={ln} style={{ background: "#111827", borderRadius: 6, padding: "8px 10px" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{ width: 44, textAlign: "right", color: "#64748b", fontFamily: "monospace", fontSize: 14 }}>{ln}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: "monospace", color: "#e2e8f0", fontSize: 12, whiteSpace: "pre-wrap" }}>{text || ""}</div>
                      <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                        {toks.map((t, i) => {
                          const cat = (t.category || t.type || "DEFAULT").toUpperCase();
                          const color = CATEGORY_COLORS[cat] || CATEGORY_COLORS.DEFAULT;
                          return (
                            <div key={i} title={`${cat} · ${t.value} · L${t.line}:${t.col ?? t.column ?? "?"}`} style={{ background: "#0b1220", border: `1px solid ${color}`, color: color, padding: "4px 8px", borderRadius: 999, fontSize: 10, fontFamily: "monospace" }}>{`${cat} · ${String(t.value).slice(0, 18)}`}</div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {Object.keys(cats).length ? Object.entries(cats).map(([cat, items]) => {
          const category = cat.toUpperCase();
          const color = CATEGORY_COLORS[category] || CATEGORY_COLORS.DEFAULT;
          const pattern = (items[0] && (items[0].pattern || items[0].regex)) || "(pattern unavailable)";
          const found = items.slice(0, 6).map(i => i.value ?? i.text ?? i.name ?? "");
          return (
            <section key={category} style={{ background: "#1e293b", borderRadius: 8, padding: 12, borderLeft: `3px solid ${color}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontFamily: "monospace", fontSize: 11, color: color, textTransform: "uppercase", fontWeight: 700 }}>{category}</div>
                <div style={{ background: "#0f172a", padding: "4px 8px", borderRadius: 999, fontFamily: "monospace", color }}>{items.length} tokens</div>
              </div>
              <div style={{ height: 8, borderBottom: "1px solid #111827", margin: "8px 0" }} />
              <div style={{ fontFamily: "monospace", color: "#94a3b8", fontSize: 11 }}>Pattern: <span style={{ color: "#94a3b8" }}>{pattern}</span></div>
              <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>{found.map((f, i) => <div key={i} style={{ padding: "6px 8px", background: "#0b1220", borderRadius: 8, color, fontFamily: "monospace", fontSize: 12 }}>{String(f)}</div>)}</div>
              <div style={{ marginTop: 10, color: "#cbd5e1", fontSize: 12 }}>{EXPLANATIONS[category] || EXPLANATIONS.DEFAULT}</div>
            </section>
          );
        }) : (
          <section style={cardBase(phaseColor)}>
            <div style={sectionLabel(phaseColor)}>No categories yet</div>
            <div style={bodyText}>Run the lexer to populate category cards.</div>
          </section>
        )}

        <section style={{ background: "#1e293b", borderRadius: 8, padding: 12, borderLeft: "3px solid #374151" }}>
          <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 700 }}>The lexer skipped:</div>
          <div style={{ marginTop: 8, color: "#cbd5e1" }}>{skipped.length ? skipped.join(", ") : "Whitespace, Blank lines, Comments"}</div>
          <div style={{ marginTop: 8, color: "#94a3b8" }}>These carry no semantic meaning.</div>
        </section>
      </div>
    </div>
  );
}
