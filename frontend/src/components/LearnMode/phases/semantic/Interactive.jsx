// src/components/LearnMode/phases/semantic/Interactive.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { cardBase, sectionLabel, bodyText } from "../../shared/CardStyles";

const KIND_COLORS = {
  function: "#8b5cf6",
  variable: "#3b82f6",
  parameter: "#10b981",
  param: "#10b981",
  default: "#6b7280",
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

function kindOf(symbol) {
  return String(symbol?.kind || "symbol").toLowerCase();
}

function kindColor(kind) {
  return KIND_COLORS[kind] || KIND_COLORS.default;
}

function symbolName(symbol) {
  return symbol?.name || symbol?.identifier || "unnamed";
}

function symbolType(symbol) {
  return symbol?.type || symbol?.dataType || symbol?.returnType || "unknown";
}

function symbolScope(symbol) {
  return symbol?.scope ?? symbol?.scopeId ?? 0;
}

function boolValue(value, fallback = true) {
  if (value === undefined || value === null) return fallback;
  return Boolean(value);
}

function isUsed(symbol) {
  return boolValue(symbol?.used ?? symbol?.isUsed, kindOf(symbol) === "function");
}

function isInit(symbol) {
  return boolValue(symbol?.init ?? symbol?.initialized ?? symbol?.isInitialized, kindOf(symbol) !== "variable" ? true : false);
}

function symbolExplanation(symbol) {
  const kind = kindOf(symbol);
  if (kind === "function") {
    return "The analyzer verified this function declaration. Its return type is checked against all return statements. Its name is added to scope 0 (global).";
  }
  if (kind === "variable") {
    return "The analyzer checked this variable declaration. Its type is recorded in the symbol table. All uses are verified to be type-compatible.";
  }
  if (kind === "parameter" || kind === "param") {
    return "This parameter is registered in the function scope. Its type is used to verify function call arguments.";
  }
  return "This symbol was verified by semantic analysis.";
}

function nodeValue(node) {
  return node?.value ?? node?.name ?? node?.operator ?? node?.dataType ?? "";
}

function symbolForNode(node, symbols) {
  const value = nodeValue(node);
  if (!value) return null;
  return symbols.find((symbol) => symbolName(symbol) === value) || null;
}

function makeFallbackSymbol() {
  return { name: "No symbols", kind: "symbol", type: "Run semantic analysis", scope: 0, line: "-", used: false, init: false };
}

export default function SemanticInteractive({ phaseColor = "#06b6d4", symbols = [], scopes = [], astData = null }) {
  const [mode, setMode] = useState("full");
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(700);
  const timerRef = useRef(null);

  const astNodes = useMemo(() => flattenAst(astData || null), [astData]);
  const symbolSteps = useMemo(() => (Array.isArray(symbols) && symbols.length ? symbols : [makeFallbackSymbol()]), [symbols]);
  const currentIndex = Math.min(currentStep, symbolSteps.length - 1);
  const currentSymbol = symbolSteps[currentIndex];
  const currentKind = kindOf(currentSymbol);
  const currentColor = kindColor(currentKind);
  const history = symbolSteps.slice(Math.max(0, currentIndex - 3), currentIndex);
  const preview = symbolSteps.slice(currentIndex + 1, currentIndex + 3);
  const progressPercent = symbolSteps.length ? ((currentIndex + 1) / symbolSteps.length) * 100 : 0;

  useEffect(() => {
    if (!playing) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return undefined;
    }

    timerRef.current = setInterval(() => {
      setCurrentStep((step) => {
        if (step >= symbolSteps.length - 1) {
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
  }, [playing, speed, symbolSteps.length]);

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
    setCurrentStep((step) => Math.min(symbolSteps.length - 1, step + 1));
  };

  const reset = () => {
    setPlaying(false);
    setCurrentStep(0);
  };

  const renderSymbolRow = (symbol, index, liveMode) => {
    const kind = kindOf(symbol);
    const color = kindColor(kind);
    const isCurrent = liveMode && index === currentIndex;
    const opacity = !liveMode ? 1 : index < currentIndex ? 0.45 : isCurrent ? 1 : 0.72;

    return (
      <div id={liveMode && isCurrent ? `step-item-${currentIndex}` : undefined} key={`${symbolName(symbol)}-${index}`} style={{ background: isCurrent ? `${phaseColor}26` : "#111827", border: `1px solid ${isCurrent ? phaseColor : "#2a3a55"}`, borderLeft: `3px solid ${color}`, borderRadius: "0 8px 8px 0", opacity, padding: "9px 10px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.9fr 0.8fr 54px 48px 42px", gap: 8, alignItems: "center", fontFamily: "monospace", fontSize: 12 }}>
          <span style={{ color: "#f8fafc", fontWeight: 800 }}>{symbolName(symbol)}</span>
          <span style={{ color }}>{kind}</span>
          <span style={{ color: "#cbd5e1" }}>{symbolType(symbol)}</span>
          <span style={{ color: "#94a3b8" }}>{symbolScope(symbol)}</span>
          <span style={{ color: isUsed(symbol) ? "#22c55e" : "#f97316" }}>{isUsed(symbol) ? "✓" : "✗"}</span>
          <span style={{ color: isInit(symbol) ? "#22c55e" : "#f97316" }}>{isInit(symbol) ? "✓" : "✗"}</span>
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
        <div style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>{symbols.length} symbols · {scopes.length} scopes</div>
      </div>

      {mode === "full" ? (
        <div style={{ height: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, minHeight: 600 }}>
          <section style={panelStyle(phaseColor)}>
            <div style={sectionLabel(phaseColor)}>AST with symbol annotations</div>
            <div style={{ height: "auto", overflow: "visible", display: "grid", alignContent: "start", gap: 6, paddingRight: 4 }}>
              {astNodes.length ? astNodes.map((node, index) => {
                const symbol = symbolForNode(node, symbols);
                const color = symbol ? kindColor(kindOf(symbol)) : "#64748b";
                return (
                  <div key={`${node.type}-${index}-${nodeValue(node)}`} style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: (node.depth || 0) * 18, minHeight: 28, fontFamily: "monospace" }}>
                    <span style={{ color: "#475569", width: 22 }}>{node.depth ? "└─" : ""}</span>
                    <span style={{ color: "#e2e8f0", fontSize: 12 }}>{node.type || "Node"}</span>
                    {nodeValue(node) && <span style={{ color: "#94a3b8", fontSize: 12 }}>→ {nodeValue(node)}</span>}
                    {symbol && <span style={{ color, border: `1px solid ${color}66`, background: `${color}18`, borderRadius: 999, padding: "2px 7px", fontSize: 11 }}>symbol type: {symbolType(symbol)}</span>}
                  </div>
                );
              }) : <div style={bodyText}>No AST nodes are available yet.</div>}
            </div>
          </section>

          <section style={panelStyle(phaseColor)}>
            <div style={sectionLabel(phaseColor)}>Symbol table</div>
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.9fr 0.8fr 54px 48px 42px", gap: 8, color: "#94a3b8", fontSize: 11, fontWeight: 800, padding: "0 10px 8px" }}>
              <span>Name</span><span>Kind</span><span>Type</span><span>Scope</span><span>Used</span><span>Init</span>
            </div>
            <div style={{ height: "auto", overflow: "visible", display: "grid", alignContent: "start", gap: 8, paddingRight: 4 }}>
              {symbolSteps.map((symbol, index) => renderSymbolRow(symbol, index, false))}
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
              <span style={{ color: "#cbd5e1", fontSize: 13, fontWeight: 700, marginLeft: 4 }}>Step {currentIndex + 1} of {symbolSteps.length}</span>
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
              <div style={sectionLabel(phaseColor)}>Symbol list</div>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.9fr 0.8fr 54px 48px 42px", gap: 8, color: "#94a3b8", fontSize: 11, fontWeight: 800, padding: "0 10px 8px" }}>
                <span>Name</span><span>Kind</span><span>Type</span><span>Scope</span><span>Used</span><span>Init</span>
              </div>
              <div style={{ height: "auto", overflow: "visible", display: "grid", alignContent: "start", gap: 8, paddingRight: 4 }}>
                {symbolSteps.map((symbol, index) => renderSymbolRow(symbol, index, true))}
              </div>
            </section>

            <section style={panelStyle(phaseColor)}>
              <div style={sectionLabel(phaseColor)}>Current check</div>
              <div style={{ height: "auto", overflow: "visible", paddingRight: 4 }}>
                <div style={{ border: `2px solid ${phaseColor}`, borderRadius: 8, background: "#0f172a", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <span style={{ background: `${currentColor}22`, border: `1px solid ${currentColor}`, borderRadius: 999, color: currentColor, fontFamily: "monospace", fontSize: 12, fontWeight: 800, padding: "5px 10px" }}>{currentKind.toUpperCase()}</span>
                    <span style={{ color: "#94a3b8", fontSize: 12 }}>Step {currentIndex + 1} of {symbolSteps.length}</span>
                  </div>
                  <div style={{ color: "#ffffff", fontFamily: "monospace", fontSize: 16, lineHeight: 1.5, wordBreak: "break-word" }}>{symbolName(currentSymbol)}</div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>Kind: {currentKind} | Type: {symbolType(currentSymbol)} | Scope: {symbolScope(currentSymbol)}</div>

                  <div style={{ borderTop: "1px solid #243247" }} />
                  <div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>What was checked:</div>
                    <div style={{ ...bodyText, margin: 0 }}>{symbolExplanation(currentSymbol)}</div>
                  </div>

                  <div style={{ display: "grid", gap: 7, background: "#111827", border: "1px solid #1f2937", borderRadius: 8, padding: 10 }}>
                    {[
                      ["Declaration valid", true],
                      ["Type compatible", symbolType(currentSymbol) !== "unknown"],
                      ["Used in program", isUsed(currentSymbol)],
                      ["Initialized before use", isInit(currentSymbol)],
                    ].map(([label, ok]) => (
                      <div key={label} style={{ color: ok ? "#22c55e" : "#f97316", fontSize: 13 }}>{ok ? "✅" : "❌"} <span style={{ color: "#cbd5e1" }}>{label}</span></div>
                    ))}
                  </div>
                </div>

                <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                  <div>
                    <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>History</div>
                    <div style={{ display: "grid", gap: 7 }}>
                      {history.length ? history.map((symbol, index) => (
                        <div key={`${symbolName(symbol)}-${index}`} style={{ opacity: 0.55, color: "#cbd5e1", fontFamily: "monospace", fontSize: 12 }}>{kindOf(symbol).toUpperCase()} {symbolName(symbol)}</div>
                      )) : <div style={{ color: "#64748b", fontSize: 12 }}>No previous symbols checked.</div>}
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Next</div>
                    <div style={{ display: "grid", gap: 7 }}>
                      {preview.length ? preview.map((symbol, index) => (
                        <div key={`${symbolName(symbol)}-${index}`} style={{ opacity: 0.65, color: "#cbd5e1", fontFamily: "monospace", fontSize: 12, fontStyle: "italic" }}>{kindOf(symbol).toUpperCase()} {symbolName(symbol)}</div>
                      )) : <div style={{ color: "#64748b", fontSize: 12, fontStyle: "italic" }}>No upcoming symbols.</div>}
                    </div>
                  </div>

                  <div style={{ borderLeft: `3px solid ${phaseColor}`, background: `${phaseColor}20`, borderRadius: "0 8px 8px 0", padding: 12 }}>
                    <div style={{ color: "#cffafe", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>What is happening:</div>
                    <div style={{ ...bodyText, margin: 0 }}>
                      Semantic analysis is validating <span style={{ color: phaseColor, fontFamily: "monospace" }}>{symbolName(currentSymbol)}</span> against scope and type rules. If these checks pass, later compiler phases can safely use this symbol table entry.
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
