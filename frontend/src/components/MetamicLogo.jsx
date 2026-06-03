export default function MetamicLogo({ size = 320, small = false }) {
  const s = small ? 0.22 : 1;
  const w = 320 * s, h = 200 * s;

  return (
    <svg width={w} height={h} viewBox="0 0 320 200" style={{ overflow:"visible" }}>
      <defs>
        <style>{`
          .ml-arc-dot-r { animation: mlDot 3s linear infinite 0s; }
          .ml-arc-dot-b { animation: mlDot 3s linear infinite 1s; }
          .ml-arc-dot-c { animation: mlDotR 3s linear infinite 0.5s; }
          @keyframes mlDot  { 0%{offset-distance:0%;opacity:0} 8%{opacity:1} 92%{opacity:1} 100%{offset-distance:100%;opacity:0} }
          @keyframes mlDotR { 0%{offset-distance:100%;opacity:0} 8%{opacity:1} 92%{opacity:1} 100%{offset-distance:0%;opacity:0} }
          .ml-orbit1 { transform-origin:160px 90px; animation:mlOrbit 10s linear infinite; }
          .ml-orbit2 { transform-origin:160px 90px; animation:mlOrbit 7s linear infinite reverse; }
          @keyframes mlOrbit { to { transform:rotate(360deg); } }
          .ml-center { animation:mlPulse 2s ease-in-out infinite; }
          @keyframes mlPulse { 0%,100%{opacity:1} 50%{opacity:0.7} }
          .ml-n1{animation:mlNode 6s ease-in-out infinite 0s}
          .ml-n2{animation:mlNode 6s ease-in-out infinite 1s}
          .ml-n3{animation:mlNode 6s ease-in-out infinite 2s}
          .ml-n4{animation:mlNode 6s ease-in-out infinite 3s}
          @keyframes mlNode{0%,15%,100%{opacity:0.35}7%{opacity:1}}
          .ml-ast{animation:mlAst 4s ease-in-out infinite}
          @keyframes mlAst{0%,100%{opacity:0.25}50%{opacity:0.8}}
        `}</style>
        <filter id="ml-glow-r"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="ml-glow-b"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="ml-glow-g"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>

      {/* NFA arcs */}
      <path d="M 30,120 Q 160,0 290,120"  fill="none" stroke="#ff3333" strokeWidth="2.5" filter="url(#ml-glow-r)" opacity="0.85"/>
      <path d="M 30,120 Q 100,40 160,88"  fill="none" stroke="#3399ff" strokeWidth="2"   filter="url(#ml-glow-b)" opacity="0.85"/>
      <path d="M 290,120 Q 220,40 160,88" fill="none" stroke="#00ccff" strokeWidth="2"   filter="url(#ml-glow-b)" opacity="0.85"/>
      <path d="M 30,120 Q 160,180 290,120" fill="none" stroke="#00ff88" strokeWidth="1.5" filter="url(#ml-glow-g)" opacity="0.5"/>

      {/* Animated dots */}
      <circle r="4.5" fill="#ff3333" filter="url(#ml-glow-r)" className="ml-arc-dot-r"
        style={{offsetPath:"path('M 30,120 Q 160,0 290,120')"}}/>
      <circle r="3.5" fill="#3399ff" filter="url(#ml-glow-b)" className="ml-arc-dot-b"
        style={{offsetPath:"path('M 30,120 Q 100,40 160,88')"}}/>
      <circle r="3.5" fill="#00ccff" filter="url(#ml-glow-b)" className="ml-arc-dot-c"
        style={{offsetPath:"path('M 290,120 Q 220,40 160,88')"}}/>

      {/* Orbit rings */}
      <g className="ml-orbit1">
        <circle cx="160" cy="90" r="38" fill="none" stroke="#4455ff" strokeWidth="0.8" strokeDasharray="3 7" opacity="0.5"/>
        <circle cx="198" cy="90" r="4" fill="#4455ff" opacity="0.9"/>
      </g>
      <g className="ml-orbit2">
        <circle cx="160" cy="90" r="28" fill="none" stroke="#aa44ff" strokeWidth="0.7" strokeDasharray="2 5" opacity="0.4"/>
        <circle cx="188" cy="90" r="3" fill="#aa44ff" opacity="0.9"/>
      </g>

      {/* AST tree (right) */}
      <g className="ml-ast">
        <line x1="250" y1="55" x2="234" y2="80" stroke="#44ffaa" strokeWidth="1"/>
        <line x1="250" y1="55" x2="266" y2="80" stroke="#44ffaa" strokeWidth="1"/>
        <line x1="234" y1="80" x2="224" y2="103" stroke="#44ffaa" strokeWidth="1"/>
        <line x1="234" y1="80" x2="242" y2="103" stroke="#44ffaa" strokeWidth="1"/>
        <circle cx="250" cy="55"  r="4.5" fill="#44ffaa" opacity="0.9"/>
        <circle cx="234" cy="80"  r="3.5" fill="#44ffaa" opacity="0.7"/>
        <circle cx="266" cy="80"  r="3.5" fill="#44ffaa" opacity="0.7"/>
        <circle cx="224" cy="103" r="2.5" fill="#44ffaa" opacity="0.5"/>
        <circle cx="242" cy="103" r="2.5" fill="#44ffaa" opacity="0.5"/>
      </g>

      {/* NFA states (left) */}
      <circle cx="55"  cy="80"  r="7" fill="none" stroke="#ffaa44" strokeWidth="1.4" opacity="0.7"/>
      <circle cx="55"  cy="80"  r="3.5" fill="#ffaa44" opacity="0.6"/>
      <circle cx="82"  cy="65"  r="7" fill="none" stroke="#ffaa44" strokeWidth="1.3" opacity="0.6"/>
      <circle cx="108" cy="57"  r="7" fill="none" stroke="#ff6644" strokeWidth="1.2" opacity="0.5"/>
      <line x1="62" y1="80" x2="75" y2="68" stroke="#ffaa44" strokeWidth="0.9" opacity="0.5"/>
      <line x1="89" y1="65" x2="101" y2="60" stroke="#ffaa44" strokeWidth="0.9" opacity="0.4"/>

      {/* Center M circle */}
      <g className="ml-center">
        <circle cx="160" cy="90" r="26" fill="#070b1a" stroke="#4455ee" strokeWidth="2"/>
        <circle cx="160" cy="90" r="22" fill="none" stroke="#6677ff" strokeWidth="0.8" opacity="0.5"/>
        <text x="160" y="97" textAnchor="middle"
          fontFamily="'Space Grotesk',sans-serif" fontWeight="700" fontSize="20" fill="#e2eeff">
          m
        </text>
      </g>

      {/* Phase nodes */}
      {[
        { x:112, y:148, label:"lex",  color:"#4488ff", cls:"ml-n1" },
        { x:143, y:160, label:"ast",  color:"#aa44ff", cls:"ml-n2" },
        { x:177, y:160, label:"sem",  color:"#44aaff", cls:"ml-n3" },
        { x:208, y:148, label:"gen",  color:"#44ffaa", cls:"ml-n4" },
      ].map((n,i) => (
        <g key={i}>
          <circle cx={n.x} cy={n.y} r="15" fill="#070b1a"
            stroke={n.color} strokeWidth="1.4" opacity="0.9" className={n.cls}/>
          <text x={n.x} y={n.y+4} textAnchor="middle"
            fontFamily="'JetBrains Mono',monospace" fontSize="7" fontWeight="600" fill={n.color}>
            {n.label}
          </text>
          <line x1={n.x} y1={n.y-15} x2="160" y2="116"
            stroke={n.color} strokeWidth="0.7" opacity="0.25" strokeDasharray="3 3"/>
        </g>
      ))}
    </svg>
  );
}