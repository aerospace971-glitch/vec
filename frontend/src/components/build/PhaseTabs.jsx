 {/* Phase selector */}
 import PhaseCard from "./PhaseCard";
 export default function PhaseTabs({
    phases,
    activePhase,
    selectPhase,
 })  {
   return (
      <div style={{
        display:     "flex",
        gap:         "8px",
        padding:     "12px 20px",
        background:  "rgba(4,3,15,0.8)",
        borderBottom:"1px solid rgba(255,255,255,0.05)",
        flexShrink:  0,
        overflowX:   "auto",
        scrollbarWidth:"none",
      }}>
        {phases.map((p, i) => (
          <PhaseCard
            key={p.id}
            phase={p}
            isActive={activePhase === i}
            onClick={() => selectPhase(i)}
          />
        ))}
      </div>
   );
 }