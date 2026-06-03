// src/components/LearnMode/phases/semantic/Concepts.jsx
import React, { useMemo, useState } from "react";
import { codeBlock } from "../../shared/CardStyles";

const DEFAULT_CONCEPTS = [
  {
    term: "Symbol table",
    def: "Maps identifiers to type, scope, and attributes",
    detail: "Answers: Does this name exist? What type? Is it in scope? Built during semantic analysis, used by all later phases.",
    example: "{ name:'sum', kind:'variable',\n  type:'int', scope:1,\n  used:true, init:true }",
    misconception: "",
  },
  {
    term: "Type checking",
    def: "Verifies operations use compatible types",
    detail: "Every expression is checked. int+int is valid. string+int is a type error. Covers variables, function arguments, and return types.",
    example: "sum += i  →  int += int  ✅\nreturn 0  →  int = int  ✅",
    misconception: "Type checking covers more than just variables — it checks every expression and function call.",
  },
  {
    term: "Scope",
    def: "Region where a declared name is visible",
    detail: "C++ has nested scopes. Inner scopes can shadow outer ones without destroying them. A variable declared inside a function is only visible there.",
    example: "Global { main() { sum:int  i:int } }",
    misconception: "Inner scope variables do not overwrite outer ones. They shadow them — outer still exists, just unreachable.",
  },
  {
    term: "Semantic error",
    def: "Syntactically correct but meaningless program",
    detail: "Undeclared variables, wrong argument types, invalid returns all pass parsing but fail semantic analysis. They indicate logic mistakes.",
    example: "string x = 42;  // type error\nfoo();  // undeclared",
    misconception: "",
  },
];

export default function SemanticConcepts({ phaseColor = "#06b6d4", data = {} }) {
  const concepts = useMemo(() => (Array.isArray(data.concepts) && data.concepts.length ? data.concepts : DEFAULT_CONCEPTS), [data]);
  const [collapsed, setCollapsed] = useState(() => new Set());

  const toggle = (index) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, maxWidth: 1120 }}>
      {concepts.map((item, index) => {
        const isOpen = !collapsed.has(index);
        return (
          <section key={`${item.term}-${index}`} style={{ background: "#1e293b", border: "1px solid #2a3a55", borderRadius: 10, padding: 14, minHeight: 120 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <div style={{ color: phaseColor, fontWeight: 700, fontSize: 15 }}>{item.term}</div>
                <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isOpen ? "normal" : "nowrap" }}>{item.def}</div>
              </div>
              <button onClick={() => toggle(index)} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12 }}>
                {isOpen ? "▾ less" : "▾ more"}
              </button>
            </div>

            {isOpen && (
              <div style={{ marginTop: 12, color: "#cbd5e1", fontSize: 13, lineHeight: 1.55 }}>
                {item.example && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>Example</div>
                    <pre style={codeBlock}>{item.example}</pre>
                  </div>
                )}
                <div style={{ marginBottom: item.misconception ? 8 : 0 }}>{item.detail}</div>
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
