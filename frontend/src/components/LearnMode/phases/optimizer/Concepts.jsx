// src/components/LearnMode/phases/optimizer/Concepts.jsx
import React, { useMemo, useState } from "react";
import { codeBlock } from "../../shared/CardStyles";

const DEFAULT_CONCEPTS = [
  {
    term: "Constant folding",
    def: "Evaluate constant expressions at compile time",
    detail: "If both operands are constants, compute at compile time. Eliminates arithmetic that would otherwise run on every execution.",
    example: "BEFORE: t1 = 3 + 4\nAFTER:  t1 = 7",
    misconception: "",
  },
  {
    term: "Constant propagation",
    def: "Replace variables holding known constants",
    detail: "If a variable is assigned a constant and never reassigned, replace all uses with the constant. Often enables further folding.",
    example: "x = 5\nt1 = x + 3\n→ t1 = 5 + 3\n→ t1 = 8",
    misconception: "",
  },
  {
    term: "Dead code elimination",
    def: "Remove instructions whose results are never used",
    detail: "If a variable is assigned but its value is never read before being overwritten or the function ends, the assignment is dead and can be removed.",
    example: "t1 = x * 2  // t1 never used\n→ REMOVED",
    misconception: "Dead code does not only mean unreachable code. Reachable instructions can still be dead if their result is never consumed.",
  },
  {
    term: "Copy propagation",
    def: "Replace copy variables with the original",
    detail: "If x = y is a copy, later uses of x can become y directly. Often exposes dead code which elimination then removes.",
    example: "x = y\nt1 = x + 3\n→ t1 = y + 3\n// x assignment now dead",
    misconception: "",
  },
];

export default function OptConcepts({ phaseColor = "#f59e0b", data = {} }) {
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
              <button type="button" onClick={() => toggle(index)} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12 }}>
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
