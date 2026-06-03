// src/components/LearnMode/phases/lexer/Concepts.jsx
import React, { useMemo, useState } from "react";
import { codeBlock } from "../../shared/CardStyles";

const DEFAULT_CONCEPTS = [
  { term: "Token", def: "An atomic lexical element produced by the lexer.", example: "int", detail: "A token includes type, value, and source position.", misconception: null },
  { term: "Lexeme", def: "The raw character sequence that forms a token.", example: "main", detail: "Lexeme is the exact text matched by a token pattern.", misconception: null },
  { term: "Pattern", def: "A regular expression describing a token.", example: "[a-zA-Z_][a-zA-Z0-9_]*", detail: "Patterns tell the lexer how to recognize tokens.", misconception: null },
  { term: "Lexical error", def: "An unrecognizable character sequence.", example: "@", detail: "Lexer reports errors when input doesn't match any pattern.", misconception: "Not every compile error is lexical — some are syntactic or semantic." },
  { term: "DFA", def: "Deterministic Finite Automaton used by the lexer.", example: "state graph", detail: "A DFA efficiently recognizes token patterns in linear time.", misconception: null },
  { term: "Whitespace handling", def: "Spaces and newlines are often ignored.", example: "   \n", detail: "Whitespace typically separates tokens and is skipped by the lexer.", misconception: null },
  { term: "Longest match rule", def: "Choose the longest matching token.", example: "<= vs <", detail: "Prevents splitting multi-char operators into smaller tokens.", misconception: null },
  { term: "Keyword priority", def: "Keywords recognized before identifiers.", example: "int", detail: "Keywords are reserved and matched before generic identifier patterns.", misconception: null },
  { term: "Token stream", def: "Ordered list of tokens emitted by the lexer.", example: "[INT, ID(x), OP(+)]", detail: "The parser consumes the token stream to build the AST.", misconception: null },
  { term: "Tokenization error recovery", def: "How the lexer continues after errors.", example: "skip invalid char", detail: "Strategies include skipping to next delimiter or aborting compilation.", misconception: null },
];

export default function LexerConcepts({ phaseColor, data = {} }) {
  const concepts = useMemo(() => (Array.isArray(data.concepts) && data.concepts.length ? data.concepts : DEFAULT_CONCEPTS), [data]);
  const [collapsed, setCollapsed] = useState(() => new Set());

  const toggle = (i) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, maxWidth: 1120 }}>
      {concepts.map((item, i) => {
        const isLastOdd = concepts.length % 2 === 1 && i === concepts.length - 1;
        const isOpen = !collapsed.has(i);
        return (
          <section key={item.term + i} style={{
            background: "#1e293b",
            border: "1px solid #2a3a55",
            borderRadius: 10,
            padding: 14,
            minHeight: 120,
            gridColumn: isLastOdd ? "1 / -1" : undefined,
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ color: phaseColor, fontWeight: 700, fontSize: 15 }}>{item.term}</div>
                <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isOpen ? "normal" : "nowrap" }}>{item.def}</div>
              </div>
              <button onClick={() => toggle(i)} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12 }}>{isOpen ? "▾ less" : "▾ more"}</button>
            </div>

            {isOpen && (
              <div style={{ marginTop: 12, color: "#cbd5e1" }}>
                {item.example && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>Example</div>
                    <pre style={codeBlock}>{item.example}</pre>
                  </div>
                )}
                <div style={{ marginBottom: 8 }}>{item.detail}</div>
                {item.misconception && (
                  <div style={{ background: "#3b2f14", border: "1px solid #6b5319", borderRadius: 8, padding: 10, color: "#f59e0b", fontSize: 13 }}>{item.misconception}</div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
