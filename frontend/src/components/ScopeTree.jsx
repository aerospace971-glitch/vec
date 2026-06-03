import { useMemo, useState } from "react";

const SCOPE_STYLES = {
  global:   { color: "#00d4ff", icon: "G", title: scope => `GLOBAL SCOPE`, pad: 16, radius: 8 },
  function: { color: "#a855f7", icon: "f", title: scope => `FUNCTION ${scope.name || "fn"}()${scope.returnType ? ` -> ${scope.returnType}` : ""}`, pad: 12, radius: 6 },
  block:    { color: "#3b82f6", icon: "B", title: () => "BLOCK SCOPE", pad: 10, radius: 6 },
  class:    { color: "#f59e0b", icon: "C", title: scope => `CLASS ${scope.name || "scope"}`, pad: 12, radius: 6 },
  struct:   { color: "#f59e0b", icon: "S", title: scope => `STRUCT ${scope.name || "scope"}`, pad: 12, radius: 6 },
  loop:     { color: "#f97316", icon: "L", title: () => "LOOP SCOPE", pad: 10, radius: 6 },
  if:       { color: "#f97316", icon: "I", title: () => "IF SCOPE", pad: 10, radius: 6 },
};

const SYMBOL_STYLES = {
  function:  { color: "#a855f7", icon: "f" },
  variable:  { color: "#3b82f6", icon: "v" },
  parameter: { color: "#10b981", icon: "p" },
  class:     { color: "#f59e0b", icon: "c" },
  struct:    { color: "#f59e0b", icon: "s" },
  namespace: { color: "#00d4ff", icon: "n" },
  unknown:   { color: "#6b7280", icon: "?" },
};

function boolValue(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  return Boolean(value);
}

function normalizeSymbols(symbols = []) {
  return symbols.map((symbol, index) => ({
    id: symbol.id ?? `${symbol.name || "symbol"}-${symbol.line || 0}-${index}`,
    name: symbol.name || "(anonymous)",
    kind: symbol.kind || "unknown",
    type: symbol.type || "void",
    scope: Number(symbol.scope ?? symbol.scopeLevel ?? 0),
    line: symbol.line || "-",
    used: boolValue(symbol.used ?? symbol.isUsed, true),
    init: boolValue(symbol.init ?? symbol.isInitialized, false),
    uses: symbol.uses ?? symbol.useCount ?? (symbol.isUsed ? 1 : 0),
    raw: symbol,
  }));
}

function inferScopesFromSymbols(symbols) {
  const levels = [...new Set([0, ...symbols.map(symbol => symbol.scope)])].sort((a, b) => a - b);
  return levels.map(level => {
    const firstFunction = symbols.find(symbol => symbol.scope === level && symbol.kind === "function");
    const firstClass = symbols.find(symbol => symbol.scope === level && ["class", "struct"].includes(symbol.kind));
    if (level === 0) return { id: 0, kind: "global", name: "global", parentId: null };
    if (firstFunction) {
      return { id: level, kind: "function", name: firstFunction.name, returnType: firstFunction.type, parentId: Math.max(0, level - 1) };
    }
    if (firstClass) {
      return { id: level, kind: firstClass.kind, name: firstClass.name, parentId: Math.max(0, level - 1) };
    }
    return { id: level, kind: "block", name: `scope ${level}`, parentId: Math.max(0, level - 1) };
  });
}

function normalizeScopes(scopes = [], symbols = []) {
  const base = scopes.length ? scopes : inferScopesFromSymbols(symbols);
  const ids = new Set(base.map(scope => Number(scope.id)));
  if (!ids.has(0)) base.unshift({ id: 0, kind: "global", name: "global", parentId: null });
  return base.map(scope => ({
    id: Number(scope.id),
    kind: scope.kind || (Number(scope.id) === 0 ? "global" : "block"),
    name: scope.name || (Number(scope.id) === 0 ? "global" : `scope ${scope.id}`),
    parentId: scope.parentId === undefined ? (Number(scope.id) === 0 ? null : Math.max(0, Number(scope.id) - 1)) : scope.parentId,
    returnType: scope.returnType || scope.type || "",
  }));
}

function buildTree(scopes, symbols) {
  const nodes = new Map();
  scopes.forEach(scope => nodes.set(scope.id, { ...scope, symbols: [], children: [] }));
  if (!nodes.has(0)) nodes.set(0, { id: 0, kind: "global", name: "global", parentId: null, symbols: [], children: [] });

  symbols.forEach(symbol => {
    if (!nodes.has(symbol.scope)) {
      nodes.set(symbol.scope, { id: symbol.scope, kind: "block", name: `scope ${symbol.scope}`, parentId: Math.max(0, symbol.scope - 1), symbols: [], children: [] });
    }
    nodes.get(symbol.scope).symbols.push(symbol);
  });

  const root = nodes.get(0);
  [...nodes.values()]
    .filter(scope => scope.id !== 0)
    .sort((a, b) => a.id - b.id)
    .forEach(scope => {
      const parent = nodes.get(Number(scope.parentId)) || root;
      parent.children.push(scope);
    });
  return root;
}

function flattenScopes(scope, output = []) {
  if (!scope) return output;
  output.push(scope);
  scope.children.forEach(child => flattenScopes(child, output));
  return output;
}

export default function ScopeTree({ symbols = [], scopes = [] }) {
  const normalizedSymbols = useMemo(() => normalizeSymbols(symbols), [symbols]);
  const normalizedScopes = useMemo(() => normalizeScopes(scopes, normalizedSymbols), [scopes, normalizedSymbols]);
  const tree = useMemo(() => buildTree(normalizedScopes, normalizedSymbols), [normalizedScopes, normalizedSymbols]);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [selectedSymbol, setSelectedSymbol] = useState(null);
  const [highlightUnused, setHighlightUnused] = useState(false);

  const allScopes = flattenScopes(tree);
  const unusedCount = normalizedSymbols.filter(symbol => !symbol.used).length;
  const functionCount = allScopes.filter(scope => scope.kind === "function").length;
  const blockCount = allScopes.filter(scope => scope.kind === "block").length;

  function toggleScope(id) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (!normalizedSymbols.length && allScopes.length <= 1) {
    return (
      <div style={{ background: "#0a0a0f", border: "1px solid #1e2a3a", borderRadius: 8, padding: 34, textAlign: "center", color: "#64748b", fontFamily: "var(--font-mono, monospace)", animation: "scopeEmptyPulse 1.8s ease-in-out infinite" }}>
        <style>{`@keyframes scopeEmptyPulse { 50% { border-color: rgba(0,212,255,.45); box-shadow: 0 0 20px rgba(0,212,255,.08); } }`}</style>
        Run your program to generate scope tree
      </div>
    );
  }

  return (
    <div className="scope-tree-shell">
      <style>{`
        .scope-tree-shell { background: #0a0a0f; border: 1px solid #1e2a3a; border-radius: 8px; overflow: hidden; }
        .scope-header { padding: 14px 16px; background: #0d1117; border-bottom: 1px solid #1e2a3a; }
        .scope-pill { border: 1px solid #1e2a3a; border-radius: 999px; padding: 5px 10px; background: #111827; color: #94a3b8; font: 800 10px var(--font-mono, monospace); cursor: pointer; }
        .scope-pill-active { color: #f97316; border-color: rgba(249,115,22,.55); background: rgba(249,115,22,.12); box-shadow: 0 0 16px rgba(249,115,22,.16); }
        @media (max-width: 760px) {
          .scope-header { padding: 12px; }
          .scope-body { padding: 10px !important; overflow-x: auto; }
          .scope-symbol-row { grid-template-columns: 18px minmax(90px,1fr) 70px 52px 42px 42px !important; font-size: 10px !important; }
        }
      `}</style>

      <div className="scope-header">
        <div style={{ color: "#00d4ff", font: "900 11px var(--font-mono, monospace)", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 10 }}>
          Scope Hierarchy <span style={{ color: "#64748b", fontWeight: 500 }}>- click containers to collapse</span>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="scope-pill">Global: 1</button>
          <button className="scope-pill">Functions: {functionCount}</button>
          <button className="scope-pill">Blocks: {blockCount}</button>
          <button className="scope-pill">Total Symbols: {normalizedSymbols.length}</button>
          <button onClick={() => setHighlightUnused(value => !value)} className={`scope-pill ${highlightUnused ? "scope-pill-active" : ""}`}>
            Unused: {unusedCount}
          </button>
        </div>
      </div>

      <div className="scope-body" style={{ padding: 14 }}>
        <ScopeBox
          scope={tree}
          collapsed={collapsed}
          onToggle={toggleScope}
          selectedSymbol={selectedSymbol}
          onSelectSymbol={setSelectedSymbol}
          highlightUnused={highlightUnused}
        />
        {tree.children.length === 0 && (
          <div style={{ marginTop: 10, color: "#64748b", font: "11px var(--font-mono, monospace)", textAlign: "center" }}>
            No nested scopes detected
          </div>
        )}
      </div>

      {selectedSymbol && (
        <div style={{ borderTop: "1px solid #1e2a3a", background: "#0d1117", padding: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 8 }}>
            {[
              ["Name", selectedSymbol.name],
              ["Kind", selectedSymbol.kind],
              ["Type", selectedSymbol.type],
              ["Scope", selectedSymbol.scope],
              ["Declared", `line ${selectedSymbol.line}`],
              ["Used", selectedSymbol.used ? `yes (${selectedSymbol.uses || 1} time${(selectedSymbol.uses || 1) === 1 ? "" : "s"})` : "no"],
              ["Init", selectedSymbol.init ? "yes" : "no"],
            ].map(([label, value]) => (
              <div key={label} style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 6, padding: "8px 10px" }}>
                <div style={{ color: "#64748b", font: "800 9px var(--font-mono, monospace)", textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
                <div style={{ color: "#e2e8f0", font: "12px var(--font-mono, monospace)" }}>{String(value)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ScopeBox({ scope, collapsed, onToggle, selectedSymbol, onSelectSymbol, highlightUnused, depth = 0 }) {
  const style = SCOPE_STYLES[scope.kind] || SCOPE_STYLES.block;
  const open = !collapsed.has(scope.id);
  const hiddenCount = countHidden(scope);
  const title = style.title(scope);

  return (
    <div style={{
      border: `2px solid ${style.color}`,
      background: `${style.color}0a`,
      borderRadius: style.radius,
      padding: style.pad,
      margin: depth === 0 ? 0 : "8px 0 0 8px",
      minWidth: 420,
      boxShadow: depth === 0 ? `0 0 24px ${style.color}0f` : "none",
    }}>
      <div
        onClick={() => onToggle(scope.id)}
        style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none", marginBottom: open ? 10 : 0 }}
      >
        <span style={{ color: style.color, font: "900 12px var(--font-mono, monospace)", width: 18 }}>{style.icon}</span>
        <span style={{ color: style.color, font: "900 12px var(--font-mono, monospace)", letterSpacing: ".5px", textTransform: "uppercase" }}>{title}</span>
        <span style={{ marginLeft: "auto", color: "#94a3b8", border: "1px solid #1e2a3a", background: "#0f172a", borderRadius: 999, padding: "3px 8px", font: "800 10px var(--font-mono, monospace)" }}>
          Scope {scope.id}
        </span>
      </div>

      <div style={{ overflow: "hidden", transition: "max-height .3s ease, opacity .3s ease", maxHeight: open ? 2000 : 28, opacity: open ? 1 : 0.72 }}>
        {!open ? (
          <div style={{ color: "#64748b", font: "11px var(--font-mono, monospace)" }}>{hiddenCount} symbols hidden</div>
        ) : (
          <>
            <div style={{ display: "grid", gap: 6 }}>
              {scope.symbols.map(symbol => (
                <SymbolRow
                  key={symbol.id}
                  symbol={symbol}
                  selected={selectedSymbol?.id === symbol.id}
                  onSelect={onSelectSymbol}
                  highlightUnused={highlightUnused}
                />
              ))}
            </div>
            {scope.children.map(child => (
              <ScopeBox
                key={child.id}
                scope={child}
                collapsed={collapsed}
                onToggle={onToggle}
                selectedSymbol={selectedSymbol}
                onSelectSymbol={onSelectSymbol}
                highlightUnused={highlightUnused}
                depth={depth + 1}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function SymbolRow({ symbol, selected, onSelect, highlightUnused }) {
  const style = SYMBOL_STYLES[symbol.kind] || SYMBOL_STYLES.unknown;
  const unused = !symbol.used;
  const faded = highlightUnused && !unused;
  return (
    <div
      className="scope-symbol-row"
      onClick={event => {
        event.stopPropagation();
        onSelect(symbol);
      }}
      title={`Name: ${symbol.name}\nKind: ${symbol.kind}\nType: ${symbol.type}\nScope: ${symbol.scope}\nLine: ${symbol.line}\nUsed: ${symbol.used ? "yes" : "no"}\nInit: ${symbol.init ? "yes" : "no"}`}
      style={{
        display: "grid",
        gridTemplateColumns: "22px minmax(120px, 1fr) 90px 70px 56px 56px",
        alignItems: "center",
        gap: 8,
        padding: "7px 9px",
        borderRadius: 6,
        cursor: "pointer",
        border: selected ? `1px solid ${style.color}` : "1px solid rgba(255,255,255,.06)",
        borderLeft: unused ? "2px solid #f97316" : selected ? `2px solid ${style.color}` : "2px solid transparent",
        background: selected ? `${style.color}22` : unused ? "rgba(249,115,22,.08)" : "rgba(255,255,255,.025)",
        boxShadow: highlightUnused && unused ? "0 0 16px rgba(249,115,22,.22)" : selected ? `0 0 16px ${style.color}22` : "none",
        opacity: faded ? 0.4 : 1,
        color: "#cbd5e1",
        font: "11px var(--font-mono, monospace)",
        transition: "background .15s ease, opacity .15s ease, box-shadow .15s ease",
      }}
    >
      <span style={{ color: style.color, fontWeight: 900 }}>{style.icon}</span>
      <span style={{ color: style.color, fontWeight: 900, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{symbol.name}</span>
      <span style={{ color: "#00d4ff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{symbol.type}</span>
      <span style={{ color: "#64748b" }}>line {symbol.line}</span>
      <span style={{ color: symbol.used ? "#10b981" : "#ef4444", fontWeight: 900 }}>{symbol.used ? "✓ used" : "✗ used"}</span>
      <span style={{ color: symbol.init ? "#10b981" : "#ef4444", fontWeight: 900 }}>{symbol.init ? "✓ init" : "✗ init"}</span>
      {unused && (
        <span style={{ gridColumn: "1 / -1", color: "#f97316", font: "800 9px var(--font-mono, monospace)", letterSpacing: ".5px" }}>
          WARNING: unused symbol
        </span>
      )}
    </div>
  );
}

function countHidden(scope) {
  return scope.symbols.length + scope.children.reduce((sum, child) => sum + countHidden(child), 0);
}
