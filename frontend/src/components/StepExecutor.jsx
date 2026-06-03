import { useState, useEffect, useRef, useMemo } from "react";
import PanelWindow from "./PanelWindow";
import LivePanelWindow from "./LivePanelWindow";

function createVRM() {
  return {
    registers: { R0:0, R1:0, R2:0, R3:0, R4:0, R5:0, R6:0, R7:0 },
    memory:{}, stack:[], call_stack:[], output:[], pc:0, halted:false, _cmpResult:0,
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
  const src1 = instr.src1|| instr.arg1   || "";
  const src2 = instr.src2|| instr.arg2   || "";

  function resolve(val) {
    if(!val||val==="—") return 0;
    val=String(val).trim();
    if(val.startsWith("#")) { const n=parseFloat(val.slice(1)); return isNaN(n)?0:n; }
    if(val.startsWith('"')&&val.endsWith('"')) return val.slice(1,-1);
    if(val==="\\n"||val==="\n") return "\n";
    if(val in s.registers) return s.registers[val];
    if(val.startsWith("MEM[")) { const idx=parseInt(val.slice(4,-1)); return s.memory[idx]??0; }
    const n=parseFloat(val); return isNaN(n)?val:n;
  }
  function setReg(name,value) { if(name in s.registers) s.registers[name]=value; }
  function memoryIndex(addr) {
    const raw = String(addr || "").trim();
    const match = raw.match(/^\[?MEM\[(\d+)\]\]?$/);
    return match ? parseInt(match[1], 10) : null;
  }

  switch(op) {
    case "MOV":  setReg(dst,resolve(src1)); break;
    case "LOAD": setReg(dst,resolve(src1)); break;
    case "STORE": {
      const idx = memoryIndex(dst);
      if (idx !== null) s.memory[idx] = resolve(src1);
      break;
    }
    case "ADD":  setReg(dst,resolve(src1)+resolve(src2)); break;
    case "SUB":  setReg(dst,resolve(src1)-resolve(src2)); break;
    case "MUL":  setReg(dst,resolve(src1)*resolve(src2)); break;
    case "DIV":{ const d=resolve(src2); setReg(dst,d!==0?Math.floor(resolve(src1)/d):0); break; }
    case "MOD":{ const d=resolve(src2); setReg(dst,d!==0?resolve(src1)%d:0); break; }
    case "NEG":  setReg(dst,-resolve(src1)); break;
    case "AND":  setReg(dst,resolve(src1)&resolve(src2)); break;
    case "OR":   setReg(dst,resolve(src1)|resolve(src2)); break;
    case "NOT":  setReg(dst,~resolve(src1)); break;
    case "XOR":  setReg(dst,resolve(src1)^resolve(src2)); break;
    case "PUSH": s.stack.push(resolve(dst||src1)); break;
    case "POP":  setReg(dst,s.stack.length>0?s.stack.pop():0); break;
    case "CMP":  s._cmpResult=resolve(src1)-resolve(src2); break;
    case "SETE": setReg(dst,s._cmpResult===0?1:0); break;
    case "SETNE":setReg(dst,s._cmpResult!==0?1:0); break;
    case "SETL": setReg(dst,s._cmpResult<0?1:0);   break;
    case "SETG": setReg(dst,s._cmpResult>0?1:0);   break;
    case "SETLE":setReg(dst,s._cmpResult<=0?1:0);  break;
    case "SETGE":setReg(dst,s._cmpResult>=0?1:0);  break;
    case "JMP":  return {state:s,jump:dst||src1};
    case "JZ":   if(s._cmpResult===0) return {state:s,jump:dst||src1}; break;
    case "JNZ":  if(s._cmpResult!==0) return {state:s,jump:dst||src1}; break;

    case "PRINT": {
      const raw = String(instr._printVal || dst || src1 || "").trim();

      if(!raw || raw === "—") break;

      // Newline — EXACT match only
      if(raw === "\\n" || raw === "\n") {
        s.output.push("↵");
        break;
      }

      // String literal — quotes hatao
      if((raw.startsWith('"') && raw.endsWith('"')) ||
        (raw.startsWith("'") && raw.endsWith("'"))) {
        s.output.push(raw.slice(1, -1));
        break;
      }

      // Register
      if(raw in s.registers) {
        s.output.push(String(s.registers[raw]));
        break;
      }

      // Immediate #42
      if(raw.startsWith("#")) {
        s.output.push(raw.slice(1));
        break;
      }

      s.output.push(raw);
      break;
    }

    case "READ": {
      const value = instr._inputValue !== undefined
        ? instr._inputValue
        : resolve(src1);
      setReg(dst, value);
      break;
    }
    case "CALL": {
      // push return address onto the call stack and jump to target
      s.call_stack.push(s.pc + 1);
      return {state:s, jump: dst || src1};
    }
    case "RET": {
      // return address is stored separately from data stack
      const ret = s.call_stack.length > 0 ? s.call_stack.pop() : null;
      if (ret === null || ret === undefined) {
        s.halted = true;
        return {state:s, jump: null};
      }
      return {state:s, jump: ret};
    }
    case "FUNC_BEGIN": case "FUNC_END": case "LABEL": case "NOP": case ";": break;
    default: break;
  }
  s.pc++;
  return {state:s,jump:null};
}

function parseInstruction(instr) {
  if (!instr) return {op:"NOP", dst:"", src1:"", src2:"", code:""};

  // code string se parse karo — har baar
  const line = (instr.code || "").trim();

  // PRINT special case
  if (instr.op === "PRINT" || line.toUpperCase().startsWith("PRINT ")) {
    const val = line.slice(6).trim() || instr.dst || instr.arg1 || "";
    return {...instr, op:"PRINT", dst:val, src1:val, arg1:val, _printVal:val, src2:""};
  }

  const rawOp = instr.op ? String(instr.op).toUpperCase() : "";

  // LABEL / FUNC_BEGIN / FUNC_END — prefer structured dst over the code string
  // (FUNC_BEGIN code is "section name\n    PUSH RBP..." which is wrong as a label name)
  if (line.endsWith(":") || rawOp === "LABEL" || rawOp === "FUNC_BEGIN" || rawOp === "FUNC_END") {
    const name = instr.dst || instr.result || line.replace(/:$/, "").trim() || "";
    return {...instr, op: rawOp || "LABEL", dst: name, result: name, src1:"", src2:""};
  }

  // Compiler-output objects already carry structured operands. Re-parsing the
  // display string breaks ops without a dst slot, such as CMP src1, src2.
  if (instr.op) {
    return {...instr, op: rawOp};
  }

  // Raw string instruction — parse from code text
  if (line) {
    const parts = line.replace(/,/g, "").split(/\s+/);
    const op = (parts[0] || "NOP").toUpperCase();
    if (op === "CMP") {
      return {...instr, op, dst:"", src1:parts[1] || "", src2:parts[2] || ""};
    }
    return {
      ...instr,
      op,
      dst:  parts[1] || "",
      src1: parts[2] || "",
      src2: parts[3] || "",
    };
  }

  // fallback
  const parts = (instr.code||"").replace(/,/g,"").split(/\s+/);
  return {
    ...instr,
    dst:  instr.dst  || parts[1] || "",
    src1: instr.src1 || parts[2] || "",
    src2: instr.src2 || parts[3] || "",
  };
}

const VRM_OPS = new Set([
  "MOV","LOAD","STORE","PUSH","POP",
  "ADD","SUB","MUL","DIV","MOD","NEG",
  "AND","OR","NOT","XOR","SHL","SHR",
  "CMP","SETE","SETNE","SETL","SETG","SETLE","SETGE",
  "JMP","JZ","JNZ","CALL","RET",
  "LABEL","FUNC_BEGIN","FUNC_END",
  "PRINT","READ","NOP","THROW","ALLOC","FREE",
]);

export default function StepExecutor({assembly}) {
  const [vrm,setVRM]=useState(createVRM());
  const vrmRef = useRef(vrm);
  const setVRMState = (v) => { vrmRef.current = v; setVRM(v); };
  const [pc,setPC]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [speed,setSpeed]=useState(800);
  const [history,setHistory]=useState([]);
  const [fullscreen,setFullscreen]=useState(false);
  const [outputFullscreen,setOutputFullscreen]=useState(false);
  const [livePanels,setLivePanels]=useState({});
  const [inputRequest,setInputRequest]=useState(null);
  const [inputValue,setInputValue]=useState("");
  const pcRef=useRef(0);
  const intervalRef=useRef(null);
  const codeRef=useRef(null);

  const instrs=useMemo(()=>{
    return (assembly||[])
      .map(i=>typeof i==="string"?{code:i}:i)
      .filter(i=>{
        // Always keep known VRM ops (FUNC_BEGIN code starts with "section" which
        // would otherwise be filtered out by the string check below)
        if (i.op && VRM_OPS.has(String(i.op).toUpperCase())) return true;
        const c=(i.code||"").trim();
        return c&&!c.startsWith(";")&&!c.startsWith("//")
          &&!c.startsWith("section")
          &&!c.toLowerCase().startsWith("target:")
          &&!c.toLowerCase().startsWith("registers:");
      })
      .map(parseInstruction);
  },[assembly]);

    const labelMap = useMemo(() => {
      const map = {};
      instrs.forEach((instr, i) => {
        if (instr.op === "LABEL" || instr.op === "FUNC_BEGIN") {
          // colon hata do label name se
          const name = (instr.dst || instr.result || "")
                        .replace(/:$/, "").trim();
          if (name) map[name] = i;
        }
      });
      return map;
    }, [instrs]);

  useEffect(()=>{pcRef.current=pc;},[pc]);

  useEffect(() => {
    clearInterval(intervalRef.current);
    // Start at main's entry point — labelMap is already recomputed before this effect runs
    const startPC = labelMap["main"] ?? 0;
    const initVRM = createVRM();
    initVRM.pc = startPC;
    setVRMState(initVRM);
    setPC(startPC);
    pcRef.current = startPC;
    setPlaying(false);
    setHistory([]);
  }, [instrs]); // eslint-disable-line react-hooks/exhaustive-deps

  function reset() {
    clearInterval(intervalRef.current);
    const startPC = labelMap["main"] ?? 0;
    const initVRM = createVRM();
    initVRM.pc = startPC;
    setVRMState(initVRM); setPC(startPC); pcRef.current = startPC;
    setPlaying(false); setHistory([]);
    setInputRequest(null); setInputValue("");
  }

  function parseInputValue(text) {
    const trimmed = String(text).trim();
    if (trimmed === "") return 0;
    if (/^-?\d+$/.test(trimmed)) return parseInt(trimmed, 10);
    if (/^-?\d*\.\d+$/.test(trimmed)) return parseFloat(trimmed);
    return trimmed;
  }

  function submitInput() {
    if (!inputRequest) return;
    const value = parseInputValue(inputValue);
    const instr = {...inputRequest.instr, _inputValue: value};
    const {state,jump} = executeInstruction(vrmRef.current, instr);
    let newPC = state.pc + 1;
    if (jump !== null && jump !== undefined) {
      if (typeof jump === "number") {
        newPC = jump;
      } else {
        const cleanJump = String(jump).replace(/:$/, "").trim();
        if (labelMap[cleanJump] !== undefined) newPC = labelMap[cleanJump];
        else if (/^\d+$/.test(cleanJump)) newPC = parseInt(cleanJump, 10);
      }
    }
    setHistory(prev=>[...prev.slice(-19),{pc:inputRequest.pc,instr:instr.op,code:instr.code||instr.op,regs:{...state.registers}}]);
    setVRMState(state);
    setPC(newPC);
    pcRef.current = newPC;
    setInputRequest(null);
    setInputValue("");
  }

  function stepOnce(currentPC,currentVRM) {
    if(currentVRM.halted||currentPC>=instrs.length)
      return {newPC:currentPC,newVRM:{...currentVRM,halted:true}};
    const instr=instrs[currentPC];
    if (instr.op === "READ") {
      return {newPC:currentPC,newVRM:currentVRM,needsInput:instr};
    }
    console.log("STEP",currentPC,instr.op,instr._printVal||instr.dst);
    const {state,jump}=executeInstruction(currentVRM,instr);
      let newPC = state.pc;
      if (jump !== null && jump !== undefined) {
        if (typeof jump === "number") {
          newPC = jump;
        } else {
          const cleanJump = String(jump).replace(/:$/, "").trim();
          if (labelMap[cleanJump] !== undefined) newPC = labelMap[cleanJump];
          else if (/^\d+$/.test(cleanJump)) newPC = parseInt(cleanJump, 10);
          else newPC = currentPC + 1; // label not found — fall through instead of looping
        }
      }
    setHistory(prev=>[...prev.slice(-19),{pc:currentPC,instr:instr.op,code:instr.code||instr.op,regs:{...state.registers}}]);
    return {newPC,newVRM:state};
  }

  function handleStep() {
    if (vrm.halted || pc >= instrs.length) return;
    const {newPC,newVRM,needsInput} = stepOnce(pc,vrm);
    if (needsInput) {
      setPlaying(false);
      setInputRequest({instr: needsInput, pc});
      return;
    }
    pcRef.current = newPC;
    setPC(newPC);
    setVRMState(newVRM);
    if (codeRef.current) {
      const rows = codeRef.current.querySelectorAll(".asm-row");
      if (rows[newPC]) rows[newPC].scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  function handlePlay() {
    if (!vrm.halted && pc < instrs.length) {
      pcRef.current = pc;
      setPlaying(true);
    }
  }
  function handlePause() {
    setPlaying(false);
    clearInterval(intervalRef.current);
  }

  useEffect(()=>{
    if(!playing){clearInterval(intervalRef.current);return;}
    intervalRef.current = setInterval(()=>{
      const current = vrmRef.current;
      if(!current || current.halted || pcRef.current>=instrs.length){
        clearInterval(intervalRef.current);
        setPlaying(false);
        return;
      }
      const currentPC = pcRef.current;
      const {newPC,newVRM,needsInput} = stepOnce(currentPC, current);
      if (needsInput) {
        clearInterval(intervalRef.current);
        setPlaying(false);
        setInputRequest({instr: needsInput, pc: currentPC});
        return;
      }
      pcRef.current = newPC; setPC(newPC);
      setVRMState(newVRM);
    },speed);
    return()=>clearInterval(intervalRef.current);
  },[playing,speed,instrs]);

  const REG_COLORS={R0:"#4d9fff",R1:"#c792ea",R2:"#c3e88d",R3:"#f78c6c",R4:"#ffcb6b",R5:"#89ddff",R6:"#f472b6",R7:"#06ffa5"};
  const OP_COLORS={"MOV":"#c792ea","LOAD":"#c792ea","STORE":"#c792ea","PUSH":"#89ddff","POP":"#89ddff","ADD":"#c3e88d","SUB":"#c3e88d","MUL":"#c3e88d","DIV":"#c3e88d","MOD":"#c3e88d","NEG":"#c3e88d","CMP":"#ffcb6b","SETE":"#ffcb6b","SETNE":"#ffcb6b","SETL":"#ffcb6b","SETG":"#ffcb6b","SETLE":"#ffcb6b","SETGE":"#ffcb6b","JMP":"#f78c6c","JZ":"#f78c6c","JNZ":"#f78c6c","CALL":"#22d3ee","RET":"#ff5370","PRINT":"#22d3ee","NOP":"#3a5070","FUNC_BEGIN":"#4d9fff","FUNC_END":"#4d9fff","LABEL":"#546e7a"};
  const isHalted=vrm.halted||pc>=instrs.length;
  const isWaitingInput=!!inputRequest;

    useEffect(()=>{
    function handleOpen(e){
      setLivePanels(prev=>({...prev,[e.detail.title]:true
    }));}
    window.addEventListener(
      "open-live-panel",
      handleOpen
    );
    return()=>{
      window.removeEventListener(
        "open-live-panel",
        handleOpen
      );
    };
  },[]);

  return ( <>
    <div style={{display:"flex",flexDirection:"column",gap:"14px",position:fullscreen?"fixed":"relative",inset:fullscreen?0:"auto",zIndex:fullscreen?9999:"auto",background:fullscreen?"#060910":"transparent",padding:fullscreen?"20px":"0",overflow:fullscreen?"auto":"visible"}}>

      <div className="phase-header">
        <span className="phase-title">Step-by-Step Execution</span>
        <span className="phase-badge">VRM Interpreter</span>
        <span className="phase-badge" style={{color:isHalted?"var(--red)":isWaitingInput?"var(--yellow)":playing?"var(--neon-green)":"var(--yellow)",borderColor:isHalted?"var(--red)":isWaitingInput?"var(--yellow)":playing?"var(--neon-green)":"var(--yellow)"}}>
          {isHalted?"HALTED":isWaitingInput?"WAITING INPUT":playing?"RUNNING":"PAUSED"}
        </span>
        <span className="phase-badge">PC: {pc}</span>
      </div>

      <div style={{display:"flex",alignItems:"center",gap:"8px",background:"var(--bg2)",border:"1px solid var(--border2)",borderRadius:"var(--radius-lg)",padding:"10px 14px",flexWrap:"wrap"}}>
        {[
          {label:"▶ Play", onClick:handlePlay,  disabled:playing||isHalted||isWaitingInput, color:"var(--neon-green)",bg:"rgba(6,255,165,0.1)"},
          {label:"⏸ Pause",onClick:handlePause, disabled:!playing,          color:"var(--yellow)",   bg:"rgba(251,191,36,0.1)"},
          {label:"→ Step", onClick:handleStep,  disabled:playing||isHalted||isWaitingInput, color:"var(--accent)",   bg:"rgba(77,159,255,0.1)"},
          {label:"↺ Reset",onClick:reset,       disabled:false,             color:"var(--red)",      bg:"rgba(255,83,112,0.1)"},
        ].map(btn=>(
          <button key={btn.label} onClick={btn.onClick} disabled={btn.disabled} style={{background:btn.disabled?"transparent":btn.bg,border:`1px solid ${btn.color}`,color:btn.disabled?"var(--text3)":btn.color,borderRadius:"var(--radius)",padding:"6px 16px",fontFamily:"var(--font-mono)",fontSize:"12px",fontWeight:700,cursor:btn.disabled?"not-allowed":"pointer",opacity:btn.disabled?0.5:1,transition:"all 0.15s"}}>{btn.label}</button>
        ))}
        <button onClick={()=>setFullscreen(f=>!f)} style={{background:"rgba(255,255,255,0.05)",border:"1px solid var(--border2)",color:"var(--text2)",borderRadius:"var(--radius)",padding:"6px 16px",fontFamily:"var(--font-mono)",fontSize:"12px",fontWeight:700,cursor:"pointer"}}>{fullscreen?"🗗 Exit":"🗖 Fullscreen"}</button>
        <div style={{display:"flex",alignItems:"center",gap:"8px",marginLeft:"auto"}}>
          <span style={{fontFamily:"var(--font-mono)",fontSize:"9px",color:"var(--text3)",letterSpacing:"1px"}}>SPEED</span>
          <input type="range" min="100" max="2000" step="100" value={2100-speed} onChange={e=>setSpeed(2100-parseInt(e.target.value))} style={{width:80,accentColor:"var(--accent)"}}/>
          <span style={{fontFamily:"var(--font-mono)",fontSize:"10px",color:"var(--accent)",minWidth:40}}>{Math.round(1000/speed*10)/10}/s</span>
        </div>
      </div>

      {isWaitingInput && (
        <div style={{display:"flex",alignItems:"center",gap:"10px",background:"rgba(255,255,255,0.05)",border:"1px solid var(--border2)",borderRadius:"var(--radius-lg)",padding:"12px 14px"}}>
          <div style={{fontFamily:"var(--font-mono)",fontSize:"11px",color:"var(--text3)",minWidth:110}}>
            Input needed for {inputRequest.instr.dst || inputRequest.instr.result}
          </div>
          <input
            value={inputValue}
            onChange={e=>setInputValue(e.target.value)}
            onKeyDown={e=>{ if(e.key==="Enter") submitInput(); }}
            placeholder="Enter value and press Enter"
            style={{flex:1,minWidth:160,padding:"8px 12px",borderRadius:"8px",border:"1px solid var(--border)",background:"var(--bg3)",color:"var(--text)",fontFamily:"var(--font-mono)",fontSize:"12px"}}
          />
          <button onClick={submitInput} style={{background:"var(--neon-green)",border:"none",borderRadius:"999px",color:"#020b13",padding:"8px 16px",fontFamily:"var(--font-mono)",fontWeight:700,cursor:"pointer"}}>
            Submit
          </button>
        </div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px"}}>
        <div style={{background:"var(--bg2)",border:"1px solid var(--border2)",borderRadius:"var(--radius-lg)",overflow:"hidden"}}>
          <div style={{padding:"8px 14px",background:"var(--bg3)",borderBottom:"1px solid var(--border)",fontFamily:"var(--font-mono)",fontSize:"9px",fontWeight:700,letterSpacing:"1.5px",color:"var(--text3)",textTransform:"uppercase"}}>Assembly Listing</div>
          <div ref={codeRef} style={{maxHeight:320,overflowY:"auto"}}>
            {instrs.map((instr,i)=>{
              const isCurrent=i===pc&&!isHalted;
              const isPast=i<pc;
              const opColor=OP_COLORS[instr.op]||"var(--text2)";
              return ( 
                <div key={i} className="asm-row" style={{display:"flex",alignItems:"center",gap:"8px",padding:"5px 12px",background:isCurrent?"rgba(0,212,255,0.12)":isPast?"rgba(6,255,165,0.03)":"transparent",borderLeft:isCurrent?"3px solid var(--neon-blue)":"3px solid transparent",transition:"background 0.2s"}}>
                  <span style={{fontFamily:"var(--font-mono)",fontSize:"10px",color:isCurrent?"var(--neon-blue)":"transparent",minWidth:12}}>▶</span>
                  <span style={{fontFamily:"var(--font-mono)",fontSize:"10px",color:"var(--text3)",minWidth:24,textAlign:"right"}}>{i+1}</span>
                  <span style={{fontFamily:"var(--font-mono)",fontSize:"9px",fontWeight:700,color:opColor,background:opColor+"18",border:`1px solid ${opColor}44`,borderRadius:"3px",padding:"1px 6px",minWidth:"52px",textAlign:"center",flexShrink:0}}>{instr.op}</span>
                  <span style={{fontFamily:"var(--font-mono)",fontSize:"11px",flex:1,color:isCurrent?"var(--text)":isPast?"var(--text3)":"var(--text2)"}}>{instr.code}</span>
                  {isCurrent&&<span style={{fontFamily:"var(--font-mono)",fontSize:"8px",color:"var(--neon-blue)",background:"rgba(0,212,255,0.1)",border:"1px solid rgba(0,212,255,0.3)",borderRadius:"3px",padding:"1px 6px",letterSpacing:"0.5px"}}>NEXT</span>}
                </div>
              );
            })}
          </div>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
          <div style={{background:"var(--bg2)",border:"1px solid var(--border2)",borderRadius:"var(--radius-lg)",overflow:"hidden"}}>
            <div style={{padding:"8px 14px",background:"var(--bg3)",borderBottom:"1px solid var(--border)",fontFamily:"var(--font-mono)",fontSize:"9px",fontWeight:700,letterSpacing:"1.5px",color:"var(--text3)",textTransform:"uppercase"}}>Registers</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"1px",background:"var(--border)"}}>
              {Object.entries(vrm.registers).map(([reg,val])=>(
                <div key={reg} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 12px",background:"var(--bg2)",transition:"background 0.2s"}}>
                  <span style={{fontFamily:"var(--font-mono)",fontSize:"11px",fontWeight:700,color:REG_COLORS[reg]}}>{reg}</span>
                  <span style={{fontFamily:"var(--font-mono)",fontSize:"12px",fontWeight:700,color:val!==0?"var(--text)":"var(--text3)",background:val!==0?"var(--bg3)":"transparent",padding:"1px 8px",borderRadius:"3px",minWidth:40,textAlign:"right",transition:"all 0.2s",transform:val!==0?"scale(1.04)":"scale(1)"}}>{val}</span>
                </div>
              ))}
            </div>
          </div>

      <PanelWindow
        title="Program Output"
        height={140}
      > <div style={{padding:"10px 14px"}}>
        {vrm.output.length===0
            ?<span style={{
              color:"var(--text3)",
              fontFamily:"var(--font-mono)",
              fontSize:"11px",
              fontStyle:"italic"
            }}>
              No output yet...
            </span>
            :vrm.output.map((line,i)=>(
              <div
                key={i}
                style={{
                  fontFamily:"var(--font-mono)",
                  fontSize:"12px",
                  color:line==="↵"
                    ?"var(--text3)"
                    :"var(--neon-green)",
                  padding:"1px 0",
                  display:"flex",
                  alignItems:"center",
                  gap:"6px"
                }}
              >
                <span style={{
                  color:"var(--text3)",
                  fontSize:"10px"
                }}>
                  ›
                </span>
                {line==="↵"
                  ?<span style={{
                    color:"var(--text3)",
                    fontSize:"10px"
                  }}>
                    [newline]
                  </span>
                  :line
                }
              </div>
            ))
          }
        </div>
      </PanelWindow>

          {vrm.stack.length>0&&(
            <div style={{background:"var(--bg2)",border:"1px solid var(--border2)",borderRadius:"var(--radius-lg)",overflow:"hidden"}}>
              <div style={{padding:"8px 14px",background:"var(--bg3)",borderBottom:"1px solid var(--border)",fontFamily:"var(--font-mono)",fontSize:"9px",fontWeight:700,letterSpacing:"1.5px",color:"var(--text3)",textTransform:"uppercase"}}>Stack ({vrm.stack.length})</div>
              <div style={{padding:"8px 14px"}}>
                {[...vrm.stack].reverse().map((val,i)=>(
                  <div key={i} style={{fontFamily:"var(--font-mono)",fontSize:"11px",color:i===0?"var(--neon-blue)":"var(--text2)",padding:"2px 0"}}>{i===0?"→ ":"  "}{val}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {history.length>0&&(
      <PanelWindow
        title="Execution History"
        height={120}
      >
        <div style={{
          padding:"4px 0"
        }}>

          {[...history].reverse().map((h,i)=>(

            <div
              key={i}
              style={{
                display:"flex",
                gap:"12px",
                padding:"3px 14px",
                fontFamily:"var(--font-mono)",
                fontSize:"10px",
                opacity:Math.max(0.3,1-i*0.05),
              }}
            >
              <span style={{
                color:"var(--text3)",
                minWidth:30
              }}>
                #{h.pc+1}
              </span>
              <span style={{
                color:"var(--text2)",
                flex:1
              }}>
                {h.code}
              </span>
              <span style={{
                color:"var(--neon-green)"
              }}>
                R0={h.regs.R0}
                {" "}
                R1={h.regs.R1}
                {" "}
                R2={h.regs.R2}
              </span>
            </div>
          ))}
        </div>
      </PanelWindow>
      )}
    </div>

    <LivePanelWindow
      title="Progam Output"
      open={livePanels["Program Output"]}
      onClose={()=>setLivePanels(prev=>({...prev,"Program Output":false}))}
    >

      <div style={{
        padding:"20px"
      }}>

        {vrm.output.map((line,i)=>(

          <div
            key={i}
            style={{
              padding:"6px 0",
              borderBottom:"1px solid rgba(255,255,255,0.05)",
              color:line==="↵"
                ?"gray"
                :"#06ffa5",
              fontFamily:"JetBrains Mono,monospace",
            }}
          >

            {line==="↵"
              ?"[newline]"
              :line
            }

          </div>

        ))}

      </div>

    </LivePanelWindow>

  <LivePanelWindow
  title="Exceution History"
  open={livePanels["Execution History"]}
    onClose={()=>setLivePanels(prev=>({...prev,"Execution History":false}))}
 >

  <div style={{
    padding:"20px"
  }}>

    {[...history].reverse().map((h,i)=>(

      <div
        key={i}
        style={{
          padding:"8px 0",
          borderBottom:"1px solid rgba(255,255,255,0.05)",
          fontFamily:"JetBrains Mono,monospace",
        }}
      >

        <div style={{
          color:"#06ffa5",
          fontSize:"11px",
          marginBottom:"4px"
        }}>
          #{h.pc+1}
        </div>

        <div style={{
          color:"#dbe7ff",
          fontSize:"12px"
        }}>
          {h.code}
        </div>

        <div style={{
          color:"#7f8ea3",
          fontSize:"10px",
          marginTop:"4px"
        }}>
          R0={h.regs.R0}
          {" "}
          R1={h.regs.R1}
          {" "}
          R2={h.regs.R2}
        </div>

      </div>

    ))}

  </div>

</LivePanelWindow>

</>

  );
}
