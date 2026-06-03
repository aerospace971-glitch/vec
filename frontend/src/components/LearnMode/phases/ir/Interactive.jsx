// src/components/LearnMode/phases/ir/Interactive.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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

const panelStyle = (phaseColor) => ({
  ...cardBase(phaseColor),
  marginBottom: 0,
  display: "flex",
  flexDirection: "column",
  overflow: "visible",
});

const controlButton = (active, phaseColor) => ({
  border: `1px solid ${active ? phaseColor : "#2a3a55"}`,
  borderRadius: 8,
  padding: "8px 12px",
  background: active ? `${phaseColor}22` : "#0f172a",
  color: active ? "#f8fafc" : "#cbd5e1",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
  whiteSpace: "nowrap",
});

function flattenAst(node, out = [], depth = 0) {
  if (!node) return out;
  out.push({ ...node, depth });
  (node.children || []).forEach((child) => flattenAst(child, out, depth + 1));
  return out;
}

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

function instrExplanation(instruction) {
  const op = opOf(instruction);
  if (op === "func_begin") return "A new function scope starts here. The IR generator emits prologue code. All subsequent instructions belong to this function.";
  if (op === "label") return "This label marks a position other instructions can jump to. It enables loops and branches in flat TAC.";
  if (op === "=") return "This assignment copies a value. The result variable now holds the value of arg1. No arithmetic is performed.";
  if (["+", "-", "*", "/", "%"].includes(op)) return "This arithmetic instruction computes arg1 op arg2 and stores the result in a temporary variable.";
  if (op === "ifnot") return "If the condition in arg1 is false, execution jumps to the label in arg2. This implements if/while.";
  if (op === "goto") return "Unconditional jump to the target label. Used for loop-back edges and else-skip jumps.";
  if (op === "return") return "Function returns the value in arg1. Control transfers back to the caller.";
  return "This TAC instruction was generated from the corresponding AST node.";
}

function breakdown(instruction) {
  const op = opOf(instruction);
  if (!instruction || instruction.instruction) {
    return `Instruction → ${formatInstr(instruction)}`;
  }
  if (instruction.result && instruction.arg1 && instruction.arg2) return `${instruction.result} → ${instruction.arg1} ${op} ${instruction.arg2}`;
  if (instruction.result && instruction.arg1) return `${instruction.result} → ${instruction.arg1}`;
  if (op === "ifnot") return `branch → ${instruction.arg1 || "cond"} false goto ${instruction.arg2 || instruction.result || "label"}`;
  if (op === "goto") return `jump → ${instruction.arg1 || instruction.arg2 || instruction.result || "label"}`;
  return `Operation → ${op}`;
}

function createdTemporary(instruction) {
  const result = String(instruction?.result || "");
  const match = result.match(/^t\d+$/);
  return match ? match[0] : "";
}

function nodeValue(node) {
  return node?.value ?? node?.name ?? node?.operator ?? node?.dataType ?? "";
}

export default function IrInteractive({ phaseColor = "#10b981", irInstructions = [], astData = null }) {
  const [mode, setMode] = useState("full");
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(700);
  const timerRef = useRef(null);

  const astNodes = useMemo(() => flattenAst(astData || null), [astData]);
  const steps = useMemo(() => (Array.isArray(irInstructions) && irInstructions.length ? irInstructions : [{ op: "none", instruction: "No IR generated" }]), [irInstructions]);
  const currentIndex = Math.min(currentStep, steps.length - 1);
  const current = steps[currentIndex];
  const history = steps.slice(Math.max(0, currentIndex - 3), currentIndex);
  const preview = steps.slice(currentIndex + 1, currentIndex + 3);
  const progressPercent = steps.length ? ((currentIndex + 1) / steps.length) * 100 : 0;
  const tempCreated = createdTemporary(current);

  useEffect(() => {
    if (!playing) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return undefined;
    }

    timerRef.current = setInterval(() => {
      setCurrentStep((step) => {
        if (step >= steps.length - 1) {
          setPlaying(false);
          return step;
        }
        return step + 1;
      });
    }, speed);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [playing, speed, steps.length]);

  useEffect(() => {
    if (mode !== "step") return;
    document.getElementById(`step-item-${currentIndex}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentIndex, mode]);

  const goPrev = () => {
    setPlaying(false);
    setCurrentStep((step) => Math.max(0, step - 1));
  };

  const goNext = () => {
    setPlaying(false);
    setCurrentStep((step) => Math.min(steps.length - 1, step + 1));
  };

  const reset = () => {
    setPlaying(false);
    setCurrentStep(0);
  };

  const renderTacList = (stepMode) => (
    <section style={panelStyle(phaseColor)}>
      <div style={sectionLabel(phaseColor)}>TAC instructions</div>
      <div style={{ height: "auto", overflow: "visible", display: "grid", alignContent: "start", gap: 6, paddingRight: 4 }}>
        {steps.map((instruction, index) => {
          const op = opOf(instruction);
          const color = opColor(instruction);
          const isCurrent = stepMode && index === currentIndex;
          const isLabel = op === "label";
          const opacity = !stepMode ? 1 : index < currentIndex ? 0.45 : isCurrent ? 1 : 0.7;
          return (
            <div id={stepMode && isCurrent ? `step-item-${currentIndex}` : undefined} key={`${formatInstr(instruction)}-${index}`} style={{ display: "grid", gridTemplateColumns: "34px minmax(0, 1fr)", gap: 8, alignItems: "center", background: isCurrent ? `${phaseColor}28` : isLabel ? `${phaseColor}12` : "#111827", border: `1px solid ${isCurrent ? phaseColor : "#2a3a55"}`, borderLeft: `3px solid ${color}`, borderRadius: "0 8px 8px 0", opacity, padding: "8px 10px" }}>
              <span style={{ color: "#64748b", fontFamily: "monospace", fontSize: 11, textAlign: "right" }}>{instruction.line ?? index + 1}</span>
              <span style={{ color: isCurrent ? "#f8fafc" : color, fontFamily: "monospace", fontSize: 12, fontStyle: isLabel ? "italic" : "normal", wordBreak: "break-word" }}>{formatInstr(instruction)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 1120 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", gap: 6, padding: 4, background: "#0f172a", border: "1px solid #2a3a55", borderRadius: 8 }}>
          <button type="button" onClick={() => setMode("full")} style={controlButton(mode === "full", phaseColor)}>Full View</button>
          <button type="button" onClick={() => setMode("step")} style={controlButton(mode === "step", phaseColor)}>Step by Step</button>
        </div>
        <div style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>{steps.length} TAC instructions</div>
      </div>

      {mode === "full" ? (
        <div style={{ height: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, minHeight: 600 }}>
          <section style={panelStyle(phaseColor)}>
            <div style={sectionLabel(phaseColor)}>AST nodes</div>
            <div style={{ height: "auto", overflow: "visible", display: "grid", alignContent: "start", gap: 6, paddingRight: 4 }}>
              {astNodes.length ? astNodes.map((node, index) => (
                <div key={`${node.type}-${index}-${nodeValue(node)}`} style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: (node.depth || 0) * 18, minHeight: 28, fontFamily: "monospace" }}>
                  <span style={{ color: "#475569", width: 22 }}>{node.depth ? "└─" : ""}</span>
                  <span style={{ color: "#e2e8f0", fontSize: 12 }}>{node.type || "Node"}</span>
                  {nodeValue(node) && <span style={{ color: "#94a3b8", fontSize: 12 }}>→ {nodeValue(node)}</span>}
                </div>
              )) : <div style={bodyText}>No AST nodes are available for IR generation.</div>}
            </div>
          </section>
          {renderTacList(false)}
        </div>
      ) : (
        <>
          <div style={{ ...cardBase(phaseColor), marginBottom: 0, padding: 12, position: "sticky", top: 108, zIndex: 9, background: "#111827", paddingBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setPlaying((value) => !value)} style={controlButton(playing, phaseColor)}>{playing ? "⏸ Pause" : "▶ Play"}</button>
              <button type="button" onClick={goNext} style={controlButton(false, phaseColor)}>⏭ Next</button>
              <button type="button" onClick={goPrev} style={controlButton(false, phaseColor)}>⏮ Prev</button>
              <button type="button" onClick={reset} style={controlButton(false, phaseColor)}>↺ Reset</button>
              <span style={{ color: "#cbd5e1", fontSize: 13, fontWeight: 700, marginLeft: 4 }}>Step {currentIndex + 1} of {steps.length}</span>
              <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 12 }}>
                Speed
                <input type="range" min={250} max={2000} step={50} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
                <span style={{ width: 58, fontFamily: "monospace" }}>{speed} ms</span>
              </label>
            </div>
            <div style={{ height: 4, background: "#0b1220", borderRadius: 999, overflow: "hidden", marginTop: 10 }}>
              <div style={{ width: `${progressPercent}%`, height: "100%", background: phaseColor, transition: "width 160ms ease" }} />
            </div>
          </div>

          <div style={{ height: "auto", display: "grid", gridTemplateColumns: "48% 52%", gap: 18, minHeight: 600 }}>
            {renderTacList(true)}

            <section style={panelStyle(phaseColor)}>
              <div style={sectionLabel(phaseColor)}>Current instruction</div>
              <div style={{ height: "auto", overflow: "visible", paddingRight: 4 }}>
                <div style={{ border: `2px solid ${phaseColor}`, borderRadius: 8, background: "#0f172a", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <span style={{ background: `${opColor(current)}22`, border: `1px solid ${opColor(current)}`, borderRadius: 999, color: opColor(current), fontFamily: "monospace", fontSize: 12, fontWeight: 800, padding: "5px 10px" }}>{opOf(current).toUpperCase()}</span>
                    <span style={{ color: "#94a3b8", fontSize: 12 }}>Step {currentIndex + 1} of {steps.length}</span>
                  </div>
                  <div style={{ color: "#ffffff", fontFamily: "monospace", fontSize: 16, lineHeight: 1.5, wordBreak: "break-word" }}>{formatInstr(current)}</div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>Result → Arg1 op Arg2 breakdown</div>
                  <div style={{ color: phaseColor, background: `${phaseColor}18`, border: `1px solid ${phaseColor}55`, borderRadius: 8, fontFamily: "monospace", fontSize: 12, padding: "8px 10px" }}>{breakdown(current)}</div>

                  <div style={{ borderTop: "1px solid #243247" }} />
                  <div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>What this instruction does:</div>
                    <div style={{ ...bodyText, margin: 0 }}>{instrExplanation(current)}</div>
                  </div>

                  {tempCreated && (
                    <div style={{ color: phaseColor, background: `${phaseColor}18`, border: `1px solid ${phaseColor}66`, borderRadius: 8, padding: "9px 10px", fontFamily: "monospace", fontSize: 12 }}>
                      Creating {tempCreated}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                  <div>
                    <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>History</div>
                    <div style={{ display: "grid", gap: 7 }}>
                      {history.length ? history.map((instruction, index) => (
                        <div key={`${formatInstr(instruction)}-${index}`} style={{ opacity: 0.55, color: "#cbd5e1", fontFamily: "monospace", fontSize: 12 }}>{formatInstr(instruction)}</div>
                      )) : <div style={{ color: "#64748b", fontSize: 12 }}>No earlier TAC instructions.</div>}
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Next</div>
                    <div style={{ display: "grid", gap: 7 }}>
                      {preview.length ? preview.map((instruction, index) => (
                        <div key={`${formatInstr(instruction)}-${index}`} style={{ opacity: 0.65, color: "#cbd5e1", fontFamily: "monospace", fontSize: 12, fontStyle: "italic" }}>{formatInstr(instruction)}</div>
                      )) : <div style={{ color: "#64748b", fontSize: 12, fontStyle: "italic" }}>No upcoming IR instructions.</div>}
                    </div>
                  </div>

                  <div style={{ borderLeft: `3px solid ${phaseColor}`, background: `${phaseColor}20`, borderRadius: "0 8px 8px 0", padding: 12 }}>
                    <div style={{ color: "#bbf7d0", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>What is happening:</div>
                    <div style={{ ...bodyText, margin: 0 }}>
                      IR generation is lowering structured AST meaning into flat TAC. This form is easier for optimization and code generation to scan, reorder, and translate.
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
