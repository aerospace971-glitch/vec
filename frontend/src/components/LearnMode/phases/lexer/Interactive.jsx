// src/components/LearnMode/phases/lexer/Interactive.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { cardBase, sectionLabel, bodyText } from "../../shared/CardStyles";

const CATEGORY_COLORS = {
  IDENTIFIER: "#3b82f6",
  KEYWORD: "#f59e0b",
  TYPE: "#8b5cf6",
  CONTROL: "#f59e0b",
  LITERAL: "#10b981",
  NUMBER: "#10b981",
  STRING: "#10b981",
  OPERATOR: "#f97316",
  ASSIGNMENT: "#a78bfa",
  DELIMITER: "#06b6d4",
  PUNCTUATION: "#ec4899",
  PREPROCESSOR: "#84cc16",
  TEMPLATE: "#f43f5e",
  MODIFIER: "#14b8a6",
  COMMENT: "#64748b",
  WHITESPACE: "#475569",
  EMPTY: "#64748b",
  DEFAULT: "#94a3b8",
};

const CATEGORY_PATTERNS = {
  IDENTIFIER: "[a-zA-Z_][a-zA-Z0-9_]*",
  KEYWORD: "reserved keyword table",
  TYPE: "int|float|double|char|bool|void|string",
  CONTROL: "if|else|for|while|return|break|continue",
  LITERAL: "[0-9]+|\"[^\"]*\"|'[^']*'",
  NUMBER: "[0-9]+(\\.[0-9]+)?",
  STRING: "\"[^\"]*\"",
  OPERATOR: "\\+|-|\\*|/|%|==|!=|<=|>=|<|>|&&|\\|\\|",
  ASSIGNMENT: "=|\\+=|-=|\\*=|/=|%=",
  DELIMITER: "[(){}\\[\\]]",
  PUNCTUATION: "[;:,\\.]",
  PREPROCESSOR: "#.*",
  TEMPLATE: "template|typename|using",
  MODIFIER: "const|static|virtual|inline|public|private|protected",
  COMMENT: "//.*|/\\*[\\s\\S]*?\\*/",
  DEFAULT: "lexer rule for this token",
};

const CATEGORY_EXPLANATIONS = {
  IDENTIFIER: "The lexer found a user-defined name. It preserves the exact spelling so later phases can resolve whether this name is a variable, function, class, or another symbol.",
  KEYWORD: "This lexeme is reserved by the language. The lexer emits a keyword token so the parser can treat it as syntax instead of a normal name.",
  TYPE: "This token names a built-in type. Recognizing it early helps the parser identify declarations and type annotations.",
  CONTROL: "This token controls program flow. The parser will use it to form branches, loops, or return statements in the syntax tree.",
  LITERAL: "The lexer recognized an actual value from the source code. Later phases can store this value directly in expression nodes.",
  NUMBER: "This numeric lexeme matched the number pattern. It becomes a literal token instead of being confused with an identifier.",
  STRING: "This quoted text matched the string literal rule. The lexer keeps the full value together as one token.",
  OPERATOR: "This symbol describes an operation. Longest-match handling keeps multi-character operators together when needed.",
  ASSIGNMENT: "This operator writes a value into a target. The parser will use it to build an assignment expression.",
  DELIMITER: "This character opens or closes a syntactic region. Delimiters help the parser understand calls, blocks, and grouped expressions.",
  PUNCTUATION: "This token separates or terminates syntax. Semicolons, commas, and colons give structure to statement lists and declarations.",
  PREPROCESSOR: "This directive is handled before normal parsing. The lexer keeps it distinct because it changes the compiler input stream.",
  TEMPLATE: "This keyword belongs to generic programming syntax. It receives a specific category so template grammar can be handled precisely.",
  MODIFIER: "This qualifier changes the meaning of a declaration. Later phases use it while checking symbol rules and generated code.",
  COMMENT: "The lexer recognized a comment. It is usually skipped because it does not contribute executable syntax.",
  DEFAULT: "The lexer matched this slice of source text and emitted a token. The parser will consume it as part of the token stream.",
  EMPTY: "Run the lexer to produce tokens. Once tokens exist, this panel will walk through them one by one.",
};

const panelStyle = (phaseColor) => ({
  ...cardBase(phaseColor),
  marginBottom: 0,
  overflow: "visible",
  display: "flex",
  flexDirection: "column",
});

const controlButton = (active, phaseColor) => ({
  border: `1px solid ${active ? phaseColor : "#2a3a55"}`,
  borderRadius: 8,
  padding: "8px 12px",
  background: active ? `${phaseColor}22` : "#0f172a",
  color: active ? "#f8fafc" : "#cbd5e1",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
  whiteSpace: "nowrap",
});

function normalizeCategory(token) {
  return String(token?.category || token?.type || "DEFAULT").toUpperCase();
}

function tokenValue(token) {
  const value = token?.value ?? token?.text ?? token?.name ?? "";
  return value === "" ? "<empty>" : String(value);
}

function tokenLine(token) {
  const value = Number(token?.line ?? token?.l ?? 1);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function tokenCol(token) {
  const value = Number(token?.col ?? token?.column ?? token?.c ?? 1);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function getColor(category, phaseColor) {
  return CATEGORY_COLORS[category] || phaseColor || CATEGORY_COLORS.DEFAULT;
}

function getPattern(token) {
  const category = normalizeCategory(token);
  return token?.pattern || token?.regex || CATEGORY_PATTERNS[category] || CATEGORY_PATTERNS.DEFAULT;
}

function buildStateTrace(token) {
  const category = normalizeCategory(token);
  if (category === "IDENTIFIER") return "START \u2192 IDENT \u2192 ACCEPT";
  if (category === "TYPE" || category === "KEYWORD" || category === "CONTROL" || category === "MODIFIER") return "START \u2192 WORD \u2192 KEYWORD \u2192 ACCEPT";
  if (category === "LITERAL" || category === "NUMBER") return "START \u2192 DIGIT \u2192 LITERAL \u2192 ACCEPT";
  if (category === "STRING") return "START \u2192 QUOTE \u2192 STRING \u2192 ACCEPT";
  if (category === "OPERATOR" || category === "ASSIGNMENT") return "START \u2192 SYMBOL \u2192 OPERATOR \u2192 ACCEPT";
  if (category === "PREPROCESSOR") return "START \u2192 HASH \u2192 DIRECTIVE \u2192 ACCEPT";
  if (category === "DELIMITER" || category === "PUNCTUATION") return "START \u2192 SINGLE_CHAR \u2192 ACCEPT";
  return "START \u2192 MATCH \u2192 ACCEPT";
}

function explainToken(token) {
  const category = normalizeCategory(token);
  return token?.explanation || CATEGORY_EXPLANATIONS[category] || CATEGORY_EXPLANATIONS.DEFAULT;
}

function dynamicHappeningText(token) {
  const category = normalizeCategory(token);
  const value = tokenValue(token);
  if (category === "EMPTY") return "No token stream is available yet. Compile or run the lexer to populate this walkthrough.";
  return `The scanner is reading "${value}" at line ${tokenLine(token)}, column ${tokenCol(token)}. It matches ${getPattern(token)}, so the lexer emits a ${category} token and advances to the next lexeme.`;
}

function groupByCategory(tokens) {
  return tokens.reduce((acc, token) => {
    const category = normalizeCategory(token);
    acc[category] = acc[category] || [];
    acc[category].push(token);
    return acc;
  }, {});
}

function createHighlightsForLine(lineText, lineNumber, tokens) {
  const lineTokens = tokens
    .filter((token) => tokenLine(token) === lineNumber && normalizeCategory(token) !== "EMPTY")
    .map((token, index) => ({ token, index }))
    .sort((a, b) => tokenCol(a.token) - tokenCol(b.token));

  let cursor = 0;
  return lineTokens.reduce((parts, entry) => {
    const value = tokenValue(entry.token);
    if (!value || value === "<empty>") return parts;

    const requestedStart = tokenCol(entry.token) - 1;
    const foundStart = lineText.indexOf(value, Math.max(cursor, requestedStart >= 0 ? requestedStart : 0));
    const start = foundStart >= cursor ? foundStart : lineText.indexOf(value, cursor);
    if (start < cursor || start === -1) return parts;

    if (start > cursor) {
      parts.push({ type: "text", value: lineText.slice(cursor, start) });
    }
    parts.push({ type: "token", value: lineText.slice(start, start + value.length), token: entry.token, key: `${lineNumber}-${entry.index}-${start}` });
    cursor = start + value.length;
    return parts;
  }, []).concat(cursor < lineText.length ? [{ type: "text", value: lineText.slice(cursor) }] : []);
}

function renderHighlightedLine(lineText, lineNumber, tokens, mode, currentToken, phaseColor) {
  const parts = createHighlightsForLine(lineText, lineNumber, tokens);
  const currentValue = tokenValue(currentToken);
  const currentLine = tokenLine(currentToken);

  if (!parts.length) return lineText || " ";

  return parts.map((part, index) => {
    if (part.type === "text") return <React.Fragment key={`text-${index}`}>{part.value}</React.Fragment>;

    const category = normalizeCategory(part.token);
    const color = getColor(category, phaseColor);
    const isCurrent = mode === "step" && lineNumber === currentLine && part.value === currentValue;
    const title = `${category} | ${tokenValue(part.token)} | line ${tokenLine(part.token)}, col ${tokenCol(part.token)}`;

    return (
      <span
        key={part.key}
        title={title}
        style={{
          background: mode === "full" ? `${color}33` : "transparent",
          borderBottom: isCurrent ? `3px solid ${color}` : mode === "full" ? `1px solid ${color}` : "1px solid transparent",
          borderRadius: mode === "full" ? 4 : 0,
          color: mode === "full" || isCurrent ? "#ffffff" : "inherit",
          padding: mode === "full" ? "1px 3px" : "0 1px",
          boxShadow: mode === "full" ? `inset 0 -1px 0 ${color}` : "none",
        }}
      >
        {part.value}
      </span>
    );
  });
}

export default function LexerInteractive({ phaseColor = "#3b82f6", tokens = [], sourceCode = "" }) {
  const [mode, setMode] = useState("full");
  const [currentStep, setCurrentStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(700);
  const timerRef = useRef(null);

  const sourceLines = useMemo(() => {
    const lines = String(sourceCode || "").split("\n");
    return lines.length ? lines : [""];
  }, [sourceCode]);

  const tokenSteps = useMemo(() => {
    if (!Array.isArray(tokens) || !tokens.length) {
      return [{ type: "EMPTY", category: "EMPTY", value: "No lexer output", line: 1, col: 1 }];
    }
    return tokens.map((token) => ({
      ...token,
      category: normalizeCategory(token),
      type: token.type || normalizeCategory(token),
      value: tokenValue(token),
      line: tokenLine(token),
      col: tokenCol(token),
    }));
  }, [tokens]);

  const realTokens = useMemo(() => tokenSteps.filter((token) => normalizeCategory(token) !== "EMPTY"), [tokenSteps]);
  const groupedTokens = useMemo(() => groupByCategory(realTokens), [realTokens]);
  const currentIndex = Math.min(currentStep, tokenSteps.length - 1);
  const currentToken = tokenSteps[currentIndex];
  const currentCategory = normalizeCategory(currentToken);
  const currentColor = getColor(currentCategory, phaseColor);
  const progressPercent = tokenSteps.length ? ((currentIndex + 1) / tokenSteps.length) * 100 : 0;
  const history = tokenSteps.slice(Math.max(0, currentIndex - 3), currentIndex);
  const preview = tokenSteps.slice(currentIndex + 1, currentIndex + 3);

  useEffect(() => {
    if (!playing) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      return undefined;
    }

    timerRef.current = setInterval(() => {
      setCurrentStep((step) => {
        if (step >= tokenSteps.length - 1) {
          setPlaying(false);
          return step;
        }
        return step + 1;
      });
    }, speed);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [playing, speed, tokenSteps.length]);

  useEffect(() => {
    if (mode !== "step") return;
    document.getElementById(`step-item-${currentIndex}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentIndex, mode]);

  const goPrev = () => {
    setPlaying(false);
    setCurrentStep((step) => Math.max(0, step - 1));
  };

  const goNext = () => {
    setPlaying(false);
    setCurrentStep((step) => Math.min(tokenSteps.length - 1, step + 1));
  };

  const reset = () => {
    setPlaying(false);
    setCurrentStep(0);
  };

  const renderSourcePanel = (sourceMode) => (
    <section style={panelStyle(phaseColor)}>
      <div style={sectionLabel(phaseColor)}>Source code</div>
      <div
        style={{
          background: "#111827",
          border: "1px solid #2a3a55",
          borderRadius: 6,
          flex: 1,
          minHeight: 0,
          overflow: "visible",
          padding: 10,
        }}
      >
        {sourceLines.map((line, index) => {
          const lineNumber = index + 1;
          const currentLine = tokenLine(currentToken);
          const isCurrent = sourceMode === "step" && lineNumber === currentLine;
          const opacity = sourceMode !== "step" ? 1 : isCurrent ? 1 : lineNumber < currentLine ? 0.45 : 0.7;

          return (
            <div
              key={lineNumber}
              id={sourceMode === "step" && isCurrent ? `step-item-${currentIndex}` : undefined}
              style={{
                display: "grid",
                gridTemplateColumns: "38px minmax(0, 1fr)",
                gap: 10,
                minHeight: 28,
                alignItems: "start",
                borderRadius: 6,
                background: isCurrent ? "#1e293b" : "transparent",
                opacity,
                padding: "5px 8px",
              }}
            >
              <span style={{ color: "#64748b", fontFamily: "monospace", fontSize: 12, lineHeight: "18px", textAlign: "right" }}>{lineNumber}</span>
              <span style={{ color: "#e2e8f0", fontFamily: "monospace", fontSize: 13, lineHeight: "18px", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {renderHighlightedLine(line, lineNumber, realTokens, sourceMode, currentToken, phaseColor)}
              </span>
            </div>
          );
        })}
      </div>
      {sourceMode === "step" && (
        <div style={{ marginTop: 10, padding: "9px 10px", borderRadius: 6, background: "#0f172a", color: "#cbd5e1", fontFamily: "monospace", fontSize: 12 }}>
          State: <span style={{ color: currentColor }}>{buildStateTrace(currentToken)}</span>
        </div>
      )}
    </section>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: 1120 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "inline-flex", gap: 6, padding: 4, background: "#0f172a", border: "1px solid #2a3a55", borderRadius: 8 }}>
          <button type="button" onClick={() => setMode("full")} style={controlButton(mode === "full", phaseColor)}>Full View</button>
          <button type="button" onClick={() => setMode("step")} style={controlButton(mode === "step", phaseColor)}>Step by Step</button>
        </div>
        <div style={{ color: "#94a3b8", fontSize: 12, fontFamily: "monospace" }}>{realTokens.length} tokens</div>
      </div>

      {mode === "full" ? (
        <div style={{ height: "auto", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, minHeight: 600 }}>
          {renderSourcePanel("full")}
          <section style={panelStyle(phaseColor)}>
            <div style={sectionLabel(phaseColor)}>Token list by category</div>
            <div style={{ height: "auto", overflow: "visible", display: "flex", flexDirection: "column", gap: 10, paddingRight: 4 }}>
              {Object.keys(groupedTokens).length ? Object.entries(groupedTokens).map(([category, items]) => {
                const color = getColor(category, phaseColor);
                return (
                  <div key={category} style={{ border: "1px solid #2a3a55", borderRadius: 8, overflow: "hidden", background: "#0f172a" }}>
                    <div style={{ background: `${color}22`, borderBottom: `1px solid ${color}66`, color, display: "flex", justifyContent: "space-between", padding: "8px 10px", fontSize: 12, fontWeight: 800, fontFamily: "monospace" }}>
                      <span>{category}</span>
                      <span>{items.length}</span>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", padding: 10 }}>
                      {items.map((token, index) => (
                        <span key={`${category}-${index}-${tokenValue(token)}`} title={`${category} | ${tokenValue(token)} | line ${tokenLine(token)}, col ${tokenCol(token)}`} style={{ background: `${color}20`, border: `1px solid ${color}88`, borderRadius: 6, color: "#f8fafc", fontFamily: "monospace", fontSize: 12, padding: "5px 7px" }}>
                          {tokenValue(token)}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              }) : (
                <div style={{ ...bodyText, padding: 12, background: "#0f172a", border: "1px solid #2a3a55", borderRadius: 8 }}>No tokens available yet.</div>
              )}
            </div>
          </section>
        </div>
      ) : (
        <>
          <div style={{ ...cardBase(phaseColor), marginBottom: 0, padding: 12, position: "sticky", top: 108, zIndex: 9, background: "#111827", paddingBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button type="button" onClick={() => setPlaying((value) => !value)} style={controlButton(playing, phaseColor)}>{playing ? "\u23f8 Pause" : "\u25b6 Play"}</button>
              <button type="button" onClick={goNext} style={controlButton(false, phaseColor)}> Next </button>
              <button type="button" onClick={goPrev} style={controlButton(false, phaseColor)}> Prev </button>
              <button type="button" onClick={reset} style={controlButton(false, phaseColor)}> Reset </button>
              <span style={{ color: "#cbd5e1", fontSize: 13, fontWeight: 700, marginLeft: 4 }}>Step {currentIndex + 1} of {tokenSteps.length}</span>
              <label style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", fontSize: 12 }}>
                Speed
                <input type="range" min={250} max={2000} step={50} value={speed} onChange={(event) => setSpeed(Number(event.target.value))} />
                <span style={{ width: 58, fontFamily: "monospace" }}>{speed} ms</span>
              </label>
            </div>
            <div style={{ height: 4, background: "#0b1220", borderRadius: 999, overflow: "hidden", marginTop: 10 }}>
              <div style={{ width: `${progressPercent}%`, height: "100%", background: currentColor, transition: "width 160ms ease" }} />
            </div>
          </div>

          <div style={{ height: "auto", display: "grid", gridTemplateColumns: "48% 52%", gap: 18, minHeight: 600 }}>
            {renderSourcePanel("step")}

            <section style={panelStyle(phaseColor)}>
              <div style={sectionLabel(phaseColor)}>Current token</div>
              <div style={{ height: "auto", overflow: "visible", paddingRight: 4 }}>
                <div style={{ border: `2px solid ${currentColor}`, borderRadius: 8, background: "#0f172a", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <span style={{ background: `${currentColor}22`, border: `1px solid ${currentColor}`, borderRadius: 999, color: currentColor, fontFamily: "monospace", fontSize: 12, fontWeight: 800, padding: "5px 10px" }}>{currentCategory}</span>
                    <span style={{ color: "#94a3b8", fontSize: 12 }}>Token {currentIndex + 1} of {tokenSteps.length}</span>
                  </div>

                  <div style={{ color: "#ffffff", fontFamily: "monospace", fontSize: 18, lineHeight: 1.5, wordBreak: "break-word" }}>{tokenValue(currentToken)}</div>
                  <div style={{ color: "#94a3b8", fontSize: 12 }}>Line {tokenLine(currentToken)}, Col {tokenCol(currentToken)}</div>

                  <div style={{ borderTop: "1px solid #243247" }} />
                  <div style={{ color: "#cbd5e1", fontSize: 13 }}>Pattern matched: <span style={{ color: currentColor, fontFamily: "monospace" }}>{getPattern(currentToken)}</span></div>
                  <div style={{ borderTop: "1px solid #243247" }} />
                  <div style={{ ...bodyText, margin: 0 }}>{explainToken(currentToken)}</div>
                </div>

                <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
                  <div>
                    <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>History</div>
                    <div style={{ display: "grid", gap: 7 }}>
                      {history.length ? history.map((token, index) => {
                        const category = normalizeCategory(token);
                        const color = getColor(category, phaseColor);
                        return (
                          <div key={`${index}-${tokenValue(token)}`} style={{ opacity: 0.55, color: "#cbd5e1", fontFamily: "monospace", fontSize: 12 }}>
                            <span style={{ color }}>{category}</span> {tokenValue(token)} <span style={{ color: "#64748b" }}>- line {tokenLine(token)}</span>
                          </div>
                        );
                      }) : <div style={{ color: "#64748b", fontSize: 12 }}>No previous tokens.</div>}
                    </div>
                  </div>

                  <div>
                    <div style={{ color: "#94a3b8", fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Next preview</div>
                    <div style={{ display: "grid", gap: 7 }}>
                      {preview.length ? preview.map((token, index) => {
                        const category = normalizeCategory(token);
                        const color = getColor(category, phaseColor);
                        return (
                          <div key={`${index}-${tokenValue(token)}`} style={{ opacity: 0.62, color: "#cbd5e1", fontFamily: "monospace", fontSize: 12, fontStyle: "italic" }}>
                            <span style={{ color }}>{category}</span> {tokenValue(token)}
                          </div>
                        );
                      }) : <div style={{ color: "#64748b", fontSize: 12, fontStyle: "italic" }}>End of token stream.</div>}
                    </div>
                  </div>

                  <div style={{ borderLeft: "3px solid #3b82f6", background: "#3b82f620", borderRadius: "0 8px 8px 0", padding: 12 }}>
                    <div style={{ color: "#bfdbfe", fontSize: 12, fontWeight: 800, marginBottom: 6 }}>What is happening:</div>
                    <div style={{ ...bodyText, margin: 0 }}>{dynamicHappeningText(currentToken)}</div>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
