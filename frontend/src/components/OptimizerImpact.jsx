import { useEffect, useMemo, useState } from "react";

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
  "Peephole Optimization": "#3b82f6",
};

const MIX_COLORS = {
  arithmetic: "#10b981",
  moves: "#3b82f6",
  jumps: "#f97316",
  calls: "#a855f7",
  labels: "#6b7280",
  other: "#f59e0b",
};

const CATEGORIES = ["arithmetic", "moves", "jumps", "calls", "labels", "other"];

const EDUCATION = {
  "Function Inlining": {
    what: "Replaces function call with the function body directly, eliminating call overhead.",
    impact: [
      "Eliminates function call overhead",
      "May increase code size",
      "Enables further optimizations on inlined code",
    ],
  },
  "Constant Propagation": {
    what: "Replaces variables holding known constant values with the constant directly.",
    impact: [
      "Reduces variable lookups at runtime",
      "Enables further constant folding",
      "May expose dead code for elimination",
    ],
  },
  "Dead Code Elimination": {
    what: "Removes instructions that have no effect on program output.",
    impact: [
      "Reduces code size",
      "Improves cache efficiency",
      "No semantic change to program",
    ],
  },
  "Common Subexpr": {
    what: "Detects repeated computations and replaces them with a single computed result.",
    impact: [
      "Reduces redundant calculations",
      "May introduce temporary variables",
      "Particularly effective in loops",
    ],
  },
  "Loop Optimization": {
    what: "Moves loop-invariant code outside the loop and optimizes loop structure.",
    impact: [
      "Reduces work done per iteration",
      "Most impactful for frequently-executed loops",
      "May change instruction ordering",
    ],
  },
  Default: {
    what: "Applies standard compiler optimization to improve code efficiency.",
    impact: [
      "Improves runtime performance",
      "May change instruction count",
    ],
  },
};

function passColor(pass) {
  return PASS_COLORS[pass] || "#6b7280";
}

function educationFor(pass) {
  if (EDUCATION[pass]) return EDUCATION[pass];
  if (pass.includes("Common Subexpression")) return EDUCATION["Common Subexpr"];
  if (pass.includes("Dead Code")) return EDUCATION["Dead Code Elimination"];
  if (pass.includes("Loop")) return EDUCATION["Loop Optimization"];
  return EDUCATION.Default;
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
  };
}

function categorize(instructions) {
  const cats = Object.fromEntries(CATEGORIES.map(cat => [cat, 0]));
  instructions.forEach(instr => {
    const op = instr.op;
    if (["+", "-", "*", "/", "%", "==", "!=", "<", ">", "<=", ">=", "&&", "||", "!"].includes(op)) cats.arithmetic += 1;
    else if (["=", "copy", "assign", "mov"].includes(op)) cats.moves += 1;
    else if (["goto", "if_goto", "ifnot_goto", "jump", "branch"].includes(op)) cats.jumps += 1;
    else if (["call", "return", "param", "print"].includes(op)) cats.calls += 1;
    else if (["label", "func_begin", "func_end"].includes(op)) cats.labels += 1;
    else cats.other += 1;
  });
  return cats;
}

export default function OptimizerImpact({
  beforeInstructions = [],
  afterInstructions = [],
  optimizations = [],
  passes = [],
}) {
  const [mounted, setMounted] = useState(false);
  const [hoverPoint, setHoverPoint] = useState(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const before = useMemo(() => beforeInstructions.map(normalizeInstruction), [beforeInstructions]);
  const after = useMemo(() => afterInstructions.map(normalizeInstruction), [afterInstructions]);
  const changes = useMemo(() => optimizations.map(normalizeOptimization), [optimizations]);
  const activePasses = useMemo(() => {
    const names = passes.length ? passes : changes.map(change => change.pass);
    return [...new Set(names.filter(Boolean))];
  }, [passes, changes]);

  const passStats = useMemo(() => {
    const stats = {};
    changes.forEach(change => {
      if (!stats[change.pass]) stats[change.pass] = { count: 0, lines: [], removed: 0, modified: 0, added: 0 };
      stats[change.pass].count += 1;
      stats[change.pass].lines.push(change.lineNumber);
      if (change.type === "removed") stats[change.pass].removed += 1;
      else if (change.type === "added") stats[change.pass].added += 1;
      else stats[change.pass].modified += 1;
    });
    return stats;
  }, [changes]);

  const reduction = before.length > 0 ? ((before.length - after.length) / before.length) * 100 : 0;
  const delta = after.length - before.length;
  const removedCount = changes.filter(change => change.type === "removed").length;
  const modifiedCount = changes.filter(change => change.type === "modified").length;
  const passLabel = activePasses.length > 2 ? `${activePasses[0]} + ${activePasses.length - 1} more` : activePasses.join(" + ") || "none";

  return (
    <div style={styles.shell}>
      <style>{`
        .oi-bar { width:0%; transition:width 600ms ease-out; }
        .oi-mounted .oi-bar { width:var(--target-width); }
        @media (max-width: 768px) {
          .oi-stats { grid-template-columns:1fr 1fr; }
          .oi-pass-row { grid-template-columns:1fr; gap:6px; }
          .oi-mix-row { grid-template-columns:90px 1fr; }
          .oi-mix-after { grid-column:2; }
          .oi-mix-indicator { grid-column:2; text-align:left; }
        }
        @media (max-width: 414px) { .oi-stats { grid-template-columns:1fr; } }
      `}</style>
      <div className={mounted ? "oi-mounted" : ""} style={styles.content}>
        <section className="oi-stats" style={styles.statsGrid}>
          <StatCard label="Instructions" value={`${before.length} -> ${after.length}`} sub={`${delta >= 0 ? "+" : ""}${delta} after opt`} color="#3b82f6" />
          <StatCard label="Code Reduction" value={`${reduction.toFixed(1)}%`} sub={`${removedCount} removed`} color={reduction > 0 ? "#10b981" : reduction < 0 ? "#ef4444" : "#6b7280"} />
          <StatCard label="Passes Applied" value={activePasses.length} sub={passLabel} color="#a855f7" />
          <StatCard label="Changes Made" value={changes.length} sub={`${modifiedCount} modified`} color="#f59e0b" />
        </section>

        <Section title="Changes Per Pass">
          {changes.length === 0 ? (
            <Empty>No optimization changes to chart.</Empty>
          ) : (
            <div style={styles.passBars}>
              {Object.entries(passStats).map(([pass, stats]) => {
                const pct = changes.length ? (stats.count / changes.length) * 100 : 0;
                const color = passColor(pass);
                return (
                  <div key={pass} className="oi-pass-row" style={styles.passRow}>
                    <div style={{ ...styles.passName, color }}>{pass}</div>
                    <div style={styles.barTrack}>
                      <div className="oi-bar" style={{ "--target-width": `${pct}%`, ...styles.barFill, background: color }} />
                    </div>
                    <div style={styles.passCount}>{stats.count} change{stats.count === 1 ? "" : "s"} ({Math.round(pct)}%)</div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section title="Optimization Timeline" subtitle="How instruction count changed after each pass">
          {activePasses.length === 0 ? (
            <Empty>No optimization passes were applied.</Empty>
          ) : (
            <StepChart
              beforeCount={before.length}
              afterCount={after.length}
              passes={activePasses}
              passStats={passStats}
              hoverPoint={hoverPoint}
              setHoverPoint={setHoverPoint}
            />
          )}
        </Section>

        <Section title="Instruction Mix - Before vs After">
          <InstructionMix before={before} after={after} mounted={mounted} />
        </Section>

        <Section title="Pass Effectiveness">
          {activePasses.length === 0 ? (
            <Empty>No pass effectiveness data available.</Empty>
          ) : (
            <div style={styles.effectGrid}>
              {activePasses.map(pass => (
                <EffectivenessCard key={pass} pass={pass} stats={passStats[pass] || { count: 0, lines: [] }} />
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={styles.card}>
      <div style={styles.cardLabel}>{label}</div>
      <div style={{ ...styles.cardValue, color }}>{value}</div>
      <div style={styles.cardSub}>{sub}</div>
    </div>
  );
}

function Section({ title, subtitle, children }) {
  return (
    <section style={styles.section}>
      <div style={styles.sectionHeader}>
        <div>
          <div style={styles.sectionTitle}>{title}</div>
          {subtitle && <div style={styles.sectionSubtitle}>{subtitle}</div>}
        </div>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }) {
  return <div style={styles.empty}>{children}</div>;
}

function StepChart({ beforeCount, afterCount, passes, passStats, hoverPoint, setHoverPoint }) {
  const passDeltas = passes.map(pass => {
    const stats = passStats[pass] || {};
    return (stats.added || 0) - (stats.removed || 0);
  });
  const points = [{ label: "Start", count: beforeCount, color: "#6b7280" }];
  let cursor = beforeCount;
  passes.forEach((pass, index) => {
    cursor += passDeltas[index] || 0;
    points.push({ label: pass, count: cursor, color: passColor(pass) });
  });
  points.push({ label: "Final", count: afterCount, color: "#6b7280" });

  const min = Math.min(...points.map(p => p.count)) - 1;
  const max = Math.max(...points.map(p => p.count)) + 1;
  const range = Math.max(1, max - min);
  const chart = { w: 720, h: 180, left: 48, right: 18, top: 18, bottom: 38 };
  const innerW = chart.w - chart.left - chart.right;
  const innerH = chart.h - chart.top - chart.bottom;
  const coords = points.map((point, index) => ({
    ...point,
    x: chart.left + (points.length === 1 ? 0 : (index / (points.length - 1)) * innerW),
    y: chart.top + ((max - point.count) / range) * innerH,
  }));
  const path = coords.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`).join(" ");
  const grid = Array.from({ length: 5 }, (_, index) => min + (range / 4) * index).reverse();

  return (
    <div style={{ position: "relative" }}>
      <svg viewBox={`0 0 ${chart.w} ${chart.h}`} style={styles.chartSvg} role="img" aria-label="Optimization timeline chart">
        {grid.map(value => {
          const y = chart.top + ((max - value) / range) * innerH;
          return (
            <g key={value}>
              <line x1={chart.left} x2={chart.w - chart.right} y1={y} y2={y} stroke="#1e2a3a" strokeDasharray="4 4" />
              <text x={chart.left - 10} y={y + 4} textAnchor="end" fill="#64748b" fontSize="10" fontFamily="var(--font-mono, monospace)">
                {Math.round(value)}
              </text>
            </g>
          );
        })}
        <path d={path} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((point, index) => (
          <g
            key={`${point.label}-${index}`}
            onMouseEnter={() => setHoverPoint(point)}
            onMouseLeave={() => setHoverPoint(null)}
            style={{ cursor: "default" }}
          >
            <circle cx={point.x} cy={point.y} r="6" fill={point.color} stroke="#0a0a0f" strokeWidth="2" />
            <text
              x={point.x}
              y={chart.h - 12}
              textAnchor="middle"
              fill="#64748b"
              fontSize="9"
              fontFamily="var(--font-mono, monospace)"
              transform={point.label.length > 12 ? `rotate(-18 ${point.x} ${chart.h - 12})` : undefined}
            >
              {point.label.length > 16 ? `${point.label.slice(0, 14)}..` : point.label}
            </text>
          </g>
        ))}
      </svg>
      {hoverPoint && (
        <div style={styles.chartTip}>
          After {hoverPoint.label}: {hoverPoint.count} instructions
        </div>
      )}
    </div>
  );
}

function InstructionMix({ before, after }) {
  const beforeCats = categorize(before);
  const afterCats = categorize(after);
  const maxCount = Math.max(1, ...CATEGORIES.flatMap(cat => [beforeCats[cat], afterCats[cat]]));

  return (
    <div style={styles.mixTable}>
      <div style={styles.mixHeader} />
      <div style={styles.mixHeader}>Before</div>
      <div style={styles.mixHeader}>After</div>
      <div style={styles.mixHeader}>Change</div>
      {CATEGORIES.map(cat => {
        const beforeCount = beforeCats[cat];
        const afterCount = afterCats[cat];
        const color = MIX_COLORS[cat];
        const beforePct = (beforeCount / maxCount) * 100;
        const afterPct = (afterCount / maxCount) * 100;
        const indicator = afterCount < beforeCount ? { text: "down reduced", color: "#10b981" } : afterCount > beforeCount ? { text: "up increased", color: "#ef4444" } : { text: "same", color: "#6b7280" };
        return (
          <div key={cat} className="oi-mix-row" style={styles.mixRow}>
            <div style={{ ...styles.mixCat, color }}>{cat}</div>
            <MixBar count={beforeCount} pct={beforePct} total={before.length} color={color} muted />
            <div className="oi-mix-after"><MixBar count={afterCount} pct={afterPct} total={after.length} color={color} /></div>
            <div className="oi-mix-indicator" style={{ ...styles.mixIndicator, color: indicator.color }}>{indicator.text}</div>
          </div>
        );
      })}
    </div>
  );
}

function MixBar({ count, pct, total, color, muted }) {
  const share = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={styles.mixBarCell}>
      <div style={styles.mixTrack}>
        <div className="oi-bar" style={{ "--target-width": `${pct}%`, ...styles.mixFill, background: color, opacity: muted ? 0.45 : 0.95 }} />
      </div>
      <span style={styles.mixCount}>{count} ({share}%)</span>
    </div>
  );
}

function EffectivenessCard({ pass, stats }) {
  const color = passColor(pass);
  const edu = educationFor(pass);
  const lines = [...new Set(stats.lines || [])].sort((a, b) => a - b);

  return (
    <article style={styles.effectCard}>
      <div style={styles.effectHeader}>
        <span style={{ ...styles.dot, background: color }} />
        <span style={{ color, fontWeight: 900, textTransform: "uppercase" }}>{pass}</span>
        <span style={styles.effectCount}>{stats.count || 0} changes</span>
      </div>
      <div style={styles.divider} />
      <div style={styles.effectLabel}>What it does:</div>
      <p style={styles.effectText}>{edu.what}</p>
      <div style={styles.effectLabel}>Impact in your program:</div>
      <div style={styles.impactList}>
        {edu.impact.map(item => (
          <div key={item} style={styles.impactItem}>ok {item}</div>
        ))}
      </div>
      <div style={styles.lines}>Instructions affected: {lines.length ? `lines ${lines.join(", ")}` : "none"}</div>
    </article>
  );
}

const styles = {
  shell: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  content: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 10,
  },
  card: {
    background: "#0d1117",
    border: "1px solid #1e2a3a",
    borderRadius: 8,
    padding: 16,
    minWidth: 0,
  },
  cardLabel: {
    color: "#64748b",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 28,
    fontWeight: 500,
    fontFamily: "var(--font-mono, monospace)",
    marginBottom: 4,
  },
  cardSub: {
    color: "#64748b",
    fontSize: 12,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  section: {
    background: "#0d1117",
    border: "1px solid #1e2a3a",
    borderRadius: 8,
    padding: 16,
  },
  sectionHeader: {
    display: "flex",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  sectionTitle: {
    color: "#94a3b8",
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: "0.1em",
    textTransform: "uppercase",
  },
  sectionSubtitle: {
    color: "#64748b",
    fontSize: 12,
    marginTop: 4,
  },
  empty: {
    color: "#64748b",
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 12,
    fontStyle: "italic",
  },
  passBars: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  passRow: {
    display: "grid",
    gridTemplateColumns: "160px minmax(120px, 1fr) 100px",
    alignItems: "center",
    gap: 12,
  },
  passName: {
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 11,
    fontWeight: 900,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  barTrack: {
    height: 6,
    background: "#1e2a3a",
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 3,
  },
  passCount: {
    color: "#64748b",
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 10,
    textAlign: "right",
  },
  chartSvg: {
    width: "100%",
    height: 180,
    display: "block",
  },
  chartTip: {
    position: "absolute",
    right: 10,
    top: 8,
    background: "#0a0a0f",
    border: "1px solid #1e2a3a",
    borderRadius: 6,
    color: "#d1d5db",
    padding: "7px 9px",
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 10,
  },
  mixTable: {
    display: "grid",
    gridTemplateColumns: "100px 1fr 1fr 92px",
    gap: "8px 12px",
    alignItems: "center",
  },
  mixHeader: {
    color: "#64748b",
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 10,
    fontWeight: 900,
    textTransform: "uppercase",
  },
  mixRow: {
    display: "contents",
  },
  mixCat: {
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 11,
    fontWeight: 900,
  },
  mixBarCell: {
    display: "grid",
    gridTemplateColumns: "1fr 62px",
    alignItems: "center",
    gap: 8,
  },
  mixTrack: {
    height: 8,
    background: "#1e2a3a",
    borderRadius: 4,
    overflow: "hidden",
  },
  mixFill: {
    height: "100%",
    borderRadius: 4,
  },
  mixCount: {
    color: "#64748b",
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 10,
    textAlign: "right",
  },
  mixIndicator: {
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 10,
    textAlign: "right",
  },
  effectGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 12,
  },
  effectCard: {
    background: "#0a0a0f",
    border: "1px solid #1e2a3a",
    borderRadius: 8,
    padding: 14,
  },
  effectHeader: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 11,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    flexShrink: 0,
  },
  effectCount: {
    marginLeft: "auto",
    color: "#64748b",
    fontSize: 10,
  },
  divider: {
    height: 1,
    background: "#1e2a3a",
    margin: "11px 0",
  },
  effectLabel: {
    color: "#94a3b8",
    fontWeight: 900,
    fontSize: 12,
    marginBottom: 5,
  },
  effectText: {
    color: "#cbd5e1",
    fontSize: 12,
    lineHeight: 1.5,
    margin: "0 0 11px",
  },
  impactList: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    marginBottom: 12,
  },
  impactItem: {
    color: "#94a3b8",
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 11,
  },
  lines: {
    color: "#64748b",
    fontFamily: "var(--font-mono, monospace)",
    fontSize: 11,
  },
};
