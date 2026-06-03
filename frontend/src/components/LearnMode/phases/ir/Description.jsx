// src/components/LearnMode/phases/ir/Description.jsx
import React, { useMemo } from "react";
import { cardBase, sectionLabel, bodyText } from "../../shared/CardStyles";

const OP_COLORS = {
  label: "#10b981",
  func_begin: "#06b6d4",
  func_end: "#06b6d4",
  ifnot: "#f59e0b",
  goto: "#f59e0b",
  "=": "#3b82f6",
  "+": "#10b981",
  "-": "#10b981",
  "*": "#10b981",
  "/": "#10b981",
  "%": "#10b981",
  return: "#ec4899",
  print: "#a855f7",
  call: "#a855f7",
  default: "#94a3b8",
};

function opOf(instruction) {
  const raw = instruction?.op || "";
  if (raw) return String(raw);
  const text = String(instruction?.instruction || "");
  if (/^\s*L\w+\s*:/.test(text)) return "label";
  if (/ifnot/i.test(text)) return "ifnot";
  if (/goto/i.test(text)) return "goto";
  if (/return/i.test(text)) return "return";
  if (/print/i.test(text)) return "print";
  if (/call/i.test(text)) return "call";
  if (/[+\-*/%]/.test(text)) return text.match(/[+\-*/%]/)?.[0] || "default";
  if (/=/.test(text)) return "=";
  return "default";
}

function opColor(instruction) {
  return OP_COLORS[opOf(instruction)] || OP_COLORS.default;
}

function formatInstr(instruction) {
  if (!instruction) return "No TAC instruction";
  if (instruction.instruction) return String(instruction.instruction);
  const op = opOf(instruction);
  if (op === "label") return `${instruction.result || instruction.arg1 || "L?"}:`;
  if (op === "func_begin") return `func_begin ${instruction.result || instruction.arg1 || ""}`.trim();
  if (op === "func_end") return `func_end ${instruction.result || instruction.arg1 || ""}`.trim();
  if (op === "ifnot") return `ifnot ${instruction.arg1 || ""} goto ${instruction.arg2 || instruction.result || ""}`.trim();
  if (op === "goto") return `goto ${instruction.arg1 || instruction.arg2 || instruction.result || ""}`.trim();
  if (op === "return") return `return ${instruction.arg1 || instruction.result || ""}`.trim();
  if (op === "print") return `print ${instruction.arg1 || instruction.result || ""}`.trim();
  if (op === "call") return `${instruction.result ? `${instruction.result} = ` : ""}call ${instruction.arg1 || ""}`.trim();
  if (instruction.result && instruction.arg1 && instruction.arg2) return `${instruction.result} = ${instruction.arg1} ${op} ${instruction.arg2}`;
  if (instruction.result && instruction.arg1) return `${instruction.result} = ${instruction.arg1}`;
  return [instruction.op, instruction.result, instruction.arg1, instruction.arg2].filter(Boolean).join(" ");
}

function valuesOf(instruction) {
  return [instruction?.result, instruction?.arg1, instruction?.arg2, instruction?.instruction].filter(Boolean).map(String);
}

function collectTemps(instructions) {
  const map = new Map();
  instructions.forEach((instruction, index) => {
    const text = valuesOf(instruction).join(" ");
    const temps = text.match(/\bt\d+\b/g) || [];
    temps.forEach((temp) => {
      if (!map.has(temp)) map.set(temp, []);
      map.get(temp).push({ index, instruction });
    });
  });
  return [...map.entries()].sort(([a], [b]) => Number(a.slice(1)) - Number(b.slice(1)));
}

function collectLabels(instructions) {
  const labels = new Map();
  instructions.forEach((instruction, index) => {
    const op = opOf(instruction);
    const text = formatInstr(instruction);
    const found = op === "label" ? [String(instruction.result || instruction.arg1 || text.replace(":", ""))] : text.match(/\bL\w+\b/g) || [];
    found.forEach((label) => {
      const clean = label.replace(":", "");
      if (!labels.has(clean)) labels.set(clean, []);
      labels.get(clean).push({ index, instruction });
    });
  });
  return [...labels.entries()].sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }));
}

function labelMeaning(label, entries) {
  const firstInstruction = entries[0]?.instruction;
  const firstText = formatInstr(firstInstruction).toLowerCase();
  if (/l1|loop|header/.test(label.toLowerCase()) || firstText.includes("condition")) return "loop header (entry point)";
  if (/l2|inc/.test(label.toLowerCase())) return "increment section";
  if (/l3|exit|end/.test(label.toLowerCase())) return "loop exit";
  return entries.some((entry) => opOf(entry.instruction) !== "label") ? "jump target" : "branch entry point";
}

export default function IrDescription({ phaseColor = "#10b981", irInstructions = [] }) {
  const temps = useMemo(() => collectTemps(irInstructions), [irInstructions]);
  const labels = useMemo(() => collectLabels(irInstructions), [irInstructions]);
  const stats = useMemo(() => {
    const ops = irInstructions.map(opOf);
    return [
      ["Instructions", irInstructions.length],
      ["Temporaries", temps.length],
      ["Labels", labels.length],
      ["Jumps", ops.filter((op) => op === "goto" || op === "ifnot").length],
      ["Arithmetic", ops.filter((op) => ["+", "-", "*", "/", "%"].includes(op)).length],
      ["Functions", ops.filter((op) => op === "func_begin").length],
    ];
  }, [irInstructions, temps.length, labels.length]);

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
          <div style={sectionLabel(phaseColor)}>Generated TAC</div>
          <div style={{ display: "grid", gap: 5, marginTop: 8 }}>
            {irInstructions.length ? irInstructions.slice(0, 30).map((instruction, index) => {
              const op = opOf(instruction);
              const color = opColor(instruction);
              const isLabel = op === "label";
              return (
                <div key={`${formatInstr(instruction)}-${index}`} style={{ display: "grid", gridTemplateColumns: "34px minmax(0, 1fr)", gap: 8, alignItems: "center", background: isLabel ? `${phaseColor}12` : "#111827", border: "1px solid #1f2937", borderLeft: `3px solid ${color}`, borderRadius: "0 6px 6px 0", padding: "7px 9px" }}>
                  <span style={{ color: "#64748b", fontFamily: "monospace", fontSize: 11, textAlign: "right" }}>{instruction.line ?? index + 1}</span>
                  <span style={{ color, fontFamily: "monospace", fontSize: 11, fontStyle: isLabel ? "italic" : "normal", wordBreak: "break-word" }}>{formatInstr(instruction)}</span>
                </div>
              );
            }) : <div style={bodyText}>No TAC instructions are available yet.</div>}
          </div>
        </section>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <section style={cardBase(phaseColor)}>
          <div style={sectionLabel(phaseColor)}>Temporaries used</div>
          <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
            {temps.length ? temps.map(([temp, entries]) => (
              <div key={temp} style={{ background: "#111827", borderLeft: `3px solid ${phaseColor}`, borderRadius: "0 8px 8px 0", padding: 12 }}>
                <div style={{ color: "#f8fafc", fontFamily: "monospace", fontWeight: 800 }}>{temp}</div>
                <div style={{ color: "#94a3b8", fontSize: 12, margin: "6px 0" }}>Used in {entries.length} instruction{entries.length === 1 ? "" : "s"}</div>
                <div style={{ display: "grid", gap: 4 }}>
                  {entries.slice(0, 3).map((entry) => (
                    <div key={`${temp}-${entry.index}`} style={{ color: "#cbd5e1", fontFamily: "monospace", fontSize: 11 }}>{formatInstr(entry.instruction)}</div>
                  ))}
                </div>
              </div>
            )) : <div style={bodyText}>No temporary values were required for this IR.</div>}
          </div>
        </section>

        <section style={cardBase(phaseColor)}>
          <div style={sectionLabel(phaseColor)}>Labels and jumps</div>
          <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
            {labels.length ? labels.map(([label, entries]) => (
              <div key={label} style={{ background: "#111827", borderLeft: `3px solid ${phaseColor}`, borderRadius: "0 8px 8px 0", padding: 12 }}>
                <div style={{ color: "#f8fafc", fontFamily: "monospace", fontWeight: 800 }}>{label} <span style={{ color: "#94a3b8", fontWeight: 400 }}>→ {labelMeaning(label, entries)}</span></div>
              </div>
            )) : <div style={bodyText}>No labels were created for this IR output.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
