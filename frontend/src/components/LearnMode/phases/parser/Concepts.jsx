// src/components/LearnMode/phases/parser/Concepts.jsx
import React, { useMemo, useState } from "react";
import { codeBlock } from "../../shared/CardStyles";

const DEFAULT_CONCEPTS = [
  {
    term: "Grammar",
    def: "Formal rules defining valid token sequences",
    detail: "A grammar is a set of production rules. The parser applies these rules recursively to check and structure the token stream.",
    example: "VarDecl -> TYPE IDENTIFIER = Expr ;",
    misconception: "",
  },
  {
    term: "AST",
    def: "Hierarchical representation of program structure",
    detail: "The AST captures essential structure without syntactic details. Each node represents a construct such as FunctionDecl, BinaryExpr, or VarDecl.",
    example: "int x = 5+3\n-> VarDecl\n   └─ BinaryExpr\n      ├─ 5\n      └─ 3",
    misconception: "AST is not the same as parse tree. AST removes redundant grammar nodes.",
  },
  {
    term: "Recursive descent",
    def: "Parsing strategy where each grammar rule is one function",
    detail: "parseFunctionDecl calls parseParamList, mirroring the grammar hierarchy exactly. It is intuitive and easy to debug.",
    example: "parseProgram()\n└─ parseFunctionDecl()\n   └─ parseParamList()",
    misconception: "",
  },
  {
    term: "Parse error",
    def: "Token that violates grammar at that position",
    detail: "When the parser expects one token type but finds another, it emits an error and may skip to a safe synchronization point like ; or }.",
    example: "Expected ')' but found ';'\nPanic mode: skip to ';'",
    misconception: "",
  },
  {
    term: "Node",
    def: "Single AST element representing one construct",
    detail: "Every AST node has a type, optional value, source location, and list of children. The root node is always Program.",
    example: "{ type: FunctionDecl\n  value: main\n  dataType: int\n  children: [...] }",
    misconception: "",
  },
];

export default function ParserConcepts({ phaseColor = "#8b5cf6", data = {} }) {
  const concepts = useMemo(() => (Array.isArray(data.concepts) && data.concepts.length ? data.concepts : DEFAULT_CONCEPTS), [data]);
  const [collapsed, setCollapsed] = useState(() => new Set());

  const toggle = (index) => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10, maxWidth: 1120 }}>
      {concepts.map((item, index) => {
        const isOpen = !collapsed.has(index);
        const isLastOdd = concepts.length % 2 === 1 && index === concepts.length - 1;

        return (
          <section
            key={`${item.term}-${index}`}
            style={{
              background: "#1e293b",
              border: "1px solid #2a3a55",
              borderRadius: 10,
              padding: 14,
              minHeight: 120,
              gridColumn: isLastOdd ? "1 / -1" : undefined,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
              <div>
                <div style={{ color: phaseColor, fontWeight: 700, fontSize: 15 }}>{item.term}</div>
                <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: isOpen ? "normal" : "nowrap" }}>{item.def}</div>
              </div>
              <button onClick={() => toggle(index)} style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 12 }}>
                {isOpen ? "▾ less" : "▾ more"}
              </button>
            </div>

            {isOpen && (
              <div style={{ marginTop: 12, color: "#cbd5e1", fontSize: 13, lineHeight: 1.55 }}>
                {item.example && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ color: "#94a3b8", fontSize: 12, marginBottom: 6 }}>Example</div>
                    <pre style={codeBlock}>{item.example}</pre>
                  </div>
                )}
                <div style={{ marginBottom: item.misconception ? 8 : 0 }}>{item.detail}</div>
                {item.misconception && (
                  <div style={{ background: "#3b2f14", border: "1px solid #6b5319", borderRadius: 8, padding: 10, color: "#f59e0b", fontSize: 13 }}>{item.misconception}</div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
