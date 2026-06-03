// src/components/LearnMode/phases/codegen/Description.jsx
import React, { useMemo } from "react";
import { cardBase, sectionLabel, bodyText } from "../../shared/CardStyles";

const ASM_COLORS = {
  FUNC_BEGIN: "#06b6d4",
  FUNC_END: "#06b6d4",
  MOV: "#3b82f6",
  ADD: "#10b981",
  SUB: "#10b981",
  MUL: "#10b981",
  DIV: "#10b981",
  CMP: "#f59e0b",
  PUSH: "#a855f7",
  POP: "#a855f7",
  CALL: "#f97316",
  RET: "#ec4899",
  DEFAULT: "#94a3b8",
};

function asmText(instr) {
  if (!instr) return "";
  if (typeof instr === "string") return instr;
  return instr.assembly || instr.asm || instr.code || [instr.op, instr.dst, instr.src1, instr.src2].filter(Boolean).join(" ");
}

function tacText(instr) {
  if (!instr) return "";
  if (typeof instr === "string") return instr;
  return instr.instruction || instr.tac || instr.code || [instr.op, instr.result, instr.arg1, instr.arg2].filter(Boolean).join(" ");
}

function asmOp(instr) {
  const raw = instr?.op || String(asmText(instr)).trim().split(/\s+/)[0] || "DEFAULT";
  return String(raw).replace(":", "").toUpperCase();
}

function asmColor(instr) {
  const op = asmOp(instr);
  if (/^L\w+/.test(op) || op.startsWith(";")) return "#6b7280";
  return ASM_COLORS[op] || ASM_COLORS.DEFAULT;
}

function isLabelOrComment(instr) {
  const text = asmText(instr).trim();
  return /^L\w+:/.test(text) || text.startsWith(";") || text.startsWith("//");
}

function registersFrom(instructions) {
  const used = new Set();
  instructions.forEach((instr) => {
    asmText(instr).match(/\bR[0-7]\b/g)?.forEach((reg) => used.add(reg));
    [instr?.dst, instr?.src1, instr?.src2].filter(Boolean).forEach((value) => {
      if (/^R[0-7]$/.test(String(value))) used.add(String(value));
    });
  });
  return used;
}

function findFunctions(instructions) {
  const funcs = [];
  instructions.forEach((instr, index) => {
    const op = asmOp(instr);
    const text = asmText(instr);
    if (op === "FUNC_BEGIN" || /^FUNC_BEGIN/i.test(text)) {
      const name = instr.name || instr.dst || instr.src1 || text.split(/\s+/)[1] || "main";
      funcs.push({ name, index, text });
    }
  });
  return funcs;
}

export default function CodegenDescription({ phaseColor = "#ef4444", asmInstructions = [], irInstructions = [] }) {
  const usedRegisters = useMemo(() => registersFrom(asmInstructions), [asmInstructions]);
  const functions = useMemo(() => findFunctions(asmInstructions), [asmInstructions]);
  const stats = useMemo(() => {
    const ops = asmInstructions.map(asmOp);
    return [
      ["Instructions", asmInstructions.length],
      ["Registers", usedRegisters.size],
      ["Functions", functions.length],
      ["MOV ops", ops.filter((op) => op === "MOV").length],
      ["PUSH/POP", ops.filter((op) => op === "PUSH" || op === "POP").length],
      ["Calls", ops.filter((op) => op === "CALL").length],
    ];
  }, [asmInstructions, usedRegisters.size, functions.length]);

  return (
    <div style={{ display: "grid", gridTemplateColumns: "42% 58%", gap: 16, maxWidth: 1120 }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <section style={{ ...cardBase(phaseColor), borderLeft: `3px solid ${phaseColor}` }}>
          <div style={sectionLabel(phaseColor)}>Summary</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 8 }}>
            {stats.map(([label, value]) => (
              <div key={label} style={{ background: "#0f172a", border: "1px solid #1f2937", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ color: "#94a3b8", fontSize: 11 }}>{label}</div>
                <div style={{ color: phaseColor, fontFamily: "monospace", fontWeight: 800, fontSize: 18 }}>{value}</div>
              </div>
            ))}
          </div>
        </section>

        <section style={cardBase(phaseColor)}>
          <div style={sectionLabel(phaseColor)}>TAC to assembly mapping</div>
          <div style={{ background: "#111827", border: "1px solid #2a3a55", borderRadius: 8, overflow: "hidden", marginTop: 8 }}>
            {irInstructions.length ? irInstructions.slice(0, 15).map((ir, index) => {
              const asm = asmInstructions[index];
              return (
                <div key={`${tacText(ir)}-${index}`} style={{ display: "grid", gridTemplateColumns: "1fr 20px 1fr", gap: 8, alignItems: "center", padding: "8px 10px", borderBottom: index === Math.min(irInstructions.length, 15) - 1 ? "none" : "1px solid #1f2937" }}>
                  <span style={{ color: "#94a3b8", fontFamily: "monospace", fontSize: 10, wordBreak: "break-word" }}>{tacText(ir)}</span>
                  <span style={{ color: phaseColor, textAlign: "center", fontWeight: 900 }}>→</span>
                  <span style={{ color: phaseColor, fontFamily: "monospace", fontSize: 10, wordBreak: "break-word" }}>{asmText(asm) || "<pending>"}</span>
                </div>
              );
            }) : <div style={{ ...bodyText, padding: 10 }}>No TAC-to-ASM mapping is available yet.</div>}
          </div>
        </section>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <section style={cardBase(phaseColor)}>
          <div style={sectionLabel(phaseColor)}>Register allocation</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(0, 1fr))", gap: 8, marginTop: 8 }}>
            {Array.from({ length: 8 }, (_, index) => `R${index}`).map((reg) => {
              const used = usedRegisters.has(reg);
              return (
                <div key={reg} style={{ background: used ? `${phaseColor}20` : "#111827", border: `1px solid ${used ? phaseColor : "#2a3a55"}`, borderRadius: 8, color: used ? phaseColor : "#4a6080", fontFamily: "monospace", fontSize: 12, fontWeight: 800, padding: "10px 0", textAlign: "center" }}>
                  {reg}
                </div>
              );
            })}
          </div>
          <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 10 }}>{usedRegisters.size} of 8 registers used</div>
        </section>

        <section style={cardBase(phaseColor)}>
          <div style={sectionLabel(phaseColor)}>Function prologues</div>
          <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
            {functions.length ? functions.map((func) => (
              <div key={`${func.name}-${func.index}`} style={{ background: "#111827", borderLeft: `3px solid ${phaseColor}`, borderRadius: "0 8px 8px 0", padding: 12 }}>
                <div style={{ color: "#f8fafc", fontFamily: "monospace", fontWeight: 800 }}>{func.name}()</div>
                <div style={{ color: phaseColor, fontFamily: "monospace", fontSize: 12, marginTop: 7 }}>FUNC_BEGIN → PUSH RBP, MOV RBP RSP</div>
                <div style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.55, marginTop: 7 }}>Saves current stack frame and sets up a new one for this function call.</div>
              </div>
            )) : <div style={bodyText}>No function prologues were detected yet.</div>}
          </div>
        </section>

        <section style={cardBase(phaseColor)}>
          <div style={sectionLabel(phaseColor)}>Full assembly output</div>
          <div style={{ display: "grid", gap: 5, marginTop: 8, height: "auto", overflow: "visible" }}>
            {asmInstructions.length ? asmInstructions.map((instr, index) => {
              const color = asmColor(instr);
              return (
                <div key={`${asmText(instr)}-${index}`} style={{ display: "grid", gridTemplateColumns: "34px minmax(0, 1fr)", gap: 8, background: "#111827", border: "1px solid #1f2937", borderLeft: `3px solid ${color}`, borderRadius: "0 6px 6px 0", padding: "7px 9px" }}>
                  <span style={{ color: "#64748b", fontFamily: "monospace", fontSize: 11, textAlign: "right" }}>{instr.line ?? index + 1}</span>
                  <span style={{ color, fontFamily: "monospace", fontSize: 11, fontStyle: isLabelOrComment(instr) ? "italic" : "normal", wordBreak: "break-word" }}>{asmText(instr)}</span>
                </div>
              );
            }) : <div style={bodyText}>No assembly output is available yet.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
