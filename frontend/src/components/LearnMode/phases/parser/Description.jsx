// src/components/LearnMode/phases/parser/Description.jsx
import React, { useMemo } from "react";
import { cardBase, sectionLabel, bodyText } from "../../shared/CardStyles";

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
  Default: "#6b7280",
};

const GRAMMAR_RULES = [
  "Program → DeclarationList",
  "FunctionDecl → TYPE ID ( ParamList ) CompoundStmt",
  "VarDecl → TYPE ID = Expr ;",
  "IfStmt → if ( Expr ) Stmt [ else Stmt ]",
  "ForStmt → for ( Init ; Cond ; Inc ) Stmt",
  "ReturnStmt → return [ Expr ] ;",
];

function flattenAst(node, out = []) {
  if (!node) return out;
  out.push(node);
  (node.children || []).forEach((child) => flattenAst(child, out));
  return out;
}

function nodeColor(type) {
  return NODE_COLORS[type] || NODE_COLORS.Default;
}

function nodeValue(node) {
  return node?.value ?? node?.name ?? node?.operator ?? node?.dataType ?? "";
}

function functionLabel(node) {
  const name = nodeValue(node) || "anonymous";
  const returnType = node?.returnType || node?.dataType || node?.typeName || "void";
  return `${name}() → ${returnType}`;
}

function topLevelText(node) {
  const value = nodeValue(node);
  if (/FunctionDecl/i.test(node.type || "")) return functionLabel(node);
  if (value) return value;
  return node.children?.length ? `${node.children.length} children` : "structure node";
}

function renderTreeNode(node, level = 0, maxDepth = 4, isLast = true) {
  if (!node || level > maxDepth) return null;

  const children = node.children || [];
  const color = nodeColor(node.type);
  const branch = level === 0 ? "" : isLast ? "└─" : "├─";

  return (
    <React.Fragment key={`${node.type}-${level}-${nodeValue(node)}-${children.length}`}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: level * 18, minHeight: 26, fontFamily: "monospace" }}>
        <span style={{ color: "#64748b", width: level === 0 ? 0 : 20 }}>{branch}</span>
        <span style={{ border: `1px solid ${color}`, background: `${color}1f`, color, borderRadius: 6, padding: "3px 7px", fontSize: 11, fontWeight: 800 }}>{node.type || "Node"}</span>
        {nodeValue(node) && <span style={{ color: "#cbd5e1", fontSize: 12 }}>{nodeValue(node)}</span>}
      </div>
      {level < maxDepth && children.map((child, index) => renderTreeNode(child, level + 1, maxDepth, index === children.length - 1))}
    </React.Fragment>
  );
}

export default function ParserDescription({ phaseColor = "#8b5cf6", astData = null }) {
  const allNodes = useMemo(() => flattenAst(astData || null), [astData]);
  const topNodes = useMemo(() => astData?.children || [], [astData]);
  const functionNodes = useMemo(() => allNodes.filter((node) => node.type === "FunctionDecl"), [allNodes]);

  const stats = useMemo(() => {
    const types = new Set(allNodes.map((node) => node.type || "Unknown"));
    return [
      ["Total Nodes", allNodes.length],
      ["Node Types", types.size],
      ["Functions", functionNodes.length],
      ["Statements", allNodes.filter((node) => String(node.type || "").includes("Stmt")).length],
      ["Expressions", allNodes.filter((node) => String(node.type || "").includes("Expr")).length],
      ["Declarations", allNodes.filter((node) => String(node.type || "").includes("Decl")).length],
    ];
  }, [allNodes, functionNodes.length]);

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
          <div style={sectionLabel(phaseColor)}>Top-level declarations</div>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {topNodes.length ? topNodes.map((node, index) => (
              <div key={`${node.type}-${index}`} style={{ background: "#111827", borderLeft: `3px solid ${phaseColor}`, borderRadius: "0 8px 8px 0", padding: "9px 10px", display: "flex", alignItems: "center", gap: 9 }}>
                <span style={{ color: phaseColor, fontWeight: 900 }}>✓</span>
                <span style={{ color: "#e2e8f0", fontFamily: "monospace", fontSize: 13, fontWeight: 800 }}>{node.type || "Node"}</span>
                <span style={{ color: "#94a3b8", fontSize: 13 }}>→ {topLevelText(node)}</span>
              </div>
            )) : <div style={bodyText}>No top-level declarations are available yet.</div>}
          </div>
        </section>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <section style={cardBase(phaseColor)}>
          <div style={sectionLabel(phaseColor)}>Function structure</div>
          <div style={{ display: "grid", gap: 12, marginTop: 8 }}>
            {functionNodes.length ? functionNodes.map((func, index) => (
              <div key={`${func.type}-${index}-${nodeValue(func)}`} style={{ background: "#111827", border: "1px solid #2a3a55", borderRadius: 8, padding: 12 }}>
                <div style={{ color: "#f8fafc", fontFamily: "monospace", fontWeight: 800, marginBottom: 8 }}>{functionLabel(func)}</div>
                <div>{renderTreeNode(func, 0, 4)}</div>
              </div>
            )) : <div style={bodyText}>No FunctionDecl nodes were detected in the current AST.</div>}
          </div>
        </section>

        <section style={cardBase(phaseColor)}>
          <div style={sectionLabel(phaseColor)}>Grammar rules applied</div>
          <div style={{ background: "#111827", border: "1px solid #2a3a55", borderRadius: 8, overflow: "hidden", marginTop: 8 }}>
            {GRAMMAR_RULES.map((rule, index) => (
              <div key={rule} style={{ color: "#94a3b8", fontFamily: "monospace", fontSize: 11, padding: "8px 10px", borderBottom: index === GRAMMAR_RULES.length - 1 ? "none" : "1px solid #1f2937" }}>
                {rule}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
