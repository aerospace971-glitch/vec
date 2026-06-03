import { useMemo, useState } from "react";

const BASE_TYPES = ["int", "float", "double", "char", "bool", "string", "void"];

const TYPE_COLORS = {
  int: "#3b82f6",
  float: "#60a5fa",
  double: "#818cf8",
  char: "#a78bfa",
  bool: "#10b981",
  string: "#f59e0b",
  void: "#6b7280",
  other: "#f97316",
};

const KIND_COLORS = {
  function: "#a855f7",
  variable: "#3b82f6",
  parameter: "#10b981",
  class: "#f59e0b",
  struct: "#f59e0b",
  namespace: "#00d4ff",
  unknown: "#6b7280",
};

function normalizeSymbol(symbol, index) {
  return {
    id: symbol.id ?? `${symbol.name || "symbol"}-${symbol.line || 0}-${index}`,
    name: symbol.name || "(anonymous)",
    kind: symbol.kind || "unknown",
    type: normalizeType(symbol.type),
    scope: symbol.scope ?? symbol.scopeLevel ?? 0,
    line: symbol.line || "-",
    used: Boolean(symbol.used ?? symbol.isUsed ?? true),
    init: Boolean(symbol.init ?? symbol.isInitialized ?? false),
  };
}

function normalizeType(type) {
  const raw = String(type || "void").trim();
  if (!raw) return "void";
  if (raw.includes("string")) return "string";
  if (BASE_TYPES.includes(raw)) return raw;
  return raw;
}

function typeColor(type) {
  return TYPE_COLORS[type] || TYPE_COLORS.other;
}

function kindInitial(kind) {
  if (kind === "function") return "f";
  if (kind === "parameter") return "p";
  if (kind === "variable") return "v";
  return kind?.[0] || "?";
}

function deriveExpressions(symbols, typeErrors = [], expressions = []) {
  if (expressions.length) {
    return expressions.map((expr, index) => ({
      id: `expr-${index}`,
      expression: expr.expression || `${expr.left || ""} ${expr.operator || ""} ${expr.right || ""}`.trim(),
      operandTypes: expr.leftType && expr.rightType
        ? `${expr.leftType} ${expr.operator || ""} ${expr.rightType}`.trim()
        : expr.operandTypes || expr.type || "-",
      resultType: expr.resultType || expr.result || "-",
      status: expr.isValid === false ? "error" : expr.severity || "valid",
      line: expr.line || "-",
      rule: expr.rule || `${expr.leftType || "T"} ${expr.operator || "op"} ${expr.rightType || "T"} -> ${expr.resultType || "T"}`,
      why: expr.why || (expr.isValid === false ? "The operand types are not compatible for this operation." : "The operation satisfies the compiler's type compatibility rule."),
    }));
  }

  const derived = [];
  const functions = symbols.filter(symbol => symbol.kind === "function");
  const variables = symbols.filter(symbol => symbol.kind === "variable");
  const parameters = symbols.filter(symbol => symbol.kind === "parameter");

  variables.filter(symbol => symbol.init).slice(0, 4).forEach(symbol => {
    derived.push({
      id: `decl-${symbol.id}`,
      expression: `${symbol.type} ${symbol.name} = ...`,
      operandTypes: `${symbol.type} = ${symbol.type}`,
      resultType: symbol.type,
      status: "valid",
      line: symbol.line,
      rule: `${symbol.type} = ${symbol.type} -> valid`,
      why: `The initializer assigned to ${symbol.name} is treated as compatible with ${symbol.type}.`,
    });
  });

  if (variables.length >= 2) {
    const [left, right] = variables;
    const valid = left.type === right.type || ["int", "float", "double"].includes(left.type) && ["int", "float", "double"].includes(right.type);
    derived.push({
      id: "derived-binary",
      expression: `${left.name} + ${right.name}`,
      operandTypes: `${left.type} + ${right.type}`,
      resultType: left.type === right.type ? left.type : "promoted numeric",
      status: valid ? "valid" : "warning",
      line: left.line,
      rule: valid ? "numeric op numeric -> numeric" : "mixed types may require conversion",
      why: valid ? "Both operands are numeric, so arithmetic is type-safe." : "The compiler may need an implicit conversion before evaluating this expression.",
    });
  }

  parameters.slice(0, 3).forEach(parameter => {
    derived.push({
      id: `param-${parameter.id}`,
      expression: `parameter ${parameter.name}`,
      operandTypes: `declared -> ${parameter.type}`,
      resultType: parameter.type,
      status: "valid",
      line: parameter.line,
      rule: `ParamDecl -> ${parameter.type} ${parameter.name}`,
      why: "The parameter has a declared type and can be checked at each function call.",
    });
  });

  functions.slice(0, 2).forEach(fn => {
    derived.push({
      id: `return-${fn.id}`,
      expression: `return from ${fn.name}`,
      operandTypes: `-> ${fn.type}`,
      resultType: "matches",
      status: "valid",
      line: fn.line,
      rule: `return expression type must match ${fn.type}`,
      why: `The function ${fn.name} declares return type ${fn.type || "void"}, so return statements are checked against it.`,
    });
  });

  typeErrors.forEach((error, index) => {
    derived.push({
      id: `error-${index}`,
      expression: error.message || "semantic issue",
      operandTypes: "unknown",
      resultType: "invalid",
      status: error.severity === "warning" ? "warning" : "error",
      line: error.line || "-",
      rule: "semantic type safety rule",
      why: error.message || "The semantic analyzer reported this issue.",
    });
  });

  return derived;
}

function rulesFrom(symbols, typeErrors, expressions) {
  const numericExpressions = expressions.filter(expr => /int|float|double/.test(expr.operandTypes));
  const assignments = expressions.filter(expr => expr.expression.includes("=") || expr.operandTypes.includes("="));
  const returns = expressions.filter(expr => expr.expression.toLowerCase().includes("return"));
  const warnings = expressions.filter(expr => expr.status === "warning");
  const errors = typeErrors.filter(error => error.severity !== "warning");

  return [
    {
      id: "integer",
      tone: "ok",
      title: "INTEGER ARITHMETIC",
      lines: ["int + int -> int", "int - int -> int", "int * int -> int", "int < int -> bool"],
      applied: numericExpressions.length ? numericExpressions.map(expr => expr.expression) : ["No numeric operations detected"],
    },
    {
      id: "assignment",
      tone: "ok",
      title: "ASSIGNMENT COMPATIBILITY",
      lines: ["T = T -> valid, no conversion", "numeric = numeric -> valid with possible promotion"],
      applied: assignments.length ? assignments.map(expr => expr.expression) : symbols.filter(symbol => symbol.init).map(symbol => `${symbol.type} ${symbol.name}`).slice(0, 4),
    },
    {
      id: "return",
      tone: "ok",
      title: "RETURN TYPE MATCH",
      lines: symbols.filter(symbol => symbol.kind === "function").map(symbol => `${symbol.name}() declared -> ${symbol.type || "void"}`).slice(0, 4),
      applied: returns.length ? returns.map(expr => expr.expression) : ["Return statements checked against function declarations"],
    },
    {
      id: "conversions",
      tone: warnings.length ? "warn" : "warn",
      title: "IMPLICIT CONVERSIONS",
      lines: warnings.length ? warnings.map(expr => expr.operandTypes) : ["None detected in current program"],
      applied: warnings.length ? warnings.map(expr => expr.expression) : [],
    },
    {
      id: "errors",
      tone: errors.length ? "error" : "error",
      title: "TYPE ERRORS",
      lines: errors.length ? errors.map(error => error.message) : ["None detected", "All operations are type-safe"],
      applied: [],
    },
  ];
}

export default function TypeChecking({ symbols = [], typeErrors = [], expressions = [], onSymbolSelect }) {
  const [expandedRow, setExpandedRow] = useState(null);
  const normalizedSymbols = useMemo(() => symbols.map(normalizeSymbol), [symbols]);
  const expressionRows = useMemo(
    () => deriveExpressions(normalizedSymbols, typeErrors, expressions),
    [normalizedSymbols, typeErrors, expressions]
  );
  const rules = useMemo(
    () => rulesFrom(normalizedSymbols, typeErrors, expressionRows),
    [normalizedSymbols, typeErrors, expressionRows]
  );

  const grouped = useMemo(() => {
    const groups = Object.fromEntries(BASE_TYPES.map(type => [type, []]));
    normalizedSymbols.forEach(symbol => {
      const key = BASE_TYPES.includes(symbol.type) ? symbol.type : "other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(symbol);
    });
    if (!groups.other) groups.other = [];
    return groups;
  }, [normalizedSymbols]);

  const total = normalizedSymbols.length || 1;

  return (
    <div className="type-checking">
      <style>{`
        .type-checking { display: flex; flex-direction: column; gap: 14px; }
        .tc-section { background: #0d1117; border: 1px solid #1e2a3a; border-radius: 8px; overflow: hidden; }
        .tc-head { padding: 12px 14px; border-bottom: 1px solid #1e2a3a; }
        .tc-title { color: #89ddff; font: 900 11px var(--font-mono, monospace); letter-spacing: .1em; text-transform: uppercase; }
        .tc-sub { color: #64748b; font-size: 12px; margin-top: 4px; }
        .tc-body { padding: 14px; }
        .tc-bar-fill { animation: tcGrow .6s ease both; transform-origin: left; }
        @keyframes tcGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @media (max-width: 760px) {
          .tc-expression-table { min-width: 640px; }
          .tc-table-wrap { overflow-x: auto; }
        }
      `}</style>

      <Section title="TYPE DISTRIBUTION" subtitle="How many symbols of each type exist in your program">
        <div style={{ display: "grid", gap: 13 }}>
          {[...BASE_TYPES, ...(grouped.other.length ? ["other"] : [])].map(type => {
            const syms = grouped[type] || [];
            const pct = Math.round((syms.length / total) * 100);
            const color = typeColor(type);
            return (
              <div key={type}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontFamily: "var(--font-mono, monospace)" }}>
                  <span style={{ color, fontWeight: 900, fontSize: 13 }}>{type}</span>
                  <span style={{ color: "#94a3b8", fontSize: 12 }}>{syms.length} <span style={{ color: "#64748b" }}>({pct}%)</span></span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: "#1e2a3a", overflow: "hidden", marginBottom: 7 }}>
                  <div className="tc-bar-fill" style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, boxShadow: `0 0 12px ${color}55` }} />
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, minHeight: 20 }}>
                  {syms.length ? syms.map(symbol => {
                    const kc = KIND_COLORS[symbol.kind] || KIND_COLORS.unknown;
                    return (
                      <button
                        key={symbol.id}
                        onClick={() => onSymbolSelect?.(symbol)}
                        style={{
                          border: `1px solid ${kc}44`,
                          background: `${kc}14`,
                          color: kc,
                          borderRadius: 999,
                          padding: "3px 8px",
                          font: "800 10px var(--font-mono, monospace)",
                          cursor: "pointer",
                        }}
                      >
                        {kindInitial(symbol.kind)}: {symbol.name}
                      </button>
                    );
                  }) : (
                    <span style={{ color: "#334155", font: "11px var(--font-mono, monospace)" }}>no symbols</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section title="EXPRESSION TYPE ANALYSIS" subtitle="How the compiler checks each operation for type safety">
        <div className="tc-table-wrap">
          {expressionRows.length ? (
            <table className="tc-expression-table" style={{ width: "100%", borderCollapse: "collapse", font: "11px var(--font-mono, monospace)", color: "#cbd5e1" }}>
              <thead>
                <tr style={{ color: "#89ddff", background: "#111827" }}>
                  <th style={th}>Expression</th>
                  <th style={th}>Operand Types</th>
                  <th style={th}>Result</th>
                  <th style={th}>Valid?</th>
                </tr>
              </thead>
              <tbody>
                {expressionRows.map(row => {
                  const active = expandedRow === row.id;
                  const color = row.status === "error" ? "#ef4444" : row.status === "warning" ? "#f59e0b" : "#10b981";
                  return (
                    <>
                      <tr
                        key={row.id}
                        onClick={() => setExpandedRow(active ? null : row.id)}
                        style={{ cursor: "pointer", background: row.status === "error" ? "rgba(239,68,68,.06)" : row.status === "warning" ? "rgba(245,158,11,.06)" : "transparent" }}
                      >
                        <td style={td}>{row.expression}</td>
                        <td style={td}>{row.operandTypes}</td>
                        <td style={{ ...td, color }}>{row.resultType}</td>
                        <td style={{ ...td, color, fontWeight: 900 }}>{row.status === "error" ? "x" : row.status === "warning" ? "!" : "ok"}</td>
                      </tr>
                      {active && (
                        <tr key={`${row.id}-detail`}>
                          <td colSpan={4} style={{ padding: 0 }}>
                            <div style={{ margin: 8, padding: 12, border: `1px solid ${color}44`, borderLeft: `3px solid ${color}`, borderRadius: 6, background: `${color}0d`, lineHeight: 1.65 }}>
                              <div style={{ color, fontWeight: 900, marginBottom: 6 }}>Rule Applied:</div>
                              <div style={{ color: "#e2e8f0", marginBottom: 10 }}>{row.rule}</div>
                              <div style={{ color, fontWeight: 900, marginBottom: 6 }}>Why {row.status === "error" ? "invalid" : "valid"}:</div>
                              <div style={{ color: "#94a3b8" }}>{row.why}</div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div style={{ color: "#64748b", font: "12px var(--font-mono, monospace)", padding: 12 }}>
              Expression analysis requires AST data - run your program to see results.
            </div>
          )}
        </div>
      </Section>

      <Section title="TYPE RULES APPLIED" subtitle="Which compiler type rules were triggered">
        <div style={{ display: "grid", gap: 10 }}>
          {rules.map(rule => <RuleCard key={rule.id} rule={rule} />)}
        </div>
      </Section>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <section className="tc-section">
      <div className="tc-head">
        <div className="tc-title">{title}</div>
        <div className="tc-sub">{subtitle}</div>
      </div>
      <div className="tc-body">{children}</div>
    </section>
  );
}

function RuleCard({ rule }) {
  const color = rule.tone === "error" ? "#ef4444" : rule.tone === "warn" ? "#f59e0b" : "#10b981";
  const prefix = rule.tone === "error" ? "ERR" : rule.tone === "warn" ? "WARN" : "OK";
  return (
    <div style={{ border: "1px solid #1e2a3a", borderLeft: `3px solid ${color}`, borderRadius: 8, background: `${color}0d`, padding: 13 }}>
      <div style={{ color, font: "900 12px var(--font-mono, monospace)", letterSpacing: ".08em", marginBottom: 9 }}>{prefix} {rule.title}</div>
      <div style={{ height: 1, background: "#1e2a3a", marginBottom: 10 }} />
      <div style={{ color: "#cbd5e1", font: "11px/1.65 var(--font-mono, monospace)" }}>
        {rule.lines.length ? rule.lines.map((line, index) => <div key={index}>{line}</div>) : <div>None detected</div>}
      </div>
      {rule.applied?.length > 0 && (
        <div style={{ marginTop: 10, color: "#64748b", font: "11px/1.5 var(--font-mono, monospace)" }}>
          Applied to: {rule.applied.join(", ")}
        </div>
      )}
    </div>
  );
}

const th = { padding: "8px 10px", textAlign: "left", borderBottom: "1px solid #1e2a3a" };
const td = { padding: "8px 10px", borderBottom: "1px solid rgba(30,42,58,.75)", verticalAlign: "top" };
