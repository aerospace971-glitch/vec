import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

const NODE_W = 200;
const MIN_NODE_H = 110;
const V_SPACING = 180;
const H_SPACING = 160;
const TOP_PAD = 72;
const SIDE_PAD = 90;
const DETAIL_W = 280;

const BLOCK_COLORS = {
  entry: "#00d4ff",
  "loop header": "#a855f7",
  condition: "#f59e0b",
  body: "#3b82f6",
  exit: "#10b981",
  default: "#6b7280",
};

const EDGE_COLORS = {
  fall: "#6b7280",
  "branch-true": "#10b981",
  "branch-false": "#ef4444",
  goto: "#f97316",
  "back-edge": "#00d4ff",
};

const EDGE_LABELS = {
  fall: "fall",
  "branch-true": "true",
  "branch-false": "false",
  goto: "goto",
  "back-edge": "loop back edge",
};

const OP_COLORS = {
  label: "#6b7280",
  func_begin: "#00d4ff",
  func_end: "#6b7280",
  "=": "#c792ea",
  copy: "#c792ea",
  "+": "#10b981",
  "-": "#10b981",
  "*": "#10b981",
  "/": "#10b981",
  "%": "#10b981",
  "<": "#f59e0b",
  ">": "#f59e0b",
  "<=": "#f59e0b",
  ">=": "#f59e0b",
  "==": "#f59e0b",
  "!=": "#f59e0b",
  if_goto: "#10b981",
  ifnot_goto: "#ef4444",
  goto: "#f97316",
  return: "#10b981",
  call: "#22d3ee",
  print: "#22d3ee",
};

function instrText(instr) {
  return instr?.instruction || instr?.code || [instr?.result, instr?.arg1, instr?.arg2].filter(Boolean).join(" ") || instr?.op || "";
}

function jumpTarget(instr) {
  return instr?.arg2 || instr?.arg1 || instr?.result || "";
}

function parseTacToBlocks(tac = []) {
  const raw = [];
  let current = null;
  let functionName = "global";

  function flush() {
    if (current && current.instructions.length) raw.push(current);
    current = null;
  }

  function start(label) {
    flush();
    current = { label: label || `block_${raw.length}`, functionName, instructions: [], exits: [] };
  }

  start("entry");

  tac.forEach(instr => {
    if (instr.op === "func_begin") {
      functionName = instr.result || instrText(instr).replace(/func_begin\s*/i, "").trim() || `func_${raw.length}`;
      start(functionName);
      current.instructions.push({ op: instr.op, instruction: instrText(instr), raw: instr });
      return;
    }

    if (instr.op === "label") {
      start(instr.result || instrText(instr).replace(/:$/, "").trim() || `L${raw.length}`);
      current.instructions.push({ op: instr.op, instruction: instrText(instr), raw: instr });
      return;
    }

    if (!current) start();
    current.instructions.push({ op: instr.op || "op", instruction: instrText(instr), raw: instr });

    if (instr.op === "goto") {
      current.exits.push({ type: "goto", target: jumpTarget(instr) });
      start();
    } else if (instr.op === "if_goto") {
      current.exits.push({ type: "branch-true", target: jumpTarget(instr) });
      current.exits.push({ type: "fall", target: "__next__" });
      start();
    } else if (instr.op === "ifnot_goto") {
      current.exits.push({ type: "branch-false", target: jumpTarget(instr) });
      current.exits.push({ type: "fall", target: "__next__" });
      start();
    } else if (instr.op === "return") {
      current.exits.push({ type: "return", target: "__exit__" });
      start();
    } else if (instr.op === "func_end") {
      start();
    }
  });

  flush();

  const blocks = raw.filter(block => block.instructions.length).map((block, index) => ({ ...block, id: `B${index}` }));
  const labelToId = {};
  blocks.forEach(block => {
    labelToId[block.label] = block.id;
    block.instructions.forEach(instr => {
      if (instr.op === "label") labelToId[instr.instruction.replace(/:$/, "").trim()] = block.id;
    });
  });

  return blocks.map((block, index) => ({
    ...block,
    exits: block.exits
      .map(exit => {
        if (exit.target === "__next__") return { ...exit, target: blocks[index + 1]?.id || "__exit__" };
        if (exit.target === "__exit__") return exit;
        return { ...exit, target: labelToId[exit.target] || exit.target };
      })
      .filter(exit => exit.type !== "return" && exit.target),
  }));
}

function normalizeBlocks(blocks = [], tac = []) {
  if (!blocks.length) return parseTacToBlocks(tac);

  const instrById = Object.fromEntries((tac || []).map(instr => [Number(instr.id), instr]));
  const idToBlockId = Object.fromEntries(blocks.map((block, index) => [Number(block.id ?? index), `B${index}`]));

  return blocks.map((block, index) => {
    const instrIds = block.instrIds || block.instr_ids || [];
    const instructions = (block.instructions || block.instrs || instrIds.map(id => instrById[Number(id)]).filter(Boolean))
      .map(instr => ({ op: instr.op || "op", instruction: instrText(instr), raw: instr }));

    const last = instructions[instructions.length - 1]?.raw;
    const exits = (block.exits || []).map(exit => ({
      type: exit.type === "jump" ? "goto" : exit.type || "fall",
      target: String(exit.target || exit.label || ""),
    }));

    if (!exits.length && Array.isArray(block.succs)) {
      block.succs.forEach((succ, succIndex) => {
        let type = "fall";
        if (last?.op === "goto") type = "goto";
        else if (last?.op === "if_goto") type = succIndex === 0 ? "branch-true" : "fall";
        else if (last?.op === "ifnot_goto") type = succIndex === 0 ? "branch-false" : "fall";
        exits.push({ type, target: idToBlockId[Number(succ)] || `B${succ}` });
      });
    }

    return {
      id: `B${index}`,
      label: block.label || block.func || `block_${index}`,
      functionName: block.func || block.functionName || "global",
      instructions,
      exits: exits.filter(exit => exit.target && exit.target !== "__exit__"),
    };
  });
}

function nodeHeight(block, expanded) {
  const rows = expanded ? block.instructions.length : Math.min(4, block.instructions.length);
  return Math.max(MIN_NODE_H, 58 + rows * 17 + (block.exits.length ? 28 : 18));
}

function blockRole(block, index, incomingBackEdges) {
  if (index === 0 || block.instructions.some(instr => instr.op === "func_begin")) return "entry";
  if (incomingBackEdges.has(block.id)) return "loop header";
  if (block.instructions.some(instr => instr.op === "return")) return "exit";
  if (block.exits.some(exit => exit.type === "branch-true" || exit.type === "branch-false")) return "condition";
  if (block.instructions.length > 1) return "body";
  return "default";
}

function computeLayout(blocks, width, expanded) {
  if (!blocks.length) return { positions: {}, edges: [], canvas: { width: 760, height: 420 }, incomingBackEdges: new Set() };

  const byId = Object.fromEntries(blocks.map(block => [block.id, block]));
  const order = Object.fromEntries(blocks.map((block, index) => [block.id, index]));
  const depth = { [blocks[0].id]: 0 };
  const queue = [blocks[0].id];

  while (queue.length) {
    const id = queue.shift();
    const block = byId[id];
    if (!block) continue;
    block.exits.forEach(exit => {
      if (!byId[exit.target]) return;
      if (order[exit.target] <= order[id]) return;
      if (depth[exit.target] === undefined) {
        depth[exit.target] = depth[id] + 1;
        queue.push(exit.target);
      }
    });
  }

  blocks.forEach((block, index) => {
    if (depth[block.id] === undefined) depth[block.id] = index;
  });

  const levels = {};
  blocks.forEach(block => {
    const d = depth[block.id];
    if (!levels[d]) levels[d] = [];
    levels[d].push(block);
  });

  const center = Math.max(width / 2, SIDE_PAD + NODE_W);
  const positions = {};
  Object.entries(levels).forEach(([level, levelBlocks]) => {
    const count = levelBlocks.length;
    let xs;
    if (count === 1) xs = [center];
    else if (count === 2) xs = [center - 180, center + 180];
    else if (count === 3) xs = [center - 280, center, center + 280];
    else {
      const gap = Math.max(H_SPACING, Math.min(280, (width - SIDE_PAD * 2 - NODE_W) / Math.max(1, count - 1)));
      const start = center - ((count - 1) * gap) / 2;
      xs = levelBlocks.map((_, index) => start + index * gap);
    }

    levelBlocks.forEach((block, index) => {
      positions[block.id] = {
        x: xs[index],
        y: TOP_PAD + Number(level) * V_SPACING,
        depth: Number(level),
        h: nodeHeight(block, expanded.has(block.id)),
      };
    });
  });

  const edges = [];
  const incomingBackEdges = new Set();
  blocks.forEach(block => {
    block.exits.forEach(exit => {
      if (!positions[exit.target]) return;
      const isBack = positions[exit.target].depth <= positions[block.id].depth;
      const edge = { source: block.id, target: exit.target, type: isBack ? "back-edge" : exit.type };
      edges.push(edge);
      if (isBack) incomingBackEdges.add(exit.target);
    });
  });

  const maxDepth = Math.max(...Object.values(positions).map(pos => pos.depth));
  const maxRight = Math.max(width, ...Object.values(positions).map(pos => pos.x + NODE_W / 2 + SIDE_PAD + DETAIL_W));
  const maxBottom = Math.max(420, TOP_PAD + maxDepth * V_SPACING + MIN_NODE_H + 96);

  return { positions, edges, incomingBackEdges, canvas: { width: maxRight, height: maxBottom } };
}

export default function CFG({ blocks: blocksProp = [], tac = [], onViewInBasicBlocks }) {
  const svgRef = useRef(null);
  const graphRef = useRef(null);
  const zoomRef = useRef(null);
  const [width, setWidth] = useState(920);
  const [selected, setSelected] = useState(null);
  const [expanded, setExpanded] = useState(new Set());
  const [showLabels, setShowLabels] = useState(true);
  const [highlightLoops, setHighlightLoops] = useState(false);

  const blocks = useMemo(() => normalizeBlocks(blocksProp, tac), [blocksProp, tac]);
  const layout = useMemo(() => computeLayout(blocks, width, expanded), [blocks, width, expanded]);
  const selectedBlock = blocks.find(block => block.id === selected);
  const preds = selected ? layout.edges.filter(edge => edge.target === selected).map(edge => `${edge.source}${edge.type === "back-edge" ? " (back)" : ""}`) : [];
  const succs = selected ? layout.edges.filter(edge => edge.source === selected).map(edge => edge.target) : [];

  useEffect(() => {
    if (!graphRef.current) return undefined;
    const observer = new ResizeObserver(entries => {
      setWidth(Math.max(720, entries[0].contentRect.width - (selected ? DETAIL_W : 0)));
    });
    observer.observe(graphRef.current);
    return () => observer.disconnect();
  }, [selected]);

  useEffect(() => {
    if (!svgRef.current) return undefined;
    const svg = d3.select(svgRef.current);
    const zoom = d3.zoom()
      .scaleExtent([0.4, 2.5])
      .on("zoom", event => {
        svg.select(".cfg-viewport").attr("transform", event.transform);
      });
    zoomRef.current = zoom;
    svg.call(zoom);
    return () => svg.on(".zoom", null);
  }, []);

  function fitScreen() {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    const host = svgRef.current.getBoundingClientRect();
    const scale = Math.max(0.4, Math.min(2.5, Math.min(host.width / layout.canvas.width, host.height / layout.canvas.height) * 0.92));
    const tx = (host.width - layout.canvas.width * scale) / 2;
    const ty = (host.height - layout.canvas.height * scale) / 2;
    svg.transition().duration(240).call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }

  function toggleExpanded(id) {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (!blocks.length) {
    return (
      <div style={{ padding: 36, textAlign: "center", background: "#0a0a0f", border: "1px solid #1e2a3a", borderRadius: 8, color: "#64748b", fontFamily: "var(--font-mono, monospace)" }}>
        No CFG available. Compile a program first.
      </div>
    );
  }

  return (
    <div ref={graphRef} className="cfg-shell">
      <style>{`
        .cfg-shell { background:#0a0a0f; border:1px solid #1e2a3a; border-radius:8px; overflow:hidden; color:#e5e7eb; }
        .cfg-toolbar { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; padding:10px 12px; background:#0d1117; border-bottom:1px solid #1e2a3a; }
        .cfg-toolgroup { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .cfg-button { border:1px solid #1e2a3a; background:#111827; color:#94a3b8; border-radius:6px; padding:7px 10px; font:800 10px var(--font-mono,monospace); cursor:pointer; }
        .cfg-button:hover { border-color:#00d4ff66; color:#00d4ff; }
        .cfg-body { display:grid; grid-template-columns:1fr ${selectedBlock ? `${DETAIL_W}px` : "0px"}; min-height:560px; transition:grid-template-columns .18s ease; }
        .cfg-canvas { position:relative; min-width:0; height:560px; background-image:radial-gradient(circle, rgba(148,163,184,.12) 1px, transparent 1px); background-size:18px 18px; }
        .cfg-node { cursor:pointer; }
        .cfg-node:hover .cfg-card { stroke-opacity:1; filter:drop-shadow(0 0 8px rgba(0,212,255,.25)); }
        .cfg-node.loop-pulse .cfg-card { animation:cfgPulse 1.4s ease-in-out infinite; }
        @keyframes cfgPulse { 50% { filter:drop-shadow(0 0 12px rgba(168,85,247,.55)); } }
      `}</style>

      <div className="cfg-toolbar">
        <div className="cfg-toolgroup">
          <span style={{ color: "#00d4ff", font: "900 11px var(--font-mono, monospace)", letterSpacing: 1, textTransform: "uppercase" }}>
            CFG - Control Flow Graph
          </span>
          <span style={{ color: "#64748b", font: "800 10px var(--font-mono, monospace)" }}>{blocks.length} blocks</span>
        </div>
        <div className="cfg-toolgroup">
          <button className="cfg-button" onClick={fitScreen}>Fit Screen</button>
          <button className="cfg-button" onClick={() => setShowLabels(v => !v)}>Show Labels {showLabels ? "on" : "off"}</button>
          <button className="cfg-button" onClick={() => setHighlightLoops(v => !v)}>Highlight Loops</button>
        </div>
      </div>

      <div className="cfg-body">
        <div className="cfg-canvas">
          <svg ref={svgRef} width="100%" height="100%" role="img" aria-label="Control flow graph">
            <defs>
              {Object.entries(EDGE_COLORS).map(([type, color]) => (
                <marker key={type} id={`cfg-arrow-${type}`} viewBox="0 -5 10 10" refX="8" refY="0" markerWidth="8" markerHeight="6" orient="auto">
                  <path d="M0,-5L10,0L0,5" fill={color} />
                </marker>
              ))}
            </defs>

            <g className="cfg-viewport">
              <rect width={layout.canvas.width} height={layout.canvas.height} fill="transparent" onClick={() => setSelected(null)} />
              <Legend />
              <EntryExitMarkers blocks={blocks} layout={layout} />

              {layout.edges.map((edge, index) => (
                <Edge
                  key={`${edge.source}-${edge.target}-${edge.type}-${index}`}
                  edge={edge}
                  positions={layout.positions}
                  selected={selected}
                  showLabels={showLabels}
                  highlightLoops={highlightLoops}
                />
              ))}

              {blocks.map((block, index) => {
                const pos = layout.positions[block.id];
                const role = blockRole(block, index, layout.incomingBackEdges);
                return (
                  <Node
                    key={block.id}
                    block={block}
                    index={index}
                    role={role}
                    pos={pos}
                    expanded={expanded.has(block.id)}
                    selected={selected === block.id}
                    dimmed={highlightLoops && role === "body"}
                    onSelect={() => setSelected(block.id)}
                    onToggle={() => toggleExpanded(block.id)}
                  />
                );
              })}
            </g>
          </svg>
          <div style={{ position: "absolute", right: 12, bottom: 10, color: "#64748b", font: "800 10px var(--font-mono, monospace)" }}>
            scroll to zoom | drag to pan | click block for details
          </div>
        </div>

        {selectedBlock && (
          <DetailPanel block={selectedBlock} preds={preds} succs={succs} onClose={() => setSelected(null)} onViewInBasicBlocks={onViewInBasicBlocks} />
        )}
      </div>
    </div>
  );
}

function Legend() {
  const blockItems = [
    ["entry block", BLOCK_COLORS.entry],
    ["loop header", BLOCK_COLORS["loop header"]],
    ["condition", BLOCK_COLORS.condition],
    ["body block", BLOCK_COLORS.body],
    ["exit / return", BLOCK_COLORS.exit],
  ];
  const edgeItems = [
    ["fall-through", EDGE_COLORS.fall, ""],
    ["branch true", EDGE_COLORS["branch-true"], ""],
    ["branch false", EDGE_COLORS["branch-false"], ""],
    ["goto", EDGE_COLORS.goto, ""],
    ["back edge", EDGE_COLORS["back-edge"], "8,5"],
  ];

  return (
    <g transform="translate(18 18)" pointerEvents="none">
      <rect x="0" y="0" width="192" height="156" rx="8" fill="#0d1117" stroke="#1e2a3a" />
      {blockItems.map(([label, color], index) => (
        <g key={label} transform={`translate(12 ${18 + index * 18})`}>
          <circle r="4" fill={color} />
          <text x="12" y="4" fill="#94a3b8" fontSize="10" fontFamily="var(--font-mono, monospace)">{label}</text>
        </g>
      ))}
      {edgeItems.map(([label, color, dash], index) => (
        <g key={label} transform={`translate(12 ${108 + index * 9})`}>
          <line x1="0" y1="0" x2="24" y2="0" stroke={color} strokeWidth="2" strokeDasharray={dash || undefined} />
          <text x="32" y="4" fill="#94a3b8" fontSize="9" fontFamily="var(--font-mono, monospace)">{label}</text>
        </g>
      ))}
    </g>
  );
}

function EntryExitMarkers({ blocks, layout }) {
  const first = layout.positions[blocks[0]?.id];
  const exitBlocks = blocks.filter(block => block.instructions.some(instr => instr.op === "return") || block.exits.length === 0);
  if (!first) return null;
  return (
    <g pointerEvents="none">
      <Marker x={first.x} y={first.y - 38} label="ENTRY" color="#00d4ff" />
      <path d={`M ${first.x} ${first.y - 16} L ${first.x} ${first.y - 4}`} stroke="#00d4ff" strokeWidth="1.5" markerEnd="url(#cfg-arrow-back-edge)" />
      {exitBlocks.map(block => {
        const pos = layout.positions[block.id];
        if (!pos) return null;
        return <Marker key={block.id} x={pos.x} y={pos.y + pos.h + 16} label="EXIT" color="#10b981" />;
      })}
    </g>
  );
}

function Marker({ x, y, label, color }) {
  return (
    <g transform={`translate(${x - 34} ${y})`}>
      <rect width="68" height="22" rx="11" fill="#0d1117" stroke={color} />
      <text x="34" y="14" textAnchor="middle" fill={color} fontSize="10" fontWeight="900" fontFamily="var(--font-mono, monospace)">{label}</text>
    </g>
  );
}

function Edge({ edge, positions, selected, showLabels, highlightLoops }) {
  const source = positions[edge.source];
  const target = positions[edge.target];
  if (!source || !target) return null;

  const isBack = edge.type === "back-edge";
  const color = EDGE_COLORS[edge.type] || EDGE_COLORS.fall;
  const faded = selected && selected !== edge.source && selected !== edge.target;
  const sx = isBack ? source.x - NODE_W / 2 : source.x;
  const sy = isBack ? source.y + source.h / 2 : source.y + source.h;
  const tx = isBack ? target.x - NODE_W / 2 : target.x;
  const ty = isBack ? target.y + target.h / 2 : target.y;
  const dx = Math.abs(sx - tx);
  const leftRoute = Math.min(sx, tx) - 120;

  let path;
  if (isBack) path = `M ${sx} ${sy} C ${sx - 120} ${sy}, ${tx - 120} ${ty}, ${tx} ${ty}`;
  else if (dx < 20) path = `M ${sx} ${sy} L ${tx} ${ty}`;
  else path = `M ${sx} ${sy} C ${sx} ${sy + V_SPACING * 0.4}, ${tx} ${ty - V_SPACING * 0.4}, ${tx} ${ty}`;

  const label = EDGE_LABELS[edge.type] || edge.type;
  const lx = isBack ? leftRoute : (sx + tx) / 2;
  const ly = isBack ? (sy + ty) / 2 : (sy + ty) / 2 - 6;
  const labelWidth = Math.max(34, label.length * 6 + 12);

  return (
    <g opacity={faded ? 0.2 : 1} pointerEvents="none">
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={isBack || selected === edge.source || selected === edge.target ? 2.4 : 1.7}
        strokeDasharray={isBack ? "8,5" : undefined}
        markerEnd={`url(#cfg-arrow-${edge.type})`}
        filter={(isBack && highlightLoops) ? "drop-shadow(0 0 4px #00d4ff)" : undefined}
      />
      {showLabels && (
        <g transform={`translate(${lx} ${ly})`}>
          <rect x={-labelWidth / 2} y="-11" width={labelWidth} height="16" rx="4" fill="#0a0a0f" stroke={color} strokeOpacity="0.3" />
          <text textAnchor="middle" y="1" fill={color} fontSize="10" fontFamily="var(--font-mono, monospace)">{label}</text>
        </g>
      )}
    </g>
  );
}

function Node({ block, index, role, pos, expanded, selected, dimmed, onSelect, onToggle }) {
  if (!pos) return null;
  const color = BLOCK_COLORS[role] || BLOCK_COLORS.default;
  const preview = expanded ? block.instructions : block.instructions.slice(0, 4);
  const more = Math.max(0, block.instructions.length - preview.length);

  return (
    <g
      className={`cfg-node ${role === "loop header" ? "loop-pulse" : ""}`}
      transform={`translate(${pos.x - NODE_W / 2} ${pos.y})`}
      onClick={event => { event.stopPropagation(); onSelect(); }}
      opacity={dimmed ? 0.72 : 1}
    >
      <rect className="cfg-card" width={NODE_W} height={pos.h} rx="8" fill="#0d1117" stroke={color} strokeOpacity={selected ? 1 : 0.45} strokeWidth={selected ? 3 : 1.5} filter={selected ? `drop-shadow(0 0 8px ${color})` : undefined} />
      {selected && <rect x="0" y="8" width="4" height={pos.h - 16} rx="2" fill={color} />}

      <g>
        <rect width={NODE_W} height="31" rx="8" fill={`${color}12`} />
        <rect y="25" width={NODE_W} height="6" fill={`${color}12`} />
        <text x="10" y="20" fill={color} fontSize="11" fontWeight="900" fontFamily="var(--font-mono, monospace)">{block.id}</text>
        <text x="38" y="20" fill="#e5e7eb" fontSize="11" fontFamily="var(--font-mono, monospace)">{block.label || `block_${index}`}</text>
        <text x={NODE_W - 8} y="20" textAnchor="end" fill={color} fontSize="9" fontWeight="800" fontFamily="var(--font-mono, monospace)">{role}</text>
      </g>

      <line x1="0" y1="31" x2={NODE_W} y2="31" stroke="#1e2a3a" />
      {preview.map((instr, row) => (
        <g key={`${instr.op}-${row}`} transform={`translate(10 ${49 + row * 17})`}>
          <text fill={OP_COLORS[instr.op] || "#94a3b8"} fontSize="10" fontWeight="900" fontFamily="var(--font-mono, monospace)">{instr.op}</text>
          <text x="52" fill="#d1d5db" fontSize="10.5" fontFamily="var(--font-mono, monospace)">{trim(instr.instruction, 22)}</text>
        </g>
      ))}
      {more > 0 && (
        <text x="10" y={49 + preview.length * 17} fill="#64748b" fontSize="10" fontFamily="var(--font-mono, monospace)" onClick={event => { event.stopPropagation(); onToggle(); }}>
          + {more} more instructions
        </text>
      )}

      <line x1="0" y1={pos.h - 28} x2={NODE_W} y2={pos.h - 28} stroke="#1e2a3a" />
      <g transform={`translate(8 ${pos.h - 18})`}>
        {block.exits.length ? block.exits.slice(0, 2).map((exit, exitIndex) => {
          const exitColor = EDGE_COLORS[exit.type] || EDGE_COLORS.fall;
          return (
            <g key={`${exit.type}-${exit.target}`} transform={`translate(${exitIndex * 94} 0)`}>
              <rect width="88" height="16" rx="8" fill={`${exitColor}18`} stroke={`${exitColor}66`} />
              <text x="44" y="11" textAnchor="middle" fill={exitColor} fontSize="8.5" fontWeight="900" fontFamily="var(--font-mono, monospace)">
                {EDGE_LABELS[exit.type] || exit.type} {"->"} {exit.target}
              </text>
            </g>
          );
        }) : (
          <text fill="#64748b" fontSize="9" fontFamily="var(--font-mono, monospace)">no exits</text>
        )}
      </g>
    </g>
  );
}

function DetailPanel({ block, preds, succs, onClose, onViewInBasicBlocks }) {
  const roleColor = "#00d4ff";
  return (
    <aside style={{ borderLeft: "1px solid #1e2a3a", background: "#0d1117", padding: 14, overflow: "auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 }}>
        <div style={{ color: roleColor, font: "900 12px var(--font-mono, monospace)" }}>{block.id}: {block.label}</div>
        <button onClick={onClose} style={{ border: "none", background: "transparent", color: "#64748b", cursor: "pointer", fontSize: 16 }}>x</button>
      </div>
      <Divider />
      <Info label="Instructions" value={block.instructions.length} />
      <Info label="Predecessors" value={preds.length ? preds.join(", ") : "none"} />
      <Info label="Successors" value={succs.length ? succs.join(", ") : "none"} />
      <Divider />
      <div style={{ color: "#94a3b8", font: "900 10px var(--font-mono, monospace)", marginBottom: 8 }}>Full instructions:</div>
      {block.instructions.map((instr, index) => (
        <div key={index} style={{ display: "grid", gridTemplateColumns: "66px 1fr", gap: 8, padding: "3px 0", font: "10px var(--font-mono, monospace)" }}>
          <span style={{ color: OP_COLORS[instr.op] || "#94a3b8", fontWeight: 900 }}>{instr.op}</span>
          <span style={{ color: "#d1d5db", wordBreak: "break-word" }}>{instr.instruction}</span>
        </div>
      ))}
      <Divider />
      <button
        onClick={() => onViewInBasicBlocks?.(block.id)}
        style={{ width: "100%", border: "1px solid #00d4ff55", background: "#00d4ff12", color: "#00d4ff", borderRadius: 6, padding: "8px 10px", font: "900 10px var(--font-mono, monospace)", cursor: "pointer" }}
      >
        View in Basic Blocks {"->"}
      </button>
    </aside>
  );
}

function Info({ label, value }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "100px 1fr", gap: 8, margin: "6px 0", font: "10px var(--font-mono, monospace)" }}>
      <span style={{ color: "#64748b" }}>{label}:</span>
      <span style={{ color: "#e5e7eb" }}>{value}</span>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "#1e2a3a", margin: "10px 0" }} />;
}

function trim(value, max) {
  const text = String(value || "");
  return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}
