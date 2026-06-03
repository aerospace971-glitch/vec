// src/components/LearnMode/phases/optimizer/Description.jsx
import React, { useMemo } from "react";
import { cardBase, sectionLabel, bodyText } from "../../shared/CardStyles";

function formatInstruction(item) {
  if (!item) return "";
  if (typeof item === "string") return item;
  return item.instruction || item.code || item.before || item.after || [item.op, item.result, item.arg1, item.arg2].filter(Boolean).join(" ") || "";
}

function passName(opt) {
  return opt?.pass || opt?.type || "Optimization";
}

function normalizeOpt(opt, index) {
  return {
    pass: passName(opt),
    lineNumber: opt?.lineNumber ?? opt?.line ?? index + 1,
    before: opt?.before || formatInstruction(opt?.original) || "",
    after: opt?.after || (opt?.type === "removed" ? "" : formatInstruction(opt?.replacement)) || "",
    type: opt?.type || (opt?.after === "" ? "removed" : "changed"),
    description: opt?.description || opt?.reason || passExplanation(passName(opt)),
  };
}

function passExplanation(pass) {
  const normalized = String(pass || "").toLowerCase();
  if (normalized.includes("constant propagation")) return "A variable was assigned a constant and not changed before use. Replacing it with the literal value preserves behavior.";
  if (normalized.includes("constant folding")) return "Both operands were known constants, so the expression was evaluated once at compile time.";
  if (normalized.includes("dead code")) return "The result was never read before being overwritten or leaving scope, so removing it does not change program output.";
  if (normalized.includes("copy propagation")) return "A simple copy was replaced with the original value, reducing unnecessary temporary names.";
  if (normalized.includes("inlining")) return "The function body replaced the call site directly, removing call overhead while preserving semantics.";
  return "This transformation preserves program behavior while making the code more efficient.";
}

function changedBeforeSet(optimizations) {
  return new Set(optimizations.map((opt) => opt.before).filter(Boolean));
}

function changedAfterSet(optimizations) {
  return new Set(optimizations.map((opt) => opt.after).filter(Boolean));
}

function isRemovedInstruction(text, optimizations) {
  return optimizations.some((opt) => opt.before === text && (!opt.after || opt.type === "removed"));
}

export default function OptDescription({ phaseColor = "#f59e0b", beforeInstructions = [], afterInstructions = [], optimizations = [] }) {
  const normalizedOptimizations = useMemo(() => {
    if (optimizations.length) return optimizations.map(normalizeOpt);
    return beforeInstructions
      .map((before, index) => {
        const beforeText = formatInstruction(before);
        const afterText = formatInstruction(afterInstructions[index]);
        if (beforeText === afterText) return null;
        return normalizeOpt({ pass: "Optimization", lineNumber: index + 1, before: beforeText, after: afterText, type: afterText ? "changed" : "removed" }, index);
      })
      .filter(Boolean);
  }, [beforeInstructions, afterInstructions, optimizations]);

  const changedBefore = useMemo(() => changedBeforeSet(normalizedOptimizations), [normalizedOptimizations]);
  const changedAfter = useMemo(() => changedAfterSet(normalizedOptimizations), [normalizedOptimizations]);
  const stats = useMemo(() => {
    const before = beforeInstructions.length;
    const after = afterInstructions.length;
    const removed = Math.max(0, before - after) || normalizedOptimizations.filter((opt) => opt.type === "removed" || !opt.after).length;
    const changed = normalizedOptimizations.filter((opt) => opt.before !== opt.after).length;
    const passes = new Set(normalizedOptimizations.map((opt) => opt.pass)).size;
    const saving = before ? `${(((before - after) / before) * 100).toFixed(0)}%` : "0%";
    return [["Before", before], ["After", after], ["Removed", removed], ["Changed", changed], ["Passes", passes], ["Saving %", saving]];
  }, [beforeInstructions.length, afterInstructions.length, normalizedOptimizations]);

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
          <div style={sectionLabel(phaseColor)}>Before vs After</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
            <div>
              <div style={{ color: "#f87171", fontSize: 11, fontWeight: 800, marginBottom: 6 }}>BEFORE</div>
              <div style={{ display: "grid", gap: 5 }}>
                {beforeInstructions.length ? beforeInstructions.map((instruction, index) => {
                  const text = formatInstruction(instruction);
                  const removed = isRemovedInstruction(text, normalizedOptimizations);
                  const changed = changedBefore.has(text);
                  return (
                    <div key={`${text}-${index}`} style={{ background: changed ? "#3b1f1f" : "#111827", border: "1px solid #1f2937", borderRadius: 6, color: changed ? "#f87171" : "#94a3b8", fontFamily: "monospace", fontSize: 11, padding: "7px 8px", textDecoration: removed ? "line-through" : "none" }}>
                      {text || "<empty>"}
                    </div>
                  );
                }) : <div style={bodyText}>No before TAC available.</div>}
              </div>
            </div>

            <div>
              <div style={{ color: "#4ade80", fontSize: 11, fontWeight: 800, marginBottom: 6 }}>AFTER</div>
              <div style={{ display: "grid", gap: 5 }}>
                {afterInstructions.length ? afterInstructions.map((instruction, index) => {
                  const text = formatInstruction(instruction);
                  const changed = changedAfter.has(text);
                  return (
                    <div key={`${text}-${index}`} style={{ background: changed ? "#1a3b1f" : "#111827", border: "1px solid #1f2937", borderRadius: 6, color: changed ? "#4ade80" : "#94a3b8", fontFamily: "monospace", fontSize: 11, padding: "7px 8px" }}>
                      {text || "<empty>"}
                    </div>
                  );
                }) : <div style={bodyText}>No after TAC available.</div>}
              </div>
            </div>
          </div>
        </section>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <section style={cardBase(phaseColor)}>
          <div style={sectionLabel(phaseColor)}>What each pass did</div>
          <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
            {normalizedOptimizations.length ? normalizedOptimizations.map((opt, index) => (
              <div key={`${opt.pass}-${index}-${opt.before}`} style={{ background: "#111827", borderLeft: `3px solid ${phaseColor}`, borderRadius: "0 8px 8px 0", padding: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <span style={{ color: phaseColor, fontFamily: "monospace", fontSize: 10, fontWeight: 900, textTransform: "uppercase" }}>{opt.pass}</span>
                  <span style={{ color: "#94a3b8", fontSize: 11 }}>Line {opt.lineNumber}</span>
                </div>
                <div style={{ borderTop: "1px solid #1f2937", margin: "9px 0" }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 20px 1fr", gap: 8, alignItems: "center" }}>
                  <div style={{ background: "#3b1f1f", color: "#f87171", borderRadius: 6, padding: "8px 9px", fontFamily: "monospace", fontSize: 11, minHeight: 34 }}>{opt.before || "<none>"}</div>
                  <div style={{ color: phaseColor, textAlign: "center", fontWeight: 900 }}>→</div>
                  <div style={{ background: "#1a3b1f", color: "#4ade80", borderRadius: 6, padding: "8px 9px", fontFamily: "monospace", fontSize: 11, minHeight: 34 }}>{opt.after || "REMOVED"}</div>
                </div>
                <div style={{ color: "#cbd5e1", fontSize: 12, lineHeight: 1.55, marginTop: 10 }}>{opt.description}</div>
              </div>
            )) : <div style={bodyText}>No optimization passes are present.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
