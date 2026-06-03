export default function MetamicLogoSmall() {
  return (
    <svg width="52" height="32" viewBox="0 0 320 200" style={{ overflow: "visible" }}>
      <defs>
        <filter id="nb-glr"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="nb-glb"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="nb-glg"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <style>{`
          .nb-o1{transform-origin:160px 90px;animation:nbO 10s linear infinite}
          .nb-o2{transform-origin:160px 90px;animation:nbO 7s linear infinite reverse}
          @keyframes nbO{to{transform:rotate(360deg)}}
          .nb-m{animation:nbP 2s ease-in-out infinite}
          @keyframes nbP{0%,100%{opacity:1}50%{opacity:.7}}
        `}</style>
      </defs>
      <path d="M 30,120 Q 160,0 290,120"   fill="none" stroke="#ff3333" strokeWidth="2.5" filter="url(#nb-glr)" opacity=".85"/>
      <path d="M 30,120 Q 100,40 160,88"   fill="none" stroke="#3399ff" strokeWidth="2"   filter="url(#nb-glb)" opacity=".85"/>
      <path d="M 290,120 Q 220,40 160,88"  fill="none" stroke="#00ccff" strokeWidth="2"   filter="url(#nb-glb)" opacity=".85"/>
      <g className="nb-o1">
        <circle cx="160" cy="90" r="38" fill="none" stroke="#4455ff" strokeWidth=".8" strokeDasharray="3 7" opacity=".5"/>
        <circle cx="198" cy="90" r="4" fill="#4455ff" opacity=".9"/>
      </g>
      <g className="nb-m">
        <circle cx="160" cy="90" r="26" fill="#070b1a" stroke="#4455ee" strokeWidth="2"/>
        <text x="160" y="97" textAnchor="middle"
          fontFamily="'Space Grotesk',sans-serif" fontWeight="700" fontSize="20" fill="#e2eeff">m</text>
      </g>
    </svg>
  );
}
