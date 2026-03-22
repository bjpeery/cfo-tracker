import { useState, useEffect } from "react";
import { supabase } from "./supabaseClient.js";
import Login     from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Projects  from "./pages/Projects.jsx";
import Timeline  from "./pages/Timeline.jsx";
import Reminders from "./pages/Reminders.jsx";
import Digest    from "./pages/Digest.jsx";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "◈" },
  { id: "projects",  label: "Projects",  icon: "▤" },
  { id: "timeline",  label: "Timeline",  icon: "▦" },
  { id: "reminders", label: "Reminders", icon: "◉" },
  { id: "digest",    label: "Digest",    icon: "✉" },
];

// Detect mobile
function useIsMobile() {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}

export default function App() {
  const [session,   setSession]   = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [page,      setPage]      = useState("dashboard");
  const [projects,  setProjects]  = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const isMobile = useIsMobile();

  // ── Auth ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthReady(true);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      Promise.all([fetchProjects(), fetchReminders()]).finally(() => setLoading(false));
    }
  }, [session]);

  async function fetchProjects() {
    const { data } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
    setProjects(data || []);
  }

  async function fetchReminders() {
    const { data } = await supabase.from("reminders").select("*");
    setReminders(data || []);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  // ── Loading / Auth gate ───────────────────────────────────────────────────
  if (!authReady) {
    return (
      <div style={{ minHeight: "100vh", background: "#0C0C0E", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@500&display=swap" rel="stylesheet" />
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#333", letterSpacing: 3 }}>LOADING…</div>
      </div>
    );
  }

  if (!session) return <Login />;

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0C0C0E", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@500&display=swap" rel="stylesheet" />
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#333", letterSpacing: 3 }}>LOADING…</div>
      </div>
    );
  }

  const sharedProps = { projects, setProjects, reminders, setReminders, fetchProjects, fetchReminders, session };
  const criticalCount = projects.filter(p => p.priority === "Critical" && p.status !== "Complete").length;

  // ── Mobile layout ─────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", background: "#0C0C0E", fontFamily: "'DM Sans', sans-serif", color: "#E8E4DC" }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500;600&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet" />

        {/* Main content */}
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 70 }}>
          {page === "dashboard"  && <Dashboard  {...sharedProps} />}
          {page === "projects"   && <Projects   {...sharedProps} />}
          {page === "timeline"   && <Timeline   {...sharedProps} />}
          {page === "reminders"  && <Reminders  {...sharedProps} />}
          {page === "digest"     && <Digest     {...sharedProps} />}
        </div>

        {/* Bottom tab bar */}
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#0A0A0D", borderTop: "1px solid #1A1A1E", display: "flex", zIndex: 50, paddingBottom: "env(safe-area-inset-bottom)" }}>
          {NAV.map(item => {
            const active = page === item.id;
            const badge = item.id === "dashboard" ? criticalCount : item.id === "reminders" ? reminders.length : 0;
            return (
              <button key={item.id} onClick={() => setPage(item.id)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "10px 4px 8px", background: "transparent", border: "none", color: active ? "#E8E4DC" : "#3A3A3F", cursor: "pointer", position: "relative", transition: "color 0.15s" }}>
                {active && <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: 2, background: "#E8E4DC", borderRadius: 1 }} />}
                <span style={{ fontSize: 18, lineHeight: 1, marginBottom: 3 }}>{item.icon}</span>
                <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: 0.5, textTransform: "uppercase" }}>{item.label}</span>
                {badge > 0 && <span style={{ position: "absolute", top: 6, right: "calc(50% - 16px)", background: item.id === "reminders" ? "#F5C842" : "#FF3B3B", color: item.id === "reminders" ? "#0C0C0E" : "#fff", borderRadius: 8, fontSize: 8, padding: "1px 4px", fontFamily: "'DM Mono', monospace", fontWeight: 700 }}>{badge}</span>}
              </button>
            );
          })}
        </div>

        <GlobalStyles />
      </div>
    );
  }

  // ── Desktop layout ────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#0C0C0E", fontFamily: "'DM Sans', sans-serif", color: "#E8E4DC" }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500;600&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet" />

      {/* Sidebar */}
      <div style={{ width: collapsed ? 56 : 196, flexShrink: 0, background: "#0A0A0D", borderRight: "1px solid #18181C", display: "flex", flexDirection: "column", transition: "width 0.2s ease", overflow: "hidden", position: "sticky", top: 0, height: "100vh", zIndex: 10 }}>

        {/* Logo */}
        <div style={{ padding: collapsed ? "20px 0" : "20px 18px", borderBottom: "1px solid #18181C", display: "flex", alignItems: "center", justifyContent: collapsed ? "center" : "space-between", minHeight: 64 }}>
          {!collapsed && (
            <div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 15, fontWeight: 800, color: "#F0EBE0", lineHeight: 1 }}>CFO</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: 3, color: "#3A3A3F", textTransform: "uppercase", marginTop: 2 }}>Command</div>
            </div>
          )}
          <button onClick={() => setCollapsed(v => !v)} style={{ background: "none", border: "none", color: "#3A3A3F", cursor: "pointer", fontSize: 14, padding: 4, lineHeight: 1, flexShrink: 0 }}>
            {collapsed ? "›" : "‹"}
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, paddingTop: 10 }}>
          {NAV.map(item => {
            const active = page === item.id;
            const badge  = item.id === "dashboard" ? criticalCount : item.id === "reminders" ? reminders.length : 0;
            return (
              <button key={item.id} onClick={() => setPage(item.id)} title={collapsed ? item.label : ""} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: collapsed ? "12px 0" : "10px 18px", justifyContent: collapsed ? "center" : "flex-start", background: active ? "#161619" : "transparent", borderLeft: `2px solid ${active ? "#E8E4DC" : "transparent"}`, border: "none", borderLeft: `2px solid ${active ? "#E8E4DC" : "transparent"}`, color: active ? "#E8E4DC" : "#444", cursor: "pointer", fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: active ? 600 : 400, transition: "all 0.15s", position: "relative" }}>
                <span style={{ fontSize: 15, flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>}
                {!collapsed && badge > 0 && <span style={{ background: item.id === "reminders" ? "#F5C842" : "#FF3B3B", color: item.id === "reminders" ? "#0C0C0E" : "#fff", borderRadius: 10, fontSize: 9, padding: "1px 6px", fontFamily: "'DM Mono', monospace", fontWeight: 600 }}>{badge}</span>}
                {collapsed && badge > 0 && <span style={{ position: "absolute", top: 8, right: 8, width: 6, height: 6, borderRadius: "50%", background: item.id === "reminders" ? "#F5C842" : "#FF3B3B" }} />}
              </button>
            );
          })}
        </nav>

        {/* User + sign out */}
        <div style={{ padding: collapsed ? "12px 0" : "12px 18px", borderTop: "1px solid #18181C" }}>
          {!collapsed && (
            <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#333", letterSpacing: 0.5, marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {session.user.email}
            </div>
          )}
          <button onClick={handleSignOut} title="Sign out" style={{ background: "none", border: "none", color: "#333", fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 1, cursor: "pointer", textTransform: "uppercase", padding: 0, display: "flex", alignItems: "center", gap: 6, width: "100%", justifyContent: collapsed ? "center" : "flex-start" }}>
            <span style={{ fontSize: 13 }}>⏻</span>
            {!collapsed && "Sign Out"}
          </button>
        </div>
      </div>

      {/* Main */}
      <div style={{ flex: 1, minWidth: 0, overflowY: "auto", minHeight: "100vh" }}>
        {page === "dashboard"  && <Dashboard  {...sharedProps} />}
        {page === "projects"   && <Projects   {...sharedProps} />}
        {page === "timeline"   && <Timeline   {...sharedProps} />}
        {page === "reminders"  && <Reminders  {...sharedProps} />}
        {page === "digest"     && <Digest     {...sharedProps} />}
      </div>

      <GlobalStyles />
    </div>
  );
}

function GlobalStyles() {
  return (
    <style>{`
      * { box-sizing: border-box; }
      ::-webkit-scrollbar { width: 4px; }
      ::-webkit-scrollbar-track { background: #0C0C0E; }
      ::-webkit-scrollbar-thumb { background: #2A2A2F; border-radius: 4px; }
      input[type=date]::-webkit-calendar-picker-indicator { filter: invert(0.4); cursor: pointer; }
      select option { background: #111114; color: #E8E4DC; }
      input::placeholder, textarea::placeholder { color: #333; }
      @keyframes fadeSlide { from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);} }
      @keyframes fadeIn { from{opacity:0;}to{opacity:1;} }
    `}</style>
  );
}
