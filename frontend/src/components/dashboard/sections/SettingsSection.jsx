import { useState } from "react";
import { GHOST_BTN, ICON_BTN } from "../../../constants/dashboardStyles";
import {
  readMetamicSettings,
  writeMetamicSettings,
} from "../../../utils/metamicSettings";

export default function SettingsSection() {
  const [settings, setSettings] = useState(readMetamicSettings);
  const [saved, setSaved] = useState(false);

  function update(key, value) {
    const updated = writeMetamicSettings({ ...settings, [key]: value });
    setSettings(updated);
    setSaved(true);
    setTimeout(() => setSaved(false), 1400);
  }

  return (
    <div style={{ maxWidth: "420px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
        <h2 style={{ margin: 0, fontSize: "22px", fontWeight: 700 }}>Settings</h2>
        {saved && <span style={{ fontSize: "11px", color: "#06ffa5", fontFamily: "'JetBrains Mono',monospace" }}>Saved ✓</span>}
      </div>
      <p style={{ margin: "0 0 24px", color: "rgba(255,255,255,0.4)", fontSize: "13px" }}>
        IDE preferences and workspace configuration.
      </p>

      <div style={{ display: "grid", gap: "10px" }}>
        {/* Font size */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600 }}>Font Size</div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>Editor font size in px</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button onClick={() => update("fontSize", Math.max(10, settings.fontSize - 1))} style={ICON_BTN}>−</button>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", minWidth: "22px", textAlign: "center" }}>{settings.fontSize}</span>
            <button onClick={() => update("fontSize", Math.min(20, settings.fontSize + 1))} style={ICON_BTN}>+</button>
          </div>
        </div>

        {/* Tab size */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600 }}>Tab Size</div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>Spaces per tab</div>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            {[2, 4, 8].map(n => (
              <button key={n} onClick={() => update("tabSize", n)} style={{
                ...GHOST_BTN, padding: "4px 10px",
                background: settings.tabSize === n ? "rgba(79,70,229,0.2)" : "transparent",
                color:      settings.tabSize === n ? "#818cf8" : "rgba(255,255,255,0.4)",
                border:     settings.tabSize === n ? "1px solid rgba(79,70,229,0.4)" : "1px solid rgba(255,255,255,0.1)",
              }}>{n}</button>
            ))}
          </div>
        </div>

        {/* Autosave */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderRadius: "10px", background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div>
            <div style={{ fontSize: "13px", fontWeight: 600 }}>Autosave</div>
            <div style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "2px" }}>Save automatically on changes</div>
          </div>
          <div onClick={() => update("autosave", !settings.autosave)} style={{
            width: 44, height: 24, borderRadius: "12px",
            background: settings.autosave ? "#4f46e5" : "rgba(255,255,255,0.1)",
            cursor: "pointer", position: "relative", transition: "background 0.2s",
          }}>
            <div style={{ position: "absolute", top: 3, left: settings.autosave ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
