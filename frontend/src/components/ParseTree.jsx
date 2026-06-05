import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";

const NODE_W = 140;
const NODE_H = 36;
const COLUMN_W = 220;

const CATEGORY_COLORS = {
  program: "#00d4ff",
  namespace: "#00d4ff",
  declaration: "#a855f7",
  function: "#a855f7",
  variable: "#3b82f6",
  parameter: "#3b82f6",
  class: "#f59e0b",
  struct: "#f59e0b",
  statement: "#f97316",
  expression: "#10b981",
  call: "#06b6d4",
  member: "#06b6d4",
  literal: "#84cc16",
  identifier: "#e2e8f0",
  block: "#8b5cf6",
  default: "#6b7280",
};

const TYPE_COLORS = [
  [/Program|Namespace/i, "#00d4ff"],
  [/FunctionDecl|function_declaration|FuncDecl/i, "#a855f7"],
  [/VarDecl|variable_declaration|ParamDecl|parameter_declaration/i, "#3b82f6"],
  [/ClassDecl|StructDecl|class_declaration|struct_declaration/i, "#f59e0b"],
  [/IfStmt|ForStmt|WhileStmt|ReturnStmt|if_statement|for_statement|while_statement|return_statement/i, "#f97316"],
  [/BinaryExpr|UnaryExpr|AssignExpr|binary_expression|unary_expression|assignment_expression/i, "#10b981"],
  [/CallExpr|MemberExpr|call_expression|member_expression/i, "#06b6d4"],
  [/IntLiteral|FloatLit|StringLiteral|integer_literal|float_literal|string_literal|bool_literal/i, "#84cc16"],
  [/Identifier|identifier/i, "#e2e8f0"],
  [/CompoundStmt|block/i, "#8b5cf6"],
];

const GRAMMAR_RULES = {
  FunctionDecl: "FunctionDecl -> TYPE ID ( ParamList ) CompoundStmt",
  function_declaration: "FunctionDecl -> TYPE ID ( ParamList ) CompoundStmt",
  VarDecl: "VarDecl -> TYPE ID = Expr ;",
  variable_declaration: "VarDecl -> TYPE ID = Expr ;",
  IfStmt: "IfStmt -> if ( Expr ) Stmt [ else Stmt ]",
  if_statement: "IfStmt -> if ( Expr ) Stmt [ else Stmt ]",
  ForStmt: "ForStmt -> for ( Init ; Cond ; Inc ) Stmt",
  for_statement: "ForStmt -> for ( Init ; Cond ; Inc ) Stmt",
  WhileStmt: "WhileStmt -> while ( Expr ) Stmt",
  while_statement: "WhileStmt -> while ( Expr ) Stmt",
  BinaryExpr: "BinaryExpr -> Expr OP Expr",
  binary_expression: "BinaryExpr -> Expr OP Expr",
  AssignExpr: "AssignExpr -> ID AssignOP Expr",
  assignment_expression: "AssignExpr -> ID AssignOP Expr",
  CallExpr: "CallExpr -> ID ( ArgList )",
  call_expression: "CallExpr -> ID ( ArgList )",
  ReturnStmt: "ReturnStmt -> return [ Expr ] ;",
  return_statement: "ReturnStmt -> return [ Expr ] ;",
  CompoundStmt: "CompoundStmt -> { Stmt* }",
  block: "CompoundStmt -> { Stmt* }",
  ClassDecl: "ClassDecl -> class ID { MemberList }",
  class_declaration: "ClassDecl -> class ID { MemberList }",
};

const DESCRIPTIONS = {
  FunctionDecl: "A function declaration defines a named, reusable block of code with parameters and a return type.",
  function_declaration: "A function declaration defines a named, reusable block of code with parameters and a return type.",
  VarDecl: "A variable declaration reserves memory and binds a name to a type and value.",
  variable_declaration: "A variable declaration reserves memory and binds a name to a type and value.",
  IfStmt: "A conditional statement executes one of two branches based on a boolean expression.",
  if_statement: "A conditional statement executes one of two branches based on a boolean expression.",
  ForStmt: "A for loop repeats a block with an initializer, condition, and increment.",
  for_statement: "A for loop repeats a block with an initializer, condition, and increment.",
  BinaryExpr: "A binary expression applies an operator to two sub-expressions.",
  binary_expression: "A binary expression applies an operator to two sub-expressions.",
  AssignExpr: "An assignment expression stores a computed value into a variable.",
  assignment_expression: "An assignment expression stores a computed value into a variable.",
  CompoundStmt: "A compound statement groups multiple statements inside curly braces.",
  block: "A compound statement groups multiple statements inside curly braces.",
  CallExpr: "A function call expression invokes a named function with a list of arguments.",
  call_expression: "A function call expression invokes a named function with a list of arguments.",
  Default: "This node represents a grammatical construct produced by the parser from source tokens.",
};

const FILTERS = ["all", "declaration", "statement", "expression", "literal"];

function nodeId(node, path = "0") {
  return `${path}:${node?.type || "node"}:${node?.value || ""}:${node?.line || ""}:${node?.col || ""}`;
}

function normalizeTree(node, path = "0", depth = 0, parent = null) {
  if (!node) return null;
  const children = Array.isArray(node.children) ? node.children : [];
  const id = nodeId(node, path);
  const isTerminal = Boolean(node.isTerminal ?? children.length === 0);
  return {
    ...node,
    id,
    depth,
    parentType: parent?.type || "",
    isTerminal,
    children: children.map((child, index) => normalizeTree(child, `${path}.${index}`, depth + 1, node)).filter(Boolean),
  };
}

function collectIds(node, out = []) {
  if (!node) return out;
  out.push(node.id);
  (node.children || []).forEach(child => collectIds(child, out));
  return out;
}

function visibleTree(node, collapsed) {
  if (!node) return null;
  return {
    ...node,
    children: collapsed.has(node.id) ? [] : (node.children || []).map(child => visibleTree(child, collapsed)).filter(Boolean),
  };
}

function colorFor(node) {
  const type = node?.type || "";
  const category = String(node?.category || "").toLowerCase();
  const byType = TYPE_COLORS.find(([pattern]) => pattern.test(type));
  if (byType) return byType[1];
  if (category.includes("decl")) return CATEGORY_COLORS.declaration;
  if (category.includes("stmt") || category === "statement") return CATEGORY_COLORS.statement;
  if (category.includes("expr") || category === "expression") return CATEGORY_COLORS.expression;
  if (category.includes("literal")) return CATEGORY_COLORS.literal;
  if (category.includes("ident")) return CATEGORY_COLORS.identifier;
  if (category.includes("block")) return CATEGORY_COLORS.block;
  return CATEGORY_COLORS[category] || CATEGORY_COLORS.default;
}

function filterMatches(node, filter) {
  if (filter === "all") return true;
  const type = String(node?.type || "").toLowerCase();
  const category = String(node?.category || "").toLowerCase();
  if (filter === "literal") return node?.isTerminal && (category.includes("literal") || type.includes("literal") || type.includes("number") || type.includes("string"));
  if (filter === "declaration") return category.includes("decl") || type.includes("decl") || ["program", "namespace"].some(part => type.includes(part));
  if (filter === "statement") return category.includes("stmt") || category === "statement" || type.includes("stmt") || type.includes("statement");
  if (filter === "expression") return category.includes("expr") || category === "expression" || type.includes("expr") || type.includes("expression");
  return false;
}

function truncate(value, length = 14) {
  const text = String(value || "");
  return text.length > length ? `${text.slice(0, length - 3)}...` : text;
}

function countLeaves(node) {
  if (!node) return 0;
  if (!node.children?.length) return 1;
  return node.children.reduce((sum, child) => sum + countLeaves(child), 0);
}

function maxDepth(node) {
  if (!node) return 0;
  return Math.max(node.depth || 0, ...(node.children || []).map(maxDepth));
}

function selectedPathIds(selected) {
  const ids = new Set();
  let cur = selected;
  while (cur) {
    ids.add(cur.data.id);
    cur = cur.parent;
  }
  return ids;
}

export default function ParseTree({ astData, onNodeSelect, onViewInAST }) {
  const svgRef = useRef(null);
  const viewportRef = useRef(null);
  const minimapRef = useRef(null);
  const zoomRef = useRef(null);
  const rootRef = useRef(null);
  const [size, setSize] = useState({ width: 900, height: 560 });
  const [renderTick, setRenderTick] = useState(0);
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [minimapOpen, setMinimapOpen] = useState(true);

  const tree = useMemo(() => normalizeTree(astData), [astData]);
  const visible = useMemo(() => visibleTree(tree, collapsed), [tree, collapsed]);
  const allIds = useMemo(() => collectIds(tree), [tree]);
  const selectedNode = useMemo(() => {
    let found = null;
    function walk(node) {
      if (!node || found) return;
      if (node.id === selectedId) found = node;
      (node.children || []).forEach(walk);
    }
    walk(tree);
    return found;
  }, [tree, selectedId]);

  useEffect(() => {
    setCollapsed(new Set());
    setSelectedId(null);
  }, [astData]);

  useEffect(() => {
    if (!viewportRef.current) return undefined;
    const observer = new ResizeObserver(entries => {
      const rect = entries[0].contentRect;
      if (rect.width > 0 && rect.height > 0) {
        setSize({ width: Math.max(520, rect.width), height: Math.max(420, rect.height) });
        setRenderTick(tick => tick + 1);
      }
    });
    observer.observe(viewportRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      const rect = viewportRef.current?.getBoundingClientRect();
      if (rect?.width > 0 && rect?.height > 0) {
        setSize({ width: Math.max(520, rect.width), height: Math.max(420, rect.height) });
        setRenderTick(tick => tick + 1);
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [astData, visible]);

  useEffect(() => {
    if (!visible || !svgRef.current) return;
    const viewport = viewportRef.current;
    const rect = viewport?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return;

    const isMobile = size.width < 760;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const root = d3.hierarchy(visible, d => d.children);
    d3.tree().nodeSize([60, COLUMN_W]).separation((a, b) => (a.parent === b.parent ? 1 : 1.5))(root);
    rootRef.current = root;

    const nodes = root.descendants();
    const links = root.links();
    const minX = d3.min(nodes, d => d.x) ?? 0;
    const maxX = d3.max(nodes, d => d.x) ?? 0;
    const minY = d3.min(nodes, d => d.y) ?? 0;
    const maxY = d3.max(nodes, d => d.y) ?? 0;
    const pad = 90;
    const viewWidth = Math.max(size.width, maxY - minY + NODE_W + pad * 2);
    const viewHeight = Math.max(size.height, maxX - minX + NODE_H + pad * 2);
    const viewBox = [minY - pad, minX - pad, viewWidth, viewHeight];

    svg.attr("viewBox", viewBox.join(" ")).attr("width", "100%").attr("height", "100%");
    const defs = svg.append("defs");
    const glow = defs.append("filter").attr("id", "parse-node-glow").attr("x", "-60%").attr("y", "-60%").attr("width", "220%").attr("height", "220%");
    glow.append("feGaussianBlur").attr("stdDeviation", 3).attr("result", "blur");
    glow.append("feMerge").selectAll("feMergeNode").data(["blur", "SourceGraphic"]).join("feMergeNode").attr("in", d => d);

    const selectedD3 = selectedId ? nodes.find(d => d.data.id === selectedId) : null;
    const pathIds = selectedD3 ? selectedPathIds(selectedD3) : new Set();
    const filteredIds = new Set(nodes.filter(d => filterMatches(d.data, filter)).map(d => d.data.id));
    const hasFocus = Boolean(selectedId || filter !== "all");
    const g = svg.append("g").attr("class", "parse-tree-content");
    const linkGen = d3.linkHorizontal().x(d => d.y).y(d => d.x);

    g.append("g").selectAll("path")
      .data(links)
      .join("path")
      .attr("d", d => linkGen({ source: d.source, target: d.target }))
      .attr("fill", "none")
      .attr("stroke", d => colorFor(d.source.data))
      .attr("stroke-width", d => pathIds.has(d.source.data.id) && pathIds.has(d.target.data.id) ? 2.5 : 1.5)
      .attr("opacity", d => {
        if (pathIds.size) return pathIds.has(d.source.data.id) && pathIds.has(d.target.data.id) ? 1 : 0.15;
        if (filter !== "all") return filteredIds.has(d.source.data.id) || filteredIds.has(d.target.data.id) ? 0.65 : 0.15;
        return 0.4;
      });

    const node = g.append("g").selectAll("g")
      .data(nodes)
      .join("g")
      .attr("transform", d => `translate(${d.y},${d.x})`)
      .style("cursor", "pointer")
      .on("mouseenter", (_, d) => setHoveredId(d.data.id))
      .on("mouseleave", () => setHoveredId(null))
      .on("click", (event, d) => {
        event.stopPropagation();
        setSelectedId(d.data.id);
        onNodeSelect?.(d.data);
      });

    node.append("rect")
      .attr("x", -NODE_W / 2)
      .attr("y", -NODE_H / 2)
      .attr("width", NODE_W)
      .attr("height", NODE_H)
      .attr("rx", 6)
      .attr("fill", d => colorFor(d.data) + (d.data.id === selectedId ? "40" : d.data.isTerminal ? "10" : "1f"))
      .attr("stroke", d => colorFor(d.data))
      .attr("stroke-width", d => d.data.id === selectedId ? 3 : d.data.isTerminal ? 1 : 2)
      .attr("stroke-opacity", d => d.data.isTerminal ? 0.6 : 1)
      .attr("opacity", d => {
        if (!hasFocus) return 1;
        if (selectedId) return pathIds.has(d.data.id) || d.data.id === selectedId ? 1 : 0.25;
        return filteredIds.has(d.data.id) ? 1 : 0.25;
      })
      .attr("filter", d => d.data.id === selectedId || d.data.id === hoveredId ? "url(#parse-node-glow)" : null);

    node.append("rect")
      .attr("x", -NODE_W / 2 + 8)
      .attr("y", -9)
      .attr("width", d => d.data.isTerminal ? 18 : 25)
      .attr("height", 17)
      .attr("rx", 4)
      .attr("fill", d => d.data.isTerminal ? "#0f172a" : "#1e293b");

    node.append("text")
      .attr("x", -NODE_W / 2 + 17)
      .attr("y", 3)
      .attr("text-anchor", "middle")
      .attr("font-size", 9)
      .attr("font-weight", 900)
      .attr("font-family", "monospace")
      .attr("fill", d => d.data.isTerminal ? "#64748b" : "#94a3b8")
      .text(d => d.data.isTerminal ? "T" : "NT");

    node.append("text")
      .attr("x", -NODE_W / 2 + 40)
      .attr("y", -2)
      .attr("font-size", 11)
      .attr("font-weight", 800)
      .attr("font-family", "monospace")
      .attr("fill", d => colorFor(d.data))
      .text(d => truncate(d.data.type, 14));

    node.append("text")
      .attr("x", -NODE_W / 2 + 40)
      .attr("y", 12)
      .attr("font-size", 10)
      .attr("font-family", "monospace")
      .attr("fill", "#cbd5e1")
      .attr("opacity", 0.82)
      .text(d => truncate(d.data.value || d.data.dataType || "", 14));

    node.append("title").text(d => `Type: ${d.data.type}\nValue: ${d.data.value || "-"}\nLine: ${d.data.line || "-"}\nColumn: ${d.data.col || d.data.column || "-"}`);

    svg.on("click", () => setSelectedId(null));

    const zoom = d3.zoom().scaleExtent([0.3, 3]).on("zoom", event => g.attr("transform", event.transform));
    zoomRef.current = zoom;
    if (!isMobile) svg.call(zoom);
    else svg.on(".zoom", null);

    renderMinimap(root, pathIds);
  }, [visible, size, selectedId, hoveredId, filter, onNodeSelect, renderTick]);

  function renderMinimap(root, pathIds = new Set()) {
    if (!minimapRef.current) return;
    const mini = d3.select(minimapRef.current);
    mini.selectAll("*").remove();
    const nodes = root.descendants();
    const links = root.links();
    const minX = d3.min(nodes, d => d.x) ?? 0;
    const maxX = d3.max(nodes, d => d.x) ?? 1;
    const minY = d3.min(nodes, d => d.y) ?? 0;
    const maxY = d3.max(nodes, d => d.y) ?? 1;
    const sx = d3.scaleLinear().domain([minY - 80, maxY + 80]).range([8, 172]);
    const sy = d3.scaleLinear().domain([minX - 60, maxX + 60]).range([8, 112]);
    mini.attr("viewBox", "0 0 180 120");
    mini.selectAll("line")
      .data(links)
      .join("line")
      .attr("x1", d => sx(d.source.y)).attr("y1", d => sy(d.source.x))
      .attr("x2", d => sx(d.target.y)).attr("y2", d => sy(d.target.x))
      .attr("stroke", "#334155").attr("stroke-width", 1).attr("opacity", 0.55);
    mini.selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("cx", d => sx(d.y)).attr("cy", d => sy(d.x)).attr("r", 2.4)
      .attr("fill", d => pathIds.has(d.data.id) ? colorFor(d.data) : "#64748b");
    mini.append("rect").attr("x", 6).attr("y", 6).attr("width", 168).attr("height", 108).attr("rx", 4).attr("fill", "none").attr("stroke", "#1e2a3a");
  }

  function fitToScreen() {
    if (!svgRef.current || !zoomRef.current || !rootRef.current) return;
    const svg = d3.select(svgRef.current);
    const root = rootRef.current;
    const nodes = root.descendants();
    const minX = d3.min(nodes, d => d.x) ?? 0;
    const maxX = d3.max(nodes, d => d.x) ?? 0;
    const minY = d3.min(nodes, d => d.y) ?? 0;
    const maxY = d3.max(nodes, d => d.y) ?? 0;
    const boundsW = maxY - minY + NODE_W + 80;
    const boundsH = maxX - minX + NODE_H + 80;
    const scale = Math.max(0.3, Math.min(1.4, Math.min(size.width / boundsW, size.height / boundsH)));
    const tx = size.width / 2 - scale * ((minY + maxY) / 2);
    const ty = size.height / 2 - scale * ((minX + maxX) / 2);
    svg.transition().duration(300).call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }

  function resetZoom() {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.transform, d3.zoomIdentity);
  }

  function collapseAll() {
    if (!tree) return;
    const next = new Set();
    function walk(node) {
      if (!node?.children?.length) return;
      if ((node.depth || 0) >= 1) next.add(node.id);
      node.children.forEach(walk);
    }
    walk(tree);
    setCollapsed(next);
  }

  if (!tree) {
    return (
      <div style={{ background: "#0a0a0f", border: "1px solid #1e2a3a", borderRadius: 8, padding: 40, color: "#64748b", textAlign: "center", fontFamily: "var(--font-mono, monospace)" }}>
        Run your program to generate parse tree
      </div>
    );
  }

  const bigTree = allIds.length > 500;
  const selectedColor = colorFor(selectedNode);

  return (
    <div className="parse-tree-shell">
      <style>{`
        .parse-tree-shell { position: relative; background: #0a0a0f; border: 1px solid #1e2a3a; border-radius: 8px; overflow: hidden; }
        .parse-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 10px 12px; border-bottom: 1px solid #1e2a3a; background: #0d1117; }
        .parse-filter { display: flex; gap: 7px; flex-wrap: wrap; }
        .parse-tree-viewport { height: 580px; overflow: auto; background-image: radial-gradient(circle, rgba(148,163,184,0.12) 1px, transparent 1px); background-size: 18px 18px; }
        .parse-tree-viewport::-webkit-scrollbar { width: 8px; height: 8px; }
        .parse-tree-viewport::-webkit-scrollbar-track { background: #0d1117; }
        .parse-tree-viewport::-webkit-scrollbar-thumb { background: #374151; border-radius: 999px; }
        .parse-detail { position: absolute; top: 58px; right: 12px; width: 300px; max-width: calc(100% - 24px); background: #0d1117; border: 1px solid ${selectedColor}88; border-radius: 8px; box-shadow: 0 18px 40px rgba(0,0,0,.38), 0 0 22px ${selectedColor}22; z-index: 5; }
        .parse-minimap { position: absolute; right: 14px; bottom: 14px; width: 180px; height: 120px; background: rgba(13,17,23,.92); border: 1px solid #1e2a3a; border-radius: 8px; z-index: 4; }
        @media (max-width: 768px) {
          .parse-tree-viewport { height: 520px; }
          .parse-detail { position: static; width: auto; max-width: none; margin: 12px; }
          .parse-minimap { display: none; }
        }
      `}</style>

      <div className="parse-toolbar">
        <div className="parse-filter">
          {FILTERS.map(item => (
            <button key={item} onClick={() => setFilter(item)} style={pillStyle(filter === item, item)}>
              {item}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {bigTree && <span style={{ color: "#f59e0b", fontSize: 11, alignSelf: "center" }}>large tree: collapse/filter for best performance</span>}
          <button onClick={collapseAll} style={toolButton}>Collapse All</button>
          <button onClick={() => setCollapsed(new Set())} style={toolButton}>Expand All</button>
          <button onClick={fitToScreen} style={toolButton}>Fit to Screen</button>
          <button onClick={resetZoom} style={toolButton}>↕ Reset Zoom</button>
          <button onClick={() => setMinimapOpen(open => !open)} style={toolButton}>{minimapOpen ? "Hide" : "Show"} Minimap</button>
        </div>
      </div>

      <div ref={viewportRef} className="parse-tree-viewport">
        <svg ref={svgRef} />
      </div>

      {minimapOpen && (
        <div className="parse-minimap" onClick={fitToScreen} title="Click to fit tree">
          <svg ref={minimapRef} style={{ width: "100%", height: "100%" }} />
        </div>
      )}

      {selectedNode && (
        <aside className="parse-detail">
          <div style={{ padding: 14, borderBottom: "1px solid #1e2a3a", display: "flex", alignItems: "center", gap: 8 }}>
            <span style={badgeStyle(selectedNode.isTerminal)}>{selectedNode.isTerminal ? "T" : "NT"}</span>
            <span style={{ color: selectedColor, font: "900 13px var(--font-mono, monospace)" }}>{selectedNode.type}</span>
            <button onClick={() => setSelectedId(null)} style={{ marginLeft: "auto", border: 0, background: "transparent", color: "#64748b", cursor: "pointer" }}>×</button>
          </div>
          <div style={{ padding: 14, color: "#cbd5e1", fontSize: 12, lineHeight: 1.7 }}>
            <Detail label="Value" value={selectedNode.value || "-"} />
            <Detail label="Data Type" value={selectedNode.dataType || selectedNode.data_type || "-"} />
            <Detail label="Line" value={selectedNode.line || "-"} />
            <Detail label="Column" value={selectedNode.col || selectedNode.column || "-"} />
            <Divider />
            <Detail label="Children" value={(selectedNode.children || []).length} />
            <Detail label="Depth" value={selectedNode.depth} />
            <Detail label="Parent" value={selectedNode.parentType || "-"} />
            <Divider />
            <BlockTitle>Grammar Rule</BlockTitle>
            <pre style={preStyle}>{GRAMMAR_RULES[selectedNode.type] || `${selectedNode.type} -> ...`}</pre>
            <Divider />
            <BlockTitle>What this node means</BlockTitle>
            <p style={{ margin: 0, color: "#94a3b8" }}>{DESCRIPTIONS[selectedNode.type] || DESCRIPTIONS.Default}</p>
            <Divider />
            <button onClick={() => onViewInAST?.(selectedNode)} style={{ ...toolButton, width: "100%", color: "#89ddff" }}>
              View in AST Tree ↗
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "88px 1fr", gap: 8 }}>
      <span style={{ color: "#64748b" }}>{label}:</span>
      <span style={{ color: "#e2e8f0", fontFamily: "var(--font-mono, monospace)", wordBreak: "break-word" }}>{String(value)}</span>
    </div>
  );
}

function Divider() {
  return <div style={{ height: 1, background: "#1e2a3a", margin: "11px 0" }} />;
}

function BlockTitle({ children }) {
  return <div style={{ color: "#89ddff", fontSize: 10, fontWeight: 900, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 6 }}>{children}</div>;
}

function badgeStyle(terminal) {
  return {
    background: terminal ? "#0f172a" : "#1e293b",
    color: terminal ? "#64748b" : "#94a3b8",
    borderRadius: 4,
    padding: "2px 5px",
    font: "900 9px var(--font-mono, monospace)",
  };
}

function pillStyle(active, name) {
  const color = name === "declaration" ? "#a855f7" : name === "statement" ? "#f97316" : name === "expression" ? "#10b981" : name === "literal" ? "#84cc16" : "#00d4ff";
  return {
    border: `1px solid ${active ? color + "88" : "#1e2a3a"}`,
    background: active ? color + "22" : "#111827",
    color: active ? color : "#94a3b8",
    boxShadow: active ? `0 0 14px ${color}22` : "none",
    borderRadius: 999,
    padding: "7px 11px",
    textTransform: "uppercase",
    font: "800 10px var(--font-mono, monospace)",
    cursor: "pointer",
  };
}

const toolButton = {
  border: "1px solid #1e2a3a",
  background: "#111827",
  color: "#94a3b8",
  borderRadius: 6,
  padding: "7px 10px",
  font: "800 10px var(--font-mono, monospace)",
  cursor: "pointer",
};

const preStyle = {
  margin: 0,
  whiteSpace: "pre-wrap",
  color: "#e2e8f0",
  font: "11px/1.6 var(--font-mono, monospace)",
  background: "rgba(255,255,255,0.03)",
  border: "1px solid #1e2a3a",
  borderRadius: 6,
  padding: 8,
};
