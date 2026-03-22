import { useState } from "react";
import { supabase } from "../supabaseClient.js";

export default function Login() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [mode,     setMode]     = useState("signin"); // "signin" | "signup"
  const [done,     setDone]     = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setDone(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const inputSt = { width: "100%", background: "#0C0C0E", border: "1px solid #2A2A2F", borderRadius: 8, padding: "11px 14px", color: "#E8E4DC", fontFamily: "'DM Sans', sans-serif", fontSize: 14, outline: "none", marginBottom: 12 };

  return (
    <div style={{ minHeight: "100vh", background: "#0C0C0E", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500;600&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet" />

      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 800, color: "#F0EBE0", letterSpacing: "-1px", lineHeight: 1 }}>CFO</div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 4, color: "#3A3A3F", textTransform: "uppercase", marginTop: 6 }}>Project Command</div>
        </div>

        {done ? (
          <div style={{ background: "#111114", border: "1px solid #2A2A2F", borderRadius: 14, padding: "28px 28px", textAlign: "center" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✉</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#F0EBE0", marginBottom: 8 }}>Check your email</div>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#555", letterSpacing: 0.5, lineHeight: 1.7 }}>We sent a confirmation link to {email}. Click it to activate your account, then come back and sign in.</div>
          </div>
        ) : (
          <div style={{ background: "#111114", border: "1px solid #2A2A2F", borderRadius: 14, padding: "28px 28px" }}>
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 2, color: "#444", textTransform: "uppercase", marginBottom: 20 }}>
              {mode === "signin" ? "Sign in to your account" : "Create an account"}
            </div>

            <form onSubmit={handleSubmit}>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" required style={inputSt} autoFocus />
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required style={inputSt} />

              {error && (
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#FF3B3B", marginBottom: 12, letterSpacing: 0.5 }}>{error}</div>
              )}

              <button type="submit" disabled={loading} style={{ width: "100%", padding: "12px 0", background: "#E8E4DC", color: "#0C0C0E", border: "none", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 14, cursor: loading ? "not-allowed" : "pointer", transition: "opacity 0.15s", opacity: loading ? 0.7 : 1 }}>
                {loading ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
              </button>
            </form>

            <div style={{ marginTop: 16, textAlign: "center" }}>
              <button onClick={() => { setMode(m => m === "signin" ? "signup" : "signin"); setError(null); }} style={{ background: "none", border: "none", color: "#555", fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 0.5, cursor: "pointer", textDecoration: "underline" }}>
                {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          </div>
        )}
      </div>
      <style>{`* { box-sizing: border-box; } input::placeholder { color: #333; }`}</style>
    </div>
  );
}
