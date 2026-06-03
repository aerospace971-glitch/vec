import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import useAuthStore from "../store/authStore";
import AutoTyper   from "../components/AutoTyper";
import PhaseSlider from "../components/PhaseSlider";
import MetamicLogo from "../components/MetamicLogo";

// ── Simple Hello World typer ───────────────────────────────
function HelloWorldTyper() {
  const code = `#include <iostream>
using namespace std;

int main() {
    cout << "Hello, World!" << endl;
    return 0;
}`;

const [displayed, setDisplayed] = useState("");
const [charIdx, setCharIdx] = useState(0);
const [isDeleting, setIsDeleting] = useState(false);

useEffect(() => {

  let timeout;

  // TYPING
  if (!isDeleting) {

    if (charIdx <= code.length) {
      timeout = setTimeout(() => {
        setDisplayed(code.substring(0, charIdx));
        setCharIdx(prev => prev + 1);
      }, 35);
    }

    // typing complete
    else {
      timeout = setTimeout(() => {
        setIsDeleting(true);
        setCharIdx(code.length);
      }, 1400);
    }
  }

  // DELETING
  else {

    if (charIdx >= 0) {
      timeout = setTimeout(() => {
        setDisplayed(code.substring(0, charIdx));
        setCharIdx(prev => prev - 1);
      }, 18);
    }

    // reset cleanly
    else {
      setDisplayed("");
      setIsDeleting(false);
      setCharIdx(0);
    }
  }

  return () => clearTimeout(timeout);

}, [charIdx, isDeleting, code]);

function highlight(code) {
  const escapeHtml = (str) =>
    str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

  code = escapeHtml(code);

  // strings first
  code = code.replace(
    /(".*?")/g,
    '<span style="color:#c3e88d;">$1</span>'
  );

  // numbers
  code = code.replace(
    /\b(\d+)\b/g,
    '<span style="color:#f78c6c;">$1</span>'
  );

  // keywords
  code = code.replace(
    /\b(int|float|double|char|bool|void|string|return|using|namespace|include)\b/g,
    '<span style="color:#c792ea;font-weight:600;">$1</span>'
  );

  // functions and std
  code = code.replace(
    /\b(main|cout|cin|endl|std)\b/g,
    '<span style="color:#82aaff;">$1</span>'
  );

  return code;
}

  const lines = displayed.split("\n");

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "760px",
        height: "360px",
        background: "rgba(10,12,28,0.78)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: "24px",
        overflow: "hidden",
        backdropFilter: "blur(24px)",
        WebkitBackdropFilter: "blur(24px)",
        boxShadow: "0 30px 90px rgba(0,0,0,0.55)",
      }}
    >
      {/* Window bar */}
      <div
        style={{
          background: "rgba(255,255,255,0.02)",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}
      >
        <span
          style={{
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: 11,
            color: "#3a5070",
          }}
        >
          hello_world.cpp
        </span>

        <span
          style={{
            marginLeft: "auto",
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: "10px",
            letterSpacing: "1px",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.35)",
          }}
        >
          input source
        </span>
      </div>

      {/* Code */}
      <div
        style={{
          display: "flex",
          minHeight: "240px",
        }}
      >
        {/* Line numbers */}
        <div
          style={{
            padding: "18px 0",
            minWidth: "52px",
            textAlign: "right",
            background: "rgba(255,255,255,0.015)",
            borderRight: "1px solid rgba(255,255,255,0.04)",
            userSelect: "none",
          }}
        >
          {lines.map((_, i) => (
            <div
              key={i}
              style={{
                height: "24px",
                lineHeight: "24px",
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 12,
                color: "#2a3a5a",
                paddingRight: 12,
              }}
            >
              {i + 1}
            </div>
          ))}
        </div>

        {/* Code text */}
        <div
          style={{
            padding: "18px 22px",
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: 14,
            lineHeight: "24px",
            color: "#c9d8f0",
            flex: 1,
            whiteSpace: "pre-wrap",
            overflowX: "hidden",
          }}
        >
          <span
            dangerouslySetInnerHTML={{
              __html: highlight(displayed)
            }}
          />

          {(
            <span
              style={{
                display: "inline-block",
                width: 2,
                height: 16,
                background: "#ffffff",
                verticalAlign: "middle",
                marginLeft: 2,
                animation: "blink 1s step-start infinite",
              }}
            />
          )}
        </div>
      </div>

      <style>{`
        @keyframes blink {
          0%,100% { opacity:1 }
          50% { opacity:0 }
        }
      `}</style>
    </div>
  );
}

// Using shared MetamicLogo component (in ../components/MetamicLogo)

// ── Splash Screen ──────────────────────────────────────────
function SplashScreen({onDone}) {
  const logoRef    = useRef(null);
  const tagRef     = useRef(null);
  const overlayRef = useRef(null);

  useEffect(()=>{
    const logo    = logoRef.current;
    const tag     = tagRef.current;
    const overlay = overlayRef.current;
    if(!logo||!tag||!overlay) return;

    // Start: center, invisible, scaled down
    logo.style.cssText = `
      position:absolute;left:50%;top:50%;
      transform:translate(-50%,-50%) scale(0) rotate(-90deg);
      opacity:0;transition:none;
    `;

    const tl = [
      // Logo explodes in center
      [100, ()=>{
        logo.style.transition="all 0.7s cubic-bezier(0.34,1.56,0.64,1)";
        logo.style.transform="translate(-50%,-50%) scale(1.05) rotate(5deg)";
        logo.style.opacity="1";
      }],
      // Settle
      [800, ()=>{
        logo.style.transition="all 0.3s ease";
        logo.style.transform="translate(-50%,-50%) scale(1) rotate(0deg)";
      }],
      // Tagline appears
      [1100, ()=>{
        tag.style.transition="all 0.6s ease";
        tag.style.opacity="1";
        tag.style.transform="translate(-50%,0) translateY(0)";
      }],
      // Hold 2s then tagline fades
      [3200, ()=>{
        tag.style.transition="all 0.4s ease";
        tag.style.opacity="0";
        tag.style.transform="translate(-50%,0) translateY(-15px)";
      }],
      // Logo flies to top-left
      [3700, ()=>{
        logo.style.transition="all 0.6s cubic-bezier(0.77,0,0.18,1)";
        logo.style.left="70px";
        logo.style.top="36px";
        logo.style.transform="translate(-50%,-50%) scale(0.18)";
      }],
      // Fade overlay
      [4400, ()=>{
        overlay.style.transition="opacity 0.5s ease";
        overlay.style.opacity="0";
      }],
      [4900, ()=>onDone()],
    ];

    const timers = tl.map(([d,fn])=>setTimeout(fn,d));
    return ()=>timers.forEach(clearTimeout);
  },[]);

  return (
    <div ref={overlayRef} style={{
      position:"fixed",inset:0,zIndex:9999,
      background:"#050812",overflow:"hidden",
    }}>
      {/* Floating particles */}
      <svg style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}}>
        <style>{`
          .sp{animation:spf linear infinite;opacity:0;}
          @keyframes spf{0%{transform:translateY(100vh) scale(0);opacity:0}
            10%{opacity:.6}90%{opacity:.2}100%{transform:translateY(-80px) scale(1);opacity:0}}
        `}</style>
        {Array.from({length:25}).map((_,i)=>(
          <circle key={i} className="sp"
            cx={`${10+Math.random()*80}%`} cy="100%" r={Math.random()*2+1}
            fill={["#1a56db","#7c3aed","#06ffa5","#f97316"][i%4]}
            style={{animationDuration:`${8+Math.random()*8}s`,animationDelay:`${Math.random()*4}s`}}/>
        ))}
      </svg>

      {/* Logo */}
      <div ref={logoRef} style={{position:"absolute"}}>
        <MetamicLogo/>
        <div style={{
          fontFamily:"'Space Grotesk',sans-serif",
          fontWeight:700,fontSize:"36px",
          color:"#e2eeff",letterSpacing:"-1px",
          textAlign:"center",marginTop:"6px",
        }}>metamic</div>
      </div>

      {/* Tagline */}
      <div ref={tagRef} style={{
        position:"absolute",
        left:"50%",top:"calc(50% + 155px)",
        transform:"translate(-50%,20px)",
        opacity:0,
        fontFamily:"'JetBrains Mono',monospace",
        fontSize:"11px",letterSpacing:"3px",
        color:"#4a6080",textTransform:"uppercase",
        whiteSpace:"nowrap",
      }}>
        Transforming Code into Machine Logic
      </div>
    </div>
  );
}

// ── UserAvatar ─────────────────────────────────────────────
function UserAvatar({ user, size = 36 }) {
  const initials = [user?.first_name?.[0], user?.last_name?.[0]]
    .filter(Boolean).join("").toUpperCase() || user?.username?.[0]?.toUpperCase() || "U";
  if (user?.avatar) {
    return (
      <img src={user.avatar} alt="avatar" style={{
        width: size, height: size, borderRadius: "50%",
        objectFit: "cover", flexShrink: 0,
        border: "1.5px solid rgba(255,255,255,0.2)",
      }} />
    );
  }
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
      color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: `${Math.round(size * 0.38)}px`, fontWeight: 700,
      fontFamily: "'Space Grotesk',sans-serif", flexShrink: 0,
      border: "1.5px solid rgba(255,255,255,0.15)",
    }}>
      {initials}
    </div>
  );
}

// ── Main Landing Page ──────────────────────────────────────
export default function LandingPage() {
  const navigate   = useNavigate();
  const user       = useAuthStore((state) => state.user);
  const clearAuth  = useAuthStore((state) => state.clearAuth);
  const [splashDone, setSplashDone] = useState(false);
  const [mounted,    setMounted]    = useState(false);

  useEffect(()=>{
    if(splashDone) setTimeout(()=>setMounted(true),80);
  },[splashDone]);

  if(!splashDone) return <SplashScreen onDone={()=>setSplashDone(true)}/>;

  return (
    <div style={{
      height:"100vh",
      background:"#04030f",
      color:"#e2eeff",
      fontFamily:"'Space Grotesk',sans-serif",
      overflowX:"hidden",
      overflowY:"auto",
      display:"flex",
      flexDirection:"column",
      position:"relative",
    }}>

      {/* Grid BG */}
      <div style={{
        position:"absolute",inset:0,pointerEvents:"none",
        backgroundImage:`linear-gradient(rgba(26,86,219,0.03) 1px,transparent 1px),
          linear-gradient(90deg,rgba(26,86,219,0.03) 1px,transparent 1px)`,
        backgroundSize:"44px 44px",
      }}/>

      {/* Glow orbs */}
        <div style={{
          position:"absolute",
          top:"-10%",
          left:"-5%",
          width:"700px",
          height:"700px",
          borderRadius:"50%",
          background:"radial-gradient(circle,rgba(80,80,255,0.12),transparent 70%)",
          filter:"blur(80px)",
          pointerEvents:"none",
        }}/>

        <div style={{
          position:"absolute",
          bottom:"-20%",
          right:"-10%",
          width:"650px",
          height:"650px",
          borderRadius:"50%",
          background:"radial-gradient(circle,rgba(255,80,120,0.08),transparent 70%)",
          filter:"blur(90px)",
          pointerEvents:"none",
        }}/>
      {/* ── NAVBAR ── */}
      <nav style={{
        display:"flex",alignItems:"center",justifyContent:"space-between",
        padding:"0 54px",height:"78px",flexShrink:0,
        background:"rgba(5,8,18,0.8)",backdropFilter:"blur(16px)",
        borderBottom:"1px solid rgba(26,86,219,0.1)",
        position:"relative",zIndex:10,
      }}>
        {/* Logo small — top LEFT */}
        <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
          <MetamicLogo small={true}/>
          <span style={{
            fontFamily:"'Space Grotesk',sans-serif",
            fontWeight:700,fontSize:"26px",letterSpacing:"-0.5px",
          }}>metamic</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {!user ? (
            <button onClick={() => navigate("/signin")} style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#ffffff",
              borderRadius: "999px",
              padding: "12px 28px",
              fontSize: "15px",
              fontWeight: 600,
              backdropFilter: "blur(12px)",
              cursor: "pointer", transition: "all 0.2s",
            }} onMouseEnter={e=>{e.currentTarget.style.background="#1a56db22";}} onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.03)";}}>
              Login
            </button>
          ) : (
            <>
              <UserAvatar user={user} size={36} />
              <button onClick={() => navigate("/dashboard")} style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#e2eeff",
                borderRadius: "999px",
                padding: "10px 22px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer", transition: "all 0.2s",
              }} onMouseEnter={e=>{e.currentTarget.style.background="rgba(255,255,255,0.08)";}} onMouseLeave={e=>{e.currentTarget.style.background="rgba(255,255,255,0.04)";}}>
                Dashboard
              </button>
              <button onClick={() => { clearAuth(); navigate("/"); }} style={{
                background: "rgba(249,115,22,0.08)",
                border: "1px solid rgba(249,115,22,0.4)",
                color: "#fbbf24",
                borderRadius: "999px",
                padding: "10px 22px",
                fontSize: "14px",
                fontWeight: 600,
                cursor: "pointer", transition: "all 0.2s",
              }} onMouseEnter={e=>{e.currentTarget.style.background="rgba(249,115,22,0.16)";}} onMouseLeave={e=>{e.currentTarget.style.background="rgba(249,115,22,0.08)";}}>
                Logout
              </button>
            </>
          )}
        </div>
      </nav>

      {/* ── HERO (flex: fills remaining height) ── */}
      <div style={{
        flex:1,
        display:"grid",
        gridTemplateColumns:"1.1fr 0.9fr",
        gap:"20px",
        minHeight:"420px",
        maxWidth:"15000px",
        width:"100%",
        margin:"0 auto",
        padding:"0 40px",
        alignItems:"start",
        paddingTop:"10px",
        position:"relative",zIndex:1,
      }}>

        {/* LEFT — Text + button */}
        <div style={{
          maxWidth:"760",
          opacity:   mounted?1:0,
          transform: mounted?"translateY(0)":"translateY(28px)",
          transition:"all 0.8s cubic-bezier(0.22,1,0.36,1)",
        }}>
          {/* Badge */}
          <div style={{
            display:"inline-flex",alignItems:"center",gap:"7px",
            background:"rgba(26,86,219,0.08)",
            border:"1px solid rgba(26,86,219,0.22)",
            borderRadius:"20px",padding:"4px 13px",marginBottom:"20px",
          }}>
            <div style={{width:6,height:6,borderRadius:"50%",background:"#4d9fff",
              boxShadow:"0 0 6px #4d9fff",animation:"pulse 2s ease-in-out infinite"}}/>
            <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:"10px",
              color:"#4d9fff",letterSpacing:"1px"}}>Visual Educational Compiler</span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily:"'Space Grotesk',sans-serif",
            fontSize:"clamp(72px,7vw,110px)",
            fontWeight:800,
            letterSpacing:"-4px",
            lineHeight:0.95,
            marginBottom:"24px",
            color:"#ffffff",
          }}>
            Transform Code<br/>
            into{" "}
            <span style={{
              background:"linear-gradient(90deg,#ffb347,#ff8c00)",
              WebkitBackgroundClip:"text",
              WebkitTextFillColor:"transparent",
            }}>
              Machine
            </span>
            <br/>
            <span style={{
            background:"linear-gradient(90deg,#ff3b3b,#ff1f5a)",
            WebkitBackgroundClip:"text",
            WebkitTextFillColor:"transparent",
          }}>
            Logic
          </span>
          </h1>

          <p style={{
            fontSize:"15px",color:"#4a6080",
            lineHeight:1.7,marginBottom:"32px",
            maxWidth:"400px",
          }}>
            Watch every compiler phase come alive — from source
            tokens to final assembly, all animated and interactive.
          </p>

          {/* CENTER — Let's Compile button */}
            <div style={{display:"flex",alignItems:"center", gap:"18px", flexWrap:"wrap" }}>

              {/* COMPILE */}
              <button
                onClick={()=>navigate("/app")}
                style={{
                  background:"linear-gradient(135deg,#ff6b2d,#ff8f3f)",
                  border:"1px solid rgba(255,255,255,0.08)",
                  color:"#fff",
                  borderRadius:"999px",
                  padding:"16px 34px",
                  fontSize:"16px",
                  fontWeight:700,
                  boxShadow:"0 10px 40px rgba(255,120,40,0.25)",
                  transition:"all 0.2s",
                  letterSpacing:"-0.3px",
                  display:"flex",
                  alignItems:"center",
                  gap:"8px",
                }}
                onMouseEnter={e=>{
                  e.currentTarget.style.transform="scale(1.04)";
                }}
                onMouseLeave={e=>{
                  e.currentTarget.style.transform="scale(1)";
                }}
              >
                🚀 Let's Compile
              </button>

              {/* BUILD */}
              <button
                onClick={()=>navigate("/build")}
                style={{
                  background:"linear-gradient(135deg,#ff2d55,#ff4d6d)",
                  border:"1px solid rgba(255, 255, 255, 0.1)",
                  color:"#dbe7ff",
                  borderRadius:"999px",
                  padding:"16px 34px",
                  fontSize:"16px",
                  fontWeight:700,
                  boxShadow:"0 10px 40px rgba(0, 0, 0, 0.7)",
                  transition:"all 0.22s",
                  letterSpacing:"-0.3px",
                  display:"flex",
                  alignItems:"center",
                  gap:"8px",
                }}
                onMouseEnter={e=>{
                  e.currentTarget.style.transform="translateX(5px)";
                }}
                onMouseLeave={e=>{
                  e.currentTarget.style.transform="translateX(0px)";
                }}
              >
                🛠️ Let's Build
              </button>

            </div>

         </div> 

        {/* RIGHT — Hello World code */}
        <div style={{
          opacity:   mounted?1:0,
          transform: mounted?"translateY(0)":"translateY(28px)",
          transition:"all 0.8s cubic-bezier(0.22,1,0.36,1) 0.12s",
          display:"flex",justifyContent:"center",
        }}>
          <HelloWorldTyper/>
        </div>
      </div>

      {/* ── PHASE SHOWCASE ── */}
      <PhaseSlider />

      {/* Built with strip */}
      <div style={{
        borderTop:"1px solid #080c1e",
        padding:"10px 40px",
        display:"flex",alignItems:"center",gap:"24px",
        background:"rgba(5,8,18,0.9)",
        flexShrink:0,position:"relative",zIndex:1,
      }}>
        <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:"9px",
          color:"#1e2d42",letterSpacing:"2px",textTransform:"uppercase"}}>Built with</span>
        {["C++","Python Flask","React","D3.js","University of Delhi"].map(t=>(
          <span key={t} style={{fontFamily:"'JetBrains Mono',monospace",
            fontSize:"10px",color:"#2a3a50"}}>{t}</span>
        ))}
      </div>

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');
      `}</style>
    </div>
  );
}