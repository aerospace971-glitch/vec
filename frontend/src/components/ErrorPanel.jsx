import { useState } from "react";
import { lookupError, PHASE_COLORS } from "../data/cppErrors.jsx";

// Detect which phase produced an error based on the object shape / a passed prop
function phaseOf(error, forcedPhase) {
  if (forcedPhase) return forcedPhase;
  if (error.phase) return error.phase;
  // Heuristic: semantic errors always carry a severity field
  if (error.severity) return "semantic";
  return "lex"; // default (compiler sets lexer errors first)
}

function ErrorCard({ error, index, phase }) {
  const [open, setOpen] = useState(false);
  const entry   = lookupError(error.message, phase);
  const phaseColor = PHASE_COLORS[phase] || "#ff5370";

  return (
    <div style={{
      borderRadius: "10px",
      border: `1px solid ${open ? "rgba(255,83,112,0.35)" : "rgba(255,83,112,0.15)"}`,
      background: open ? "rgba(255,83,112,0.06)" : "rgba(255,255,255,0.02)",
      overflow: "hidden",
      transition: "border-color 0.15s, background 0.15s",
    }}>
      {/* ── Summary row ── */}
      <div
        onClick={() => entry && setOpen(o => !o)}
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          padding: "9px 14px",
          cursor: entry ? "pointer" : "default",
        }}
      >
        {/* Index badge */}
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "10px",
          fontWeight: 700,
          color: "#ff5370",
          background: "rgba(255,83,112,0.12)",
          border: "1px solid rgba(255,83,112,0.25)",
          borderRadius: "4px",
          padding: "1px 6px",
          flexShrink: 0,
          marginTop: "1px",
        }}>
          #{index + 1}
        </span>

        {/* Location */}
        {error.line > 0 && (
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "10px",
            color: "#ffcb6b",
            flexShrink: 0,
            minWidth: "90px",
            marginTop: "1px",
          }}>
            L{error.line}{error.col > 0 ? `:${error.col}` : ""}
          </span>
        )}

        {/* Severity badge */}
        {error.severity && (
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "9px",
            fontWeight: 700,
            padding: "1px 6px",
            borderRadius: "3px",
            background: error.severity === "error" ? "rgba(255,83,112,0.18)" : "rgba(255,203,107,0.18)",
            color:       error.severity === "error" ? "#ff5370" : "#ffcb6b",
            border:      `1px solid ${error.severity === "error" ? "rgba(255,83,112,0.35)" : "rgba(255,203,107,0.35)"}`,
            flexShrink: 0,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            marginTop: "1px",
          }}>
            {error.severity}
          </span>
        )}

        {/* Message */}
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: "11px",
          color: "rgba(226,238,248,0.85)",
          flex: 1,
          lineHeight: 1.5,
          wordBreak: "break-word",
        }}>
          {error.message}
        </span>

        {/* Expand toggle */}
        {entry && (
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: "9px",
            color: open ? "#ff5370" : "rgba(255,255,255,0.25)",
            flexShrink: 0,
            marginTop: "2px",
            transition: "color 0.15s",
          }}>
            {open ? "▲ less" : "▼ more"}
          </span>
        )}
      </div>

      {/* ── Expanded details ── */}
      {open && entry && (
        <div style={{
          borderTop: "1px solid rgba(255,83,112,0.12)",
          padding: "12px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}>
          {/* Category pill */}
          <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "1px",
              textTransform: "uppercase",
              color: phaseColor,
              background: phaseColor + "18",
              border: `1px solid ${phaseColor}44`,
              borderRadius: "4px",
              padding: "2px 8px",
            }}>
              {entry.id}
            </span>
            <span style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "9px",
              color: "rgba(255,255,255,0.35)",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "4px",
              padding: "2px 8px",
            }}>
              {entry.category}
            </span>
          </div>

          {/* What it means */}
          <InfoRow icon="?" label="What" text={entry.description} color="#4d9fff" />

          {/* Cause */}
          <InfoRow icon="↯" label="Cause" text={entry.cause} color="#ffcb6b" />

          {/* Impact — the key section */}
          <div style={{
            padding: "10px 12px",
            borderRadius: "8px",
            background: "rgba(255,83,112,0.08)",
            border: "1px solid rgba(255,83,112,0.25)",
            borderLeft: "3px solid #ff5370",
          }}>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "1px",
              color: "#ff5370",
              textTransform: "uppercase",
              marginBottom: "5px",
            }}>
              ⚡ Impact — what this breaks downstream
            </div>
            <p style={{
              margin: 0,
              fontFamily: "'Space Grotesk', sans-serif",
              fontSize: "12px",
              color: "rgba(226,238,248,0.75)",
              lineHeight: 1.6,
            }}>
              {entry.impact}
            </p>
          </div>

          {/* Fix */}
          <InfoRow icon="✓" label="Fix" text={entry.fix} color="#06ffa5" />

          {/* Example */}
          {entry.example && (
            <div>
              <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "9px",
                fontWeight: 700,
                color: "rgba(255,255,255,0.3)",
                letterSpacing: "1px",
                textTransform: "uppercase",
                marginBottom: "4px",
              }}>
                Example
              </div>
              <pre style={{
                margin: 0,
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "10px",
                color: "#c792ea",
                background: "rgba(0,0,0,0.35)",
                borderRadius: "6px",
                padding: "8px 10px",
                overflowX: "auto",
                lineHeight: 1.6,
                border: "1px solid rgba(199,146,234,0.15)",
              }}>
                {entry.example}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoRow({ icon, label, text, color }) {
  return (
    <div style={{ display: "flex", gap: "10px", alignItems: "flex-start" }}>
      <span style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: "10px",
        fontWeight: 700,
        color,
        flexShrink: 0,
        minWidth: "44px",
        paddingTop: "1px",
      }}>
        {icon} {label}
      </span>
      <p style={{
        margin: 0,
        fontFamily: "'Space Grotesk', sans-serif",
        fontSize: "12px",
        color: "rgba(226,238,248,0.65)",
        lineHeight: 1.55,
      }}>
        {text}
      </p>
    </div>
  );
}

export default function ErrorPanel({ errors = [], phase = null, onClose }) {
  const total    = errors.length;
  const errCount = errors.filter(e => !e.severity || e.severity === "error").length;
  const warnCount = errors.filter(e => e.severity === "warning").length;

  return (
    <div className="error-panel" style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Header */}
      <div className="error-header" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ flex: 1 }}>
          ⚠ &nbsp;
          {errCount > 0 && <span style={{ color: "#ff5370" }}>{errCount} error{errCount !== 1 ? "s" : ""}</span>}
          {errCount > 0 && warnCount > 0 && <span style={{ color: "rgba(255,255,255,0.3)", margin: "0 6px" }}>·</span>}
          {warnCount > 0 && <span style={{ color: "#ffcb6b" }}>{warnCount} warning{warnCount !== 1 ? "s" : ""}</span>}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "9px", color: "rgba(255,255,255,0.3)" }}>
          click an error to see cause & impact
        </span>
        {onClose && (
          <button className="error-close" onClick={onClose}>✕</button>
        )}
      </div>

      {/* Error cards */}
      <div className="error-list" style={{ display: "flex", flexDirection: "column", gap: "5px", padding: "10px 12px" }}>
        {errors.map((e, i) => (
          <ErrorCard
            key={i}
            error={e}
            index={i}
            phase={phaseOf(e, phase)}
          />
        ))}
      </div>

    </div>
  );
}
