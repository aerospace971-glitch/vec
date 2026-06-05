import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import useAuthStore from "../store/authStore";
import MetamicLogo from "../components/MetamicLogo";
import { useResponsive } from "../hooks/useResponsive";
import { LAYOUT } from "../constants/responsiveConfig";

const generateCaptcha = () => {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
};

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

const INPUT_STYLE = {
  width: "100%", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.12)",
  background: "#090d1f", color: "#e2eeff", padding: "12px 14px",
  fontFamily: "'JetBrains Mono',monospace", fontSize: "13px", outline: "none",
  boxSizing: "border-box",
};

const EYE_BTN = {
  position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
  background: "none", border: "none", cursor: "pointer", color: "#9bb5ff",
  padding: "0", display: "flex", alignItems: "center",
};

export default function SignInPage() {
  const navigate = useNavigate();
  const setAuth  = useAuthStore((state) => state.setAuth);
  const user     = useAuthStore((state) => state.user);
  const { isMobile, device } = useResponsive();

  // ── sign-in state ──────────────────────────────────────────────
  const [username,     setUsername]     = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [captcha]                       = useState(generateCaptcha);
  const [captchaInput, setCaptchaInput] = useState("");
  const [error,        setError]        = useState("");
  const [loading,      setLoading]      = useState(false);

  // ── forgot-password state ──────────────────────────────────────
  const [mode,           setMode]           = useState("signin"); // "signin" | "forgot"
  const [fpStep,         setFpStep]         = useState(1);        // 1=email, 2=otp+newpass
  const [fpEmail,        setFpEmail]        = useState("");
  const [fpOtp,          setFpOtp]          = useState("");
  const [fpNewPass,      setFpNewPass]      = useState("");
  const [fpConfirmPass,  setFpConfirmPass]  = useState("");
  const [showFpNew,      setShowFpNew]      = useState(false);
  const [showFpConfirm,  setShowFpConfirm]  = useState(false);
  const [fpLoading,      setFpLoading]      = useState(false);
  const [fpError,        setFpError]        = useState("");
  const [fpMessage,      setFpMessage]      = useState("");
  const [fpDone,         setFpDone]         = useState(false);

  useEffect(() => { if (user) navigate("/dashboard"); }, [user, navigate]);

  // ── sign-in submit ─────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!username || !password) { setError("Enter username and password."); return; }
    if (captchaInput.toUpperCase() !== captcha) { setError("Captcha does not match."); return; }
    setLoading(true);
    try {
      const res  = await fetch("/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to sign in."); return; }
      setAuth({ user: data.user, token: data.token });
      navigate("/dashboard");
    } catch {
      setError("Cannot reach server. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  // ── forgot-password step 1: send OTP ──────────────────────────
  async function handleFpSendOtp(e) {
    e.preventDefault();
    setFpError(""); setFpMessage("");
    if (!fpEmail.trim()) { setFpError("Enter your registered email address."); return; }
    setFpLoading(true);
    try {
      const res  = await fetch("/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fpEmail.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setFpError(data.error || "Failed to send reset code."); return; }
      if (data.dev_otp) {
        setFpMessage(`Dev mode — no email sent. Your reset code: ${data.dev_otp}`);
      } else {
        setFpMessage("Reset code sent to your email. Check your inbox.");
      }
      setFpStep(2);
    } catch {
      setFpError("Cannot reach server. Check your connection.");
    } finally {
      setFpLoading(false);
    }
  }

  // ── forgot-password step 2: verify OTP + reset password ───────
  async function handleFpReset(e) {
    e.preventDefault();
    setFpError("");
    if (!fpOtp.trim()) { setFpError("Enter the reset code from your email."); return; }
    if (!fpNewPass)    { setFpError("Enter a new password."); return; }
    if (fpNewPass.length < 8) { setFpError("Password must be at least 8 characters."); return; }
    if (fpNewPass !== fpConfirmPass) { setFpError("Passwords do not match."); return; }
    setFpLoading(true);
    try {
      const res  = await fetch("/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fpEmail.trim().toLowerCase(), otp: fpOtp.trim(), newPassword: fpNewPass }),
      });
      const data = await res.json();
      if (!res.ok) { setFpError(data.error || "Failed to reset password."); return; }
      setFpDone(true);
      setTimeout(() => backToSignIn(), 2500);
    } catch {
      setFpError("Cannot reach server. Check your connection.");
    } finally {
      setFpLoading(false);
    }
  }

  function backToSignIn() {
    setMode("signin"); setFpStep(1);
    setFpEmail(""); setFpOtp(""); setFpNewPass(""); setFpConfirmPass("");
    setFpError(""); setFpMessage(""); setFpDone(false);
  }

  // ── render ─────────────────────────────────────────────────────
  return (
    <div style={{
      height: "100vh", overflowY: "auto", background: "#04030f", color: "#e2eeff",
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      padding: isMobile ? "16px 12px" : "40px 24px 24px", fontFamily: "'Space Grotesk',sans-serif",
    }}>
      <div style={{
        width: "100%", maxWidth: LAYOUT.modalWidth[device], padding: isMobile ? "20px 16px" : "32px", position: "relative",
        borderRadius: "24px", background: "rgba(7,12,28,0.94)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 40px 120px rgba(0,0,0,0.35)",
      }}>
        <button onClick={() => navigate("/")} style={{
          position: "absolute", top: "24px", right: "24px",
          borderRadius: "999px", border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)", color: "#e2eeff",
          padding: "10px 16px", cursor: "pointer", fontSize: "12px",
        }}>Home</button>

        {/* ══ SIGN IN MODE ══════════════════════════════════════ */}
        {mode === "signin" && (
          <>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "8px", overflow: "hidden", height: "138px" }}>
              <div style={{ transform: "scale(0.69)", transformOrigin: "top center" }}>
                <MetamicLogo />
              </div>
            </div>
            <h1 style={{ margin: 0, fontSize: "32px", letterSpacing: "-0.02em" }}>Sign In</h1>
            <p style={{ color: "#9bb5ff", marginTop: "10px" }}>
              Access full compiler and build features after signing in.
            </p>

            <form onSubmit={handleSubmit} style={{ display: "grid", gap: "14px", marginTop: "24px" }}>
              <label style={{ display: "grid", gap: "8px", fontSize: "13px", color: "#cbd5ff" }}>
                Username or Email
                <input value={username} onChange={e => setUsername(e.target.value)} placeholder="username or email" style={INPUT_STYLE} />
              </label>

              <label style={{ display: "grid", gap: "8px", fontSize: "13px", color: "#cbd5ff" }}>
                Password
                <div style={{ position: "relative" }}>
                  <input type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} placeholder="password"
                    style={{ ...INPUT_STYLE, paddingRight: "40px" }} />
                  <button type="button" onClick={() => setShowPassword(v => !v)} style={EYE_BTN}>
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </label>

              <label style={{ display: "grid", gap: "8px", fontSize: "13px", color: "#cbd5ff" }}>
                Captcha
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ padding: "12px 16px", borderRadius: "12px", background: "#0b1227", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "2px" }}>
                    {captcha}
                  </span>
                  <input value={captchaInput} onChange={e => setCaptchaInput(e.target.value)} placeholder="enter code"
                    style={{ ...INPUT_STYLE, flex: 1 }} />
                </div>
              </label>

              {error && <div style={{ color: "#f87171", fontSize: "13px" }}>{error}</div>}

              <button type="submit" disabled={loading} style={{
                width: "100%", borderRadius: "999px", border: "none", background: "#4f46e5",
                color: "#ffffff", padding: "14px", fontWeight: 700,
                cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1,
              }}>
                {loading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <div style={{ marginTop: "18px", fontSize: "13px", color: "#9bb5ff" }}>
              New here? <Link to="/signup" style={{ color: "#7dd3fc" }}>Create an account</Link>.
            </div>
            <button onClick={() => { setMode("forgot"); setFpError(""); setFpMessage(""); }} style={{
              marginTop: "10px", background: "none", border: "none", cursor: "pointer",
              color: "#6b7ea8", fontSize: "13px", padding: "0", textDecoration: "underline",
              textDecorationColor: "rgba(107,126,168,0.4)",
            }}>
              Forgot your password?
            </button>
          </>
        )}

        {/* ══ FORGOT PASSWORD MODE ══════════════════════════════ */}
        {mode === "forgot" && (
          <>
            {/* success state */}
            {fpDone ? (
              <div style={{ textAlign: "center", padding: "32px 0" }}>
                <div style={{ fontSize: "52px", marginBottom: "16px" }}>✓</div>
                <h2 style={{ margin: "0 0 10px", fontSize: "24px", color: "#06ffa5" }}>Password reset!</h2>
                <p style={{ color: "#4b5a7a", fontSize: "14px" }}>Redirecting you to Sign In…</p>
              </div>
            ) : (
              <>
                {/* step indicator */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "24px" }}>
                  {[1, 2].map(n => (
                    <div key={n} style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{
                        width: "28px", height: "28px", borderRadius: "50%", display: "flex",
                        alignItems: "center", justifyContent: "center",
                        fontFamily: "'JetBrains Mono',monospace", fontSize: "12px", fontWeight: 700,
                        background: fpStep >= n ? "#4f46e5" : "rgba(255,255,255,0.06)",
                        color: fpStep >= n ? "#fff" : "#4b5a7a",
                        border: fpStep === n ? "2px solid #818cf8" : "2px solid transparent",
                        transition: "all 0.2s",
                      }}>{n}</div>
                      {n < 2 && <div style={{ width: "40px", height: "1px", background: fpStep > n ? "#4f46e5" : "rgba(255,255,255,0.1)" }} />}
                    </div>
                  ))}
                  <span style={{ fontSize: "12px", color: "#6b7ea8", marginLeft: "4px", fontFamily: "'JetBrains Mono',monospace" }}>
                    {fpStep === 1 ? "Enter email" : "Reset password"}
                  </span>
                </div>

                <h1 style={{ margin: "0 0 6px", fontSize: "26px", letterSpacing: "-0.02em" }}>Forgot Password</h1>
                <p style={{ color: "#9bb5ff", marginBottom: "24px", fontSize: "14px" }}>
                  {fpStep === 1
                    ? "Enter your account email and we'll send a reset code."
                    : `Reset code sent to ${fpEmail}. Enter it below with your new password.`}
                </p>

                {/* step 1 — email */}
                {fpStep === 1 && (
                  <form onSubmit={handleFpSendOtp} style={{ display: "grid", gap: "14px" }}>
                    <label style={{ display: "grid", gap: "8px", fontSize: "13px", color: "#cbd5ff" }}>
                      Registered Email
                      <input type="email" value={fpEmail} onChange={e => setFpEmail(e.target.value)}
                        placeholder="you@example.com" autoFocus style={INPUT_STYLE} />
                    </label>

                    {fpError   && <div style={{ color: "#f87171", fontSize: "13px" }}>{fpError}</div>}
                    {fpMessage && <div style={{ color: "#06ffa5", fontSize: "13px" }}>{fpMessage}</div>}

                    <button type="submit" disabled={fpLoading} style={{
                      width: "100%", borderRadius: "999px", border: "none", background: "#4f46e5",
                      color: "#fff", padding: "14px", fontWeight: 700,
                      cursor: fpLoading ? "not-allowed" : "pointer", opacity: fpLoading ? 0.7 : 1,
                    }}>
                      {fpLoading ? "Sending…" : "Send Reset Code"}
                    </button>
                  </form>
                )}

                {/* step 2 — OTP + new password */}
                {fpStep === 2 && (
                  <form onSubmit={handleFpReset} style={{ display: "grid", gap: "14px" }}>
                    {fpMessage && (
                      <div style={{ padding: "10px 14px", borderRadius: "12px", background: "rgba(6,255,165,0.06)", border: "1px solid rgba(6,255,165,0.2)", color: "#06ffa5", fontSize: "13px", fontFamily: "'JetBrains Mono',monospace" }}>
                        {fpMessage}
                      </div>
                    )}

                    <label style={{ display: "grid", gap: "8px", fontSize: "13px", color: "#cbd5ff" }}>
                      Reset Code (5 digits)
                      <input value={fpOtp} onChange={e => setFpOtp(e.target.value)}
                        placeholder="12345" maxLength={6} autoFocus
                        style={{ ...INPUT_STYLE, letterSpacing: "4px", fontSize: "18px", textAlign: "center" }} />
                    </label>

                    <label style={{ display: "grid", gap: "8px", fontSize: "13px", color: "#cbd5ff" }}>
                      New Password
                      <div style={{ position: "relative" }}>
                        <input type={showFpNew ? "text" : "password"} value={fpNewPass}
                          onChange={e => setFpNewPass(e.target.value)} placeholder="at least 8 characters"
                          style={{ ...INPUT_STYLE, paddingRight: "40px" }} />
                        <button type="button" onClick={() => setShowFpNew(v => !v)} style={EYE_BTN}>
                          <EyeIcon open={showFpNew} />
                        </button>
                      </div>
                    </label>

                    <label style={{ display: "grid", gap: "8px", fontSize: "13px", color: "#cbd5ff" }}>
                      Confirm New Password
                      <div style={{ position: "relative" }}>
                        <input type={showFpConfirm ? "text" : "password"} value={fpConfirmPass}
                          onChange={e => setFpConfirmPass(e.target.value)} placeholder="repeat password"
                          style={{ ...INPUT_STYLE, paddingRight: "40px" }} />
                        <button type="button" onClick={() => setShowFpConfirm(v => !v)} style={EYE_BTN}>
                          <EyeIcon open={showFpConfirm} />
                        </button>
                      </div>
                    </label>

                    {fpError && <div style={{ color: "#f87171", fontSize: "13px" }}>{fpError}</div>}

                    <button type="submit" disabled={fpLoading} style={{
                      width: "100%", borderRadius: "999px", border: "none", background: "#4f46e5",
                      color: "#fff", padding: "14px", fontWeight: 700,
                      cursor: fpLoading ? "not-allowed" : "pointer", opacity: fpLoading ? 0.7 : 1,
                    }}>
                      {fpLoading ? "Resetting…" : "Reset Password"}
                    </button>

                    <button type="button" onClick={() => { setFpStep(1); setFpOtp(""); setFpNewPass(""); setFpConfirmPass(""); setFpError(""); }} style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "#6b7ea8", fontSize: "13px", padding: "0",
                    }}>
                      ← Resend code / change email
                    </button>
                  </form>
                )}

                <button onClick={backToSignIn} style={{
                  marginTop: "18px", background: "none", border: "none", cursor: "pointer",
                  color: "#6b7ea8", fontSize: "13px", padding: "0", display: "block",
                }}>
                  ← Back to Sign In
                </button>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
