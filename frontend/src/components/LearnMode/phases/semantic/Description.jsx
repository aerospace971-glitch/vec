// src/components/LearnMode/phases/semantic/Description.jsx
import React, { useMemo } from "react";
import { cardBase, sectionLabel, bodyText } from "../../shared/CardStyles";

const KIND_COLORS = {
  function: "#8b5cf6",
  variable: "#3b82f6",
  parameter: "#10b981",
  param: "#10b981",
  default: "#6b7280",
};

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

function scopeTitle(scope) {
  if (!scope) return "Global Scope";
  if (scope.name) return scope.kind === "function" ? `${scope.name}() body` : scope.name;
  if (scope.id === 0 || scope.id === "0") return "Global Scope";
  return `${scope.kind || "Scope"} ${scope.id ?? ""}`.trim();
}

function buildScopeTree(scopes, symbols) {
  const normalizedScopes = Array.isArray(scopes) && scopes.length ? scopes : [{ id: 0, kind: "global", name: "Global Scope", parentId: null }];
  const map = new Map();

  normalizedScopes.forEach((scope) => {
    const id = scope.id ?? scope.scopeId ?? scope.name ?? 0;
    map.set(id, { ...scope, id, children: [], symbols: [] });
  });

  symbols.forEach((symbol) => {
    const sid = symbolScope(symbol);
    const target = map.get(sid) || map.get(String(sid)) || map.get(0);
    if (target) target.symbols.push(symbol);
  });

  const roots = [];
  map.forEach((scope) => {
    const parentId = scope.parentId ?? scope.parent ?? null;
    if (parentId !== null && parentId !== undefined && map.has(parentId)) {
      map.get(parentId).children.push(scope);
    } else {
      roots.push(scope);
    }
  });

  return roots.length ? roots : [...map.values()];
}

function renderScope(scope, depth = 0) {
  const isRoot = depth === 0;
  const border = isRoot ? "#06b6d440" : "#3b82f640";
  const background = isRoot ? "#06b6d408" : "#3b82f608";

  return (
    <div key={`${scope.id}-${scopeTitle(scope)}-${depth}`} style={{ border: `1px solid ${border}`, background, borderRadius: 8, padding: 12, marginTop: depth ? 10 : 0, marginLeft: depth ? 12 : 0 }}>
      <div style={{ color: "#e2e8f0", fontWeight: 800, fontSize: 13, marginBottom: 8 }}>{scopeTitle(scope)}</div>
      <div style={{ display: "grid", gap: 6 }}>
        {(scope.symbols || []).map((symbol, index) => (
          <div key={`${symbolName(symbol)}-${index}`} style={{ color: "#cbd5e1", fontFamily: "monospace", fontSize: 12 }}>
            <span style={{ color: kindColor(kindOf(symbol)) }}>●</span> {symbolName(symbol)} : {symbolType(symbol)} <span style={{ color: isUsed(symbol) ? "#22c55e" : "#f97316" }}>{isUsed(symbol) ? "✓" : "✗"}</span>
          </div>
        ))}
        {!(scope.symbols || []).length && <div style={{ color: "#64748b", fontSize: 12 }}>No direct symbols</div>}
      </div>
      {(scope.children || []).map((child) => renderScope(child, depth + 1))}
    </div>
  );
}

function buildTypeChecks(symbols) {
  return symbols.map((symbol) => {
    const kind = kindOf(symbol);
    if (kind === "function") {
      return {
        expression: `return ${symbolType(symbol)}`,
        left: symbolType(symbol),
        op: "matches",
        right: "function return",
        valid: true,
      };
    }
    return {
      expression: `${symbolName(symbol)} = ${symbolType(symbol)}`,
      left: symbolType(symbol),
      op: "=",
      right: symbolType(symbol),
      valid: isInit(symbol),
    };
  });
}

export default function SemanticDescription({ phaseColor = "#06b6d4", symbols = [], scopes = [] }) {
  const scopeTree = useMemo(() => buildScopeTree(scopes, symbols), [scopes, symbols]);
  const checks = useMemo(() => buildTypeChecks(symbols), [symbols]);

  const stats = useMemo(() => {
    const functions = symbols.filter((symbol) => kindOf(symbol) === "function").length;
    const variables = symbols.filter((symbol) => kindOf(symbol) === "variable").length;
    const parameters = symbols.filter((symbol) => kindOf(symbol) === "parameter" || kindOf(symbol) === "param").length;
    const unused = symbols.filter((symbol) => !isUsed(symbol)).length;
    return [
      ["Symbols", symbols.length],
      ["Functions", functions],
      ["Variables", variables],
      ["Parameters", parameters],
      ["Scopes", scopes.length || scopeTree.length],
      ["Unused", unused],
    ];
  }, [symbols, scopes.length, scopeTree.length]);

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
          <div style={sectionLabel(phaseColor)}>Symbols verified</div>
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {symbols.length ? symbols.map((symbol, index) => {
              const kind = kindOf(symbol);
              const color = kindColor(kind);
              return (
                <div key={`${symbolName(symbol)}-${index}`} style={{ background: "#111827", borderLeft: `3px solid ${color}`, borderRadius: "0 8px 8px 0", padding: "10px 12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                    <span style={{ color: "#f8fafc", fontFamily: "monospace", fontWeight: 800 }}>{symbolName(symbol)}</span>
                    <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <span style={{ color, border: `1px solid ${color}`, background: `${color}18`, borderRadius: 999, padding: "3px 7px", fontSize: 11 }}>{kind}</span>
                      <span style={{ color: phaseColor, border: `1px solid ${phaseColor}66`, background: `${phaseColor}14`, borderRadius: 999, padding: "3px 7px", fontSize: 11 }}>{symbolType(symbol)}</span>
                    </span>
                  </div>
                  <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 7 }}>
                    Scope {symbolScope(symbol)} · Line {symbol.line ?? symbol.l ?? "-"} · {isUsed(symbol) ? "✓ used" : "✗ unused"} · {isInit(symbol) ? "✓ init" : "✗ not init"}
                  </div>
                </div>
              );
            }) : <div style={bodyText}>No symbol entries are available yet.</div>}
          </div>
        </section>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <section style={cardBase(phaseColor)}>
          <div style={sectionLabel(phaseColor)}>Scope hierarchy</div>
          <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
            {scopeTree.length ? scopeTree.map((scope) => renderScope(scope)) : <div style={bodyText}>No scopes are available yet.</div>}
          </div>
        </section>

        <section style={cardBase(phaseColor)}>
          <div style={sectionLabel(phaseColor)}>Type checks performed</div>
          <div style={{ background: "#111827", border: "1px solid #2a3a55", borderRadius: 8, overflow: "hidden", marginTop: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 56px 1fr 38px", gap: 8, padding: "8px 10px", color: "#94a3b8", fontSize: 11, fontWeight: 800 }}>
              <span>Expression</span><span>Left type</span><span>Op</span><span>Right type</span><span />
            </div>
            {checks.length ? checks.map((check, index) => (
              <div key={`${check.expression}-${index}`} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 56px 1fr 38px", gap: 8, padding: "8px 10px", borderTop: "1px solid #1f2937", color: "#cbd5e1", fontFamily: "monospace", fontSize: 11 }}>
                <span>{check.expression}</span>
                <span>{check.left}</span>
                <span>{check.op}</span>
                <span>{check.right}</span>
                <span style={{ color: check.valid ? "#22c55e" : "#f97316" }}>{check.valid ? "✅" : "❌"}</span>
              </div>
            )) : <div style={{ ...bodyText, padding: 10 }}>No type checks are available yet.</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
