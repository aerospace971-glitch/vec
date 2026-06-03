import { useNavigate, useLocation } from "react-router-dom";
import { useRef, useEffect } from "react";
import useAuthStore from "../store/authStore";
import MetamicLogo from "./MetamicLogo";

const TABS = [
  { label:"Compiler", path:"/app",       color:"#e2eeff" },
  { label:"Lexer",    path:"/lexer",     color:"#4488ff" },
  { label:"Parser",   path:"/parser",    color:"#aa44ff" },
  { label:"Semantic", path:"/semantic",  color:"#44aaff" },
  { label:"IR Gen",   path:"/ir",        color:"#44ffaa" },
  { label:"Optimizer",path:"/optimizer", color:"#ffaa44" },
  { label:"CodeGen",  path:"/codegen",   color:"#ff4488" },
  { label:"Runtime",  path:"/runtime",   color:"#ff6b35" },
  { label:"Let's Build",path:"/build",  color:"#f97316" },
];

function UserAvatar({ user, size = 30 }) {
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


export default function Navbar() {
  const navigate    = useNavigate();
  const location    = useLocation();
  const user        = useAuthStore((state) => state.user);
  const clearAuth   = useAuthStore((state) => state.clearAuth);
  const activeTabRef = useRef(null);

  useEffect(() => {
    if (activeTabRef.current) {
      activeTabRef.current.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    }
  }, [location.pathname]);

  return (
    <nav style={{
      display:      "flex",
      alignItems:   "center",
      height:       "52px",
      background:   "#04030f",
      borderBottom: "1px solid rgba(255,255,255,0.06)",
      flexShrink:   0,
      position:     "sticky",
      top:          0,
      zIndex:       11000,
      pointerEvents: "auto",
      paddingLeft:  "20px",
      overflowX:    "auto",
      scrollbarWidth:"none",
    }}>
      <style>{`.nb-tabs::-webkit-scrollbar{display:none}`}</style>

      {/* Logo */}
      <div onClick={() => navigate("/")} style={{
        display:     "flex",
        alignItems:  "center",
        gap:         "8px",
        cursor:      "pointer",
        marginRight: "16px",
        flexShrink:  0,
      }}>
        <MetamicLogo small={true}/>
        <span style={{
          fontFamily:    "'Space Grotesk',sans-serif",
          fontWeight:    700,
          fontSize:      "16px",
          color:         "#e2eeff",
          letterSpacing: "-0.3px",
        }}>metamic</span>
      </div>

      {/* Divider */}
      <div style={{width:1,height:24,background:"rgba(255,255,255,0.08)",marginRight:"8px",flexShrink:0}}/>

      {/* Tabs */}
      <div style={{display:"flex",alignItems:"center",height:"100%",overflowX:"auto"}} className="nb-tabs">
        {TABS.map(tab => {
          const active = location.pathname === tab.path;
          return (
            <button key={tab.path} ref={active ? activeTabRef : null} onClick={() => navigate(tab.path)} style={{
              display:      "flex",
              alignItems:   "center",
              gap:          "6px",
              padding:      "0 16px",
              height:       "52px",
              background:   "transparent",
              border:       "none",
              borderBottom: active ? `2px solid ${tab.color}` : "2px solid transparent",
              cursor:       "pointer",
              fontFamily:   "'JetBrains Mono',monospace",
              fontSize:     "11px",
              fontWeight:   active ? 700 : 400,
              color:        active ? tab.color : "rgba(255,255,255,0.35)",
              transition:   "all 0.15s",
              whiteSpace:   "nowrap",
              flexShrink:   0,
            }}
            onMouseEnter={e=>{ if(!active) e.currentTarget.style.color="#e2eeff"; }}
            onMouseLeave={e=>{ if(!active) e.currentTarget.style.color="rgba(255,255,255,0.35)"; }}
            >
              <div style={{
                width:        5, height: 5,
                borderRadius: "50%",
                background:   tab.color,
                opacity:      active ? 1 : 0.35,
                boxShadow:    active ? `0 0 6px ${tab.color}` : "none",
                flexShrink:   0,
              }}/>
              {tab.label}
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "auto", paddingRight: "16px", flexShrink: 0 }}>
        {user ? (
          <>
            <UserAvatar user={user} size={30} />
            <button onClick={() => navigate("/dashboard")} style={{
              borderRadius: "999px",
              border: "1px solid rgba(255,255,255,0.12)",
              padding: "6px 16px",
              background: "rgba(255,255,255,0.04)",
              color: "#e2eeff",
              cursor: "pointer",
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: "11px",
            }}>Dashboard</button>
            <button onClick={() => { clearAuth(); navigate("/"); }} style={{
              borderRadius: "999px",
              border: "1px solid rgba(249,115,22,0.4)",
              padding: "6px 16px",
              background: "rgba(249,115,22,0.08)",
              color: "#fbbf24",
              cursor: "pointer",
              fontFamily: "'JetBrains Mono',monospace",
              fontSize: "11px",
            }}>Logout</button>
          </>
        ) : (
          <button onClick={() => navigate("/signin")} style={{
            borderRadius: "999px",
            border: "1px solid rgba(255,255,255,0.15)",
            padding: "6px 20px",
            background: "rgba(255,255,255,0.06)",
            color: "#e2eeff",
            cursor: "pointer",
            fontFamily: "'JetBrains Mono',monospace",
            fontSize: "11px",
          }}>Login</button>
        )}
      </div>
    </nav>
  );
}