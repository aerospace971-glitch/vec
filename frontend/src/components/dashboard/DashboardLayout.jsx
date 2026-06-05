import { useState, useEffect } from "react";
import MetamicLogo from "../MetamicLogo";
import UserAvatar from "./UserAvatar";
import HomeSection     from "./sections/HomeSection";
import ProfileSection  from "./sections/ProfileSection";
import FilesSection    from "./sections/FilesSection";
import BuildSection    from "./sections/BuildSection";
import SecuritySection from "./sections/SecuritySection";
import SettingsSection from "./sections/SettingsSection";

const API = "";

const NAV = [
  { id: "home",     label: "Home",     icon: "⬡" },
  { id: "profile",  label: "Profile",  icon: "○" },
  { id: "files",    label: "Files",    icon: "⊞" },
  { id: "build",    label: "Build",    icon: "◈" },
  { id: "security", label: "Security", icon: "⬢" },
  { id: "settings", label: "Settings", icon: "⊕" },
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth <= 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

export default function DashboardLayout({ user, token, updateUser, clearAuth, setSource, navigate }) {
  const [section,      setSection]      = useState("home");
  const [dashboard,    setDashboard]    = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [sidebarOpen,  setSidebarOpen]  = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!user || !token) { navigate("/signin"); return; }
    fetchDashboard();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function fetchDashboard() {
    setLoading(true);
    try {
      const res  = await fetch(`${API}/user/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setDashboard(data);
      else setError(data.error || "Failed to load dashboard.");
    } catch {
      setError("Cannot reach server.");
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  const sidebarContent = (
    <>
      {/* User identity */}
      <div style={{ padding: "18px 16px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <UserAvatar user={user} size={40} />
        <div style={{ marginTop: "10px", fontSize: "13px", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {user.first_name ? `${user.first_name} ${user.last_name || ""}`.trim() : user.username}
        </div>
        <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)", fontFamily: "'JetBrains Mono',monospace", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          @{user.username}
        </div>
      </div>

      {/* Nav */}
      <div style={{ padding: "8px 0", flex: 1 }}>
        {NAV.map(item => (
          <button key={item.id} onClick={() => { setSection(item.id); if (isMobile) setSidebarOpen(false); }} style={{
            display: "flex", alignItems: "center", gap: "9px",
            padding: "9px 14px", margin: "1px 6px",
            background: section === item.id ? "rgba(79,70,229,0.15)" : "transparent",
            border: "none", borderRadius: "8px",
            color: section === item.id ? "#818cf8" : "rgba(255,255,255,0.4)",
            cursor: "pointer",
            fontFamily: "'Space Grotesk',sans-serif", fontSize: "13px",
            fontWeight: section === item.id ? 600 : 400,
            textAlign: "left", width: "calc(100% - 12px)",
            transition: "all 0.12s",
          }}>
            <span style={{ fontSize: "13px", opacity: 0.7 }}>{item.icon}</span>
            {item.label}
          </button>
        ))}
      </div>

      {/* Sign out */}
      <div style={{ padding: "8px 0 12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
        <button onClick={() => { clearAuth(); navigate("/"); }} style={{
          display: "flex", alignItems: "center", gap: "9px",
          padding: "9px 14px", margin: "1px 6px",
          background: "transparent", border: "none", borderRadius: "8px",
          color: "rgba(239,68,68,0.55)", cursor: "pointer",
          fontFamily: "'Space Grotesk',sans-serif", fontSize: "13px",
          textAlign: "left", width: "calc(100% - 12px)",
        }}>
          <span style={{ fontSize: "13px" }}>⊗</span>
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#04030f", color: "#e2eeff", fontFamily: "'Space Grotesk',sans-serif", overflow: "hidden" }}>

      {/* ── Top bar ─────────────────────────────────────────── */}
      {isMobile ? (
        <div style={{ flexShrink: 0, background: "rgba(4,3,15,0.98)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {/* Row 1: hamburger + logo */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px" }}>
            <button onClick={() => setSidebarOpen(o => !o)} style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e2eeff", cursor: "pointer", fontSize: "18px", padding: "4px 10px", lineHeight: 1 }}>
              ☰
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }} onClick={() => navigate("/")}>
              <MetamicLogo small={true} />
              <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: "14px", color: "rgba(255,255,255,0.4)", letterSpacing: "-0.3px" }}>metamic</span>
            </div>
            <div style={{ width: 40 }} />
          </div>
          {/* Row 2: action buttons */}
          <div style={{ display: "flex", gap: "8px", padding: "0 16px 10px" }}>
            <button onClick={() => navigate("/app")} style={{ flex: 1, borderRadius: "8px", border: "1px solid rgba(68,136,255,0.35)", padding: "8px", background: "rgba(68,136,255,0.08)", color: "#4488ff", cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", fontWeight: 700 }}>
              ⚡ Let's Compile
            </button>
            <button onClick={() => navigate("/build")} style={{ flex: 1, borderRadius: "8px", border: "1px solid rgba(249,115,22,0.35)", padding: "8px", background: "rgba(249,115,22,0.08)", color: "#f97316", cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", fontWeight: 700 }}>
              Let's Build 🔨
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", background: "rgba(4,3,15,0.98)", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
          <button onClick={() => navigate("/app")} style={{ borderRadius: "8px", border: "1px solid rgba(68,136,255,0.35)", padding: "8px 18px", background: "rgba(68,136,255,0.08)", color: "#4488ff", cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", fontWeight: 700 }}>
            ⚡ Let's Compile
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer" }} onClick={() => navigate("/")}>
            <MetamicLogo small={true} />
            <span style={{ fontFamily: "'Space Grotesk',sans-serif", fontWeight: 700, fontSize: "14px", color: "rgba(255,255,255,0.4)", letterSpacing: "-0.3px" }}>metamic</span>
          </div>
          <button onClick={() => navigate("/build")} style={{ borderRadius: "8px", border: "1px solid rgba(249,115,22,0.35)", padding: "8px 18px", background: "rgba(249,115,22,0.08)", color: "#f97316", cursor: "pointer", fontFamily: "'JetBrains Mono',monospace", fontSize: "11px", fontWeight: 700 }}>
            Let's Build 🔨
          </button>
        </div>
      )}

      {/* ── Body ────────────────────────────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden", position: "relative" }}>

        {/* Mobile backdrop */}
        {isMobile && sidebarOpen && (
          <div onClick={() => setSidebarOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 40 }} />
        )}

        {/* Sidebar — drawer on mobile, fixed on desktop */}
        <div style={{
          width: "200px",
          background: "rgba(4,6,16,0.98)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          ...(isMobile ? {
            position: "absolute",
            top: 0, left: 0, bottom: 0,
            zIndex: 50,
            transform: sidebarOpen ? "translateX(0)" : "translateX(-100%)",
            transition: "transform 0.22s ease",
          } : {}),
        }}>
          {sidebarContent}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: isMobile ? "20px 16px" : "28px 32px", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.08) transparent" }}>
          {section === "home"     && <HomeSection     user={user} dashboard={dashboard} loading={loading} error={error} navigate={navigate} isMobile={isMobile} />}
          {section === "profile"  && <ProfileSection  user={user} token={token} updateUser={updateUser} />}
          {section === "files"    && <FilesSection    user={user} token={token} setSource={setSource} navigate={navigate} />}
          {section === "build"    && <BuildSection    user={user} token={token} navigate={navigate} />}
          {section === "security" && <SecuritySection token={token} />}
          {section === "settings" && <SettingsSection />}
        </div>
      </div>
    </div>
  );
}
