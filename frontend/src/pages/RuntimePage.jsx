import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import PanelWindow from "../components/PanelWindow";
import LivePanelWindow from "../components/LivePanelWindow";
import useCompilerStore from "../store/compilerStore";
import { downloadRuntime_JSON, downloadRuntime_LOG } from "../downloads";

// ── VRM Engine ────────────────────────────────────────────────────

function createVRM() {
  return {
    registers: { R0:0, R1:0, R2:0, R3:0, R4:0, R5:0, R6:0, R7:0 },
    memory:{}, stack:[], call_stack:[], output:[], pc:0, sp:0, halted:false, _cmpResult:0,
  };
}

function executeInstruction(state, instr) {
  const s = {
    ...state,
    registers:{...state.registers}, memory:{...state.memory},
    stack:[...state.stack], call_stack:[...state.call_stack], output:[...state.output],
  };
  const op   = instr.op  || "";
  const dst  = instr.dst || instr.result || "";
  const src1 = instr.src1 || instr.arg1 || "";
  const src2 = instr.src2 || instr.arg2 || "";

  function resolve(val) {
    if (!val || val === "—") return 0;
    val = String(val).trim();
    if (val.startsWith("#")) { const n = parseFloat(val.slice(1)); return isNaN(n) ? 0 : n; }
    if (val.startsWith('"') && val.endsWith('"')) return val.slice(1, -1);
    if (val === "\\n" || val === "\n") return "\n";
    if (val in s.registers) return s.registers[val];
    if (val.startsWith("MEM[")) { const idx = parseInt(val.slice(4, -1)); return s.memory[idx] ?? 0; }
    const n = parseFloat(val); return isNaN(n) ? val : n;
  }
  function setReg(name, value) { if (name in s.registers) s.registers[name] = value; }
  function memoryIndex(addr) {
    const raw = String(addr || "").trim();
    const match = raw.match(/^\[?MEM\[(\d+)\]\]?$/);
    return match ? parseInt(match[1], 10) : null;
  }

  switch (op) {
    case "MOV":   setReg(dst, resolve(src1)); break;
    case "LOAD":  setReg(dst, resolve(src1)); break;
    case "STORE": {
      const idx = memoryIndex(dst);
      if (idx !== null) s.memory[idx] = resolve(src1);
      break;
    }
    case "ADD":   setReg(dst, resolve(src1) + resolve(src2)); break;
    case "SUB":   setReg(dst, resolve(src1) - resolve(src2)); break;
    case "MUL":   setReg(dst, resolve(src1) * resolve(src2)); break;
    case "DIV": { const d = resolve(src2); setReg(dst, d !== 0 ? Math.floor(resolve(src1) / d) : 0); break; }
    case "MOD": { const d = resolve(src2); setReg(dst, d !== 0 ? resolve(src1) % d : 0); break; }
    case "NEG":   setReg(dst, -resolve(src1)); break;
    case "AND":   setReg(dst, resolve(src1) & resolve(src2)); break;
    case "OR":    setReg(dst, resolve(src1) | resolve(src2)); break;
    case "NOT":   setReg(dst, ~resolve(src1)); break;
    case "XOR":   setReg(dst, resolve(src1) ^ resolve(src2)); break;
    case "PUSH":  s.stack.push(resolve(dst || src1)); s.sp = s.stack.length; break;
    case "POP":   setReg(dst, s.stack.length > 0 ? s.stack.pop() : 0); s.sp = s.stack.length; break;
    case "CMP":   s._cmpResult = resolve(src1) - resolve(src2); break;
    case "SETE":  setReg(dst, s._cmpResult === 0 ? 1 : 0); break;
    case "SETNE": setReg(dst, s._cmpResult !== 0 ? 1 : 0); break;
    case "SETL":  setReg(dst, s._cmpResult < 0  ? 1 : 0); break;
    case "SETG":  setReg(dst, s._cmpResult > 0  ? 1 : 0); break;
    case "SETLE": setReg(dst, s._cmpResult <= 0 ? 1 : 0); break;
    case "SETGE": setReg(dst, s._cmpResult >= 0 ? 1 : 0); break;
    case "JMP":   return { state: s, jump: dst || src1 };
    case "JZ":    if (s._cmpResult === 0) return { state: s, jump: dst || src1 }; break;
    case "JNZ":   if (s._cmpResult !== 0) return { state: s, jump: dst || src1 }; break;
    case "PRINT": {
      const raw = String(instr._printVal || dst || src1 || "").trim();
      if (!raw || raw === "—") break;
      if (raw === "\\n" || raw === "\n") { s.output.push("↵"); break; }
      if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
        s.output.push(raw.slice(1, -1)); break;
      }
      if (raw in s.registers) { s.output.push(String(s.registers[raw])); break; }
      if (raw.startsWith("#")) { s.output.push(raw.slice(1)); break; }
      s.output.push(raw); break;
    }
    case "READ": {
      const value = instr._inputValue !== undefined ? instr._inputValue : resolve(src1);
      setReg(dst, value); break;
    }
    case "CALL": { s.call_stack.push(s.pc + 1); return { state: s, jump: dst || src1 }; }
    case "RET": {
      const ret = s.call_stack.length > 0 ? s.call_stack.pop() : null;
      if (ret === null || ret === undefined) { s.halted = true; return { state: s, jump: null }; }
      return { state: s, jump: ret };
    }
    case "FUNC_BEGIN": case "FUNC_END": case "LABEL": case "NOP": case ";": break;
    default: break;
  }
  s.pc++;
  return { state: s, jump: null };
}

function parseInstruction(instr) {
  if (!instr) return { op: "NOP", dst: "", src1: "", src2: "", code: "" };
  const line = (instr.code || "").trim();
  if (instr.op === "PRINT" || line.toUpperCase().startsWith("PRINT ")) {
    const val = line.slice(6).trim() || instr.dst || instr.arg1 || "";
    return { ...instr, op: "PRINT", dst: val, src1: val, arg1: val, _printVal: val, src2: "" };
  }
  const rawOp = instr.op ? String(instr.op).toUpperCase() : "";
  if (line.endsWith(":") || rawOp === "LABEL" || rawOp === "FUNC_BEGIN" || rawOp === "FUNC_END") {
    const name = instr.dst || instr.result || line.replace(/:$/, "").trim() || "";
    const displayCode = rawOp === "FUNC_BEGIN" ? `FUNC_BEGIN ${name}`
                      : rawOp === "FUNC_END"   ? `FUNC_END ${name}`
                      : `${name}:`;
    return { ...instr, op: rawOp || "LABEL", dst: name, result: name, src1: "", src2: "", code: displayCode };
  }
  // Compiler-output objects already have correct dst/src1/src2 — trust them directly.
  // Re-parsing the code display string gives wrong field positions for ops like CMP
  // (which has no dst, so code[1]=src1 but parser would treat it as dst).
  if (instr.op) {
    return { ...instr, op: String(instr.op).toUpperCase() };
  }
  // Raw string instruction — parse from code text
  if (line) {
    const parts = line.replace(/,/g, "").split(/\s+/);
    const op = (parts[0] || "NOP").toUpperCase();
    if (op === "CMP") {
      return { ...instr, op, dst: "", src1: parts[1] || "", src2: parts[2] || "" };
    }
    return { ...instr, op, dst: parts[1] || "", src1: parts[2] || "", src2: parts[3] || "" };
  }
  const parts = (instr.code || "").replace(/,/g, "").split(/\s+/);
  return { ...instr, dst: instr.dst || parts[1] || "", src1: instr.src1 || parts[2] || "", src2: instr.src2 || parts[3] || "" };
}

function explainInstruction(instr, vrm) {
  if (!instr) return "No instruction selected.";
  const { op, dst, src1, src2 } = instr;
  const regs = vrm.registers;
  const val = (v) => {
    if (!v || v === "—") return "0";
    if (String(v).startsWith("#")) return String(v).slice(1);
    if (v in regs) return String(regs[v]);
    return String(v);
  };
  switch (op) {
    case "MOV":   return `MOV copies the value ${val(src1)} into register ${dst}.`;
    case "LOAD":  return `LOAD reads value ${val(src1)} into register ${dst}.`;
    case "ADD":   return `ADD adds ${src1} (${val(src1)}) + ${src2} (${val(src2)}) and stores the result in ${dst}.`;
    case "SUB":   return `SUB subtracts ${src2} (${val(src2)}) from ${src1} (${val(src1)}) and stores the result in ${dst}.`;
    case "MUL":   return `MUL multiplies ${src1} (${val(src1)}) × ${src2} (${val(src2)}) and stores the result in ${dst}.`;
    case "DIV":   return `DIV divides ${src1} (${val(src1)}) ÷ ${src2} (${val(src2)}) and stores integer result in ${dst}.`;
    case "MOD":   return `MOD computes ${src1} % ${src2} and stores the remainder in ${dst}.`;
    case "NEG":   return `NEG negates the value in ${src1} (${val(src1)}) and stores −${val(src1)} in ${dst}.`;
    case "CMP":   return `CMP compares ${src1} (${val(src1)}) with ${src2} (${val(src2)}) and updates the comparison flags. Difference = ${Number(val(src1)) - Number(val(src2))}.`;
    case "SETE":  return `SETE sets ${dst} = 1 if the last comparison was equal (difference = 0), otherwise 0.`;
    case "SETNE": return `SETNE sets ${dst} = 1 if the last comparison was not equal, otherwise 0.`;
    case "SETL":  return `SETL sets ${dst} = 1 if the last comparison showed less-than, otherwise 0.`;
    case "SETG":  return `SETG sets ${dst} = 1 if the last comparison showed greater-than, otherwise 0.`;
    case "SETLE": return `SETLE sets ${dst} = 1 if the last comparison showed less-than-or-equal, otherwise 0.`;
    case "SETGE": return `SETGE sets ${dst} = 1 if the last comparison showed greater-than-or-equal, otherwise 0.`;
    case "JMP":   return `JMP unconditionally jumps execution to label ${dst || src1}.`;
    case "JZ":    return `JZ jumps to ${dst || src1} only if the last comparison result was zero (equal). Current flags ${vrm._cmpResult === 0 ? "will" : "will NOT"} trigger the jump.`;
    case "JNZ":   return `JNZ jumps to ${dst || src1} only if the last comparison result was non-zero (not equal). Current flags ${vrm._cmpResult !== 0 ? "will" : "will NOT"} trigger the jump.`;
    case "PUSH":  return `PUSH writes ${dst || src1} (${val(dst || src1)}) to stack memory at SP=${vrm.sp}. After the push, SP becomes ${vrm.sp + 1}.`;
    case "POP":   return `POP reads the top stack-memory value at SP=${Math.max(vrm.sp - 1, 0)} into ${dst}. After the pop, SP becomes ${Math.max(vrm.sp - 1, 0)}.`;
    case "PRINT": return `PRINT outputs the value of "${dst || src1}" to the program's STDOUT terminal.`;
    case "READ":  return `READ pauses execution and waits for user input. The entered value will be stored in register ${dst}.`;
    case "CALL":  return `CALL saves the return address on the call stack and jumps to function ${dst || src1}. Data SP stays ${vrm.sp}.`;
    case "RET":   return `RET pops the return address from the call stack and returns to the caller. Data SP is ${vrm.sp}.`;
    case "FUNC_BEGIN": return `FUNC_BEGIN marks the start of function "${dst}". A new stack frame is allocated.`;
    case "FUNC_END":   return `FUNC_END marks the end of function "${dst}" and cleans up the stack frame.`;
    case "LABEL":      return `LABEL "${dst}" is a jump target marker — no computation is performed at this step.`;
    case "NOP":        return `NOP — no operation. The CPU simply advances the program counter to the next instruction.`;
    default:           return `Executing: ${instr.code || op}`;
  }
}

// ── Constants ──────────────────────────────────────────────────────

const VRM_OPS = new Set([
  "MOV","LOAD","STORE","PUSH","POP",
  "ADD","SUB","MUL","DIV","MOD","NEG",
  "AND","OR","NOT","XOR","SHL","SHR",
  "CMP","SETE","SETNE","SETL","SETG","SETLE","SETGE",
  "JMP","JZ","JNZ","CALL","RET",
  "LABEL","FUNC_BEGIN","FUNC_END",
  "PRINT","READ","NOP","THROW","ALLOC","FREE",
]);

const REG_COLORS = {
  R0: "#4d9fff", R1: "#c792ea", R2: "#c3e88d", R3: "#f78c6c",
  R4: "#ffcb6b", R5: "#89ddff", R6: "#f472b6", R7: "#06ffa5",
};

const OP_COLORS = {
  MOV:"#c792ea", LOAD:"#c792ea", STORE:"#c792ea",
  PUSH:"#89ddff", POP:"#89ddff",
  ADD:"#c3e88d", SUB:"#c3e88d", MUL:"#c3e88d", DIV:"#c3e88d", MOD:"#c3e88d", NEG:"#c3e88d",
  CMP:"#ffcb6b", SETE:"#ffcb6b", SETNE:"#ffcb6b", SETL:"#ffcb6b", SETG:"#ffcb6b", SETLE:"#ffcb6b", SETGE:"#ffcb6b",
  JMP:"#f78c6c", JZ:"#f78c6c", JNZ:"#f78c6c",
  CALL:"#22d3ee", RET:"#ff5370",
  PRINT:"#22d3ee", READ:"#06ffa5",
  NOP:"#3a5070", FUNC_BEGIN:"#4d9fff", FUNC_END:"#4d9fff", LABEL:"#546e7a",
};

function RuntimeDownloadMenu({ trace, history, disabled }) {
  const [open, setOpen] = useState(false);
  const options = [
    { label: "Trace JSON", onClick: () => downloadRuntime_JSON(trace) },
    { label: "Execution LOG", onClick: () => downloadRuntime_LOG(history) },
  ];

  return (
    <span style={{ position: "relative", display: "inline-flex" }}>
      <button
        disabled={disabled}
        onClick={() => setOpen(v => !v)}
        style={{
          borderRadius: "999px",
          border: "1px solid rgba(6,255,165,0.3)",
          background: disabled ? "rgba(255,255,255,0.04)" : "rgba(6,255,165,0.08)",
          color: disabled ? "rgba(255,255,255,0.25)" : "#06ffa5",
          padding: "8px 16px",
          fontFamily: "'JetBrains Mono',monospace",
          fontSize: "12px",
          fontWeight: 700,
          cursor: disabled ? "not-allowed" : "pointer",
          whiteSpace: "nowrap",
        }}
      >
        Download ▾
      </button>
      {open && !disabled && (
        <span
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 30,
            minWidth: "160px",
            display: "flex",
            flexDirection: "column",
            gap: "3px",
            padding: "7px",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: "10px",
            background: "#080d1e",
            boxShadow: "0 12px 28px rgba(0,0,0,0.38)",
          }}
        >
          {options.map(option => (
            <button
              key={option.label}
              onClick={() => {
                setOpen(false);
                option.onClick();
              }}
              style={{
                border: "none",
                borderRadius: "7px",
                background: "transparent",
                color: "rgba(255,255,255,0.68)",
                cursor: "pointer",
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: "11px",
                fontWeight: 700,
                padding: "8px 10px",
                textAlign: "left",
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = "rgba(6,255,165,0.08)";
                e.currentTarget.style.color = "#06ffa5";
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = "rgba(255,255,255,0.68)";
              }}
            >
              {option.label}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}

// ── Shared sub-renders (used by both main page and live popups) ───

function AsmList({ instrs, pc, isHalted, asmRef }) {
  return (
    <div ref={asmRef} style={{ display:"flex", flexDirection:"column", gap:"3px", padding:"10px 14px" }}>
      {instrs.map((instr, i) => {
        const active = i === pc && !isHalted;
        const done   = i < pc;
        const opC    = OP_COLORS[instr.op] || "#888";
        return (
          <div key={i} className="rt-row" style={{
            display:"flex", alignItems:"center", gap:"10px",
            padding:"7px 12px", borderRadius:"12px",
            border: active ? `1px solid ${opC}55` : "1px solid transparent",
            background: active ? `${opC}10` : done ? "rgba(6,255,165,0.02)" : "transparent",
            opacity: (!done && !active) ? 0.38 : 1,
            transition:"all 0.18s",
            boxShadow: active ? `0 0 16px ${opC}1a` : "none",
          }}>
            <div style={{
              width:7, height:7, borderRadius:"50%", flexShrink:0,
              background: active ? opC : done ? "#06ffa5" : "#1e2d48",
              boxShadow: active ? `0 0 8px ${opC}` : "none",
              animation: active ? "rtpulse 1s ease-in-out infinite" : "none",
            }}/>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", color:"#3a4a6a", minWidth:"20px", textAlign:"right" }}>{i}</span>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"9px", fontWeight:700, color:opC, background:`${opC}18`, border:`1px solid ${opC}44`, borderRadius:"4px", padding:"2px 6px", minWidth:"52px", textAlign:"center", flexShrink:0 }}>
              {instr.op}
            </span>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"11px", flex:1, color: active ? "#e2eeff" : done ? "#3a4a6a" : "#6b7ea8" }}>
              {instr.code}
            </span>
            {active && <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"8px", color:opC, background:`${opC}15`, border:`1px solid ${opC}44`, borderRadius:"4px", padding:"1px 6px", letterSpacing:"0.5px", flexShrink:0 }}>EXEC</span>}
            {done   && <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"9px", color:"#06ffa530", flexShrink:0 }}>✓</span>}
          </div>
        );
      })}
    </div>
  );
}

function OutputLines({ output, playing, isHalted }) {
  return (
    <div style={{ padding:"10px 14px" }}>
      <div style={{ borderRadius:"14px", background:"rgba(0,0,0,0.7)", border:"1px solid rgba(255,255,255,0.05)", padding:"14px", minHeight:"160px", fontFamily:"'JetBrains Mono',monospace", fontSize:"13px" }}>
        {output.length === 0 ? (
          <span style={{ color:"#1e2d48", fontStyle:"italic" }}>No output yet...</span>
        ) : (
          output.map((line, i) => (
            <div key={i} style={{ color: line === "↵" ? "#2a3a56" : "#06ffa5", padding:"2px 0", display:"flex", gap:"8px", alignItems:"baseline" }}>
              <span style={{ color:"#2a3a56", fontSize:"11px" }}>›</span>
              {line === "↵" ? <span style={{ color:"#2a3a56", fontSize:"11px" }}>[newline]</span> : line}
            </div>
          ))
        )}
        {playing && !isHalted && (
          <span style={{ color:"#06ffa5", animation:"rtpulse 1s ease-in-out infinite" }}>▌</span>
        )}
      </div>
    </div>
  );
}

function StackMemoryPanel({ stack = [], sp = 0 }) {
  const dataRows = stack.map((value, index) => ({
    index, value, isTop: index === stack.length - 1,
  })).reverse();

  return (
    <div style={{ borderRadius:"20px", border:"1px solid rgba(137,221,255,0.18)", background:"rgba(137,221,255,0.035)", padding:"18px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:"10px", marginBottom:"12px" }}>
        <h2 style={{ margin:0, fontSize:"15px", fontWeight:700, color:"#89ddff" }}>Stack Memory</h2>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", color:"#89ddff", border:"1px solid rgba(137,221,255,0.25)", borderRadius:"999px", padding:"3px 9px" }}>
          SP: {sp}
        </span>
      </div>
      {dataRows.length === 0 ? (
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"11px", color:"#2a3a56", fontStyle:"italic" }}>
          Data stack is empty.
        </div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
          {dataRows.map(row => (
            <div key={row.index} style={{
              display:"grid", gridTemplateColumns:"58px 1fr auto", alignItems:"center", gap:"8px",
              borderRadius:"12px",
              border: row.isTop ? "1px solid rgba(137,221,255,0.55)" : "1px solid rgba(255,255,255,0.06)",
              background: row.isTop ? "rgba(137,221,255,0.10)" : "rgba(255,255,255,0.025)",
              padding:"8px 10px",
            }}>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", color:"#4b5a7a" }}>[{row.index}]</span>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"13px", color:"#e2eeff", overflow:"hidden", textOverflow:"ellipsis" }}>{String(row.value)}</span>
              {row.isTop && <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"9px", color:"#89ddff" }}>TOP</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CallStackVisualization({ callStack, instrs, pc }) {
  function getFrameName(returnAddr) {
    if (typeof returnAddr !== "number") return "?";
    const callIdx = returnAddr - 1;
    if (callIdx >= 0 && callIdx < instrs.length) {
      const ci = instrs[callIdx];
      if (ci && ci.op === "CALL") return ci.dst || ci.src1 || `fn@${callIdx}`;
    }
    return `fn@${returnAddr}`;
  }

  function getCurrentFunc() {
    for (let i = Math.min(pc, instrs.length - 1); i >= 0; i--) {
      if (instrs[i]?.op === "FUNC_BEGIN") return instrs[i].dst || "main";
    }
    return "global";
  }

  const currentFunc = getCurrentFunc();
  const frames = [...callStack].reverse().map((addr, i) => ({
    name: getFrameName(addr), returnAddr: addr, isCurrent: false,
  }));
  const allFrames = [{ name: currentFunc, returnAddr: null, isCurrent: true }, ...frames];

  return (
    <div style={{ borderRadius:"20px", border:"1px solid rgba(34,211,238,0.2)", background:"rgba(34,211,238,0.03)", padding:"18px" }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"14px" }}>
        <h2 style={{ margin:0, fontSize:"15px", fontWeight:700, color:"#22d3ee" }}>Call Stack</h2>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", color:"#22d3ee", border:"1px solid rgba(34,211,238,0.3)", borderRadius:"999px", padding:"3px 10px" }}>
          depth {allFrames.length}
        </span>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:"5px" }}>
        {allFrames.map((frame, i) => (
          <div key={i} style={{
            borderRadius:"12px",
            border: frame.isCurrent ? "1px solid rgba(34,211,238,0.5)" : i === 1 ? "1px solid rgba(34,211,238,0.2)" : "1px solid rgba(255,255,255,0.05)",
            background: frame.isCurrent ? "rgba(34,211,238,0.1)" : "rgba(255,255,255,0.02)",
            padding:"10px 14px", display:"flex", alignItems:"center", gap:"10px",
          }}>
            <div style={{
              width:"22px", height:"22px", borderRadius:"50%", flexShrink:0,
              background: frame.isCurrent ? "rgba(34,211,238,0.2)" : "rgba(255,255,255,0.04)",
              border: `1px solid ${frame.isCurrent ? "rgba(34,211,238,0.5)" : "rgba(255,255,255,0.1)"}`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontFamily:"'JetBrains Mono',monospace", fontSize:"9px",
              color: frame.isCurrent ? "#22d3ee" : "#3a4a6a", fontWeight:700,
            }}>
              {allFrames.length - i}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px", fontWeight:700, color: frame.isCurrent ? "#22d3ee" : i === 1 ? "#6b7ea8" : "#3a4a6a" }}>
                {frame.name}()
              </div>
              {frame.returnAddr !== null && (
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"9px", color:"#2a3a56", marginTop:"2px" }}>
                  returns → PC {frame.returnAddr}
                </div>
              )}
            </div>
            {frame.isCurrent && (
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"9px", color:"#22d3ee", background:"rgba(34,211,238,0.1)", border:"1px solid rgba(34,211,238,0.3)", borderRadius:"4px", padding:"2px 7px" }}>
                ▶ ACTIVE
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TimelineEntries({ history }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:"6px", padding:"10px 14px" }}>
      {history.length === 0 ? (
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"11px", color:"#1e2d48", fontStyle:"italic" }}>
          No execution history yet.
        </div>
      ) : (
        [...history].reverse().map((entry, i) => (
          <div key={i} style={{
            display:"flex", gap:"12px", alignItems:"flex-start",
            borderRadius:"12px", border:"1px solid rgba(255,255,255,0.05)",
            background:"rgba(255,255,255,0.02)", padding:"9px 12px",
            opacity: Math.max(0.3, 1 - i * 0.035),
          }}>
            <div style={{
              width:"26px", height:"26px", borderRadius:"50%", flexShrink:0,
              background:"rgba(77,159,255,0.1)", border:"1px solid rgba(77,159,255,0.2)",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", color:"#4d9fff", fontWeight:700,
            }}>
              {history.length - i}
            </div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"11px", color:"#6b7ea8", lineHeight:"1.5", paddingTop:"4px" }}>
              {entry.code}
              {entry.stackInfo && (
                <div style={{ marginTop:"4px", color:"#89ddff", fontSize:"10px" }}>
                  {entry.stackInfo}
                </div>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── Execution Heatmap ────────────────────────────────────────────

function ExecutionHeatmap({ instrs, execCount }) {
  const [sortBy, setSortBy] = useState("index");
  const [showOnly, setShowOnly] = useState("all");

  const maxCount = Math.max(1, ...Object.values(execCount));

  function heatColor(count) {
    if (!count) return "rgba(255,255,255,0.03)";
    const ratio = count / maxCount;
    if (ratio < 0.2)  return "rgba(77,159,255,0.15)";
    if (ratio < 0.4)  return "rgba(6,255,165,0.18)";
    if (ratio < 0.6)  return "rgba(255,203,107,0.22)";
    if (ratio < 0.85) return "rgba(248,124,108,0.28)";
    return "rgba(255,83,112,0.38)";
  }

  function heatBorder(count) {
    if (!count) return "transparent";
    const ratio = count / maxCount;
    if (ratio < 0.2)  return "rgba(77,159,255,0.3)";
    if (ratio < 0.4)  return "rgba(6,255,165,0.35)";
    if (ratio < 0.6)  return "rgba(255,203,107,0.4)";
    if (ratio < 0.85) return "rgba(248,124,108,0.45)";
    return "rgba(255,83,112,0.6)";
  }

  function heatTextColor(count) {
    if (!count) return "rgba(255,255,255,0.2)";
    const ratio = count / maxCount;
    if (ratio < 0.2)  return "#4d9fff";
    if (ratio < 0.4)  return "#06ffa5";
    if (ratio < 0.6)  return "#ffcb6b";
    if (ratio < 0.85) return "#f87c6c";
    return "#ff5370";
  }

  const rows = instrs.map((instr, i) => ({
    idx: i, instr, count: execCount[i] || 0,
    ratio: (execCount[i] || 0) / maxCount,
  }));

  const filtered = showOnly === "hot"
    ? rows.filter(r => r.count > 0)
    : showOnly === "loop"
    ? rows.filter(r => r.count > 1)
    : rows;

  const sorted = [...filtered].sort((a, b) =>
    sortBy === "count" ? b.count - a.count : a.idx - b.idx
  );

  // Stats
  const executedCount = rows.filter(r => r.count > 0).length;
  const hotCount      = rows.filter(r => r.ratio > 0.5).length;
  const loopCount     = rows.filter(r => r.count > 1).length;
  const totalExecs    = Object.values(execCount).reduce((s, v) => s + v, 0);

  return (
    <div style={{ borderRadius:"20px", border:"1px solid rgba(255,83,112,0.18)", background:"rgba(255,83,112,0.025)", padding:"18px" }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"14px", flexWrap:"wrap", gap:"10px" }}>
        <div>
          <h2 style={{ margin:0, fontSize:"15px", fontWeight:700, color:"#ff5370" }}>Execution Heatmap</h2>
          <p style={{ margin:"3px 0 0", fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", color:"#4b5a7a" }}>
            Instruction execution frequency after full run
          </p>
        </div>
        <div style={{ display:"flex", gap:"8px", alignItems:"center", flexWrap:"wrap" }}>
          {[
            { label:`${executedCount} executed`,  color:"#06ffa5" },
            { label:`${loopCount} in loops`,      color:"#ffcb6b" },
            { label:`${hotCount} hot paths`,      color:"#ff5370" },
            { label:`${totalExecs} total execs`,  color:"#4d9fff" },
          ].map(s => (
            <span key={s.label} style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"9px", color:s.color, background:`${s.color}12`, border:`1px solid ${s.color}33`, borderRadius:"999px", padding:"3px 10px" }}>
              {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div style={{ display:"flex", gap:"8px", marginBottom:"12px", flexWrap:"wrap", alignItems:"center" }}>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"9px", color:"#4b5a7a", letterSpacing:"1px" }}>SORT:</span>
        {[["index","By Index"],["count","By Frequency"]].map(([val, lbl]) => (
          <button key={val} onClick={() => setSortBy(val)} style={{
            borderRadius:"999px", border:`1px solid ${sortBy===val ? "rgba(255,83,112,0.5)" : "rgba(255,255,255,0.08)"}`,
            background: sortBy===val ? "rgba(255,83,112,0.12)" : "transparent",
            color: sortBy===val ? "#ff5370" : "rgba(255,255,255,0.4)",
            padding:"3px 12px", fontFamily:"'JetBrains Mono',monospace", fontSize:"9px", cursor:"pointer",
          }}>{lbl}</button>
        ))}
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"9px", color:"#4b5a7a", letterSpacing:"1px", marginLeft:"8px" }}>SHOW:</span>
        {[["all","All"],["hot","Executed only"],["loop","Loop bodies"]].map(([val, lbl]) => (
          <button key={val} onClick={() => setShowOnly(val)} style={{
            borderRadius:"999px", border:`1px solid ${showOnly===val ? "rgba(255,83,112,0.5)" : "rgba(255,255,255,0.08)"}`,
            background: showOnly===val ? "rgba(255,83,112,0.12)" : "transparent",
            color: showOnly===val ? "#ff5370" : "rgba(255,255,255,0.4)",
            padding:"3px 12px", fontFamily:"'JetBrains Mono',monospace", fontSize:"9px", cursor:"pointer",
          }}>{lbl}</button>
        ))}
      </div>

      {/* Heat legend */}
      <div style={{ display:"flex", gap:"6px", alignItems:"center", marginBottom:"10px", flexWrap:"wrap" }}>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"9px", color:"#4b5a7a" }}>HEAT:</span>
        {[
          ["Never executed", "rgba(255,255,255,0.05)", "rgba(255,255,255,0.15)"],
          ["Rare (< 20%)",   "rgba(77,159,255,0.15)",  "#4d9fff"],
          ["Moderate",       "rgba(6,255,165,0.18)",   "#06ffa5"],
          ["Frequent",       "rgba(255,203,107,0.22)", "#ffcb6b"],
          ["Hot path",       "rgba(248,124,108,0.28)", "#f87c6c"],
          ["Critical (max)", "rgba(255,83,112,0.38)",  "#ff5370"],
        ].map(([label, bg, border]) => (
          <span key={label} style={{ display:"flex", alignItems:"center", gap:"4px", fontFamily:"'JetBrains Mono',monospace", fontSize:"8px", color:"rgba(255,255,255,0.35)" }}>
            <span style={{ width:10, height:10, borderRadius:"2px", background:bg, border:`1px solid ${border}`, display:"inline-block" }} />
            {label}
          </span>
        ))}
      </div>

      {/* Instruction list */}
      <div style={{ display:"flex", flexDirection:"column", gap:"2px", maxHeight:"400px", overflowY:"auto" }}>
        {sorted.map(({ idx, instr, count, ratio }) => {
          const opColor = OP_COLORS[instr.op] || "#888";
          const barW = Math.round(ratio * 100);
          return (
            <div key={idx} style={{
              display:"flex", alignItems:"center", gap:"10px",
              padding:"6px 12px", borderRadius:"10px",
              background: heatColor(count),
              border:`1px solid ${heatBorder(count)}`,
              transition:"all 0.15s",
            }}>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"9px", color:"rgba(255,255,255,0.2)", minWidth:"22px", textAlign:"right", flexShrink:0 }}>{idx}</span>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"8px", fontWeight:700, color:opColor, background:`${opColor}18`, border:`1px solid ${opColor}44`, borderRadius:"4px", padding:"1px 5px", minWidth:"52px", textAlign:"center", flexShrink:0 }}>
                {instr.op}
              </span>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", flex:1, color: count > 0 ? "rgba(226,238,248,0.8)" : "rgba(255,255,255,0.2)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                {instr.code}
              </span>
              {/* Mini bar */}
              <div style={{ width:"80px", height:"4px", background:"rgba(255,255,255,0.05)", borderRadius:"2px", flexShrink:0 }}>
                <div style={{ height:"100%", width:`${barW}%`, background: heatTextColor(count), borderRadius:"2px" }} />
              </div>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", fontWeight:700, color: heatTextColor(count), minWidth:"38px", textAlign:"right", flexShrink:0 }}>
                {count > 0 ? `×${count}` : "—"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── RuntimePage ───────────────────────────────────────────────────

export default function RuntimePage() {
  const navigate  = useNavigate();
  const result    = useCompilerStore((state) => state.result);
  const compiled  = useCompilerStore((state) => state.compiled);

  // Block runtime if any upstream phase has hard errors (includes fatal warnings)
  const runtimeBlocker = (() => {
    if (!result) return null;
    const lexErrors   = (result.lexer_errors   || []);
    const parseErrors = (result.parse_errors   || []);
    // Hard errors + warnings that make IR invalid (e.g., undeclared identifier)
    const semanticHard = (result.semantic_errors || []).filter(
      e => e.severity === "error" || /identifier '.*' may be undeclared/i.test(e.message)
    );
    if (lexErrors.length > 0)      return { label:"01 — Lexer",             errors: lexErrors };
    if (parseErrors.length > 0)    return { label:"02 — Parser",            errors: parseErrors };
    if (semanticHard.length > 0)   return { label:"03 — Semantic Analysis", errors: semanticHard };
    return null;
  })();

  const rawAssembly = useMemo(() => result?.assembly || [], [result]);

  const instrs = useMemo(() => (rawAssembly)
    .map(i => typeof i === "string" ? { code: i } : i)
    .filter(i => {
      if (i.op && VRM_OPS.has(i.op)) return true;
      const c = (i.code || "").trim();
      return c && !c.startsWith(";") && !c.startsWith("//")
        && !c.startsWith("section")
        && !c.toLowerCase().startsWith("target:")
        && !c.toLowerCase().startsWith("registers:");
    })
    .map(parseInstruction),
  [rawAssembly]);

  const labelMap = useMemo(() => {
    const map = {};
    instrs.forEach((instr, i) => {
      if (instr.op === "LABEL" || instr.op === "FUNC_BEGIN") {
        const name = (instr.dst || instr.result || "").replace(/:$/, "").trim();
        if (name) map[name] = i;
      }
    });
    return map;
  }, [instrs]);

  const readCount = useMemo(() => instrs.filter(i => i.op === 'READ').length, [instrs]);

  const varMap = useMemo(() => {
    const map = {};
    const isUserVar = (name) => {
      if (!name || /^\d/.test(name)) return false;
      if (/^_?t\d+$/.test(name)) return false; // compiler temporaries like t0, t1
      return true;
    };
    instrs.forEach(instr => {
      const comment = (instr.comment || "").trim();
      const dst = (instr.dst || "").trim();
      if (!dst || !/^R\d$/.test(dst)) return;

      // "reload varname" — variable reloaded from memory spill
      const reloadMatch = comment.match(/^reload\s+(\S+)$/);
      if (reloadMatch && isUserVar(reloadMatch[1])) { map[reloadMatch[1]] = dst; return; }

      // "read varname" — READ instruction stores into register
      const readMatch = comment.match(/^read\s+(\S+)$/);
      if (readMatch && isUserVar(readMatch[1])) { map[readMatch[1]] = dst; return; }

      // "pop param varname" — function parameter received
      const paramMatch = comment.match(/^pop param\s+(\S+)$/);
      if (paramMatch && isUserVar(paramMatch[1])) { map[paramMatch[1]] = dst; return; }

      // "varname = ..." — assignment comment from genAssign
      if ((instr.op === "MOV" || instr.op === "LOAD") && comment) {
        const assignMatch = comment.match(/^(\w+)\s*=/);
        if (assignMatch && isUserVar(assignMatch[1])) map[assignMatch[1]] = dst;
      }
    });
    return map;
  }, [instrs]);

  const [vrm, setVRM]           = useState(createVRM());
  const vrmRef                  = useRef(vrm);
  const setVRMState = (v)       => { vrmRef.current = v; setVRM(v); };
  const [pc,  setPC]            = useState(0);
  const [playing, setPlaying]   = useState(false);
  const [speed,   setSpeed]     = useState(800);
  const [history, setHistory]   = useState([]);
  const [changedRegs,  setChangedRegs]  = useState({});
  const [userInputs,   setUserInputs]   = useState([]);
  const [showInputPanel, setShowInputPanel] = useState(false);

  // ── Backend trace state ───────────────────────────────────────────
  const [trace, setTrace]               = useState([]);
  const traceRef                        = useRef([]);
  const traceIdxRef                     = useRef(0);
  const [traceLoading, setTraceLoading] = useState(false);
  const setTraceData = (t) => { traceRef.current = t; setTrace(t); };

  // live panel states
  const [liveAssembly,  setLiveAssembly]  = useState(false);
  const [liveOutput,    setLiveOutput]    = useState(false);
  const [liveTimeline,  setLiveTimeline]  = useState(false);

  const pcRef       = useRef(0);
  const intervalRef = useRef(null);
  const asmRef      = useRef(null);

  useEffect(() => { pcRef.current = pc; }, [pc]);
  useEffect(() => {
    clearInterval(intervalRef.current);
    setTraceData([]); traceIdxRef.current = 0;
    setVRMState(createVRM()); setPC(0); pcRef.current = 0;
    setPlaying(false); setHistory([]); setChangedRegs({});
    if (!rawAssembly?.length) return;
    const rCount = instrs.filter(i => i.op === 'READ').length;
    if (rCount > 0) {
      setUserInputs(Array(rCount).fill(""));
      setShowInputPanel(true);
    } else {
      setShowInputPanel(false);
      fetchTrace([]);
    }
  }, [instrs]); // eslint-disable-line react-hooks/exhaustive-deps

  // listen for PanelWindow popup events
  useEffect(() => {
    const handler = (e) => {
      const t = e.detail?.title;
      if (t === "Assembly Instructions") setLiveAssembly(true);
      else if (t === "Program Output")    setLiveOutput(true);
      else if (t === "Execution Timeline") setLiveTimeline(true);
    };
    window.addEventListener("open-live-panel", handler);
    return () => window.removeEventListener("open-live-panel", handler);
  }, []);

  // ── Trace helpers ────────────────────────────────────────────────
  function traceEntryToVRM(entry) {
    if (!entry) return createVRM();
    const mem = {};
    Object.entries(entry.memory || {}).forEach(([k, v]) => { mem[parseInt(k)] = v; });
    return {
      registers:  { ...entry.registers },
      memory:     mem,
      stack:      [...(entry.stack  || [])],
      call_stack: [...(entry.call_stack || [])],
      output:     [...(entry.output || [])],
      pc:         entry.pc,
      sp:         entry.sp ?? (entry.stack || []).length,
      halted:     entry.halted,
      _cmpResult: entry.cmp_result || 0,
    };
  }

  async function fetchTrace(inputs = [], autoPlay = false) {
    if (!rawAssembly?.length) return;
    setTraceLoading(true);
    try {
      const resp = await fetch("/execute", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instructions: rawAssembly, inputs, maxSteps: 10000 }),
      });
      const data = await resp.json();
      if (data.trace?.length) {
        setTraceData(data.trace);
        traceIdxRef.current = 0;
        // Force halted=false on initial state — trace[0] is the "before execution"
        // snapshot and must never block play even if backend marked it halted.
        const initVRM = { ...traceEntryToVRM(data.trace[0]), halted: false };
        setVRMState(initVRM);
        setPC(data.trace[0].pc);
        pcRef.current = data.trace[0].pc;
        if (autoPlay && data.trace.length > 1) {
          setPlaying(true);
        }
      }
    } catch (e) {
      console.error("[VRM] Backend execute failed:", e);
    } finally {
      setTraceLoading(false);
    }
  }

  function reset() {
    clearInterval(intervalRef.current);
    traceIdxRef.current = 0;
    const t       = traceRef.current;
    const initVRM = t.length ? traceEntryToVRM(t[0]) : createVRM();
    const initPC  = t.length ? t[0].pc : 0;
    setVRMState(initVRM); setPC(initPC); pcRef.current = initPC;
    setPlaying(false); setHistory([]); setChangedRegs({});
  }

  function parseInputValue(text) {
    const t = String(text).trim();
    if (t === "") return 0;
    if (/^-?\d+$/.test(t)) return parseInt(t, 10);
    if (/^-?\d*\.\d+$/.test(t)) return parseFloat(t);
    return t;
  }

  function resolveJump(jump) {
    if (jump === null || jump === undefined) return null;
    if (typeof jump === "number") return jump;
    const clean = String(jump).replace(/:$/, "").trim();
    if (labelMap[clean] !== undefined) return labelMap[clean];
    if (/^\d+$/.test(clean)) return parseInt(clean, 10);
    return null;
  }

  function buildHistoryLine(instr, prevVRM, nextState) {
    const op = instr.op;
    if (op === "PRINT") {
      const last = nextState.output[nextState.output.length - 1] || "";
      return `PRINT → displayed "${last === "↵" ? "\\n" : last}"`;
    }
    if (op === "MOV" || op === "LOAD")
      return `${op} → ${instr.dst} = ${nextState.registers[instr.dst]}`;
    if (["ADD","SUB","MUL","DIV","MOD","NEG"].includes(op))
      return `${op} → ${instr.dst} = ${nextState.registers[instr.dst]}`;
    if (op === "CMP") {
      const a = prevVRM.registers[instr.src1] ?? instr.src1;
      const b = instr.src2?.startsWith("#") ? instr.src2.slice(1) : (prevVRM.registers[instr.src2] ?? instr.src2);
      return `CMP ${instr.src1}(${a}) with ${b} → diff=${a - b}`;
    }
    if (op === "PUSH") {
      const pushed = nextState.stack[nextState.stack.length - 1];
      return `PUSH → stack[${nextState.sp - 1}] = ${String(pushed)}, SP ${prevVRM.sp} → ${nextState.sp}`;
    }
    if (op === "POP") {
      return `POP → ${instr.dst} = ${nextState.registers[instr.dst]}, SP ${prevVRM.sp} → ${nextState.sp}`;
    }
    if (op === "CALL") {
      return `CALL ${instr.dst || instr.src1} → return address saved, call depth ${prevVRM.call_stack.length} → ${nextState.call_stack.length}`;
    }
    if (op === "RET") {
      return `RET → call depth ${prevVRM.call_stack.length} → ${nextState.call_stack.length}`;
    }
    if (["JMP","JZ","JNZ"].includes(op)) return `${op} → ${instr.code}`;
    return instr.code || op;
  }

  function buildStackInfo(prevVRM, nextState) {
    const spChanged = prevVRM.sp !== nextState.sp;
    const callChanged = prevVRM.call_stack.length !== nextState.call_stack.length;
    if (!spChanged && !callChanged) return "";
    const parts = [];
    if (spChanged) parts.push(`SP ${prevVRM.sp} -> ${nextState.sp}`);
    if (callChanged) parts.push(`call stack ${prevVRM.call_stack.length} -> ${nextState.call_stack.length}`);
    return parts.join(" | ");
  }

  function stepOnce(currentPC, currentVRM) {
    const t   = traceRef.current;
    const idx = traceIdxRef.current;
    if (!t.length || idx >= t.length - 1) {
      return { newPC: currentPC, newVRM: { ...currentVRM, halted: true } };
    }
    const prevEntry     = t[idx];
    const nextEntry     = t[idx + 1];
    const newVRM        = traceEntryToVRM(nextEntry);
    const changed       = {};
    (nextEntry.changed_regs || []).forEach(r => { changed[r] = true; });
    if ((prevEntry.sp ?? (prevEntry.stack || []).length) !== (nextEntry.sp ?? (nextEntry.stack || []).length)) {
      changed.SP = true;
    }
    const executedInstr = instrs[prevEntry.pc];
    const historyEntry  = executedInstr ? {
      pc:   prevEntry.pc,
      code: buildHistoryLine(executedInstr, currentVRM, newVRM),
      stackInfo: buildStackInfo(currentVRM, newVRM),
      regs: { ...newVRM.registers },
    } : null;
    traceIdxRef.current = idx + 1;
    return { newPC: nextEntry.pc, newVRM, changed, historyEntry };
  }

  function applyStep(result) {
    if (result.historyEntry)
      setHistory(prev => [...prev.slice(-49), result.historyEntry]);
    if (result.changed && Object.keys(result.changed).length > 0) {
      setChangedRegs(result.changed);
      setTimeout(() => setChangedRegs({}), 600);
    }
    pcRef.current = result.newPC;
    setPC(result.newPC);
    setVRMState(result.newVRM);
    if (asmRef.current) {
      const rows = asmRef.current.querySelectorAll(".rt-row");
      const row = rows[result.newPC];
      if (row) {
        const container = asmRef.current.parentElement;
        if (container) {
          const cRect = container.getBoundingClientRect();
          const rRect = row.getBoundingClientRect();
          const relTop    = rRect.top - cRect.top;
          const relBottom = relTop + rRect.height;
          if (relTop < 40) container.scrollTop += relTop - 40;
          else if (relBottom > container.clientHeight - 40) container.scrollTop += relBottom - container.clientHeight + 40;
        }
      }
    }
  }

  function handleStep() {
    if (!traceReady || vrm.halted || traceIdxRef.current >= traceRef.current.length - 1) return;
    applyStep(stepOnce(pc, vrm));
  }

  function handlePlay()  {
    if (!traceRef.current.length && !traceLoading && !showInputPanel && hasProgram) {
      fetchTrace([], true);
      return;
    }
    if (!vrmRef.current.halted && traceIdxRef.current < traceRef.current.length - 1) {
      pcRef.current = pc; setPlaying(true);
    }
  }
  function handlePause() { setPlaying(false); clearInterval(intervalRef.current); }

  useEffect(() => {
    if (!playing) { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      const current = vrmRef.current;
      if (!current || current.halted || traceIdxRef.current >= traceRef.current.length - 1) {
        clearInterval(intervalRef.current); setPlaying(false); return;
      }
      applyStep(stepOnce(pcRef.current, vrmRef.current));
    }, speed);
    return () => clearInterval(intervalRef.current);
  }, [playing, speed, instrs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Execution frequency map: instrIndex → count (built from trace)
  const execCount = useMemo(() => {
    if (!trace.length) return {};
    const counts = {};
    trace.forEach(entry => {
      const idx = entry.pc;
      if (typeof idx === "number") counts[idx] = (counts[idx] || 0) + 1;
    });
    return counts;
  }, [trace]);

  const hasProgram   = instrs.length > 0 && rawAssembly.length > 0;
  const traceReady    = trace.length > 0 && !traceLoading;
  const tracePending  = !traceLoading && !showInputPanel && hasProgram;
  const canRun        = traceReady || tracePending;
  const isHalted      = traceReady && (vrm.halted || traceIdxRef.current >= trace.length - 1);
  const currentInstr  = instrs[pc] || null;
  const stackRelevantOps = useMemo(
    () => instrs.some(i => ["PUSH","POP","CALL","RET"].includes(i.op)),
    [instrs]
  );
  const stackPanelVisible = stackRelevantOps && (
    history.some(h => h.stackInfo) ||
    vrm.stack.length > 0 ||
    vrm.call_stack.length > 0
  );

  const statusLabel = traceLoading ? "LOADING..." :
    showInputPanel ? "NEEDS INPUT" :
    isHalted ? "HALTED" : playing ? "RUNNING" :
    instrs.length === 0 ? "NO PROGRAM" : "PAUSED";
  const statusColor = traceLoading ? "#ffcb6b" :
    showInputPanel ? "#ffcb6b" :
    isHalted ? "#ff5370" : playing ? "#06ffa5" : "#89ddff";

  const isEmpty = !compiled || instrs.length === 0 || !!runtimeBlocker;

  // ── Main page ──────────────────────────────────────────────────
  return (
    <div style={{ display:"flex", flexDirection:"column", height:"100vh", background:"#04030f", color:"#e2eeff", fontFamily:"'Space Grotesk',sans-serif" }}>
      <Navbar />

      {/* ── Empty / Blocked state ───────────────────────────── */}
      {isEmpty ? (
        runtimeBlocker ? (
          /* Blocked by upstream error */
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"20px", padding:"40px", textAlign:"center" }}>
            <div style={{ fontSize:"56px", filter:"drop-shadow(0 0 18px #ff446688)", opacity:0.85 }}>⛔</div>
            <div>
              <h2 style={{ margin:"0 0 6px", fontSize:"18px", fontWeight:700, color:"rgba(255,255,255,0.75)" }}>Runtime — Blocked</h2>
              <p style={{ margin:0, fontFamily:"'JetBrains Mono',monospace", fontSize:"11px", color:"rgba(255,255,255,0.3)" }}>
                Cannot execute — <span style={{ color:"#ff5370" }}>{runtimeBlocker.label}</span> has {runtimeBlocker.errors.length} error{runtimeBlocker.errors.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div style={{ width:"100%", maxWidth:"560px", background:"rgba(255,68,68,0.05)", border:"1px solid rgba(255,83,112,0.25)", borderRadius:"14px", overflow:"hidden" }}>
              <div style={{ padding:"8px 16px", background:"rgba(255,83,112,0.08)", borderBottom:"1px solid rgba(255,83,112,0.15)", display:"flex", justifyContent:"space-between" }}>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", fontWeight:700, color:"#ff5370", letterSpacing:"1px", textTransform:"uppercase" }}>{runtimeBlocker.label} — Errors</span>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"9px", color:"rgba(255,83,112,0.5)" }}>{runtimeBlocker.errors.length} error{runtimeBlocker.errors.length !== 1 ? "s" : ""}</span>
              </div>
              <div style={{ maxHeight:"220px", overflowY:"auto" }}>
                {runtimeBlocker.errors.slice(0, 15).map((err, i) => (
                  <div key={i} style={{ display:"flex", gap:"14px", padding:"7px 16px", borderBottom:"1px solid rgba(255,255,255,0.04)", fontFamily:"'JetBrains Mono',monospace", fontSize:"11px", alignItems:"flex-start" }}>
                    <span style={{ color:"#ff5370", flexShrink:0 }}>✕</span>
                    {err.line !== undefined && <span style={{ color:"#ffcb6b", flexShrink:0, minWidth:"80px" }}>L{err.line}{err.col !== undefined ? `:${err.col}` : ""}</span>}
                    <span style={{ color:"rgba(226,238,248,0.7)", flex:1, textAlign:"left" }}>{err.message || String(err)}</span>
                  </div>
                ))}
                {runtimeBlocker.errors.length > 15 && (
                  <div style={{ padding:"7px 16px", color:"rgba(255,83,112,0.5)", fontFamily:"'JetBrains Mono',monospace", fontSize:"10px" }}>… and {runtimeBlocker.errors.length - 15} more</div>
                )}
              </div>
            </div>
            <button onClick={() => navigate("/app")} style={{ borderRadius:"999px", background:"linear-gradient(135deg,#ff448888,#ff448844)", border:"1px solid #ff448844", color:"#fff", padding:"11px 26px", fontFamily:"'JetBrains Mono',monospace", fontWeight:700, fontSize:"12px", cursor:"pointer" }}>
              Fix Errors in Compiler →
            </button>
          </div>
        ) : (
          /* No program compiled yet */
          <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:"18px" }}>
            <div style={{ fontSize:"56px", opacity:0.15 }}>⚡</div>
            <h2 style={{ margin:0, fontSize:"26px", color:"#e2eeff" }}>No program loaded</h2>
            <p style={{ color:"#4b5a7a", margin:0, maxWidth:"380px", textAlign:"center", lineHeight:"1.6", fontSize:"14px" }}>
              Compile a C++ program in the Compiler tab first, then return here to simulate runtime execution step-by-step.
            </p>
            <button onClick={() => navigate("/app")} style={{ borderRadius:"999px", background:"#4d9fff", color:"#020b13", padding:"12px 28px", border:"none", cursor:"pointer", fontFamily:"'JetBrains Mono',monospace", fontWeight:700, fontSize:"13px" }}>
              Go to Compiler →
            </button>
          </div>
        )
      ) : (

      /* scrollable content area */
      <div style={{ flex:1, padding:"18px 20px", display:"flex", flexDirection:"column", gap:"14px", overflowY:"auto" }}>

        {/* ── Runtime Control Bar ──────────────────────────────── */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", borderRadius:"20px", border:"1px solid rgba(255,255,255,0.08)", background:"rgba(10,16,32,0.95)", padding:"14px 20px", gap:"14px", flexWrap:"wrap" }}>
          <div>
            <h1 style={{ margin:0, fontSize:"22px", fontWeight:700, letterSpacing:"-0.02em" }}>Runtime Visualizer</h1>
            <p style={{ margin:"3px 0 0", fontSize:"11px", color:"#4b5a7a", fontFamily:"'JetBrains Mono',monospace" }}>
              Virtual Machine Execution Simulation
            </p>
          </div>

          <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", fontWeight:700, letterSpacing:"1px", color:statusColor, background:`${statusColor}18`, border:`1px solid ${statusColor}44`, borderRadius:"999px", padding:"4px 12px" }}>
              {statusLabel}
            </span>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", color:"#4b5a7a", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:"999px", padding:"4px 12px" }}>
              PC: {pc} / {instrs.length}
            </span>
            {traceLoading && (
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", color:"#ffcb6b", background:"rgba(255,203,107,0.08)", border:"1px solid rgba(255,203,107,0.3)", borderRadius:"999px", padding:"4px 12px", animation:"rtpulse 1s ease-in-out infinite" }}>
                compiling trace…
              </span>
            )}
            {traceReady && !traceLoading && (
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", color:"#06ffa530", background:"transparent", borderRadius:"999px", padding:"4px 12px" }}>
                {trace.length - 1} steps
              </span>
            )}
            {traceReady && readCount > 0 && (
              <button onClick={() => {
                clearInterval(intervalRef.current);
                setPlaying(false);
                setTraceData([]); traceIdxRef.current = 0;
                setVRMState(createVRM()); setPC(0); pcRef.current = 0;
                setHistory([]); setChangedRegs({});
                setShowInputPanel(true);
              }} style={{ borderRadius:"999px", border:"1px solid rgba(6,255,165,0.3)", background:"transparent", color:"#06ffa5", padding:"4px 12px", fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", cursor:"pointer", whiteSpace:"nowrap" }}>
                ⟳ Inputs
              </button>
            )}
            <RuntimeDownloadMenu trace={trace} history={history} disabled={!traceReady && history.length === 0} />

            {[
              { label:"▶ Play",  fn: handlePlay,  off: !canRun || playing || isHalted, bg:"#06ffa5", tc:"#020b13" },
              { label:"⏸ Pause", fn: handlePause, off: !playing,                           bg:"#ffcb6b", tc:"#020b13" },
              { label:"⏭ Step",  fn: handleStep,  off: !canRun || playing || isHalted, bg:"#4d9fff", tc:"#020b13" },
              { label:"↺ Reset", fn: reset,        off: false,                             bg:"#ff5370", tc:"#ffffff" },
            ].map(btn => (
              <button key={btn.label} onClick={btn.fn} disabled={btn.off} style={{
                borderRadius:"999px", border:"none",
                background: btn.off ? "rgba(255,255,255,0.05)" : btn.bg,
                color: btn.off ? "rgba(255,255,255,0.25)" : btn.tc,
                padding:"8px 18px", fontFamily:"'JetBrains Mono',monospace",
                fontWeight:700, fontSize:"12px", cursor: btn.off ? "not-allowed" : "pointer",
                transition:"all 0.15s",
              }}>{btn.label}</button>
            ))}

            <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"9px", color:"#3a4a6a", letterSpacing:"1px" }}>SPEED</span>
              <input type="range" min="100" max="2000" step="100" value={2100 - speed}
                onChange={e => setSpeed(2100 - parseInt(e.target.value))}
                style={{ width:70, accentColor:"#4d9fff" }} />
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", color:"#4d9fff", minWidth:"34px" }}>
                {Math.round(1000 / speed * 10) / 10}/s
              </span>
            </div>
          </div>
        </div>

        {/* ── Program Inputs Panel ──────────────────────────────── */}
        {showInputPanel && (
          <div style={{ background:"rgba(6,255,165,0.03)", border:"1px solid rgba(6,255,165,0.2)", borderRadius:"20px", padding:"18px 20px" }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:"14px", flexWrap:"wrap", gap:"10px" }}>
              <div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px", color:"#06ffa5", fontWeight:700, letterSpacing:"0.5px" }}>
                  PROGRAM INPUTS
                </div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", color:"#4b5a7a", marginTop:"3px" }}>
                  {userInputs.length} READ instruction{userInputs.length !== 1 ? "s" : ""} detected — enter values to run
                </div>
              </div>
              <button
                onClick={() => {
                  const parsed = userInputs.map(parseInputValue);
                  setShowInputPanel(false);
                  fetchTrace(parsed, true);
                }}
                style={{ borderRadius:"999px", background:"#06ffa5", color:"#020b13", padding:"9px 22px", border:"none", fontFamily:"'JetBrains Mono',monospace", fontWeight:700, fontSize:"12px", cursor:"pointer", whiteSpace:"nowrap" }}
              >
                ▶ Run Program
              </button>
            </div>
            <div style={{ display:"flex", gap:"12px", flexWrap:"wrap" }}>
              {userInputs.map((val, i) => (
                <div key={i} style={{ display:"flex", flexDirection:"column", gap:"5px" }}>
                  <label style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"9px", color:"#06ffa550", letterSpacing:"1px" }}>
                    INPUT {i + 1}
                  </label>
                  <input
                    value={val}
                    onChange={e => {
                      const next = [...userInputs];
                      next[i] = e.target.value;
                      setUserInputs(next);
                    }}
                    onKeyDown={e => {
                      if (e.key === "Enter") {
                        const parsed = userInputs.map(parseInputValue);
                        setShowInputPanel(false);
                        fetchTrace(parsed, true);
                      }
                    }}
                    placeholder={`value ${i + 1}`}
                    // eslint-disable-next-line jsx-a11y/no-autofocus
                    autoFocus={i === 0}
                    style={{ padding:"8px 14px", borderRadius:"10px", border:"1px solid rgba(6,255,165,0.25)", background:"rgba(6,255,165,0.04)", color:"#e2eeff", fontFamily:"'JetBrains Mono',monospace", fontSize:"13px", outline:"none", width:"130px" }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Main grid: Assembly (L) + Right column ───────────── */}
        <div style={{ display:"grid", gridTemplateColumns:"1.25fr 0.75fr", gap:"14px", alignItems:"start" }}>

          {/* Assembly Instructions Panel — PanelWindow wrapper */}
          <div style={{ borderRadius:"20px", border:"1px solid rgba(255,255,255,0.08)", background:"rgba(10,16,32,0.95)", overflow:"hidden", height:"520px" }}>
            <PanelWindow title="Assembly Instructions" height={480}>
              <div style={{ display:"flex", justifyContent:"flex-end", padding:"8px 14px 0" }}>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", color:"#4d9fff", background:"rgba(77,159,255,0.1)", border:"1px solid rgba(77,159,255,0.2)", borderRadius:"999px", padding:"3px 10px" }}>
                  PC: {pc}
                </span>
              </div>
              <AsmList instrs={instrs} pc={pc} isHalted={isHalted} asmRef={asmRef} />
            </PanelWindow>
          </div>

          {/* Right column stack */}
          <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>

            {/* Registers Panel */}
            <div style={{ borderRadius:"20px", border:"1px solid rgba(255,255,255,0.08)", background:"rgba(10,16,32,0.95)", padding:"18px" }}>
              <h2 style={{ margin:"0 0 14px", fontSize:"15px", fontWeight:700 }}>Registers</h2>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"8px" }}>
                {Object.entries(vrm.registers).map(([reg, val]) => {
                  const changed  = !!changedRegs[reg];
                  const regColor = REG_COLORS[reg] || "#888";
                  return (
                    <div key={reg} style={{
                      borderRadius:"14px",
                      border: changed ? `1px solid ${regColor}` : "1px solid rgba(255,255,255,0.07)",
                      background: changed ? `${regColor}12` : "rgba(255,255,255,0.02)",
                      padding:"12px 14px",
                      transition:"all 0.3s",
                      boxShadow: changed ? `0 0 14px ${regColor}30` : "none",
                    }}>
                      <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", color:regColor, fontWeight:700 }}>{reg}</div>
                      <div style={{
                        fontFamily:"'JetBrains Mono',monospace", fontSize:"20px", fontWeight:700,
                        marginTop:"4px", color: val !== 0 ? "#e2eeff" : "#2a3a56",
                        transition:"all 0.25s",
                        transform: changed ? "scale(1.1)" : "scale(1)",
                      }}>{String(val)}</div>
                    </div>
                  );
                })}
                {/* Program Counter */}
                <div style={{ borderRadius:"14px", border:"1px solid rgba(77,159,255,0.3)", background:"rgba(77,159,255,0.06)", padding:"12px 14px", gridColumn:"1/-1" }}>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", color:"#4d9fff", fontWeight:700 }}>PC — Program Counter</div>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"20px", fontWeight:700, marginTop:"4px", color:"#4d9fff" }}>{pc}</div>
                </div>
                <div style={{
                  borderRadius:"14px",
                  border: changedRegs.SP ? "1px solid #89ddff" : "1px solid rgba(137,221,255,0.25)",
                  background: changedRegs.SP ? "rgba(137,221,255,0.12)" : "rgba(137,221,255,0.05)",
                  padding:"12px 14px",
                  gridColumn:"1/-1",
                  transition:"all 0.3s",
                  boxShadow: changedRegs.SP ? "0 0 14px rgba(137,221,255,0.28)" : "none",
                }}>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", color:"#89ddff", fontWeight:700 }}>SP — Stack Pointer</div>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"20px", fontWeight:700, marginTop:"4px", color:"#89ddff" }}>{vrm.sp}</div>
                </div>
              </div>
            </div>

            {stackPanelVisible && (
              <StackMemoryPanel stack={vrm.stack} sp={vrm.sp} />
            )}

            {/* Call Stack Visualization */}
            {vrm.call_stack.length > 0 && (
              <CallStackVisualization
                callStack={vrm.call_stack}
                instrs={instrs}
                pc={pc}
              />
            )}

            {/* Variable Watch Panel */}
            <div style={{ borderRadius:"20px", border:"1px solid rgba(255,255,255,0.08)", background:"rgba(10,16,32,0.95)", padding:"18px" }}>
              <h2 style={{ margin:"0 0 14px", fontSize:"15px", fontWeight:700 }}>Variable Watch</h2>
              {Object.keys(varMap).length === 0 ? (
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"11px", color:"#2a3a56", fontStyle:"italic" }}>
                  No named variables detected in this assembly output.
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:"6px" }}>
                  {Object.entries(varMap).map(([varName, regName]) => {
                    const regColor = REG_COLORS[regName] || "#888";
                    return (
                      <div key={varName} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", borderRadius:"12px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", padding:"10px 14px" }}>
                        <div>
                          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px", color:"#c3e88d" }}>{varName}</div>
                          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", color:regColor, marginTop:"2px" }}>{varName} → {regName}</div>
                        </div>
                        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"18px", fontWeight:700, color:"#e2eeff" }}>{String(vrm.registers[regName])}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Current Step Explanation Panel */}
            <div style={{ borderRadius:"20px", border:"1px solid rgba(199,146,234,0.2)", background:"rgba(199,146,234,0.04)", padding:"18px" }}>
              <h2 style={{ margin:"0 0 12px", fontSize:"15px", fontWeight:700, color:"#c792ea" }}>Current Step Explanation</h2>
              {currentInstr && !isHalted ? (
                <div>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px", marginBottom:"10px", flexWrap:"wrap" }}>
                    <span style={{
                      fontFamily:"'JetBrains Mono',monospace", fontSize:"11px", fontWeight:700,
                      color: OP_COLORS[currentInstr.op] || "#888",
                      background:`${OP_COLORS[currentInstr.op] || "#888"}18`,
                      border:`1px solid ${OP_COLORS[currentInstr.op] || "#888"}44`,
                      borderRadius:"6px", padding:"3px 8px",
                    }}>{currentInstr.op}</span>
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"12px", color:"#e2eeff" }}>
                      {currentInstr.code}
                    </span>
                  </div>
                  <p style={{ margin:0, fontSize:"13px", color:"#8899bb", lineHeight:"1.65" }}>
                    {explainInstruction(currentInstr, vrm)}
                  </p>
                </div>
              ) : (
                <p style={{ margin:0, fontSize:"13px", color:"#2a3a56", fontStyle:"italic" }}>
                  {isHalted ? "Program has finished execution." : "Press Step or Play to begin execution."}
                </p>
              )}
            </div>

          </div>
        </div>

        {/* ── Bottom grid: Output (L) + Timeline (R) ───────────── */}
        <div style={{ display:"grid", gridTemplateColumns:"0.75fr 1.25fr", gap:"14px" }}>

          {/* Program Output Panel — PanelWindow wrapper */}
          <div style={{ borderRadius:"20px", border:"1px solid rgba(255,255,255,0.08)", background:"rgba(0,0,0,0.65)", overflow:"hidden" }}>
            <PanelWindow title="Program Output" height={240}>
              <div style={{ display:"flex", justifyContent:"flex-end", padding:"8px 14px 0" }}>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"9px", color:"#06ffa5", letterSpacing:"1px" }}>STDOUT</span>
              </div>
              <OutputLines output={vrm.output} playing={playing} isHalted={isHalted} />
            </PanelWindow>
          </div>

          {/* Execution Timeline Panel — PanelWindow wrapper */}
          <div style={{ borderRadius:"20px", border:"1px solid rgba(255,255,255,0.08)", background:"rgba(10,16,32,0.95)", overflow:"hidden" }}>
            <PanelWindow title="Execution Timeline" height={260}>
              <div style={{ display:"flex", justifyContent:"flex-end", padding:"8px 14px 0" }}>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:"10px", color:"#3a4a6a" }}>
                  {history.length} step{history.length !== 1 ? "s" : ""}
                </span>
              </div>
              <TimelineEntries history={history} />
            </PanelWindow>
          </div>

        </div>

        {/* ── Execution Heatmap ────────────────────────────────── */}
        {Object.keys(execCount).length > 0 && (
          <ExecutionHeatmap instrs={instrs} execCount={execCount} />
        )}

      </div>
      )}

      {/* ── Live popup windows ─────────────────────────────────── */}
      <LivePanelWindow title="Assembly Instructions" open={liveAssembly} onClose={() => setLiveAssembly(false)}>
        <AsmList instrs={instrs} pc={pc} isHalted={isHalted} asmRef={null} />
      </LivePanelWindow>

      <LivePanelWindow title="Program Output" open={liveOutput} onClose={() => setLiveOutput(false)}>
        <OutputLines output={vrm.output} playing={playing} isHalted={isHalted} />
      </LivePanelWindow>

      <LivePanelWindow title="Execution Timeline" open={liveTimeline} onClose={() => setLiveTimeline(false)}>
        <TimelineEntries history={history} />
      </LivePanelWindow>

      <style>{`
        @keyframes rtpulse { 0%,100%{opacity:1} 50%{opacity:.35} }
        .rt-row:hover { background: rgba(255,255,255,0.025) !important; }
      `}</style>
    </div>
  );
}
