// src/components/LearnMode/phases/codegen/Concepts.jsx
import React, { useMemo, useState } from "react";
import { codeBlock } from "../../shared/CardStyles";

const DEFAULT_CONCEPTS = [
  {
    term: "Register allocation",
    def: "Assign variables to CPU registers for fast access",
    detail: "Registers are fastest memory — 1 cycle vs 100+ for main memory. The code generator assigns temporaries and variables to R0-R7, spilling to stack when full.",
    example: "sum → R3\ni   → R4\nt1  → R5\n// 3 of 8 registers used",
    misconception: "",
  },
  {
    term: "Instruction selection",
    def: "Choose machine instructions for each TAC operation",
    detail: "Each TAC op maps to one or more VRM instructions. TAC 'x = a + b' becomes MOV Rx, Ra then ADD Rx, Rb. The selector picks the most efficient sequence.",
    example: "= sum 0    →  MOV R3, #0\n+ sum sum i →  ADD R3, R4",
    misconception: "",
  },
  {
    term: "Spilling",
    def: "Store register to memory when all registers are full",
    detail: "When all 8 registers are occupied and a new value needs one, a register is evicted to the stack. Spilling is expensive and good allocation minimizes it.",
    example: "PUSH R3  ; save R3 to stack\n; use R3 for new value\nPOP R3   ; restore",
    misconception: "",
  },
  {
    term: "Prologue/Epilogue",
    def: "Code emitted at function entry and exit",
    detail: "Prologue: PUSH RBP, MOV RBP RSP — saves frame. Epilogue: restore registers, RET — returns to caller. This bookkeeping prevents functions corrupting each other.",
    example: "FUNC_BEGIN:\n  PUSH RBP\n  MOV RBP, RSP\n  ...\nFUNC_END:\n  POP RBP\n  RET",
    misconception: "",
  },
];

export default function CodegenConcepts({ phaseColor = "#ef4444", data = {} }) {
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
