import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

const CARD_W = 200;
const MIN_CARD_H = 0;
const MIN_SIBLING_GAP = 24;
const COMPACT_SIBLING_GAP = 12;
const MIN_CENTER_GAP = CARD_W + MIN_SIBLING_GAP;
const BASE_V_SPACING = 140;
const WRAPPER_PAD = 20;
const FUNCTION_GAP = 54;

const OP_COLORS = {
  label: "#6b7280",
  "=": "#3b82f6",
  copy: "#3b82f6",
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
  print: "#a855f7",
  call: "#a855f7",
  return: "#ec4899",
  func_begin: "#00d4ff",
  func_end: "#6b7280",
};

const EDGE_COLORS = {
  fall: "#6b7280",
  "branch-true": "#10b981",
  "branch-false": "#ef4444",
  goto: "#f97316",
  "back-edge": "#00d4ff",
  return: "#6b7280",
};

function instrText(instr) {
  return instr.instruction || instr.code || [instr.result, instr.arg1, instr.arg2].filter(Boolean).join(" ") || instr.op || "";
}

function targetLabel(instr) {
  return instr.arg2 || instr.arg1 || instr.result || "";
}

export function parseTacToBasicBlocks(instructions = []) {
  const rawBlocks = [];
  let current = null;
  let functionName = "global";

  function flush() {
    if (current && current.instructions.length) rawBlocks.push(current);
    current = null;
  }

  function start(label) {
    flush();
    current = { label: label || `block_${rawBlocks.length}`, functionName, instructions: [], exits: [] };
  }

  start("entry");

  instructions.forEach(instr => {
    if (instr.op === "func_begin") {
      functionName = instr.result || instr.dst || instrText(instr).replace(/func_begin\s*/i, "").trim() || `func_${rawBlocks.length}`;
      start(functionName);
      current.instructions.push({ op: instr.op, instruction: instrText(instr), raw: instr });
      return;
    }

    if (instr.op === "label") {
      start(instr.result || instr.dst || instrText(instr).replace(/:$/, "").trim() || `L${rawBlocks.length}`);
      current.instructions.push({ op: instr.op, instruction: instrText(instr), raw: instr });
      return;
    }

    if (!current) start(`block_${rawBlocks.length}`);
    current.instructions.push({ op: instr.op, instruction: instrText(instr), raw: instr });

    if (instr.op === "goto") {
      current.exits.push({ type: "goto", target: targetLabel(instr) });
      start();
    } else if (instr.op === "if_goto") {
      current.exits.push({ type: "branch-true", target: targetLabel(instr) });
      current.exits.push({ type: "fall", target: "__next__" });
      start();
    } else if (instr.op === "ifnot_goto") {
      current.exits.push({ type: "branch-false", target: targetLabel(instr) });
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

  const blocks = rawBlocks
    .filter(block => block.instructions.length)
    .map((block, index) => ({ ...block, id: `B${index}` }));

  const labelToId = {};
  blocks.forEach(block => {
    labelToId[block.label] = block.id;
    block.instructions.forEach(instr => {
      if (instr.op === "label") {
        const text = instr.instruction.replace(/:$/, "").trim();
        if (text) labelToId[text] = block.id;
      }
    });
  });

  return blocks.map((block, index) => ({
    ...block,
    exits: block.exits.map(exit => {
      if (exit.target === "__next__") return { ...exit, target: blocks[index + 1]?.id || "__exit__" };
      if (exit.target === "__exit__") return exit;
      return { ...exit, target: labelToId[exit.target] || exit.target };
    }).filter(exit => exit.target),
  }));
}

function normalizeProvidedBlocks(blocks = [], tac = []) {
  if (!blocks.length) return [];
  const instrById = Object.fromEntries((tac || []).map(instr => [Number(instr.id), instr]));
  const idToBlockId = Object.fromEntries(blocks.map((block, index) => [Number(block.id ?? index), `B${index}`]));

  return blocks.map((block, index) => {
    const instrIds = block.instrIds || block.instr_ids || [];
    const instructions = (block.instructions || block.instrs || instrIds.map(id => instrById[Number(id)]).filter(Boolean))
      .map(instr => ({
        op: instr.op || "op",
        instruction: instrText(instr),
        raw: instr,
      }));

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
      functionName: block.func || block.functionName || block.function_name || "global",
      instructions,
      exits: exits.filter(exit => exit.target),
    };
  });
}

function groupBlocksByFunction(blocks) {
  const groups = [];
  blocks.forEach(block => {
    const name = block.functionName || "global";
    const last = groups[groups.length - 1];
    if (!last || last.name !== name) groups.push({ name, blocks: [] });
    groups[groups.length - 1].blocks.push(block);
  });
  return groups;
}

function estimateCardHeight(block, collapsed) {
  const instructionRows = collapsed ? 0 : block.instructions.length * 22;
  return 28 + instructionRows + 28;
}

function computeLayout(blocks, width, cardHeights = {}, collapsed = new Set()) {
  if (!blocks.length) return { positions: {}, edges: [], separators: [], canvas: { width: 760, height: 160 } };

  const viewportWidth = Math.max(320, width);
  const byId = Object.fromEntries(blocks.map(block => [block.id, block]));
  const blockIndex = Object.fromEntries(blocks.map((block, index) => [block.id, index]));
  const positions = {};
  const edges = [];
  const separators = [];
  let cursorY = WRAPPER_PAD;
  let maxRight = viewportWidth - WRAPPER_PAD;

  groupBlocksByFunction(blocks).forEach((group, groupIndex) => {
    if (groupIndex > 0) cursorY += FUNCTION_GAP;
    if (groupBlocksByFunction(blocks).length > 1) {
      separators.push({ name: group.name, y: cursorY });
      cursorY += 30;
    }

    const localIndex = Object.fromEntries(group.blocks.map((block, index) => [block.id, index]));
    const depth = { [group.blocks[0].id]: 0 };
    const bfsOrder = [];
    const queue = [group.blocks[0].id];

    while (queue.length) {
      const id = queue.shift();
      if (bfsOrder.includes(id)) continue;
      bfsOrder.push(id);
      const block = byId[id];
      if (!block) continue;
      block.exits.forEach(exit => {
        if (exit.target === "__exit__" || !Object.prototype.hasOwnProperty.call(localIndex, exit.target)) return;
        if (localIndex[exit.target] <= localIndex[id]) return;
        if (depth[exit.target] === undefined || depth[exit.target] > depth[id] + 1) {
          depth[exit.target] = depth[id] + 1;
          queue.push(exit.target);
        }
      });
    }

    group.blocks.forEach((block, index) => {
      if (depth[block.id] === undefined) depth[block.id] = index;
    });

    const levels = {};
    group.blocks.forEach(block => {
      const d = depth[block.id];
      if (!levels[d]) levels[d] = [];
      levels[d].push(block);
    });

    const sortedLevels = Object.entries(levels).sort(([a], [b]) => Number(a) - Number(b));
    let levelY = cursorY;
    sortedLevels.forEach(([level, levelBlocks]) => {
      const heights = levelBlocks.map(block => cardHeights[block.id] || estimateCardHeight(block, collapsed.has(block.id)));
      const levelHeight = Math.max(...heights, 56);
      const count = levelBlocks.length;
      const desiredGap = count * CARD_W + (count - 1) * MIN_SIBLING_GAP > viewportWidth - WRAPPER_PAD * 2
        ? COMPACT_SIBLING_GAP
        : MIN_SIBLING_GAP;
      const step = CARD_W + desiredGap;
      const totalWidth = count * CARD_W + (count - 1) * desiredGap;
      const center = viewportWidth / 2;
      const startX = center - totalWidth / 2 + CARD_W / 2;

      levelBlocks.forEach((block, index) => {
        positions[block.id] = {
          x: startX + index * step,
          y: levelY,
          depth: Number(level),
          functionName: group.name,
          bfsOrder: bfsOrder.indexOf(block.id) === -1 ? localIndex[block.id] : bfsOrder.indexOf(block.id),
        };
      });

      for (let i = 0; i < 3; i += 1) {
        for (let a = 0; a < levelBlocks.length; a += 1) {
          for (let b = a + 1; b < levelBlocks.length; b += 1) {
            const left = positions[levelBlocks[a].id];
            const right = positions[levelBlocks[b].id];
            const gap = Math.abs(right.x - left.x);
            if (gap < MIN_CENTER_GAP) {
              const push = (MIN_CENTER_GAP - gap) / 2;
              left.x -= push;
              right.x += push;
            }
          }
        }
      }

      const minX = Math.min(...levelBlocks.map(block => positions[block.id].x - CARD_W / 2));
      const maxX = Math.max(...levelBlocks.map(block => positions[block.id].x + CARD_W / 2));
      const offset = viewportWidth / 2 - (minX + maxX) / 2;
      levelBlocks.forEach(block => {
        positions[block.id].x += offset;
        maxRight = Math.max(maxRight, positions[block.id].x + CARD_W / 2 + WRAPPER_PAD);
      });

      levelY += Math.max(BASE_V_SPACING, levelHeight + 40);
    });

    cursorY = levelY;
  });

  blocks.forEach((block, index) => {
    if (!block.exits.length && blocks[index + 1] && positions[blocks[index + 1].id]?.functionName === positions[block.id]?.functionName) {
      const back = positions[blocks[index + 1].id].depth <= positions[block.id].depth || positions[blocks[index + 1].id].bfsOrder < positions[block.id].bfsOrder;
      edges.push({ source: block.id, target: blocks[index + 1].id, type: back ? "back-edge" : "fall" });
      return;
    }
    block.exits.forEach(exit => {
      if (exit.target === "__exit__" || !positions[exit.target]) return;
      const source = positions[block.id];
      const target = positions[exit.target];
      const back = target.depth <= source.depth || target.bfsOrder < source.bfsOrder || blockIndex[exit.target] <= blockIndex[block.id];
      edges.push({ source: block.id, target: exit.target, type: back ? "back-edge" : exit.type });
    });
  });

  const bottom = Math.max(...blocks.map(block => {
    const pos = positions[block.id];
    return pos.y + (cardHeights[block.id] || estimateCardHeight(block, collapsed.has(block.id)));
  }));

  return {
    positions,
    edges,
    separators,
    canvas: {
      width: Math.max(viewportWidth, maxRight + WRAPPER_PAD),
      height: bottom + WRAPPER_PAD + 48,
    },
  };
}

export default function BasicBlocks({ blocks: blocksProp, tac = [] }) {
  const containerRef = useRef(null);
  const stageRef = useRef(null);
  const contentRef = useRef(null);
  const svgRef = useRef(null);
  const cardRefs = useRef({});
  const zoomRef = useRef(null);
  const zoomDebounceRef = useRef(null);
  const [width, setWidth] = useState(900);
  const [cardHeights, setCardHeights] = useState({});
  const [zoomPct, setZoomPct] = useState(100);
  const [collapsed, setCollapsed] = useState(new Set());
  const [selected, setSelected] = useState(null);
  const [showLabels, setShowLabels] = useState(true);

  const blocks = useMemo(() => {
    const normalized = normalizeProvidedBlocks(blocksProp || [], tac);
    return normalized.length ? normalized : parseTacToBasicBlocks(tac);
  }, [blocksProp, tac]);
  const layout = useMemo(() => computeLayout(blocks, width, cardHeights, collapsed), [blocks, width, cardHeights, collapsed]);

  useEffect(() => {
    if (!containerRef.current) return undefined;
    const observer = new ResizeObserver(entries => {
      setWidth(Math.max(720, entries[0].contentRect.width));
      requestAnimationFrame(() => {
        measureCards();
        drawArrows();
      });
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    measureCards();
  }, [blocks, collapsed]);

  useEffect(() => {
    const observers = blocks.map(block => {
      const el = cardRefs.current[block.id];
      if (!el) return null;
      const observer = new ResizeObserver(() => {
        measureCards();
        requestAnimationFrame(drawArrows);
      });
      observer.observe(el);
      return observer;
    });
    return () => observers.forEach(observer => observer?.disconnect());
  }, [blocks, collapsed]);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => drawArrows());
    return () => cancelAnimationFrame(frame);
  }, [layout, collapsed, showLabels, selected, cardHeights]);

  useEffect(() => {
    if (!stageRef.current || !contentRef.current) return undefined;
    const zoom = d3.zoom()
      .scaleExtent([0.3, 2.5])
      .extent([[0, 0], [width, Math.max(560, layout.canvas.height)]])
      .filter(event => event.type === "wheel" || !event.target.closest?.(".block-card"))
      .on("zoom", event => {
        const { x, y, k } = event.transform;
        contentRef.current.style.transform = `translate(${x}px, ${y}px) scale(${k})`;
        setZoomPct(Math.round(k * 100));
        if (zoomDebounceRef.current) clearTimeout(zoomDebounceRef.current);
        zoomDebounceRef.current = setTimeout(() => drawArrows(), 150);
      });
    zoomRef.current = zoom;
    d3.select(stageRef.current).call(zoom);
    return () => {
      if (zoomDebounceRef.current) clearTimeout(zoomDebounceRef.current);
      d3.select(stageRef.current).on(".zoom", null);
    };
  }, [width, layout.canvas.height, showLabels, selected]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      measureCards();
      fitScreen(false);
      drawArrows();
    });
    return () => cancelAnimationFrame(frame);
  }, [layout.canvas.width, layout.canvas.height, blocks.length, cardHeights]);

  function measureCards() {
    const next = {};
    blocks.forEach(block => {
      const el = cardRefs.current[block.id];
      if (el) next[block.id] = Math.ceil(el.offsetHeight);
    });
    if (!Object.keys(next).length) return;
    setCardHeights(prev => {
      const changed = Object.keys(next).some(id => prev[id] !== next[id]);
      return changed ? { ...prev, ...next } : prev;
    });
  }

  function fitScreen(animate = true) {
    if (!stageRef.current || !zoomRef.current) return;
    const stage = stageRef.current;
    const stageW = stage.clientWidth || width;
    const stageH = stage.clientHeight || 560;
    const bbox = getCardBounds();
    const scale = Math.max(0.3, Math.min(2.5, Math.min(stageW / (bbox.width + 40), stageH / (bbox.height + 40))));
    const tx = (stageW - bbox.width * scale) / 2 - bbox.left * scale;
    const ty = (stageH - bbox.height * scale) / 2 - bbox.top * scale + 20;
    const selection = d3.select(stage);
    const transform = d3.zoomIdentity.translate(tx, ty).scale(scale);
    if (animate) selection.transition().duration(300).call(zoomRef.current.transform, transform);
    else selection.call(zoomRef.current.transform, transform);
  }

  function getCardBounds() {
    const boxes = blocks
      .map(block => {
        const pos = layout.positions[block.id];
        if (!pos) return null;
        const cardH = cardHeights[block.id] || cardRefs.current[block.id]?.offsetHeight || estimateCardHeight(block, collapsed.has(block.id));
        return {
          left: pos.x - CARD_W / 2,
          right: pos.x + CARD_W / 2,
          top: pos.y,
          bottom: pos.y + cardH,
        };
      })
      .filter(Boolean);

    if (!boxes.length) {
      return { left: 0, top: 0, right: layout.canvas.width, bottom: layout.canvas.height, width: layout.canvas.width, height: layout.canvas.height };
    }

    const left = Math.min(...boxes.map(box => box.left));
    const right = Math.max(...boxes.map(box => box.right));
    const top = Math.min(...boxes.map(box => box.top));
    const bottom = Math.max(...boxes.map(box => box.bottom));
    return { left, top, right, bottom, width: Math.max(1, right - left), height: Math.max(1, bottom - top) };
  }

  function zoomBy(factor) {
    if (!stageRef.current || !zoomRef.current) return;
    d3.select(stageRef.current).transition().duration(180).call(zoomRef.current.scaleBy, factor);
  }

  function drawArrows() {
    const svgEl = svgRef.current;
    const wrapper = contentRef.current;
    const stage = stageRef.current;
    if (!svgEl || !wrapper || !stage) return;

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();
    svg.attr("width", layout.canvas.width).attr("height", layout.canvas.height);
    const transform = d3.zoomTransform(stage);
    const scale = transform.k || 1;
    const wrapperRect = wrapper.getBoundingClientRect();

    function cardBox(id) {
      const el = cardRefs.current[id];
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        left: (rect.left - wrapperRect.left) / scale,
        right: (rect.right - wrapperRect.left) / scale,
        top: (rect.top - wrapperRect.top) / scale,
        bottom: (rect.bottom - wrapperRect.top) / scale,
        width: rect.width / scale,
        height: rect.height / scale,
        cx: (rect.left + rect.width / 2 - wrapperRect.left) / scale,
      };
    }

    const defs = svg.append("defs");
    Object.entries(EDGE_COLORS).forEach(([type, color]) => {
      defs.append("marker")
        .attr("id", `bb-arrow-${type}`)
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 8)
        .attr("refY", 0)
        .attr("markerWidth", 6)
        .attr("markerHeight", 6)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", color);
    });

    const boxes = blocks.map(block => cardBox(block.id)).filter(Boolean);
    const leftBound = boxes.length ? Math.min(...boxes.map(box => box.left)) - 60 : WRAPPER_PAD;

    layout.edges.forEach(edge => {
      const sourceBox = cardBox(edge.source);
      const targetBox = cardBox(edge.target);
      if (!sourceBox || !targetBox) return;
      const color = EDGE_COLORS[edge.type] || "#6b7280";
      const sx = sourceBox.cx;
      const sy = sourceBox.bottom;
      const tx = targetBox.cx;
      const ty = targetBox.top;
      const isBack = edge.type === "back-edge";
      const midY = (sy + ty) / 2;
      const sameColumn = Math.abs(sx - tx) < 10;
      let path = `M ${sx} ${sy} L ${tx} ${ty}`;
      if (isBack) {
        path = `M ${sx} ${sy} C ${sx - 80} ${sy}, ${leftBound} ${midY}, ${tx - 80} ${ty} L ${tx} ${ty}`;
      } else if (!sameColumn) {
        path = `M ${sx} ${sy} C ${sx} ${midY}, ${tx} ${midY}, ${tx} ${ty}`;
      }

      svg.append("path")
        .attr("d", path)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", selected === edge.source || selected === edge.target ? 2.8 : 2)
        .attr("stroke-dasharray", isBack ? "6,4" : null)
        .attr("opacity", selected && selected !== edge.source && selected !== edge.target ? 0.35 : 0.9)
        .attr("marker-end", `url(#bb-arrow-${edge.type})`);

      if (showLabels) {
        const label = isBack ? "loop back" : edge.type;
        const lx = isBack ? leftBound : (sx + tx) / 2;
        const ly = isBack ? midY : midY - 5;
        const textW = Math.max(42, label.length * 7);
        svg.append("rect")
          .attr("x", lx - textW / 2)
          .attr("y", ly - 11)
          .attr("width", textW)
          .attr("height", 15)
          .attr("rx", 4)
          .attr("fill", "#0a0a0f")
          .attr("stroke", color)
          .attr("stroke-opacity", 0.25);
        svg.append("text")
          .attr("x", lx)
          .attr("y", ly)
          .attr("text-anchor", "middle")
          .attr("font-family", "var(--font-mono, monospace)")
          .attr("font-size", 10)
          .attr("fill", color)
          .text(label);
      }
    });
  }

  function toggleBlock(id) {
    setCollapsed(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  if (!blocks.length) {
    return (
      <div style={{ background: "#0a0a0f", border: "1px solid #1e2a3a", borderRadius: 8, padding: 36, color: "#64748b", textAlign: "center", fontFamily: "var(--font-mono, monospace)" }}>
        No basic blocks available.
      </div>
    );
  }

  return (
    <div ref={containerRef} className="bb-shell">
      <style>{`
        .bb-shell { background:#0a0a0f; border:1px solid #1e2a3a; border-radius:8px; overflow:hidden; }
        .bb-toolbar { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; padding:10px 12px; background:#0d1117; border-bottom:1px solid #1e2a3a; }
        .bb-toolbar-left, .bb-toolbar-right { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .bb-button { border:1px solid #1e2a3a; background:#111827; color:#94a3b8; border-radius:6px; padding:7px 10px; font:800 10px var(--font-mono,monospace); cursor:pointer; }
        .bb-zoom-level { min-width:42px; text-align:center; color:#00d4ff; font:900 10px var(--font-mono,monospace); }
        .bb-stage { position:relative; overflow:hidden; cursor:grab; background-image:radial-gradient(circle, rgba(148,163,184,.10) 1px, transparent 1px); background-size:18px 18px; }
        .bb-stage:active { cursor:grabbing; }
        .diagram-wrapper { cursor:grab; user-select:none; transform-origin:0 0; }
        .diagram-wrapper:active { cursor:grabbing; }
        .bb-card, .block-card { position:absolute; width:${CARD_W}px; min-height:${MIN_CARD_H}px; background:#0d1117; border:1px solid #1e2a3a; border-radius:8px; overflow:hidden; font-family:var(--font-mono,monospace); transition:border-color .15s, box-shadow .15s; z-index:2; cursor:default; pointer-events:all; }
        .bb-card-header { cursor:pointer; height:28px; padding:0 12px; border-bottom:1px solid #1e2a3a; display:flex; align-items:center; gap:7px; box-sizing:border-box; }
        .bb-instrs { padding:0; }
        .bb-instr-row { display:grid; grid-template-columns:90px 1fr; gap:8px; min-height:22px; padding:3px 12px; box-sizing:border-box; font-size:11px; line-height:1.35; }
        .bb-exits { min-height:28px; border-top:1px solid #1e2a3a; padding:5px 12px; display:flex; align-items:center; gap:5px; flex-wrap:wrap; box-sizing:border-box; }
        .bb-function-separator { position:absolute; left:20px; right:20px; height:20px; color:#00d4ff; font:900 10px var(--font-mono,monospace); text-align:center; letter-spacing:1px; text-transform:uppercase; z-index:3; opacity:.85; }
        .bb-card:hover { border-color:#3b82f6; box-shadow:0 0 18px rgba(59,130,246,.16); }
        .bb-card-selected { border-left:3px solid #00d4ff; box-shadow:0 0 22px rgba(0,212,255,.18); }
        .bb-pulse { animation:bbPulse 1.4s ease-in-out infinite; }
        @keyframes bbPulse { 50% { box-shadow:0 0 24px rgba(0,212,255,.30); } }
      `}</style>

      <div className="bb-toolbar">
        <div className="bb-toolbar-left">
          <div style={{ color: "#00d4ff", font: "900 11px var(--font-mono, monospace)", letterSpacing: "1px", textTransform: "uppercase" }}>
            {blocks.length} Basic Block{blocks.length !== 1 ? "s" : ""} detected
          </div>
        </div>
        <div className="bb-toolbar-right">
          <button className="bb-button" onClick={() => zoomBy(0.8)}>-</button>
          <button className="bb-button" onClick={() => zoomBy(1.2)}>+</button>
          <button className="bb-button" onClick={() => fitScreen(true)}>Fit</button>
          <span className="bb-zoom-level">{zoomPct}%</span>
          <button className="bb-button" onClick={() => setCollapsed(new Set())}>Expand All</button>
          <button className="bb-button" onClick={() => setCollapsed(new Set(blocks.map(block => block.id)))}>Collapse All</button>
          <button className="bb-button" onClick={() => setShowLabels(v => !v)}>Show Labels {showLabels ? "✓" : ""}</button>
        </div>
      </div>

      <div ref={stageRef} className="bb-stage" style={{ height: Math.min(640, layout.canvas.height) }}>
        <div ref={contentRef} className="diagram-wrapper" style={{ position: "relative", width: layout.canvas.width, height: layout.canvas.height }}>
          <svg ref={svgRef} style={{ position: "absolute", inset: 0, zIndex: 1, pointerEvents: "none" }} />

          {layout.separators.map(separator => (
            <div key={`${separator.name}-${separator.y}`} className="bb-function-separator" style={{ top: separator.y }}>
              -- function: {separator.name} --
            </div>
          ))}

          <Marker label="ENTRY" color="#00d4ff" x={layout.positions[blocks[0].id]?.x || width / 2} y={Math.max(0, (layout.positions[blocks[0].id]?.y || 20) - 20)} />
          <Marker label="EXIT" color="#6b7280" x={layout.positions[blocks[blocks.length - 1].id]?.x || width / 2} y={getCardBounds().bottom + 20} />

          {blocks.map((block, index) => {
            const pos = layout.positions[block.id];
            if (!pos) return null;
            const isCollapsed = collapsed.has(block.id);
            const isSelected = selected === block.id;
            return (
              <BlockCard
                key={block.id}
                refCallback={el => { if (el) cardRefs.current[block.id] = el; }}
                block={block}
                index={index}
                collapsed={isCollapsed}
                selected={isSelected}
                x={pos.x}
                y={pos.y}
                onToggle={() => toggleBlock(block.id)}
                onSelect={() => setSelected(block.id)}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Marker({ label, color, x, y }) {
  return (
    <div style={{
      position: "absolute",
      left: x - 38,
      top: y,
      zIndex: 3,
      border: `1px solid ${color}`,
      color,
      background: "#0d1117",
      borderRadius: 999,
      padding: "5px 16px",
      font: "900 10px var(--font-mono, monospace)",
      boxShadow: `0 0 14px ${color}22`,
    }}>
      {label}
    </div>
  );
}

function BlockCard({ block, index, collapsed, selected, x, y, onToggle, onSelect, refCallback }) {
  return (
    <div
      ref={refCallback}
      className={`bb-card block-card ${selected ? "bb-card-selected" : ""} ${index === 0 ? "bb-pulse" : ""}`}
      onClick={onSelect}
      style={{ left: x - CARD_W / 2, top: y }}
    >
      <div className="bb-card-header" onClick={event => { event.stopPropagation(); onToggle(); }}>
        <span style={{ background: "#1e2a3a", color: "#00d4ff", borderRadius: 4, padding: "2px 6px", fontWeight: 900, fontSize: 10 }}>{block.id}</span>
        <span style={{ color: "#94a3b8", fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{block.label || `block_${index}`}</span>
        <span style={{ marginLeft: "auto", color: "#64748b", fontSize: 9 }}>{block.instructions.length} instrs</span>
      </div>

      {!collapsed && (
        <div className="bb-instrs">
          {block.instructions.map((instr, i) => {
            const color = OP_COLORS[instr.op] || "#94a3b8";
            return (
              <div key={i} className="bb-instr-row">
                <span style={{ color, fontStyle: instr.op === "label" ? "italic" : "normal", fontWeight: 800, overflow: "hidden", textOverflow: "ellipsis" }}>{instr.op}</span>
                <span style={{ color: "#e2e8f0", wordBreak: "break-word" }}>{instr.instruction}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="bb-exits">
        {block.exits.length ? block.exits.map((exit, i) => {
          const color = EDGE_COLORS[exit.type] || "#6b7280";
          return (
            <span key={i} style={{ color, background: `${color}14`, border: `1px solid ${color}44`, borderRadius: 999, padding: "2px 7px", fontSize: 9, fontWeight: 800 }}>
              {`${exit.type} -> ${exit.target}`}
            </span>
          );
        }) : (
          <span style={{ color: "#64748b", fontSize: 9 }}>no explicit exits</span>
        )}
      </div>
    </div>
  );
}
