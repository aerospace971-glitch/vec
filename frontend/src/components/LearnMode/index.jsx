// src/components/LearnMode/index.jsx
import React, { useEffect, useState } from "react";
import { PHASE_COLORS } from "./shared/PhaseColors";
import PHASE_DATA from "./LearnModeData";
import TabBar from "./shared/TabBar";

// phase components
import LexerTheory from "./phases/lexer/Theory";
import LexerConcepts from "./phases/lexer/Concepts";
import LexerDescription from "./phases/lexer/Description";
import LexerInteractive from "./phases/lexer/Interactive";

import ParserTheory from "./phases/parser/Theory";
import ParserConcepts from "./phases/parser/Concepts";
import ParserDescription from "./phases/parser/Description";
import ParserInteractive from "./phases/parser/Interactive";

import SemanticTheory from "./phases/semantic/Theory";
import SemanticConcepts from "./phases/semantic/Concepts";
import SemanticDescription from "./phases/semantic/Description";
import SemanticInteractive from "./phases/semantic/Interactive";

import IrTheory from "./phases/ir/Theory";
import IrConcepts from "./phases/ir/Concepts";
import IrDescription from "./phases/ir/Description";
import IrInteractive from "./phases/ir/Interactive";

import OptTheory from "./phases/optimizer/Theory";
import OptConcepts from "./phases/optimizer/Concepts";
import OptDescription from "./phases/optimizer/Description";
import OptInteractive from "./phases/optimizer/Interactive";

import CodegenTheory from "./phases/codegen/Theory";
import CodegenConcepts from "./phases/codegen/Concepts";
import CodegenDescription from "./phases/codegen/Description";
import CodegenInteractive from "./phases/codegen/Interactive";

const PHASE_COMPONENTS = {
  lex: {
    theory: LexerTheory,
    concepts: LexerConcepts,
    description: LexerDescription,
    interactive: LexerInteractive,
  },
  parse: {
    theory: ParserTheory,
    concepts: ParserConcepts,
    description: ParserDescription,
    interactive: ParserInteractive,
  },
  semantic: {
    theory: SemanticTheory,
    concepts: SemanticConcepts,
    description: SemanticDescription,
    interactive: SemanticInteractive,
  },
  ir: {
    theory: IrTheory,
    concepts: IrConcepts,
    description: IrDescription,
    interactive: IrInteractive,
  },
  opt: {
    theory: OptTheory,
    concepts: OptConcepts,
    description: OptDescription,
    interactive: OptInteractive,
  },
  codegen: {
    theory: CodegenTheory,
    concepts: CodegenConcepts,
    description: CodegenDescription,
    interactive: CodegenInteractive,
  },
};

export default function LearnMode({ phase = "lex", onClose, onNavigate, tokens = [], sourceCode = "", astData = null, symbols = [], scopes = [], irInstructions = [], beforeInstructions = [], afterInstructions = [], optimizations = [], asmInstructions = [] }) {
  const [phaseState, setPhaseState] = useState({ propPhase: phase, currentPhase: phase });
  const currentPhase = phaseState.propPhase === phase ? phaseState.currentPhase : phase;
  const [tabState, setTabState] = useState({ phase: currentPhase, tab: "Theory" });
  const activeTab = tabState.phase === currentPhase ? tabState.tab : "Theory";

  useEffect(() => {
    const overlay = document.querySelector(".learn-overlay");
    overlay?.scrollTo({ top: 0, behavior: "smooth" });
  }, [activeTab, currentPhase]);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
      if (e.key === "ArrowRight") {
        const tabs = PHASE_DATA[currentPhase].tabs;
        const idx = tabs.indexOf(activeTab);
        setTabState({ phase: currentPhase, tab: tabs[(idx + 1) % tabs.length] });
      }
      if (e.key === "ArrowLeft") {
        const tabs = PHASE_DATA[currentPhase].tabs;
        const idx = tabs.indexOf(activeTab);
        setTabState({ phase: currentPhase, tab: tabs[(idx - 1 + tabs.length) % tabs.length] });
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentPhase, activeTab, onClose]);

  const phaseInfo = PHASE_DATA[currentPhase] || PHASE_DATA.lex;
  const phaseColor = PHASE_COLORS[currentPhase] || "#3b82f6";
  const ActiveComp = PHASE_COMPONENTS[currentPhase][activeTab.toLowerCase()];

  return (
    <div className="learn-overlay" style={{ position: "fixed", inset: 0, zIndex: 12000, background: "#111827", color: "#cbd5e1", fontFamily: "system-ui", overflow: "auto", height: "100vh", scrollbarWidth: "thin", scrollbarColor: "#2a3a55 transparent" }}>
      <style>{`
        .learn-overlay::-webkit-scrollbar { width: 8px; }
        .learn-overlay::-webkit-scrollbar-thumb { background: #2a3a55; border-radius: 999px; }
        .learn-overlay::-webkit-scrollbar-track { background: transparent; }
      `}</style>
      <div style={{ width: "100vw", minHeight: "100vh", height: "auto" }}>
        <main style={{ minWidth: 0, display: "flex", flexDirection: "column", background: "#111827", overflow: "visible", height: "auto" }}>
          <header style={{ minHeight: 108, borderBottom: "1px solid #2a3a55", display: "grid", gridTemplateColumns: "4px 1fr 42px", gridTemplateRows: "60px 48px", position: "sticky", top: 0, zIndex: 10, background: "#111827" }}>
            <div style={{ gridRow: "1 / span 2", background: phaseColor }} />
            <div style={{ padding: "10px 18px" }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, color: phaseColor }}>Phase - {phaseInfo.label}</div>
              <h1 style={{ margin: "3px 0 0", color: "#f1f5f9", fontSize: 18 }}>{phaseInfo.title}</h1>
              <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}></p>
            </div>
            <button onClick={() => onClose?.()} style={{ margin: 10, width: 32, height: 32, border: "1px solid #2a3a55", background: "transparent", color: "#94a3b8", borderRadius: 8 }}>x</button>
            <div style={{ gridColumn: "2 / span 2", display: "flex", alignItems: "center", gap: 8, padding: "0 18px" }}>
              <TabBar tabs={phaseInfo.tabs} activeTab={activeTab} onTabChange={(tab) => setTabState({ phase: currentPhase, tab })} phaseColor={phaseColor} />
            </div>
          </header>
          <section style={{ overflow: "visible", padding: 24, height: "auto" }}>
            <ActiveComp
              phaseColor={phaseColor}
              data={phaseInfo}
              onNavigate={(p) => { setPhaseState({ propPhase: phase, currentPhase: p }); setTabState({ phase: p, tab: "Theory" }); onNavigate?.(p); }}
              tokens={tokens}
              sourceCode={sourceCode}
              astData={astData}
              symbols={symbols}
              scopes={scopes}
              irInstructions={irInstructions}
              beforeInstructions={beforeInstructions}
              afterInstructions={afterInstructions}
              optimizations={optimizations}
              asmInstructions={asmInstructions}
            />
          </section>
        </main>
      </div>
    </div>
  );
}
