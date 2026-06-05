import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import useAuthStore from "../store/authStore";
import { useResponsive } from "../hooks/useResponsive";
import { LAYOUT } from "../constants/responsiveConfig";

const generateCaptcha = () => {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
};

export default function SignUpPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const user = useAuthStore((state) => state.user);
  const { isMobile, device } = useResponsive();

  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    emailOtp: "",
  });
  const [showEmailVerification, setShowEmailVerification] = useState(false);
  const [captcha, setCaptcha] = useState(generateCaptcha());
  const [captchaInput, setCaptchaInput] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  function updateField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  const isValidPhone = (phone) => /^[0-9]{10}$/.test(phone.replace(/\D/g, ""));
  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  async function requestEmailOtp() {
    if (!form.email) {
      setEmailError("Email is required to verify.");
      return false;
    }
    if (!isValidEmail(form.email)) {
      setEmailError("Invalid email format");
      return false;
    }
    setEmailError("");
    try {
      const res = await fetch("/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.email, kind: 'email' }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to send verification email.");
        return false;
      }
      setShowEmailVerification(true);
      if (data.dev_otp) {
        setMessage(`Dev mode — email not sent. Your OTP: ${data.dev_otp}`);
      } else {
        setMessage("Verification email sent. Enter the OTP and captcha to complete step 1.");
      }
      return true;
    } catch (err) {
      setError("Unable to reach server to send verification email.");
      return false;
    }
  }

  async function handleSubmit(e) {
    // route submit based on current step
    e.preventDefault();
    setError("");
    setMessage("");
    if (step === 1) {
      if (!form.firstName.trim() || !form.lastName.trim()) {
        setError("Please enter first and last name.");
        return;
      }
      if (!form.email || !form.email.trim()) {
        setError("Please enter an email to verify.");
        return;
      }
      if (captchaInput.toUpperCase() !== captcha) {
        setError("Captcha is incorrect.");
        return;
      }
        if (!showEmailVerification) {
          const ok = await requestEmailOtp();
          if (!ok) {
            return;
          }
          return;
        }
        if (!form.emailOtp) {
          setError("Enter the email OTP.");
          return;
        }
        if (captchaInput.toUpperCase() !== captcha) {
          setError("Captcha is incorrect.");
          return;
        }
        // verify OTP with server
        try {
          const resp = await fetch("/auth/verify-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: form.email.trim(), otp: form.emailOtp.trim(), kind: 'email' }),
          });
          const d = await resp.json();
          if (!resp.ok) {
            setError(d.error || "OTP verification failed.");
            return;
          }
          setMessage("Email verified — continue to create account.");
          setShowEmailVerification(false);
          setCaptcha(generateCaptcha());
          setCaptchaInput("");
          setStep(2);
          return;
        } catch (err) {
          setError("Unable to verify OTP with server.");
          return;
        }
      return;
    }

    // Step 2: final create account
    if (!form.username || !form.password || !form.confirmPassword || !form.phone) {
      setError("Fill all required fields.");
      return;
    }
    if (form.username.length < 3) {
      setError("Username must be at least 3 characters long.");
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) {
      setError("Username can only contain letters, numbers, and underscores.");
      return;
    }
    if (form.password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError("Passwords must match.");
      return;
    }
    if (!isValidPhone(form.phone)) {
      setError("Phone must be 10 digits.");
      return;
    }
    if (captchaInput.toUpperCase() !== captcha) {
      setError("Captcha is incorrect.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: form.firstName.trim(),
          lastName: form.lastName.trim(),
          phone: (form.phone || '').trim(),
          email: form.email.trim(),
          username: form.username.trim(),
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Unable to sign up.");
        setLoading(false);
        return;
      }
      setAuth({ user: data.user, token: data.token });
      navigate("/dashboard");
    } catch {
      setError("Cannot reach server. Check your connection.");
      setLoading(false);
    }
  }

  return (
    <div style={{
      height: "100vh",
      overflowY: "auto",
      background: "#04030f",
      color: "#e2eeff",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      paddingTop: isMobile ? "16px" : "40px",
      paddingBottom: "24px",
      paddingLeft: isMobile ? "12px" : "24px",
      paddingRight: isMobile ? "12px" : "24px",
      fontFamily: "'Space Grotesk',sans-serif",
    }}>
      <div style={{
        width: "100%",
        maxWidth: isMobile ? "100%" : "560px",
        padding: isMobile ? "20px 16px" : "32px",
        position: "relative",
        borderRadius: "24px",
        background: "rgba(7, 12, 28, 0.94)",
        border: "1px solid rgba(255,255,255,0.08)",
        boxShadow: "0 40px 120px rgba(0,0,0,0.35)",
      }}>
        <button onClick={() => navigate("/")} style={{
          position: "absolute",
          top: "24px",
          right: "24px",
          borderRadius: "999px",
          border: "1px solid rgba(255,255,255,0.12)",
          background: "rgba(255,255,255,0.06)",
          color: "#e2eeff",
          padding: "10px 16px",
          cursor: "pointer",
          fontSize: "12px",
        }}>
          Home
        </button>
        <h1 style={{ margin: 0, fontSize: "32px", letterSpacing: "-0.02em" }}>Create Account</h1>
        <p style={{ color: "#9bb5ff", marginTop: "10px" }}>
          Sign up to unlock full compiler and build functionality.
        </p>

        <form onSubmit={handleSubmit} style={{ display: "grid", gap: "14px", marginTop: "24px" }}>
          <div style={{ display: "grid", gap: "14px", gridTemplateColumns: "1fr 1fr" }}>
            <label style={{ display: "grid", gap: "8px", fontSize: "13px", color: "#cbd5ff" }}>
              First name
              <input value={form.firstName} onChange={(e) => updateField("firstName", e.target.value)} placeholder="First name" style={{ width: "100%", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.12)", background: "#090d1f", color: "#e2eeff", padding: "12px 14px" }}/>
            </label>
            <label style={{ display: "grid", gap: "8px", fontSize: "13px", color: "#cbd5ff" }}>
              Last name
              <input value={form.lastName} onChange={(e) => updateField("lastName", e.target.value)} placeholder="Last name" style={{ width: "100%", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.12)", background: "#090d1f", color: "#e2eeff", padding: "12px 14px" }}/>
            </label>
          </div>

          {step === 1 && (
            <>
              <label style={{ display: "grid", gap: "8px", fontSize: "13px", color: "#cbd5ff" }}>
                Email <span style={{ color: "#9bb5ff" }}>(Required for authentication)</span>
                <input value={form.email} onChange={(e) => {
                  updateField("email", e.target.value);
                  if (e.target.value && !isValidEmail(e.target.value)) {
                    setEmailError("Invalid email format");
                  } else {
                    setEmailError("");
                  }
                }} placeholder="you@example.com" style={{ width: "100%", borderRadius: "12px", border: emailError ? "1px solid #ef4444" : "1px solid rgba(255,255,255,0.12)", background: "#090d1f", color: "#e2eeff", padding: "12px 14px" }}/>
                {emailError && <span style={{ color: "#ef4444", fontSize: "12px" }}>{emailError}</span>}
              </label>
              {showEmailVerification && (
                <label style={{ display: "grid", gap: "8px", fontSize: "13px", color: "#cbd5ff" }}>
                  Email OTP
                  <input value={form.emailOtp} onChange={(e) => updateField("emailOtp", e.target.value)} placeholder="Enter OTP from email" style={{ width: "100%", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.12)", background: "#090d1f", color: "#e2eeff", padding: "12px 14px" }}/>
                </label>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <label style={{ display: "grid", gap: "8px", fontSize: "13px", color: "#cbd5ff" }}>
                Phone
                <input value={form.phone} onChange={(e) => {
                  updateField("phone", e.target.value);
                  if (e.target.value && !isValidPhone(e.target.value)) {
                    setPhoneError("Phone must be 10 digits");
                  } else {
                    setPhoneError("");
                  }
                }} placeholder="10-digit phone number" style={{ width: "100%", borderRadius: "12px", border: phoneError ? "1px solid #ef4444" : "1px solid rgba(255,255,255,0.12)", background: "#090d1f", color: "#e2eeff", padding: "12px 14px" }}/>
                {phoneError && <span style={{ color: "#ef4444", fontSize: "12px" }}>{phoneError}</span>}
              </label>
            </>
          )}

          {step === 2 && (
            <div style={{ display: "grid", gap: "14px", gridTemplateColumns: "1fr 1fr" }}>
              <label style={{ display: "grid", gap: "8px", fontSize: "13px", color: "#cbd5ff" }}>
                Username
                <input value={form.username} onChange={(e) => updateField("username", e.target.value)} placeholder="Username" style={{ width: "100%", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.12)", background: "#090d1f", color: "#e2eeff", padding: "12px 14px" }}/>
                <span style={{ fontSize: "11px", color: "#9bb5ff", marginTop: "4px" }}>3+ chars, letters/numbers/underscore</span>
              </label>
              <div/>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: "grid", gap: "14px", gridTemplateColumns: "1fr 1fr" }}>
              <label style={{ display: "grid", gap: "8px", fontSize: "13px", color: "#cbd5ff" }}>
                Password
                <div style={{ position: "relative" }}>
                  <input type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => updateField("password", e.target.value)} placeholder="Password" style={{ width: "100%", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.12)", background: "#090d1f", color: "#e2eeff", padding: "12px 40px 12px 14px", boxSizing: "border-box" }}/>
                  <button type="button" onClick={() => setShowPassword(v => !v)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9bb5ff", padding: 0, display: "flex" }}>
                    {showPassword
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
                <span style={{ fontSize: "11px", color: "#9bb5ff", marginTop: "4px" }}>Minimum 6 characters</span>
              </label>
              <label style={{ display: "grid", gap: "8px", fontSize: "13px", color: "#cbd5ff" }}>
                Confirm password
                <div style={{ position: "relative" }}>
                  <input type={showConfirmPassword ? "text" : "password"} value={form.confirmPassword} onChange={(e) => updateField("confirmPassword", e.target.value)} placeholder="Confirm password" style={{ width: "100%", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.12)", background: "#090d1f", color: "#e2eeff", padding: "12px 40px 12px 14px", boxSizing: "border-box" }}/>
                  <button type="button" onClick={() => setShowConfirmPassword(v => !v)} style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "#9bb5ff", padding: 0, display: "flex" }}>
                    {showConfirmPassword
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </label>
            </div>
          )}


          <label style={{ display: "grid", gap: "8px", fontSize: "13px", color: "#cbd5ff" }}>
            Captcha
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ padding: "12px 16px", borderRadius: "12px", background: "#0b1227", border: "1px solid rgba(255,255,255,0.1)", fontFamily: "'JetBrains Mono',monospace", letterSpacing: "2px" }}>{captcha}</span>
              <input value={captchaInput} onChange={(e) => setCaptchaInput(e.target.value)} placeholder="Type code" style={{ flex: 1, borderRadius: "12px", border: "1px solid rgba(255,255,255,0.12)", background: "#090d1f", color: "#e2eeff", padding: "12px 14px" }}/>
            </div>
          </label>

          {message && <div style={{ color: "#86efac", fontSize: "13px" }}>{message}</div>}
          {error && <div style={{ color: "#f87171", fontSize: "13px" }}>{error}</div>}

          <button type="submit" disabled={loading} style={{
            width: "100%", borderRadius: "999px", border: "none", background: "#4f46e5", color: "#ffffff", padding: "14px", fontWeight: 700, cursor: "pointer"
          }}>
            {loading ? (step===2?"Creating account...":"Working...") : (step===1 ? "Authenticate" : "Create account")}
          </button>
        </form>

        <div style={{ marginTop: "18px", fontSize: "13px", color: "#9bb5ff" }}>
          Already have an account? <Link to="/signin" style={{ color: "#7dd3fc" }}>Sign in</Link>.
        </div>
      </div>
    </div>
  );
}
