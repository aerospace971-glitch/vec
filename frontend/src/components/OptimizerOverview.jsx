import { useMemo, useRef, useState } from "react";

const PASS_COLORS = {
  "Function Inlining": "#a855f7",
  "Constant Propagation": "#00d4ff",
  "Dead Code Elim": "#10b981",
  "Dead Code Elimination": "#10b981",
  "Common Subexpr": "#f59e0b",
  "Common Subexpression Elimination": "#f59e0b",
  "Loop Optimization": "#f97316",
  "Loop Unrolling": "#f97316",
  "Constant Folding": "#06ffa5",
  "Copy Propagation": "#c792ea",
  "Strength Reduction": "#f97316",
  "Peephole Optimization": "#4d9fff",
};

const DEFAULT_COLOR = "#6b7280";

function passColor(pass) {
  return PASS_COLORS[pass] || DEFAULT_COLOR;
}

function lineText(instr) {
  return instr?.instruction || instr?.code || [instr?.result, instr?.arg1, instr?.arg2].filter(Boolean).join(" ") || "";
}

function normalizeInstruction(instr, index) {
  return {
    line: Number(instr?.line ?? instr?.id ?? index + 1),
    instruction: lineText(instr),
    op: instr?.op || "",
  };
}

function normalizeOptimization(change, index) {
  const after = change.after ?? "";
  return {
    pass: change.pass || "Optimization",
    lineNumber: Number(change.lineNumber ?? change.instrId ?? index + 1),
    before: change.before || "",
    after,
    type: change.type || (after === "-- REMOVED --" ? "removed" : "modified"),
    description: change.description || change.reason || "Optimization transformed this instruction.",
  };
}

function summarizePass(pass, count) {
  const lower = pass.toLowerCase();
  if (lower.includes("inlin")) return `${count} call${count === 1 ? "" : "s"} inlined`;
  if (lower.includes("propagation")) return `${count} value${count === 1 ? "" : "s"} resolved`;
  if (lower.includes("dead")) return `${count} instruction${count === 1 ? "" : "s"} removed`;
  if (lower.includes("common")) return `${count} expression${count === 1 ? "" : "s"} reused`;
  if (lower.includes("loop")) return `${count} loop change${count === 1 ? "" : "s"} applied`;
  if (lower.includes("fold")) return `${count} constant expression${count === 1 ? "" : "s"} folded`;
  return `${count} change${count === 1 ? "" : "s"} applied`;
}

function makeNetResult(beforeCount, afterCount) {
  const delta = afterCount - beforeCount;
  if (delta === 0) return { text: "Net result: no instruction count change", color: "#f59e0b" };
  if (delta > 0) return { text: `Net result: +${delta} instruction${delta === 1 ? "" : "s"} (expanded)`, color: "#ef4444" };
  const saved = Math.abs(delta);
  const pct = beforeCount > 0 ? Math.round((saved / beforeCount) * 100) : 0;
  return { text: `Net result: -${saved} instruction${saved === 1 ? "" : "s"} (${pct}% reduction)`, color: "#10b981" };
}

export default function OptimizerOverview({
  beforeInstructions = [],
  afterInstructions = [],
  optimizations = [],
  passes = [],
}) {
  const before = useMemo(() => beforeInstructions.map(normalizeInstruction), [beforeInstructions]);
  const after = useMemo(() => afterInstructions.map(normalizeInstruction), [afterInstructions]);
  const changes = useMemo(() => optimizations.map(normalizeOptimization), [optimizations]);
  const allPasses = useMemo(() => {
    const names = passes.length ? passes : changes.map(change => change.pass);
    return [...new Set(names.filter(Boolean))];
  }, [passes, changes]);

  const [activePass, setActivePass] = useState("all");
  const [tooltip, setTooltip] = useState(null);
  const beforeScrollRef = useRef(null);
  const afterScrollRef = useRef(null);
  const syncLock = useRef(false);

  const filteredChanges = activePass === "all" ? changes : changes.filter(change => change.pass === activePass);
  const passCounts = useMemo(() => {
    const counts = {};
    changes.forEach(change => { counts[change.pass] = (counts[change.pass] || 0) + 1; });
    return counts;
  }, [changes]);
  const byLine = useMemo(() => {
    const map = {};
    changes.forEach(change => {
      if (!map[change.lineNumber]) map[change.lineNumber] = [];
      map[change.lineNumber].push(change);
    });
    return map;
  }, [changes]);
  const net = makeNetResult(before.length, after.length);

  function isActive(change) {
    return activePass === "all" || change.pass === activePass;
  }

  function handleScroll(source) {
    if (syncLock.current) return;
    const from = source === "before" ? beforeScrollRef.current : afterScrollRef.current;
    const to = source === "before" ? afterScrollRef.current : beforeScrollRef.current;
    if (!from || !to) return;
    syncLock.current = true;
    to.scrollTop = from.scrollTop;
    requestAnimationFrame(() => { syncLock.current = false; });
  }

  function jumpToLine(line) {
    const rowHeight = 32;
    const top = Math.max(0, (line - 1) * rowHeight);
    if (beforeScrollRef.current) beforeScrollRef.current.scrollTop = top;
    if (afterScrollRef.current) afterScrollRef.current.scrollTop = top;
  }

  if (!changes.length) {
    return (
      <div style={styles.empty}>
        No optimizations applied - try a more complex program
      </div>
    );
  }

  return (
    <div style={styles.shell}>
      <style>{`
        .opt-overview-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
        .opt-overview-scroll::-webkit-scrollbar-thumb { background:#1e2a3a; border-radius:999px; }
        .opt-overview-diff { grid-template-columns:1fr 1fr; }
        @media (max-width: 768px) { .opt-overview-diff { grid-template-columns:1fr; } }
      `}</style>

      <SummaryBox changes={changes} passCounts={passCounts} net={net} />

      <div style={styles.pills}>
        <PassPill
          label="All"
          count={changes.length}
          color="#94a3b8"
          active={activePass === "all"}
          onClick={() => setActivePass("all")}
        />
        {allPasses.map(pass => (
          <PassPill
            key={pass}
            label={pass}
            count={passCounts[pass] || 0}
            color={passColor(pass)}
            active={activePass === pass}
            onClick={() => setActivePass(current => current === pass ? "all" : pass)}
          />
        ))}
      </div>

      <div className="opt-overview-diff" style={styles.diffGrid}>
        <DiffPanel
          title="Before Optimization"
          side="before"
          rows={before}
          changesByLine={byLine}
          activePass={activePass}
          scrollRef={beforeScrollRef}
          onScroll={() => handleScroll("before")}
          onLineClick={jumpToLine}
          onHover={setTooltip}
          onLeave={() => setTooltip(null)}
        />
        <DiffPanel
          title="After Optimization"
          side="after"
          rows={after}
          changesByLine={byLine}
          activePass={activePass}
          scrollRef={afterScrollRef}
          onScroll={() => handleScroll("after")}
          onLineClick={jumpToLine}
          onHover={setTooltip}
          onLeave={() => setTooltip(null)}
        />
      </div>

      {tooltip && <Tooltip data={tooltip} />}

      <Timeline changes={filteredChanges} activePass={activePass} />
    </div>
  );
}

function SummaryBox({ changes, passCounts, net }) {
  return (
    <section style={styles.summary}>
      <div style={styles.summaryTitle}>
        {changes.length} optimization{changes.length === 1 ? "" : "s"} applied to your program
      </div>
      <div style={styles.summaryPasses}>
        {Object.entries(passCounts).map(([pass, count], index) => {
          const color = passColor(pass);
          return (
            <div key={pass} style={styles.summaryLine}>
              <span style={{ ...styles.summaryBadge, borderColor: color, color, background: `${color}18` }}>{index + 1}</span>
              <span style={{ color, fontWeight: 800 }}>{pass}</span>
              <span style={{ color: "#64748b" }}>-</span>
              <span style={{ color: "#94a3b8" }}>{summarizePass(pass, count)}</span>
            </div>
          );
        })}
      </div>
      <div style={{ ...styles.netResult, color: net.color }}>{net.text}</div>
    </section>
  );
}

function PassPill({ label, count, color, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.pill,
        borderColor: active ? color : "#1e2a3a",
        background: active ? `${color}22` : "#0d1117",
        color: active ? color : "#64748b",
      }}
    >
      {label}
      <span style={styles.pillCount}>{count}</span>
    </button>
  );
}

function DiffPanel({ title, side, rows, changesByLine, activePass, scrollRef, onScroll, onLineClick, onHover, onLeave }) {
  return (
    <section style={styles.panel}>
      <div style={styles.panelHeader}>{title}</div>
      <div ref={scrollRef} className="opt-overview-scroll" style={styles.panelScroll} onScroll={onScroll}>
        {rows.map((row, index) => (
          <DiffRow
            key={`${side}-${row.line}-${index}`}
            side={side}
            row={row}
            changes={changesByLine[row.line] || []}
            activePass={activePass}
            onLineClick={onLineClick}
            onHover={onHover}
            onLeave={onLeave}
          />
        ))}
      </div>
    </section>
  );
}

function DiffRow({ side, row, changes, activePass, onLineClick, onHover, onLeave }) {
  const visibleChange = changes.find(change => activePass === "all" || change.pass === activePass) || changes[0];
  const hasChange = Boolean(visibleChange);
  const active = hasChange && (activePass === "all" || visibleChange.pass === activePass);
  const filteredOut = hasChange && activePass !== "all" && visibleChange.pass !== activePass;
  const unchangedDim = activePass !== "all" && !hasChange;
  const color = visibleChange ? passColor(visibleChange.pass) : DEFAULT_COLOR;
  const removed = side === "before" && visibleChange?.type === "removed";
  const added = side === "after" && visibleChange?.type === "added";
  const changedAfter = side === "after" && hasChange && visibleChange?.type !== "removed";
  const changedBefore = side === "before" && hasChange && visibleChange?.type !== "added";
  const highlighted = active && (changedBefore || changedAfter || removed || added);

  let rowStyle = { ...styles.row };
  let textStyle = { ...styles.rowText };
  let prefix = "";

  if (highlighted) {
    rowStyle = {
      ...rowStyle,
      background: removed ? "rgba(239,68,68,0.08)" : added ? "rgba(16,185,129,0.08)" : `${color}1f`,
      borderLeftColor: removed ? "#ef4444" : added ? "#10b981" : color,
    };
    textStyle = {
      ...textStyle,
      color: removed ? "#ef4444" : changedAfter || added ? "#f8fafc" : "#cbd5e1",
      textDecoration: removed ? "line-through" : "none",
      fontWeight: changedAfter || added ? 800 : 500,
    };
    prefix = removed ? "x" : changedAfter || added ? "ok" : "~";
  }

  if (filteredOut) {
    rowStyle.opacity = 0.35;
    rowStyle.background = "transparent";
    rowStyle.borderLeftColor = "transparent";
  } else if (unchangedDim) {
    rowStyle.opacity = 0.6;
  }

  return (
    <div
      style={rowStyle}
      onMouseEnter={event => {
        if (!hasChange) return;
        onHover({
          x: event.clientX,
          y: event.clientY,
          change: visibleChange,
        });
      }}
      onMouseMove={event => {
        if (!hasChange) return;
        onHover({ x: event.clientX, y: event.clientY, change: visibleChange });
      }}
      onMouseLeave={onLeave}
    >
      <button style={styles.lineNo} onClick={() => onLineClick(row.line)}>{row.line}</button>
      <span style={{ ...styles.prefix, color: highlighted ? (removed ? "#ef4444" : changedAfter || added ? "#10b981" : color) : "transparent" }}>
        {prefix}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={textStyle}>{row.instruction}</div>
        {highlighted && side === "after" && visibleChange?.type !== "removed" && (
          <div style={{ ...styles.passTag, color }}>{visibleChange.pass}</div>
        )}
      </div>
    </div>
  );
}

function Tooltip({ data }) {
  const { change, x, y } = data;
  const color = passColor(change.pass);
  return (
    <div style={{ ...styles.tooltip, left: Math.min(x + 14, window.innerWidth - 320), top: y + 14 }}>
      <div style={{ color, fontWeight: 900, marginBottom: 4 }}>{change.pass}</div>
      <div style={{ color: "#64748b", marginBottom: 8 }}>Line {change.lineNumber}</div>
      <div style={styles.tooltipDivider} />
      <div><span style={styles.tooltipLabel}>Before:</span> {change.before || "none"}</div>
      <div><span style={styles.tooltipLabel}>After:</span> {change.after || "none"}</div>
      <div style={{ color: "#94a3b8", marginTop: 8 }}>{change.description}</div>
    </div>
  );
}

function Timeline({ changes, activePass }) {
  return (
    <section style={styles.timelineShell}>
      <div style={styles.timelineTitle}>
        Optimization Log <span style={{ color: "#64748b" }}>[{changes.length} changes]</span>
      </div>
      {changes.length === 0 ? (
        <div style={styles.noLog}>No log entries for {activePass}.</div>
      ) : (
        <div style={styles.timeline}>
          {changes.map((change, index) => {
            const color = passColor(change.pass);
            return (
              <div key={`${change.pass}-${change.lineNumber}-${index}`} style={styles.timelineItem}>
                <div style={{ ...styles.timelineBadge, background: color }}>{index + 1}</div>
                <div style={styles.timelineCard}>
                  <div style={styles.timelineHeader}>
                    <span style={{ color, fontWeight: 900, textTransform: "uppercase" }}>{change.pass}</span>
                    <span style={styles.timelineLine}>Line {change.lineNumber}</span>
                  </div>
                  <div style={styles.timelineRows}>
                    <CodeRow label="Before" value={change.before || "none"} color="#64748b" />
                    <CodeRow label="After" value={change.after || "none"} color={change.type === "removed" ? "#ef4444" : color} strong />
                  </div>
                  <div style={styles.effect}>Effect: {change.description}</div>
                  <span style={{ ...styles.timelinePass, color, borderColor: `${color}66`, background: `${color}18` }}>
                    {change.type}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CodeRow({ label, value, color, strong }) {
  return (
    <div style={styles.codeRow}>
      <span style={{ color: "#64748b" }}>{label}</span>
      <span style={{ color, fontWeight: strong ? 900 : 500 }}>{value}</span>
    </div>
  );
}

const styles = {
  shell: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    position: "relative",
  },
  empty: {
    background: "#0d1117",
    border: "1px solid #1e2a3a",
    borderRadius: 8,
    color: "#64748b",
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 12,
    padding: 28,
    textAlign: "center",
  },
  summary: {
    background: "#0d1117",
    border: "1px solid #1e2a3a",
    borderLeft: "3px solid #10b981",
    borderRadius: 8,
    padding: "14px 16px",
  },
  summaryTitle: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: 500,
    marginBottom: 10,
  },
  summaryPasses: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 10,
  },
  summaryLine: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 11,
  },
  summaryBadge: {
    width: 20,
    height: 20,
    borderRadius: 999,
    border: "1px solid",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 900,
    flexShrink: 0,
  },
  netResult: {
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 11,
    fontWeight: 800,
  },
  pills: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
  },
  pill: {
    border: "1px solid",
    borderRadius: 999,
    padding: "6px 10px",
    cursor: "pointer",
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 10,
    fontWeight: 900,
    display: "inline-flex",
    alignItems: "center",
    gap: 7,
    transition: "all 0.15s",
  },
  pillCount: {
    color: "#94a3b8",
    fontSize: 9,
    background: "rgba(255,255,255,0.05)",
    borderRadius: 999,
    padding: "1px 6px",
  },
  diffGrid: {
    display: "grid",
    gap: 10,
  },
  panel: {
    background: "#0d1117",
    border: "1px solid #1e2a3a",
    borderRadius: 8,
    overflow: "hidden",
    minWidth: 0,
  },
  panelHeader: {
    padding: "9px 14px",
    borderBottom: "1px solid #1e2a3a",
    color: "#94a3b8",
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  panelScroll: {
    maxHeight: 420,
    overflow: "auto",
  },
  row: {
    minHeight: 32,
    display: "grid",
    gridTemplateColumns: "40px 26px minmax(0, 1fr)",
    alignItems: "start",
    gap: 8,
    padding: "6px 10px 6px 0",
    borderBottom: "1px solid rgba(30,42,58,0.65)",
    borderLeft: "2px solid transparent",
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 11,
    transition: "opacity 0.15s, background 0.15s",
  },
  lineNo: {
    width: 40,
    border: "none",
    background: "transparent",
    color: "#374151",
    cursor: "pointer",
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 11,
    textAlign: "right",
    paddingRight: 4,
  },
  prefix: {
    fontSize: 10,
    fontWeight: 900,
    textAlign: "center",
  },
  rowText: {
    color: "#94a3b8",
    whiteSpace: "pre-wrap",
    overflowWrap: "anywhere",
  },
  passTag: {
    marginTop: 3,
    fontSize: 9,
    fontWeight: 900,
  },
  tooltip: {
    position: "fixed",
    zIndex: 1000,
    width: 290,
    background: "#0d1117",
    border: "1px solid #1e2a3a",
    borderRadius: 8,
    padding: 12,
    color: "#d1d5db",
    boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 11,
    pointerEvents: "none",
  },
  tooltipDivider: {
    height: 1,
    background: "#1e2a3a",
    marginBottom: 8,
  },
  tooltipLabel: {
    color: "#64748b",
    display: "inline-block",
    width: 48,
  },
  timelineShell: {
    background: "#0a0a0f",
    border: "1px solid #1e2a3a",
    borderRadius: 8,
    padding: "12px 14px",
  },
  timelineTitle: {
    color: "#94a3b8",
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 10,
    fontWeight: 900,
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  timeline: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    borderLeft: "2px solid #1e2a3a",
    marginLeft: 10,
    paddingLeft: 18,
  },
  timelineItem: {
    position: "relative",
  },
  timelineBadge: {
    position: "absolute",
    left: -29,
    top: 4,
    width: 20,
    height: 20,
    borderRadius: 999,
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 10,
    fontWeight: 900,
    fontFamily: "var(--font-mono, monospace)",
  },
  timelineCard: {
    position: "relative",
    background: "#0d1117",
    border: "1px solid #1e2a3a",
    borderRadius: 8,
    padding: "12px 14px",
  },
  timelineHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 10,
    marginBottom: 10,
  },
  timelineLine: {
    color: "#64748b",
    textAlign: "right",
  },
  timelineRows: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    marginBottom: 10,
  },
  codeRow: {
    display: "grid",
    gridTemplateColumns: "64px 1fr",
    gap: 8,
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 11,
  },
  effect: {
    color: "#64748b",
    fontSize: 12,
    fontStyle: "italic",
  },
  timelinePass: {
    position: "absolute",
    right: 12,
    bottom: 10,
    border: "1px solid",
    borderRadius: 999,
    padding: "2px 7px",
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 9,
    fontWeight: 900,
  },
  noLog: {
    color: "#64748b",
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 12,
    fontStyle: "italic",
  },
};
