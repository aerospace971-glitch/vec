// src/components/LearnMode/phases/codegen/Interactive.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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

function asmExplanation(op) {
  if (op === "MOV") return "Copies a value into a register. Could load a constant, copy from another register, or load from memory. The most common VRM instruction.";
  if (["ADD", "SUB", "MUL", "DIV"].includes(op)) return "Performs arithmetic on two registers or a register and constant. Stores result in the destination register.";
  if (op === "PUSH") return "Saves a register value to the stack memory. Used before function calls to preserve register state. Stack pointer SP decrements by one.";
  if (op === "POP") return "Restores a previously saved register from stack. Used after function calls to recover register state. Stack pointer SP increments by one.";
  if (op === "CALL") return "Jumps to the target function, pushing the return address to the stack. Arguments were already PUSHed.";
  if (op === "RET") return "Returns from current function. Pops return address from stack and jumps to it. Restores caller context.";
  if (op === "CMP") return "Compares two values by subtraction without storing result. Sets condition flags used by conditional jumps.";
  return "This VRM instruction performs a specific operation as part of the generated assembly.";
}

function registerState(instr) {
  if (instr?.registers && typeof instr.registers === "object") return instr.registers;
  const state = {};
  const text = asmText(instr);
  text.match(/\bR[0-7]\b/g)?.forEach((reg) => {
    state[reg] = true;
  });
  [instr?.dst, instr?.src1, instr?.src2].filter(Boolean).forEach((value) => {
    if (/^R[0-7]$/.test(String(value))) state[String(value)] = true;
  });
  return state;
}

function normalizeSteps(asmInstructions, irInstructions) {
  if (asmInstructions.length) {
    return asmInstructions.map((asm, index) => ({
      asm,
      tac: irInstructions[index] || asm.tac || asm.source || null,
      registers: registerState(asm),
    }));
  }
  return irInstructions.map((ir) => ({ asm: { op: "ASM", assembly: "<assembly not generated>" }, tac: ir, registers: {} }));
}

function renderRegisterGrid(registers, phaseColor) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(8, minmax(0, 1fr))", gap: 6 }}>
      {Array.from({ length: 8 }, (_, index) => `R${index}`).map((reg) => {
        const active = Boolean(registers?.[reg]);
        return (
          <div key={reg} style={{ background: active ? `${phaseColor}20` : "#111827", border: `1px solid ${active ? phaseColor : "#2a3a55"}`, borderRadius: 6, color: active ? phaseColor : "#4a6080", fontFamily: "monospace", fontSize: 11, fontWeight: 800, padding: "7px 0", textAlign: "center" }}>
            {reg}
          </div>
        );
      })}
    </div>
  );
}

export default function CodegenInteractive({ phaseColor = "#ef4444", asmInstructions = [], irInstructions = [] }) {
  const [mode, setMode] = useState("full");
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(700);
  const timerRef = useRef(null);

  const steps = useMemo(() => {
    const normalized = normalizeSteps(asmInstructions, irInstructions);
    return normalized.length ? normalized : [{ asm: { op: "NONE", assembly: "No assembly generated" }, tac: { instruction: "No TAC available" }, registers: {} }];
  }, [asmInstructions, irInstructions]);

  const currentIndex = Math.min(currentStep, steps.length - 1);
  const current = steps[currentIndex];
  const currentOp = asmOp(current.asm);
  const history = steps.slice(Math.max(0, currentIndex - 3), currentIndex);
  const preview = steps.slice(currentIndex + 1, currentIndex + 3);
  const progressPercent = steps.length ? ((currentIndex + 1) / steps.length) * 100 : 0;

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
        {steps.map((step, index) => {
          const isCurrent = stepMode && index === currentIndex;
          const opacity = !stepMode ? 1 : index < currentIndex ? 0.45 : isCurrent ? 1 : 0.7;
          const color = asmColor(step.asm);
          return (
            <div id={stepMode && isCurrent ? `step-item-${currentIndex}` : undefined} key={`${tacText(step.tac)}-${index}`} style={{ display: "grid", gridTemplateColumns: "34px minmax(0, 1fr)", gap: 8, background: isCurrent ? `${phaseColor}28` : "#111827", border: `1px solid ${isCurrent ? phaseColor : "#2a3a55"}`, borderLeft: `3px solid ${color}`, borderRadius: "0 8px 8px 0", opacity, padding: "8px 10px" }}>
              <span style={{ color: "#64748b", fontFamily: "monospace", fontSize: 11, textAlign: "right" }}>{index + 1}</span>
              <span style={{ color: isCurrent ? "#f8fafc" : "#cbd5e1", fontFamily: "monospace", fontSize: 12, wordBreak: "break-word" }}>{tacText(step.tac) || "<tac>"}</span>
            </div>
          );
        })}
      </div>
    </section>
  );

  const renderAsmList = () => (
    <section style={panelStyle(phaseColor)}>
      <div style={sectionLabel(phaseColor)}>ASM instructions</div>
      <div style={{ height: "auto", overflow: "visible", display: "grid", alignContent: "start", gap: 6, paddingRight: 4 }}>
        {steps.map((step, index) => {
          const color = asmColor(step.asm);
          return (
            <div key={`${asmText(step.asm)}-${index}`} style={{ display: "grid", gridTemplateColumns: "34px minmax(0, 1fr)", gap: 8, background: "#111827", border: "1px solid #2a3a55", borderLeft: `3px solid ${color}`, borderRadius: "0 8px 8px 0", padding: "8px 10px" }}>
              <span style={{ color: "#64748b", fontFamily: "monospace", fontSize: 11, textAlign: "right" }}>{step.asm.line ?? index + 1}</span>
              <span style={{ color, fontFamily: "monospace", fontSize: 12, wordBreak: "break-word" }}>{asmText(step.asm)}</span>
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
        <div style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>{steps.length} ASM instructions</div>
      </div>

      {mode === "full" ? (
        <div style={{ height: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, minHeight: 600 }}>
          {renderTacList(false)}
          {renderAsmList()}
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
              <div style={sectionLabel(phaseColor)}>Current ASM</div>
              <div style={{ height: "auto", overflow: "visible", paddingRight: 4 }}>
                <div style={{ border: `2px solid ${phaseColor}`, borderRadius: 8, background: "#0f172a", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <span style={{ background: `${asmColor(current.asm)}22`, border: `1px solid ${asmColor(current.asm)}`, borderRadius: 999, color: asmColor(current.asm), fontFamily: "monospace", fontSize: 12, fontWeight: 800, padding: "5px 10px" }}>{currentOp}</span>
                    <span style={{ color: "#94a3b8", fontSize: 12 }}>Step {currentIndex + 1} of {steps.length}</span>
                  </div>
                  <div style={{ color: "#ffffff", fontFamily: "monospace", fontSize: 16, lineHeight: 1.5, wordBreak: "break-word" }}>{asmText(current.asm)}</div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>Generated from TAC:</div>
                  <div style={{ color: phaseColor, background: `${phaseColor}18`, border: `1px solid ${phaseColor}55`, borderRadius: 8, fontFamily: "monospace", fontSize: 12, padding: "8px 10px" }}>{tacText(current.tac) || "<tac>"}</div>

                  <div style={{ borderTop: "1px solid #243247" }} />
                  {renderRegisterGrid(current.registers, phaseColor)}
                  <div style={{ borderTop: "1px solid #243247" }} />
                  <div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>What this instruction does:</div>
                    <div style={{ ...bodyText, margin: 0 }}>{asmExplanation(currentOp)}</div>
                  </div>
                </div>

                <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                  <div>
                    <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>History</div>
                    <div style={{ display: "grid", gap: 7 }}>
                      {history.length ? history.map((step, index) => (
                        <div key={`${asmText(step.asm)}-${index}`} style={{ opacity: 0.55, color: "#cbd5e1", fontFamily: "monospace", fontSize: 12 }}>{asmText(step.asm)}</div>
                      )) : <div style={{ color: "#64748b", fontSize: 12 }}>No assembly emitted yet.</div>}
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Next</div>
                    <div style={{ display: "grid", gap: 7 }}>
                      {preview.length ? preview.map((step, index) => (
                        <div key={`${asmText(step.asm)}-${index}`} style={{ opacity: 0.65, color: "#cbd5e1", fontFamily: "monospace", fontSize: 12, fontStyle: "italic" }}>{asmText(step.asm)}</div>
                      )) : <div style={{ color: "#64748b", fontSize: 12, fontStyle: "italic" }}>No upcoming assembly instructions.</div>}
                    </div>
                  </div>

                  <div style={{ borderLeft: `3px solid ${phaseColor}`, background: `${phaseColor}20`, borderRadius: "0 8px 8px 0", padding: 12 }}>
                    <div style={{ color: "#fecaca", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>What is happening:</div>
                    <div style={{ ...bodyText, margin: 0 }}>
                      Code generation is choosing concrete VRM instructions and registers for the optimized TAC. The result is executable machine-like code for the virtual runtime.
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
