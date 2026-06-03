import { useEffect, useRef, useState } from "react";
import MetamicLogo from "./MetamicLogo";

export default function SplashScreen({ onDone }) {
  const overlayRef = useRef(null);
  const logoRef    = useRef(null);
  const tagRef     = useRef(null);

  useEffect(() => {
    const tl = [
      // Logo appears
      [100,  () => {
        logoRef.current.style.transition = "all 0.7s cubic-bezier(0.34,1.56,0.64,1)";
        logoRef.current.style.opacity    = "1";
        logoRef.current.style.transform  = "translate(-50%,-50%) scale(1)";
      }],
      // Tagline appears
      [900,  () => {
        tagRef.current.style.transition  = "all 0.6s ease";
        tagRef.current.style.opacity     = "1";
        tagRef.current.style.transform   = "translateY(0)";
      }],
      // Logo moves top-right, tagline fades
      [2900, () => {
        tagRef.current.style.transition  = "all 0.5s ease";
        tagRef.current.style.opacity     = "0";
        tagRef.current.style.transform   = "translateY(-20px)";
        logoRef.current.style.transition = "all 0.8s cubic-bezier(0.77,0,0.18,1)";
        logoRef.current.style.left       = "92px";
        logoRef.current.style.top        = "36px";
        logoRef.current.style.transform  = "translate(-50%,-50%) scale(0.14)";
      }],
      // Fade out overlay
      [3400, () => {
        overlayRef.current.style.transition = "opacity 0.5s ease";
        overlayRef.current.style.opacity    = "0";
      }],
      [3850, () => onDone()],
    ];

    const timers = tl.map(([delay, fn]) => setTimeout(fn, delay));
    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <div ref={overlayRef} style={{
      position:  "fixed", inset: 0, zIndex: 9999,
      background:"#050812",
      overflow:  "hidden",
    }}>
      {/* Particles */}
      <Particles />

      {/* Logo */}
      <div ref={logoRef} style={{
        position:  "absolute",
        left:      "50%", top: "50%",
        transform: "translate(-50%,-50%) scale(0)",
        opacity:   0,
        textAlign: "center",
      }}>
        <MetamicLogo size={320} />
        <div style={{
          fontFamily:    "'Space Grotesk',sans-serif",
          fontWeight:    700,
          fontSize:      "38px",
          color:         "#e2eeff",
          letterSpacing: "-1px",
          marginTop:     "8px",
        }}>
          metamic
        </div>
      </div>

      {/* Tagline */}
      <div ref={tagRef} style={{
        position:      "absolute",
        left:          "50%",
        top:           "calc(50% + 160px)",
        transform:     "translate(-50%, 20px)",
        opacity:       0,
        textAlign:     "center",
        fontFamily:    "'JetBrains Mono',monospace",
        fontSize:      "12px",
        letterSpacing: "3px",
        color:         "#5a6a8a",
        textTransform: "uppercase",
        whiteSpace:    "nowrap",
      }}>
        Transforming Code into Machine Logic
      </div>
    </div>
  );
}

function Particles() {
    const particles = useRef(
    Array.from({length:30}).map((_,i)=>({
    x:Math.random()*100,
    r:Math.random()*2+1,
    color:["#1a56db","#7c3aed","#06ffa5","#f97316"][i%4],
    duration:Math.random()*8+6,
    delay:Math.random()*5,
  }))  ).current;

  return (
    <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%", pointerEvents:"none" }}>
      <style>{`
        .sp { animation: spFloat linear infinite; opacity:0; }
        @keyframes spFloat {
          0%   { transform:translateY(100vh) scale(0); opacity:0; }
          10%  { opacity:0.6; }
          90%  { opacity:0.3; }
          100% { transform:translateY(-100px) scale(1); opacity:0; }
        }
      `}</style>
      {particles.map((_,i) => (
        <circle key={i} className="sp"
          cx={`${Math.random()*100}%`} cy="100%"
          r={Math.random()*2+1}
          fill={["#1a56db","#7c3aed","#06ffa5","#f97316"][i%4]}
          style={{
            animationDuration: `${Math.random()*8+6}s`,
            animationDelay:    `${Math.random()*5}s`,
          }}
        />
      ))}
    </svg>
  );
}