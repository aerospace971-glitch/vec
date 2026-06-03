import { useState } from "react";
import UserAvatar from "../UserAvatar";
import { GHOST_BTN, PRIMARY_BTN, FIELD_INPUT } from "../../../constants/dashboardStyles";

const EDITABLE_FIELDS = [
  { label: "First Name",        key: "first_name"        },
  { label: "Last Name",         key: "last_name"         },
  { label: "Phone",             key: "phone"             },
  { label: "Institution",       key: "institution"       },
  { label: "Institution Email", key: "institution_email" },
];

export default function ProfileSection({ user, token, updateUser }) {
  const [edit,   setEdit]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState("");
  const [err,    setErr]    = useState("");
  const [form, setForm] = useState({
    first_name:        user?.first_name        || "",
    last_name:         user?.last_name         || "",
    phone:             user?.phone             || "",
    institution:       user?.institution       || "",
    institution_email: user?.institution_email || "",
  });

  function field(k, v) { setForm(p => ({ ...p, [k]: v })); }

  function handleAvatarChange(e) {
    const f = e.target.files?.[0]; if (!f) return;
    const reader = new FileReader();
    reader.onload = ev => updateUser({ avatar: ev.target.result });
    reader.readAsDataURL(f);
  }

  async function handleSave() {
    setSaving(true); setMsg(""); setErr("");
    try {
      const res = await fetch("/user/update-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setErr(data.error || "Update failed."); return; }
      updateUser(form);
      setMsg("Profile updated.");
      setEdit(false);
    } catch {
      setErr("Cannot reach server.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "540px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700 }}>Profile</h2>
          <p style={{ margin: "6px 0 0", color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
            Your identity and account details.
          </p>
        </div>
        {!edit && (
          <button onClick={() => { setEdit(true); setMsg(""); setErr(""); }} style={GHOST_BTN}>Edit</button>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <UserAvatar user={user} size={68} />
        <div>
          <div style={{ fontSize: "16px", fontWeight: 700 }}>
            {user?.first_name || ""} {user?.last_name || ""}
          </div>
          <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono',monospace", marginTop: "3px" }}>
            @{user?.username}
          </div>
          <label style={{ display: "inline-block", marginTop: "8px", ...GHOST_BTN, cursor: "pointer" }}>
            Change photo
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarChange} />
          </label>
        </div>
      </div>

      <div style={{ display: "grid", gap: "14px" }}>
        {EDITABLE_FIELDS.map(({ label, key }) => (
          <div key={key} style={{ display: "grid", gap: "5px" }}>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.6px" }}>
              {label.toUpperCase()}
            </div>
            {edit ? (
              <input value={form[key] || ""} onChange={e => field(key, e.target.value)} style={FIELD_INPUT} />
            ) : (
              <div style={{ fontSize: "14px", color: user?.[key] ? "#e2eeff" : "rgba(255,255,255,0.2)", padding: "2px 0" }}>
                {user?.[key] || "—"}
              </div>
            )}
          </div>
        ))}

        {[
          { label: "Username", value: `@${user?.username}` },
          { label: "Email",    value: user?.email           },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: "grid", gap: "5px" }}>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.35)", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "0.6px" }}>
              {label.toUpperCase()}
            </div>
            <div style={{ fontSize: "14px", color: "rgba(255,255,255,0.4)", padding: "2px 0" }}>{value}</div>
          </div>
        ))}
      </div>

      {msg && <div style={{ color: "#06ffa5", fontSize: "13px" }}>{msg}</div>}
      {err && <div style={{ color: "#f87171", fontSize: "13px" }}>{err}</div>}

      {edit && (
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={handleSave} disabled={saving} style={{ ...PRIMARY_BTN, padding: "10px 22px", fontSize: "13px" }}>
            {saving ? "Saving…" : "Save Changes"}
          </button>
          <button onClick={() => { setEdit(false); setErr(""); setMsg(""); }} style={{ ...GHOST_BTN, padding: "10px 18px", fontSize: "13px" }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
