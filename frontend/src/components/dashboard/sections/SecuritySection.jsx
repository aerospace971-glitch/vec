import { useState } from "react";
import { PRIMARY_BTN, FIELD_INPUT } from "../../../constants/dashboardStyles";

function EyeToggle({ open, toggle }) {
  return (
    <button type="button" onClick={toggle} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9bb5ff", padding: 0, display: "flex", alignItems: "center" }}>
      {open
        ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      }
    </button>
  );
}

export default function SecuritySection({ token }) {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [showCur,  setShowCur]  = useState(false);
  const [showNew,  setShowNew]  = useState(false);
  const [showConf, setShowConf] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setMsg(""); setErr("");
    if (!form.currentPassword || !form.newPassword || !form.confirmPassword) { setErr("All fields are required."); return; }
    if (form.newPassword.length < 8) { setErr("New password must be at least 8 characters."); return; }
    if (form.newPassword !== form.confirmPassword) { setErr("Passwords do not match."); return; }
    setLoading(true);
    try {
      const res = await fetch("/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: form.currentPassword, newPassword: form.newPassword }),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Failed to change password."); return; }
      setMsg("Password changed successfully.");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch {
      setErr("Cannot reach server.");
    } finally {
      setLoading(false);
    }
  }

  const rows = [
    { label: "Current Password",  key: "currentPassword", show: showCur,  toggle: () => setShowCur(v => !v)  },
    { label: "New Password",      key: "newPassword",     show: showNew,  toggle: () => setShowNew(v => !v)  },
    { label: "Confirm New",       key: "confirmPassword", show: showConf, toggle: () => setShowConf(v => !v) },
  ];

  return (
    <div style={{ maxWidth: "400px" }}>
      <h2 style={{ margin: "0 0 6px", fontSize: "22px", fontWeight: 700 }}>Security</h2>
      <p style={{ margin: "0 0 24px", color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
        Change your account password.
      </p>
      <form onSubmit={handleSubmit} style={{ display: "grid", gap: "14px" }}>
        {rows.map(({ label, key, show, toggle }) => (
          <label key={key} style={{ display: "grid", gap: "6px", fontSize: "10px", color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.6px" }}>
            {label.toUpperCase()}
            <div style={{ position: "relative" }}>
              <input type={show ? "text" : "password"} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                style={{ ...FIELD_INPUT, paddingRight: "40px" }} />
              <EyeToggle open={show} toggle={toggle} />
            </div>
          </label>
        ))}
        {msg && <div style={{ color: "#06ffa5", fontSize: "13px" }}>{msg}</div>}
        {err && <div style={{ color: "#f87171", fontSize: "13px" }}>{err}</div>}
        <button type="submit" disabled={loading} style={{ ...PRIMARY_BTN, padding: "11px 20px", fontSize: "13px" }}>
          {loading ? "Changing…" : "Change Password"}
        </button>
      </form>
    </div>
  );
}
