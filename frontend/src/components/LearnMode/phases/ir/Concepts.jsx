// src/components/LearnMode/phases/ir/Concepts.jsx
import React, { useMemo, useState } from "react";
import { codeBlock } from "../../shared/CardStyles";

const DEFAULT_CONCEPTS = [
  {
    term: "TAC",
    def: "Three-Address Code with max 1 operator and 3 names",
    detail: "Complex expressions decomposed into simple instructions. Each instruction has result = arg1 op arg2. Easier to optimize than tree form.",
    example: "a + b * c  becomes:\nt1 = b * c\nt2 = a + t1\nx  = t2",
    misconception: "",
  },
  {
    term: "Temporary",
    def: "Compiler-generated variable for intermediate values",
    detail: "Named t1, t2, t3... Assigned exactly once. Later phases decide if they live in registers or memory, or get eliminated entirely.",
    example: "t1 = i <= 10\nifnot t1 goto L3\n// t1 is a temporary bool",
    misconception: "",
  },
  {
    term: "Label",
    def: "Named position in TAC for jumps and branches",
    detail: "Labels mark targets of goto and ifnot instructions. They enable structured control flow in flat TAC. Every loop and branch needs at least one label.",
    example: "L1:\n  t1 = i <= 10\n  ifnot t1 goto L3\n  ...\n  goto L1\nL3:",
    misconception: "",
  },
  {
    term: "Basic block",
    def: "Maximal TAC sequence with no jumps except at ends",
    detail: "Within a basic block execution is always sequential. Blocks start at labels or function entry. The CFG connects blocks with directed edges.",
    example: "B0: func_begin\nB1: L1 → condition\nB2: body\nB3: L3 → exit",
    misconception: "",
  },
];

export default function IrConcepts({ phaseColor = "#10b981", data = {} }) {
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
