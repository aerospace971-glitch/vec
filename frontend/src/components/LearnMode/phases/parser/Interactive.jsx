// src/components/LearnMode/phases/parser/Interactive.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { cardBase, sectionLabel, bodyText } from "../../shared/CardStyles";

const TOKEN_COLORS = {
  IDENTIFIER: "#3b82f6",
  KEYWORD: "#f59e0b",
  TYPE: "#8b5cf6",
  CONTROL: "#f59e0b",
  LITERAL: "#10b981",
  NUMBER: "#10b981",
  STRING: "#10b981",
  OPERATOR: "#f97316",
  ASSIGNMENT: "#a78bfa",
  DELIMITER: "#06b6d4",
  PUNCTUATION: "#ec4899",
  PREPROCESSOR: "#84cc16",
  DEFAULT: "#94a3b8",
};

const NODE_COLORS = {
  FunctionDecl: "#8b5cf6",
  VarDecl: "#3b82f6",
  IfStmt: "#f59e0b",
  ForStmt: "#f59e0b",
  WhileStmt: "#f59e0b",
  BinaryExpr: "#10b981",
  AssignExpr: "#10b981",
  Literal: "#84cc16",
  Identifier: "#e2e8f0",
  ReturnStmt: "#f43f5e",
  CompoundStmt: "#06b6d4",
  Program: "#a78bfa",
  Default: "#6b7280",
};

const GRAMMAR_RULES = {
  Program: "Program → DeclarationList",
  FunctionDecl: "FunctionDecl → TYPE ID ( ParamList ) CompoundStmt",
  VarDecl: "VarDecl → TYPE ID = Expr ;",
  IfStmt: "IfStmt → if ( Expr ) Stmt [ else Stmt ]",
  ForStmt: "ForStmt → for ( Init ; Cond ; Inc ) Stmt",
  WhileStmt: "WhileStmt → while ( Expr ) Stmt",
  ReturnStmt: "ReturnStmt → return [ Expr ] ;",
  BinaryExpr: "BinaryExpr → Expr OP Expr",
  AssignExpr: "AssignExpr → ID = Expr",
  Literal: "Literal → NUMBER | STRING | CHAR",
  Identifier: "Identifier → ID",
  CompoundStmt: "CompoundStmt → { StmtList }",
  Default: "Grammar rule → AST node",
};

const NODE_EXPLANATIONS = {
  FunctionDecl: "The parser matched TYPE ID ( ParamList ) CompoundStmt and created a function declaration node.",
  VarDecl: "The parser matched TYPE ID = Expr ; and created a variable declaration with an initializer.",
  IfStmt: "The parser matched if ( Expr ) Stmt and created a conditional branch node.",
  ForStmt: "The parser matched for ( Init ; Cond ; Inc ) Stmt and created a loop node with 4 children.",
  BinaryExpr: "The parser found two operands with an operator between them and created a binary expression node.",
  ReturnStmt: "The parser matched return Expr ; and created a return statement node.",
  Default: "The parser applied a grammar rule and created this AST node from the matching token sequence.",
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

function tokenCategory(token) {
  return String(token?.category || token?.type || "DEFAULT").toUpperCase();
}

function tokenValue(token) {
  const value = token?.value ?? token?.text ?? token?.name ?? "";
  return value === "" ? "<empty>" : String(value);
}

function tokenType(token) {
  return String(token?.type || token?.category || "TOKEN").toUpperCase();
}

function tokenColor(token) {
  return TOKEN_COLORS[tokenCategory(token)] || TOKEN_COLORS.DEFAULT;
}

function nodeValue(node) {
  return node?.value ?? node?.name ?? node?.operator ?? node?.dataType ?? "";
}

function nodeColor(node) {
  return NODE_COLORS[node?.type] || NODE_COLORS.Default;
}

function grammarRule(node) {
  return GRAMMAR_RULES[node?.type] || GRAMMAR_RULES.Default;
}

function nodeExplanation(type) {
  return NODE_EXPLANATIONS[type] || NODE_EXPLANATIONS.Default;
}

function displayNode(node) {
  const value = nodeValue(node);
  return value ? `${node.type} → ${value}` : node.type || "Node";
}

export default function ParserInteractive({ phaseColor = "#8b5cf6", tokens = [], astData = null }) {
  const [mode, setMode] = useState("full");
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(700);
  const timerRef = useRef(null);

  const tokenStream = useMemo(() => {
    if (!Array.isArray(tokens) || !tokens.length) return [];
    return tokens.map((token) => ({ ...token, display: `${tokenType(token)}: ${tokenValue(token)}` }));
  }, [tokens]);

  const nodeSteps = useMemo(() => {
    const flattened = flattenAst(astData || null);
    return flattened.length ? flattened : [{ type: "No AST", value: "Run parser output", depth: 0, children: [] }];
  }, [astData]);

  const currentIndex = Math.min(currentStep, nodeSteps.length - 1);
  const currentNode = nodeSteps[currentIndex];
  const currentNodeColor = nodeColor(currentNode);
  const currentTokenIndex = tokenStream.length ? Math.min(currentIndex, tokenStream.length - 1) : -1;
  const history = nodeSteps.slice(Math.max(0, currentIndex - 3), currentIndex);
  const preview = nodeSteps.slice(currentIndex + 1, currentIndex + 3);
  const progressPercent = nodeSteps.length ? ((currentIndex + 1) / nodeSteps.length) * 100 : 0;

  useEffect(() => {
    if (!playing) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return undefined;
    }

    timerRef.current = setInterval(() => {
      setCurrentStep((step) => {
        if (step >= nodeSteps.length - 1) {
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
  }, [playing, speed, nodeSteps.length]);

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
    setCurrentStep((step) => Math.min(nodeSteps.length - 1, step + 1));
  };

  const reset = () => {
    setPlaying(false);
    setCurrentStep(0);
  };

  const renderTokenStream = (streamMode) => (
    <section style={panelStyle(phaseColor)}>
      <div style={sectionLabel(phaseColor)}>Token stream</div>
      <div style={{ height: "auto", overflow: "visible", display: "grid", alignContent: "start", gap: 6, paddingRight: 4 }}>
        {tokenStream.length ? tokenStream.map((token, index) => {
          const color = tokenColor(token);
          const isCurrent = streamMode === "step" && index === currentTokenIndex;
          const opacity = streamMode !== "step" ? 1 : index < currentTokenIndex ? 0.4 : isCurrent ? 1 : 0.7;

          return (
            <div
              id={streamMode === "step" && isCurrent ? `step-item-${currentIndex}` : undefined}
              key={`${token.display}-${index}`}
              style={{
                background: isCurrent ? `${phaseColor}30` : "#111827",
                border: `1px solid ${isCurrent ? phaseColor : "#2a3a55"}`,
                borderLeft: `3px solid ${color}`,
                borderRadius: "0 8px 8px 0",
                color: "#e2e8f0",
                display: "grid",
                gridTemplateColumns: "132px minmax(0, 1fr)",
                gap: 10,
                opacity,
                padding: "9px 10px",
                fontFamily: "monospace",
                fontSize: 12,
              }}
            >
              <span style={{ color, fontWeight: 800 }}>{tokenType(token)}</span>
              <span style={{ wordBreak: "break-word" }}>{tokenValue(token)}</span>
            </div>
          );
        }) : <div style={bodyText}>Token stream is unavailable. Run the parser to populate tokens.</div>}
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
        <div style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>{nodeSteps.length} AST nodes</div>
      </div>

      {mode === "full" ? (
        <div style={{ height: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, minHeight: 600 }}>
          {renderTokenStream("full")}
          <section style={panelStyle(phaseColor)}>
            <div style={sectionLabel(phaseColor)}>AST</div>
            <div style={{ height: "auto", overflow: "visible", display: "grid", alignContent: "start", gap: 6, paddingRight: 4 }}>
              {nodeSteps.map((node, index) => {
                const color = nodeColor(node);
                return (
                  <div key={`${node.type}-${index}-${nodeValue(node)}`} style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: (node.depth || 0) * 18, minHeight: 28, fontFamily: "monospace" }}>
                    <span style={{ color: "#475569", width: 22 }}>{node.depth ? "└─" : ""}</span>
                    <span style={{ border: `1px solid ${color}`, background: `${color}1f`, color, borderRadius: 6, padding: "4px 7px", fontSize: 11, fontWeight: 800 }}>{node.type}</span>
                    {nodeValue(node) && <span style={{ color: "#cbd5e1", fontSize: 12 }}>{nodeValue(node)}</span>}
                  </div>
                );
              })}
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
              <span style={{ color: "#cbd5e1", fontSize: 13, fontWeight: 700, marginLeft: 4 }}>Step {currentIndex + 1} of {nodeSteps.length}</span>
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
            {renderTokenStream("step")}

            <section style={panelStyle(phaseColor)}>
              <div style={sectionLabel(phaseColor)}>Current AST node being built</div>
              <div style={{ height: "auto", overflow: "visible", paddingRight: 4 }}>
                <div style={{ border: `2px solid ${phaseColor}`, borderRadius: 8, background: "#0f172a", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <span style={{ background: `${currentNodeColor}22`, border: `1px solid ${currentNodeColor}`, borderRadius: 999, color: currentNodeColor, fontFamily: "monospace", fontSize: 12, fontWeight: 800, padding: "5px 10px" }}>{currentNode.type}</span>
                    <span style={{ color: "#94a3b8", fontSize: 12 }}>Step {currentIndex + 1} of {nodeSteps.length}</span>
                  </div>

                  <div style={{ color: "#ffffff", fontFamily: "monospace", fontSize: 16, lineHeight: 1.5, wordBreak: "break-word" }}>{nodeValue(currentNode) || currentNode.type}</div>
                  <div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>Grammar rule applied:</div>
                    <div style={{ color: phaseColor, background: `${phaseColor}18`, border: `1px solid ${phaseColor}55`, borderRadius: 8, fontFamily: "monospace", fontSize: 12, padding: "8px 10px" }}>{grammarRule(currentNode)}</div>
                  </div>

                  <div style={{ borderTop: "1px solid #243247" }} />
                  <div>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>What this means:</div>
                    <div style={{ ...bodyText, margin: 0 }}>{nodeExplanation(currentNode.type)}</div>
                  </div>
                </div>

                <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                  <div>
                    <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>History</div>
                    <div style={{ display: "grid", gap: 7 }}>
                      {history.length ? history.map((node, index) => (
                        <div key={`${node.type}-${index}-${nodeValue(node)}`} style={{ opacity: 0.55, color: "#cbd5e1", fontFamily: "monospace", fontSize: 12 }}>
                          {displayNode(node)}
                        </div>
                      )) : <div style={{ color: "#64748b", fontSize: 12 }}>Starting AST construction.</div>}
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Next</div>
                    <div style={{ display: "grid", gap: 7 }}>
                      {preview.length ? preview.map((node, index) => (
                        <div key={`${node.type}-${index}-${nodeValue(node)}`} style={{ opacity: 0.65, color: "#cbd5e1", fontFamily: "monospace", fontSize: 12, fontStyle: "italic" }}>
                          {displayNode(node)}
                        </div>
                      )) : <div style={{ color: "#64748b", fontSize: 12, fontStyle: "italic" }}>No upcoming AST nodes.</div>}
                    </div>
                  </div>

                  <div style={{ borderLeft: `3px solid ${phaseColor}`, background: `${phaseColor}20`, borderRadius: "0 8px 8px 0", padding: 12 }}>
                    <div style={{ color: "#ddd6fe", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>What is happening:</div>
                    <div style={{ ...bodyText, margin: 0 }}>
                      The parser has recognized a valid grammar shape and is adding <span style={{ color: phaseColor, fontFamily: "monospace" }}>{currentNode.type}</span> to the AST. This node keeps the program structure while leaving raw punctuation behind.
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
