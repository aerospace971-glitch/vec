// src/components/LearnMode/phases/optimizer/Interactive.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { cardBase, sectionLabel, bodyText } from "../../shared/CardStyles";

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

function formatInstruction(item) {
  if (!item) return "";
  if (typeof item === "string") return item;
  return item.instruction || item.code || item.before || item.after || [item.op, item.result, item.arg1, item.arg2].filter(Boolean).join(" ") || "";
}

function passExplanation(pass) {
  const normalized = String(pass || "").toLowerCase();
  if (normalized.includes("constant propagation")) return "The variable held a known constant value and was never reassigned. All uses are safely replaced with the constant directly.";
  if (normalized.includes("constant folding")) return "Both operands were constants so the expression was computed at compile time. The result replaces the original expression.";
  if (normalized.includes("dead code")) return "The result of this instruction was never used before being overwritten. The instruction can be safely removed without changing behavior.";
  if (normalized.includes("function inlining")) return "The function call was replaced with the function body directly, eliminating call overhead.";
  if (normalized.includes("copy propagation")) return "The copied value can be used directly, removing an unnecessary alias and often exposing dead code.";
  return "This transformation preserves program behavior while making the code more efficient.";
}

function impactDescription(opt) {
  const pass = String(opt.pass || "").toLowerCase();
  if (opt.type === "removed" || !opt.after) return "Instruction count decreases and the later code generator has less work to emit.";
  if (pass.includes("folding")) return "Runtime arithmetic is reduced because the result is already known at compile time.";
  if (pass.includes("propagation")) return "Later instructions become simpler and may unlock more folding or dead-code removal.";
  if (pass.includes("inlining")) return "Call overhead is reduced, though code size may grow at the call site.";
  return "The TAC becomes simpler while preserving the same observable behavior.";
}

function normalizeOptimization(opt, index, beforeInstructions, afterInstructions) {
  if (opt) {
    return {
      pass: opt.pass || opt.type || "Optimization",
      lineNumber: opt.lineNumber ?? opt.line ?? index + 1,
      before: opt.before || formatInstruction(opt.original) || "",
      after: opt.after || (opt.type === "removed" ? "" : formatInstruction(opt.replacement)) || "",
      type: opt.type || (opt.after === "" ? "removed" : "changed"),
      description: opt.description || opt.reason || passExplanation(opt.pass || opt.type),
    };
  }

  const before = formatInstruction(beforeInstructions[index]);
  const after = formatInstruction(afterInstructions[index]);
  return {
    pass: "Optimization",
    lineNumber: index + 1,
    before,
    after,
    type: after ? "changed" : "removed",
    description: passExplanation("Optimization"),
  };
}

function changedBeforeSet(optimizations) {
  return new Set(optimizations.map((opt) => opt.before).filter(Boolean));
}

function changedAfterSet(optimizations) {
  return new Set(optimizations.map((opt) => opt.after).filter(Boolean));
}

function passForInstruction(text, optimizations) {
  return optimizations.find((opt) => opt.before === text || opt.after === text)?.pass || "";
}

function isRemovedInstruction(text, optimizations) {
  return optimizations.some((opt) => opt.before === text && (!opt.after || opt.type === "removed"));
}

export default function OptInteractive({ phaseColor = "#f59e0b", beforeInstructions = [], afterInstructions = [], optimizations = [] }) {
  const [mode, setMode] = useState("full");
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(700);
  const timerRef = useRef(null);

  const steps = useMemo(() => {
    if (Array.isArray(optimizations) && optimizations.length) return optimizations.map((opt, index) => normalizeOptimization(opt, index, beforeInstructions, afterInstructions));
    const max = Math.max(beforeInstructions.length, afterInstructions.length);
    const generated = [];
    for (let index = 0; index < max; index += 1) {
      const before = formatInstruction(beforeInstructions[index]);
      const after = formatInstruction(afterInstructions[index]);
      if (before !== after) generated.push(normalizeOptimization(null, index, beforeInstructions, afterInstructions));
    }
    return generated.length ? generated : [{ pass: "No optimization", lineNumber: 1, before: "No changes detected", after: "No changes detected", type: "unchanged", description: "No optimization data is available for this run." }];
  }, [beforeInstructions, afterInstructions, optimizations]);

  const currentIndex = Math.min(currentStep, steps.length - 1);
  const current = steps[currentIndex];
  const history = steps.slice(Math.max(0, currentIndex - 3), currentIndex);
  const preview = steps.slice(currentIndex + 1, currentIndex + 3);
  const progressPercent = steps.length ? ((currentIndex + 1) / steps.length) * 100 : 0;
  const changedBefore = useMemo(() => changedBeforeSet(steps), [steps]);
  const changedAfter = useMemo(() => changedAfterSet(steps), [steps]);

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

  const renderBeforeRow = (instruction, index, liveMode) => {
    const text = formatInstruction(instruction);
    const pass = passForInstruction(text, steps);
    const changed = changedBefore.has(text);
    const removed = isRemovedInstruction(text, steps);
    const currentRow = liveMode && current.before === text;
    const past = liveMode && steps.findIndex((step) => step.before === text) > -1 && steps.findIndex((step) => step.before === text) < currentIndex;
    const opacity = !liveMode ? 1 : past ? 0.45 : currentRow ? 1 : 0.8;

    return (
      <div id={liveMode && currentRow ? `step-item-${currentIndex}` : undefined} key={`${text}-${index}`} style={{ background: currentRow ? `${phaseColor}2b` : changed ? "#3b1f1f" : "#111827", border: `1px solid ${currentRow ? phaseColor : "#2a3a55"}`, borderLeft: `3px solid ${changed ? "#f87171" : "#64748b"}`, borderRadius: "0 8px 8px 0", opacity, padding: "8px 10px", display: "grid", gap: 5 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <span style={{ color: changed ? "#f87171" : "#cbd5e1", fontFamily: "monospace", fontSize: 12, textDecoration: removed ? "line-through" : "none", wordBreak: "break-word" }}>{past ? "✓ " : ""}{text || "<empty>"}</span>
          {pass && <span style={{ color: phaseColor, border: `1px solid ${phaseColor}66`, borderRadius: 999, padding: "2px 6px", fontSize: 10, whiteSpace: "nowrap" }}>{pass}</span>}
        </div>
      </div>
    );
  };

  const renderAfterRow = (instruction, index) => {
    const text = formatInstruction(instruction);
    const changed = changedAfter.has(text);
    const pass = passForInstruction(text, steps);
    return (
      <div key={`${text}-${index}`} style={{ background: changed ? "#1a3b1f" : "#111827", border: "1px solid #2a3a55", borderLeft: `3px solid ${changed ? "#4ade80" : "#64748b"}`, borderRadius: "0 8px 8px 0", padding: "8px 10px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
          <span style={{ color: changed ? "#4ade80" : "#cbd5e1", fontFamily: "monospace", fontSize: 12, wordBreak: "break-word" }}>{text || "<empty>"}</span>
          {pass && <span style={{ color: phaseColor, border: `1px solid ${phaseColor}66`, borderRadius: 999, padding: "2px 6px", fontSize: 10, whiteSpace: "nowrap" }}>{pass}</span>}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 1120 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", gap: 6, padding: 4, background: "#0f172a", border: "1px solid #2a3a55", borderRadius: 8 }}>
          <button type="button" onClick={() => setMode("full")} style={controlButton(mode === "full", phaseColor)}>Full View</button>
          <button type="button" onClick={() => setMode("step")} style={controlButton(mode === "step", phaseColor)}>Step by Step</button>
        </div>
        <div style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>{steps.length} optimizations</div>
      </div>

      {mode === "full" ? (
        <div style={{ height: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, minHeight: 600 }}>
          <section style={panelStyle(phaseColor)}>
            <div style={sectionLabel(phaseColor)}>Before TAC</div>
            <div style={{ height: "auto", overflow: "visible", display: "grid", alignContent: "start", gap: 7, paddingRight: 4 }}>
              {beforeInstructions.length ? beforeInstructions.map((instruction, index) => renderBeforeRow(instruction, index, false)) : <div style={bodyText}>No before TAC available.</div>}
            </div>
          </section>

          <section style={panelStyle(phaseColor)}>
            <div style={sectionLabel(phaseColor)}>After TAC</div>
            <div style={{ height: "auto", overflow: "visible", display: "grid", alignContent: "start", gap: 7, paddingRight: 4 }}>
              {afterInstructions.length ? afterInstructions.map((instruction, index) => renderAfterRow(instruction, index)) : <div style={bodyText}>No after TAC available.</div>}
            </div>
          </section>
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
            <section style={panelStyle(phaseColor)}>
              <div style={sectionLabel(phaseColor)}>Before TAC list</div>
              <div style={{ height: "auto", overflow: "visible", display: "grid", alignContent: "start", gap: 7, paddingRight: 4 }}>
                {beforeInstructions.length ? beforeInstructions.map((instruction, index) => renderBeforeRow(instruction, index, true)) : <div style={bodyText}>No before TAC available.</div>}
              </div>
            </section>

            <section style={panelStyle(phaseColor)}>
              <div style={sectionLabel(phaseColor)}>Current optimization</div>
              <div style={{ height: "auto", overflow: "visible", paddingRight: 4 }}>
                <div style={{ border: `2px solid ${phaseColor}`, borderRadius: 8, background: "#0f172a", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <span style={{ background: `${phaseColor}22`, border: `1px solid ${phaseColor}`, borderRadius: 999, color: phaseColor, fontFamily: "monospace", fontSize: 12, fontWeight: 800, padding: "5px 10px" }}>{current.pass}</span>
                    <span style={{ color: "#94a3b8", fontSize: 12 }}>Step {currentIndex + 1} of {steps.length}</span>
                  </div>

                  <div style={{ background: "#3b1f1f", color: "#f87171", borderRadius: 8, padding: "9px 10px", fontFamily: "monospace", fontSize: 12, wordBreak: "break-word" }}>{current.before || "<none>"}</div>
                  <div style={{ color: phaseColor, textAlign: "center", fontWeight: 900, fontSize: 18 }}>→</div>
                  <div style={{ background: "#1a3b1f", color: "#4ade80", borderRadius: 8, padding: "9px 10px", fontFamily: "monospace", fontSize: 12, wordBreak: "break-word" }}>{current.after || "REMOVED"}</div>

                  <div style={{ borderTop: "1px solid #243247" }} />
                  <div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>Why this is valid:</div>
                    <div style={{ ...bodyText, margin: 0 }}>{current.description || passExplanation(current.pass)}</div>
                  </div>
                  <div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>Effect:</div>
                    <div style={{ ...bodyText, margin: 0 }}>{impactDescription(current)}</div>
                  </div>
                </div>

                <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                  <div>
                    <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>History</div>
                    <div style={{ display: "grid", gap: 7 }}>
                      {history.length ? history.map((entry, index) => (
                        <div key={`${entry.pass}-${index}`} style={{ opacity: 0.55, color: "#cbd5e1", fontFamily: "monospace", fontSize: 12 }}>{entry.pass}: {entry.before} → {entry.after || "REMOVED"}</div>
                      )) : <div style={{ color: "#64748b", fontSize: 12 }}>No optimizations completed yet.</div>}
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Next</div>
                    <div style={{ display: "grid", gap: 7 }}>
                      {preview.length ? preview.map((entry, index) => (
                        <div key={`${entry.pass}-${index}`} style={{ opacity: 0.65, color: "#cbd5e1", fontFamily: "monospace", fontSize: 12, fontStyle: "italic" }}>{entry.pass}: {entry.before}</div>
                      )) : <div style={{ color: "#64748b", fontSize: 12, fontStyle: "italic" }}>No more optimization steps.</div>}
                    </div>
                  </div>

                  <div style={{ borderLeft: `3px solid ${phaseColor}`, background: `${phaseColor}20`, borderRadius: "0 8px 8px 0", padding: 12 }}>
                    <div style={{ color: "#fde68a", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>What is happening:</div>
                    <div style={{ ...bodyText, margin: 0 }}>
                      The optimizer is rewriting TAC into a smaller or cheaper equivalent form. Each pass keeps behavior the same while removing redundant work.
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
