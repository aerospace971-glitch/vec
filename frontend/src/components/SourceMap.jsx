// src/components/LearnMode/phases/parser/SourceMap.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

const NODE_COLORS = {
  Program: "#00d4ff",
  FunctionDecl: "#a855f7",
  VarDecl: "#3b82f6",
  ClassDecl: "#f59e0b",
  IfStmt: "#f97316",
  ForStmt: "#f97316",
  WhileStmt: "#f97316",
  BinaryExpr: "#10b981",
  UnaryExpr: "#10b981",
  CallExpr: "#06b6d4",
  Literal: "#84cc16",
  Identifier: "#e2e8f0",
  CompoundStmt: "#8b5cf6",
  Default: "#6b7280",
};

function flattenAst(node, out = [], depth = 0) {
  if (!node) return out;
  const id = node.id || `${node.type}-${node.line || 0}-${String(node.value || node.name || "").slice(0, 12)}`;
  out.push({ ...node, id, depth });
  (node.children || []).forEach((c) => flattenAst(c, out, depth + 1));
  return out;
}

function nodeColor(type) {
  return NODE_COLORS[type] || NODE_COLORS.Default;
}

function nodeSize(type) {
  if (["Program", "FunctionDecl", "ClassDecl"].includes(type)) return 34;
  if (type && type.toLowerCase().includes("stmt")) return 28;
  return 22;
}

function buildNetwork(astData, sourceCode) {
  const sourceLines = (sourceCode || "")
    .split("\n")
    .map((text, i) => ({
      id: `src-${i + 1}`,
      line: i + 1,
      text: text.replace(/\t/g, "  "),
    }))
    .filter((line) => line.text.trim().length > 0);

  const astNodes = flattenAst(astData || {}).map((n, i) => ({
    id: `ast-${i}-${n.id}`,
    type: n.type || "Unknown",
    value: n.value ?? n.name ?? n.operator ?? "",
    line: n.line || n.l || null,
    depth: n.depth || 0,
    raw: n,
    color: nodeColor(n.type),
    r: nodeSize(n.type),
  }));

  const edges = astNodes
    .filter((n) => n.line)
    .map((n) => ({ source: `src-${n.line}`, target: n.id, color: n.color }));

  return { sourceLines, astNodes, edges };
}

function astMapColor(targetId, net) {
  const node = net.astNodes.find((n) => n.id === targetId);
  return node ? node.color : null;
}

export default function SourceMap({
  astData = null,
  sourceCode = "",
  onViewInAST = () => {},
  onSwitchTab = () => {},
  highlightLine = null,
  phaseColor = "#8b5cf6",
}) {
  const containerRef = useRef(null);
  const svgRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const [activeSrcId, setActiveSrcId] = useState(null);
  const [status, setStatus] = useState("Click a source line to focus its AST nodes");

  const network = useMemo(() => buildNetwork(astData, sourceCode), [astData, sourceCode]);

  useEffect(() => {
    if (!highlightLine) return;
    const srcId = `src-${highlightLine}`;
    setActiveSrcId(srcId);
    setSelected({ type: "src", id: srcId });
  }, [highlightLine]);

  function computeLayout(width, height) {
    const BOX_HEIGHT = 48;
    const BOX_STEP = BOX_HEIGHT + 14;
    const leftX = 20;
    const totalNeeded = network.sourceLines.length * BOX_STEP;
    const startY = Math.max(20, (height - totalNeeded) / 2);

    const srcPositions = network.sourceLines.map((s, i) => ({
      ...s,
      displayText: s.text.length > 18 ? `${s.text.slice(0, 18)}...` : s.text,
      fullText: s.text,
      x: leftX,
      y: startY + i * BOX_STEP,
      width: 150,
      height: BOX_HEIGHT,
    }));

    const sourceColWidth = 180;
    const graphWidth = Math.max(260, width - sourceColWidth - 20);
    const maxDepth = Math.max(...network.astNodes.map((n) => n.depth || 0), 0);
    const depthGroups = {};
    network.astNodes.forEach((n) => {
      depthGroups[n.depth] = depthGroups[n.depth] || [];
      depthGroups[n.depth].push(n);
    });

    const astPositions = [];
    Object.keys(depthGroups)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach((depth) => {
        const nodes = depthGroups[depth];
        const x = maxDepth === 0
          ? sourceColWidth + graphWidth / 2
          : sourceColWidth + (depth / maxDepth) * graphWidth;
        const vertSpacing = (height - 40) / Math.max(nodes.length + 1, 2);

        nodes.forEach((n, index) => {
          astPositions.push({ ...n, cx: x, cy: 20 + (index + 1) * vertSpacing });
        });
      });

    return { srcPositions, astPositions };
  }

  useEffect(() => {
    const container = containerRef.current;
    const svgEl = svgRef.current;
    if (!container || !svgEl || !network.sourceLines.length || !network.astNodes.length) return undefined;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return undefined;

    const W = Math.max(800, rect.width);
    const H = Math.max(400, rect.height);
    const svg = d3.select(svgEl).attr("width", W).attr("height", H);

    svg.selectAll("*").remove();
    const g = svg.append("g").attr("class", "graph-root");

    let srcTooltip = document.getElementById("src-tooltip");
    if (!srcTooltip) {
      srcTooltip = document.createElement("div");
      srcTooltip.id = "src-tooltip";
      srcTooltip.style.cssText = "position:absolute; background:#1e293b; border:1px solid #2a3a55; border-radius:6px; padding:6px 10px; font-size:11px; font-family:monospace; color:#e2e8f0; pointer-events:none; opacity:0; transition:opacity 0.15s; z-index:10; max-width:280px; white-space:pre-wrap; word-break:break-all;";
      container.appendChild(srcTooltip);
    }

    let astTooltip = document.getElementById("ast-tooltip");
    if (!astTooltip) {
      astTooltip = document.createElement("div");
      astTooltip.id = "ast-tooltip";
      astTooltip.style.cssText = "position:absolute; background:#1e293b; border:1px solid #2a3a55; border-radius:6px; padding:6px 10px; font-size:11px; font-family:monospace; color:#e2e8f0; pointer-events:none; opacity:0; transition:opacity 0.15s; z-index:10; max-width:200px; white-space:pre-wrap; word-break:break-word;";
      container.appendChild(astTooltip);
    }

    svg.call(d3.zoom().scaleExtent([0.5, 2]).on("zoom", (event) => {
      g.attr("transform", event.transform);
    }));

    const { srcPositions, astPositions } = computeLayout(W, H);
    const defs = svg.append("defs");
    defs.append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 8)
      .attr("refY", 0)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto")
      .append("path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("fill", "#2a3a55");

    const srcMap = new Map(srcPositions.map((s) => [s.id, s]));
    const astMap = new Map(astPositions.map((a) => [a.id, a]));
    const edges = network.edges.filter((e) => srcMap.has(e.source) && astMap.has(e.target));

    const edgeG = g.append("g").attr("class", "edges");
    edgeG.selectAll("path.edge").data(edges).enter().append("path")
      .attr("class", "edge")
      .attr("d", (d) => {
        const src = srcMap.get(d.source);
        const tgt = astMap.get(d.target);
        const sx = src.x + src.width;
        const sy = src.y + src.height / 2;
        const angle = Math.atan2(sy - tgt.cy, sx - tgt.cx);
        const tx = tgt.cx + tgt.r * Math.cos(angle);
        const ty = tgt.cy + tgt.r * Math.sin(angle);
        const cp1x = sx + (tx - sx) * 0.35;
        const cp1y = sy;
        const cp2x = sx + (tx - sx) * 0.65;
        const cp2y = ty;
        return `M ${sx},${sy} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${tx},${ty}`;
      })
      .attr("fill", "none")
      .attr("stroke", "#2a3a55")
      .attr("stroke-width", 1)
      .attr("opacity", 0.3)
      .attr("marker-end", "url(#arrow)");

    const srcG = g.append("g").attr("class", "sources");
    const srcNodes = srcG.selectAll("g.src").data(srcPositions).enter().append("g")
      .attr("class", "src")
      .style("cursor", "pointer");

    srcNodes.append("rect")
      .attr("x", (d) => d.x)
      .attr("y", (d) => d.y)
      .attr("rx", 8)
      .attr("ry", 8)
      .attr("width", (d) => d.width)
      .attr("height", (d) => d.height)
      .attr("fill", (d) => d.id === activeSrcId ? `${phaseColor}25` : `${phaseColor}15`)
      .attr("stroke", (d) => d.id === activeSrcId ? phaseColor : `${phaseColor}80`)
      .attr("stroke-width", (d) => d.id === activeSrcId ? 2.5 : 1.5);

    srcNodes.append("text")
      .attr("x", (d) => d.x + 14)
      .attr("y", (d) => d.y + 17)
      .text((d) => `Line ${d.line}`)
      .attr("font-family", "monospace")
      .attr("font-size", 10)
      .attr("fill", phaseColor)
      .attr("font-weight", 700);

    srcNodes.append("text")
      .attr("x", (d) => d.x + 14)
      .attr("y", (d) => d.y + 34)
      .text((d) => d.displayText)
      .attr("font-family", "monospace")
      .attr("font-size", 9)
      .attr("fill", "#64748b");

    const astG = g.append("g").attr("class", "asts");
    const astNodesSel = astG.selectAll("g.ast").data(astPositions).enter().append("g")
      .attr("class", "ast")
      .style("cursor", "pointer");

    astNodesSel.append("circle")
      .attr("cx", (d) => d.cx)
      .attr("cy", (d) => d.cy)
      .attr("r", (d) => d.r)
      .attr("fill", (d) => `${d.color}20`)
      .attr("stroke", (d) => d.color)
      .attr("stroke-width", 2);

    astNodesSel.append("text")
      .attr("x", (d) => d.cx)
      .attr("y", (d) => d.cy - 4)
      .text((d) => (d.type || "").slice(0, 9))
      .attr("font-family", "monospace")
      .attr("font-size", 9)
      .attr("fill", (d) => d.color)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle");

    astNodesSel.append("text")
      .attr("x", (d) => d.cx)
      .attr("y", (d) => d.cy + 10)
      .text((d) => String(d.value || "").slice(0, 8) + (String(d.value || "").length > 8 ? "..." : ""))
      .attr("font-family", "monospace")
      .attr("font-size", 8)
      .attr("fill", "#94a3b8")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle");

    srcNodes.on("click", (event, d) => {
      event.stopPropagation();
      setSelected({ type: "src", id: d.id });
      setActiveSrcId((current) => current === d.id ? null : d.id);
    }).on("mouseover", function (event, d) {
      d3.select(this).select("rect").attr("stroke-width", 2.5);
      const tooltip = document.getElementById("src-tooltip");
      if (tooltip) {
        tooltip.textContent = `Line ${d.line}: ${d.fullText}`;
        tooltip.style.opacity = "1";
        tooltip.style.left = `${event.offsetX + 12}px`;
        tooltip.style.top = `${event.offsetY - 10}px`;
      }
    }).on("mousemove", function (event) {
      const tooltip = document.getElementById("src-tooltip");
      if (tooltip && tooltip.style.opacity === "1") {
        tooltip.style.left = `${event.offsetX + 12}px`;
        tooltip.style.top = `${event.offsetY - 10}px`;
      }
    }).on("mouseout", function () {
      d3.select(this).select("rect").attr("stroke-width", 1.5);
      const tooltip = document.getElementById("src-tooltip");
      if (tooltip) tooltip.style.opacity = "0";
    });

    astNodesSel.on("click", (event, d) => {
      event.stopPropagation();
      setSelected({ type: "ast", id: d.id });
    }).on("mouseover", function (event, d) {
      d3.select(this).select("circle").attr("stroke-width", 3);
      const tooltip = document.getElementById("ast-tooltip");
      if (tooltip) {
        const childCount = d.raw?.children?.length ?? 0;
        tooltip.textContent = `${d.type}: ${d.value}\nLine: ${d.line || "?"}\nChildren: ${childCount}`;
        tooltip.style.opacity = "1";
        tooltip.style.left = `${event.offsetX + 12}px`;
        tooltip.style.top = `${event.offsetY - 10}px`;
      }
    }).on("mousemove", function (event) {
      const tooltip = document.getElementById("ast-tooltip");
      if (tooltip && tooltip.style.opacity === "1") {
        tooltip.style.left = `${event.offsetX + 12}px`;
        tooltip.style.top = `${event.offsetY - 10}px`;
      }
    }).on("mouseout", function () {
      d3.select(this).select("circle").attr("stroke-width", 2);
      const tooltip = document.getElementById("ast-tooltip");
      if (tooltip) tooltip.style.opacity = "0";
    });

    svg.on("click", () => {
      setSelected(null);
      setActiveSrcId(null);
    });

    return () => {
      svg.on(".zoom", null);
      svg.on("click", null);
    };
  }, [network, phaseColor, activeSrcId]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (!svgRef.current) return;

    if (!activeSrcId) {
      svg.selectAll("g.src rect")
        .attr("opacity", 1)
        .attr("stroke-width", 1.5)
        .attr("stroke", `${phaseColor}80`)
        .attr("fill", `${phaseColor}15`);
      svg.selectAll("g.ast circle").attr("opacity", 1).attr("display", "block");
      svg.selectAll("g.ast text").attr("opacity", 1).attr("display", "block");
      svg.selectAll("path.edge")
        .attr("opacity", 0.3)
        .attr("stroke", "#2a3a55")
        .attr("stroke-width", 1);
      setStatus("Click a source line to focus its AST nodes");
      return;
    }

    const connectedAst = network.edges
      .filter((e) => e.source === activeSrcId)
      .map((e) => e.target);

    svg.selectAll("g.src rect")
      .attr("opacity", (d) => d.id === activeSrcId ? 1 : 0.2)
      .attr("stroke-width", (d) => d.id === activeSrcId ? 2.5 : 1)
      .attr("stroke", (d) => d.id === activeSrcId ? phaseColor : `${phaseColor}80`)
      .attr("fill", (d) => d.id === activeSrcId ? `${phaseColor}25` : `${phaseColor}15`);

    svg.selectAll("g.ast circle")
      .attr("opacity", (d) => connectedAst.includes(d.id) ? 1 : 0)
      .attr("display", (d) => connectedAst.includes(d.id) ? "block" : "none");

    svg.selectAll("g.ast text")
      .attr("opacity", (d) => connectedAst.includes(d.id) ? 1 : 0)
      .attr("display", (d) => connectedAst.includes(d.id) ? "block" : "none");

    svg.selectAll("path.edge")
      .attr("opacity", (d) => d.source === activeSrcId ? 0.9 : 0)
      .attr("stroke", (d) => d.source === activeSrcId ? d.color : "#2a3a55")
      .attr("stroke-width", (d) => d.source === activeSrcId ? 2 : 1);

    const srcLine = network.sourceLines.find((s) => s.id === activeSrcId);
    setStatus(srcLine ? `Line ${srcLine.line} focused: ${connectedAst.length} AST node(s)` : "Source line focused");
  }, [activeSrcId, network, phaseColor]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (!svgRef.current) return;

    svg.selectAll("g.ast circle")
      .attr("stroke-width", (d) => selected?.type === "ast" && d.id === selected.id ? 3 : 2);

    if (!selected) return;

    if (selected.type === "src" && !activeSrcId) {
      const connected = network.edges.filter((e) => e.source === selected.id).map((e) => e.target);
      const srcLine = network.sourceLines.find((s) => s.id === selected.id);
      setStatus(srcLine ? `Line ${srcLine.line} connected to ${connected.length} AST node(s)` : "Source selected");
    } else if (selected.type === "ast") {
      const connected = network.edges.filter((e) => e.target === selected.id).map((e) => e.source);
      const node = network.astNodes.find((n) => n.id === selected.id);
      setStatus(node ? `${node.type} connects from ${connected.length} source line(s)` : "AST selected");
    }
  }, [selected, activeSrcId, network]);

  if (!astData || !sourceCode || !network.sourceLines.length || !network.astNodes.length) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#94a3b8", fontFamily: "monospace", fontSize: 13 }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ marginBottom: 8 }}>No AST or source code available</div>
          <div style={{ fontSize: 11, color: "#64748b" }}>Compile a program to see the source map</div>
        </div>
      </div>
    );
  }

  const detail = (() => {
    if (!selected) return null;
    if (selected.type === "src") {
      const src = network.sourceLines.find((s) => s.id === selected.id);
      if (!src) return null;
      const connected = network.edges
        .filter((e) => e.source === selected.id)
        .map((e) => network.astNodes.find((n) => n.id === e.target))
        .filter(Boolean);

      return (
        <div style={{ background: "#0d1424", borderLeft: "1px solid #2a3a55", padding: 12, width: 280, height: "100%", boxSizing: "border-box", overflowY: "auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ color: "#e2e8f0", fontWeight: 800 }}>Line {src.line}</div>
            <button onClick={() => setSelected(null)} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}>x</button>
          </div>
          <div style={{ height: 8, borderBottom: "1px solid #243247", margin: "8px 0" }} />
          <div style={{ color: "#cbd5e1", fontFamily: "monospace", fontSize: 12, whiteSpace: "pre-wrap" }}>{src.text}</div>
          <div style={{ height: 10 }} />
          <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800 }}>AST NODES FROM THIS LINE</div>
          <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
            {connected.length ? connected.map((n) => (
              <div key={n.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0f172a", padding: "8px", borderRadius: 8 }}>
                <div>
                  <div style={{ color: n.color, fontFamily: "monospace", fontWeight: 800 }}>{n.type}</div>
                  <div style={{ color: "#cbd5e1", fontSize: 12 }}>{String(n.value)}</div>
                </div>
                <button onClick={() => { onSwitchTab("tree"); onViewInAST(n.raw || n); }} style={{ background: "#8b5cf620", border: "1px solid #8b5cf6", color: "#a78bfa", borderRadius: 20, padding: "6px 14px", fontSize: 11, fontFamily: "monospace", cursor: "pointer" }}>View in AST Tree -&gt;</button>
              </div>
            )) : <div style={{ color: "#64748b" }}>No AST nodes mapped to this line.</div>}
          </div>
        </div>
      );
    }

    const node = network.astNodes.find((n) => n.id === selected.id);
    if (!node) return null;
    const sources = network.edges
      .filter((e) => e.target === selected.id)
      .map((e) => network.sourceLines.find((s) => s.id === e.source))
      .filter(Boolean);

    return (
      <div style={{ background: "#0d1424", borderLeft: "1px solid #2a3a55", padding: 12, width: 280, height: "100%", boxSizing: "border-box", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ color: "#e2e8f0", fontWeight: 800 }}>{node.type}</div>
          <button onClick={() => setSelected(null)} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer" }}>x</button>
        </div>
        <div style={{ height: 8, borderBottom: "1px solid #243247", margin: "8px 0" }} />
        <div style={{ color: "#cbd5e1", fontSize: 12 }}>Value: <span style={{ fontFamily: "monospace" }}>{String(node.value)}</span></div>
        <div style={{ color: "#cbd5e1", fontSize: 12 }}>Type: <span style={{ fontFamily: "monospace" }}>{node.type}</span></div>
        <div style={{ color: "#cbd5e1", fontSize: 12 }}>Line: <span style={{ fontFamily: "monospace" }}>{node.line || "-"}</span></div>
        <div style={{ color: "#cbd5e1", fontSize: 12 }}>Children: <span style={{ fontFamily: "monospace" }}>{node.raw?.children?.length ?? 0}</span></div>
        <div style={{ height: 10 }} />
        <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 800 }}>SOURCE LINES</div>
        <div style={{ marginTop: 8, display: "grid", gap: 8 }}>
          {sources.length ? sources.map((s) => (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#0f172a", padding: "6px 8px", borderRadius: 6 }}>
              <div style={{ color: "#cbd5e1", fontFamily: "monospace" }}>Line {s.line}</div>
              <div style={{ color: "#94a3b8", fontSize: 12 }}>{s.text.slice(0, 20)}</div>
            </div>
          )) : <div style={{ color: "#64748b" }}>No source lines connected.</div>}
        </div>
        <div style={{ height: 12 }} />
        <button onClick={() => { onSwitchTab("tree"); onViewInAST(node.raw || node); }} style={{ background: "#8b5cf620", border: "1px solid #8b5cf6", color: "#a78bfa", borderRadius: 20, padding: "6px 14px", fontSize: 11, fontFamily: "monospace", cursor: "pointer" }}>View in AST Tree -&gt;</button>
      </div>
    );
  })();

  const isMobileView = typeof window !== "undefined" && window.innerWidth <= 768;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, height: "calc(100vh - 160px)", minHeight: 500, width: "100%" }}>
      <div style={{ height: 40, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", background: "#07101a", borderBottom: "1px solid #172233" }}>
        <div style={{ display: "flex", gap: 16, alignItems: "center", color: "#94a3b8", fontSize: 11 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}><div style={{ width: 12, height: 12, background: `${phaseColor}20`, border: `1px solid ${phaseColor}`, borderRadius: 2 }} /> <div>Source Line</div></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}><div style={{ width: 10, height: 10, background: "#222", borderRadius: 999 }} /> <div>AST Node</div></div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}><div style={{ width: 36, height: 6, background: "#2a3a55" }} /> <div>Connection</div></div>
        </div>
        <div style={{ color: "#4a6080", fontFamily: "monospace", fontSize: 10 }}>{network.sourceLines.length} source lines · {network.astNodes.length} AST nodes</div>
      </div>

      {/* ── Main split layout: diagram always visible, info panel slides in ── */}
      <div style={{
        display: "flex",
        flexDirection: isMobileView ? "column" : "row",
        flex: 1,
        width: "100%",
        minHeight: 0,
        overflow: "hidden",
      }}>
        {/* Diagram — always full width when no selection, 2fr when info panel open */}
        <div
          ref={containerRef}
          style={{
            flex: 1,
            minWidth: 0,
            height: isMobileView && detail ? "55%" : "100%",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <svg ref={svgRef} style={{ display: "block", width: "100%", height: "100%", background: "transparent" }} />
        </div>

        {/* Info panel — only rendered when a node is selected */}
        {detail && (
          <div style={{
            width: isMobileView ? "100%" : 300,
            height: isMobileView ? "45%" : "100%",
            flexShrink: 0,
            overflowY: "auto",
            borderTop: isMobileView ? "1px solid #2a3a55" : "none",
          }}>
            {detail}
          </div>
        )}
      </div>

      <div style={{ height: 32, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 12px", background: "#07101a", borderTop: "1px solid #172233", fontSize: 13, color: "#94a3b8" }}>
        <div>{status}</div>
        <div>{selected ? <button onClick={() => { if (selected.type === "ast") { const node = network.astNodes.find((n) => n.id === selected.id); onSwitchTab("tree"); onViewInAST(node?.raw || node || selected.id); } else { setSelected(null); } }} style={{ background: "#8b5cf620", border: "1px solid #8b5cf6", color: "#a78bfa", borderRadius: 20, padding: "6px 14px", fontSize: 11, fontFamily: "monospace", cursor: "pointer" }}>View in AST Tree -&gt;</button> : null}</div>
      </div>
    </div>
  );
}
