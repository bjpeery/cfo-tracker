import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";
import { supabase } from "./supabaseClient";

// ─── Constants ───────────────────────────────────────────────────────────────

const PRIORITIES = ["Critical", "High", "Medium", "Low"];
const PRIORITY_CONFIG = {
  Critical: { color: "#FF3B3B", bg: "rgba(255,59,59,0.1)", dot: "#FF3B3B" },
  High:     { color: "#FF8C00", bg: "rgba(255,140,0,0.1)",  dot: "#FF8C00" },
  Medium:   { color: "#F5C842", bg: "rgba(245,200,66,0.1)", dot: "#F5C842" },
  Low:      { color: "#4ECDC4", bg: "rgba(78,205,196,0.1)", dot: "#4ECDC4" },
};
const STATUS_OPTIONS = ["In Progress", "On Hold", "Complete"];
const EMPTY_FORM     = { title: "", due_date: "", priority: "High", partners: "", notes: "", status: "In Progress" };
const EMPTY_REMINDER = { project_id: null, email: "", days_before: 3 };

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

function DueBadge({ date }) {
  const days = getDaysUntil(date);
  if (days === null) return null;
  let color = "#4ECDC4", label = `${days}d`;
  if (days < 0)        { color = "#888";    label = "Overdue"; }
  else if (days === 0) { color = "#FF3B3B"; label = "Today"; }
  else if (days <= 3)  { color = "#FF3B3B"; label = `${days}d`; }
  else if (days <= 7)  { color = "#FF8C00"; label = `${days}d`; }
  return (
    <span style={{ fontSize: 11, fontFamily: "'DM Mono', monospace", color, border: `1px solid ${color}`, borderRadius: 4, padding: "2px 7px", letterSpacing: 1, fontWeight: 600 }}>
      {label}
    </span>
  );
}

function highlight(text, query) {
  if (!query || !text) return text;
  const safe  = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${safe})`, "gi"));
  return parts.map((p, i) =>
    p.toLowerCase() === query.toLowerCase()
      ? <mark key={i} style={{ background: "#F5C84244", color: "#F5C842", borderRadius: 2, padding: "0 1px" }}>{p}</mark>
      : p
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function CFOTracker() {
  const [projects,    setProjects]    = useState([]);
  const [reminders,   setReminders]   = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [dbError,     setDbError]     = useState(null);

  const [form,        setForm]        = useState(EMPTY_FORM);
  const [showForm,    setShowForm]    = useState(false);
  const [editId,      setEditId]      = useState(null);
  const [saving,      setSaving]      = useState(false);

  const [filter,      setFilter]      = useState("All");
  const [expandedId,  setExpandedId]  = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [showReminder,   setShowReminder]   = useState(false);
  const [reminder,       setReminder]       = useState(EMPTY_REMINDER);
  const [reminderSent,   setReminderSent]   = useState(false);

  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef(null);

  // ── Load data on mount ──────────────────────────────────────────────────────
  useEffect(() => {
    Promise.all([fetchProjects(), fetchReminders()])
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    function handler(e) {
      if (exportRef.current && !exportRef.current.contains(e.target)) setShowExport(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function fetchProjects() {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) { setDbError(error.message); return; }
    setProjects(data || []);
  }

  async function fetchReminders() {
    const { data, error } = await supabase
      .from("reminders")
      .select("*");
    if (error) return;
    setReminders(data || []);
  }

  // ── CRUD ────────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      if (editId !== null) {
        const { error } = await supabase
          .from("projects")
          .update({ ...form, updated_at: new Date().toISOString() })
          .eq("id", editId);
        if (error) throw error;
        setProjects(ps => ps.map(p => p.id === editId ? { ...p, ...form } : p));
        setEditId(null);
      } else {
        const { data, error } = await supabase
          .from("projects")
          .insert([form])
          .select()
          .single();
        if (error) throw error;
        setProjects(ps => [data, ...ps]);
      }
      setForm(EMPTY_FORM);
      setShowForm(false);
    } catch (err) {
      alert("Save failed: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    await supabase.from("reminders").delete().eq("project_id", id);
    await supabase.from("projects").delete().eq("id", id);
    setProjects(ps => ps.filter(p => p.id !== id));
    setReminders(rs => rs.filter(r => r.project_id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  async function handleStatusCycle(id) {
    const project = projects.find(p => p.id === id);
    const next    = STATUS_OPTIONS[(STATUS_OPTIONS.indexOf(project.status) + 1) % STATUS_OPTIONS.length];
    await supabase.from("projects").update({ status: next, updated_at: new Date().toISOString() }).eq("id", id);
    setProjects(ps => ps.map(p => p.id === id ? { ...p, status: next } : p));
  }

  function handleEdit(p) {
    setForm({ title: p.title, due_date: p.due_date, priority: p.priority, partners: p.partners || "", notes: p.notes || "", status: p.status });
    setEditId(p.id);
    setShowForm(true);
    setExpandedId(null);
  }

  // ── Reminders ───────────────────────────────────────────────────────────────
  function openReminderFor(projectId) {
    const existing = reminders.find(r => r.project_id === projectId);
    setReminder(existing ? { ...existing } : { ...EMPTY_REMINDER, project_id: projectId });
    setReminderSent(false);
    setShowReminder(true);
  }

  async function saveReminder() {
    if (!reminder.email || !reminder.project_id) return;
    const existing = reminders.find(r => r.project_id === reminder.project_id);
    let result;
    if (existing) {
      result = await supabase
        .from("reminders")
        .update({ email: reminder.email, days_before: reminder.days_before })
        .eq("id", existing.id)
        .select()
        .single();
    } else {
      result = await supabase
        .from("reminders")
        .insert([{ project_id: reminder.project_id, email: reminder.email, days_before: reminder.days_before }])
        .select()
        .single();
    }
    if (!result.error) {
      setReminders(rs => [...rs.filter(r => r.project_id !== reminder.project_id), result.data]);
    }
    setReminderSent(true);
    setTimeout(() => { setShowReminder(false); setReminderSent(false); }, 1800);
  }

  async function removeReminder(projectId) {
    await supabase.from("reminders").delete().eq("project_id", projectId);
    setReminders(rs => rs.filter(r => r.project_id !== projectId));
  }

  // ── Export ──────────────────────────────────────────────────────────────────
  function exportCSV() {
    const rows = [
      ["Title", "Priority", "Status", "Due Date", "Days Until Due", "Partners", "Notes"],
      ...projects.map(p => [p.title, p.priority, p.status, p.due_date, getDaysUntil(p.due_date) ?? "", p.partners, p.notes])
    ];
    const csv = rows.map(r => r.map(c => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const a   = document.createElement("a");
    a.href    = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "cfo-projects.csv";
    a.click();
    setShowExport(false);
  }

  function exportExcel() {
    const data = projects.map(p => ({
      "Title": p.title, "Priority": p.priority, "Status": p.status,
      "Due Date": p.due_date, "Days Until Due": getDaysUntil(p.due_date) ?? "",
      "Key Partners": p.partners, "Notes": p.notes,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [{ wch: 36 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 28 }, { wch: 42 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Projects");
    const summary = [
      ["CFO Project Command — Export"], ["Generated", new Date().toLocaleDateString()],
      ["Total Projects",   projects.length],
      ["Critical (Open)", projects.filter(p => p.priority === "Critical" && p.status !== "Complete").length],
      ["In Progress",     projects.filter(p => p.status === "In Progress").length],
      ["On Hold",         projects.filter(p => p.status === "On Hold").length],
      ["Complete",        projects.filter(p => p.status === "Complete").length],
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");
    XLSX.writeFile(wb, "cfo-projects.xlsx");
    setShowExport(false);
  }

  // ── Derived state ───────────────────────────────────────────────────────────
  const criticalCount = projects.filter(p => p.priority === "Critical" && p.status !== "Complete").length;

  const filtered = projects
    .filter(p => filter === "All" || p.priority === filter || p.status === filter)
    .filter(p => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.title.toLowerCase().includes(q) ||
        (p.notes     || "").toLowerCase().includes(q) ||
        (p.partners  || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const pri = PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority);
      return pri !== 0 ? pri : new Date(a.due_date) - new Date(b.due_date);
    });

  const inputSt = {
    width: "100%", background: "#0C0C0E", border: "1px solid #2A2A2F",
    borderRadius: 8, padding: "10px 12px", color: "#E8E4DC",
    fontFamily: "'DM Sans', sans-serif", fontSize: 13, outline: "none",
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0C0C0E", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@500&display=swap" rel="stylesheet" />
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 12, color: "#444", letterSpacing: 3 }}>LOADING…</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0C0C0E", fontFamily: "'DM Sans', sans-serif", color: "#E8E4DC", paddingBottom: 60 }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500;600&family=Playfair+Display:wght@700;800&display=swap" rel="stylesheet" />

      {/* DB error banner */}
      {dbError && (
        <div style={{ background: "#2A0A0A", borderBottom: "1px solid #FF3B3B44", padding: "10px 40px", fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#FF3B3B", letterSpacing: 1 }}>
          ⚠ DATABASE ERROR — {dbError} — Check your VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env
        </div>
      )}

      {/* HEADER */}
      <div style={{ borderBottom: "1px solid #1E1E22", padding: "28px 40px 20px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", background: "linear-gradient(180deg,#111114 0%,#0C0C0E 100%)", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, letterSpacing: 3, color: "#444", textTransform: "uppercase", marginBottom: 5 }}>Office of the CFO</div>
          <h1 style={{ margin: 0, fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 800, color: "#F0EBE0", letterSpacing: "-0.5px" }}>Project Command</h1>
          {criticalCount > 0 && (
            <div style={{ marginTop: 5, fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#FF3B3B", letterSpacing: 1 }}>
              ● {criticalCount} CRITICAL ITEM{criticalCount > 1 ? "S" : ""} NEED ATTENTION
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Export dropdown */}
          <div ref={exportRef} style={{ position: "relative" }}>
            <button onClick={() => setShowExport(v => !v)} style={{ background: "#17171A", color: "#888", border: "1px solid #2A2A2F", borderRadius: 8, padding: "9px 16px", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}>
              ↓ Export
            </button>
            {showExport && (
              <div style={{ position: "absolute", right: 0, top: "calc(100% + 8px)", background: "#17171A", border: "1px solid #2A2A2F", borderRadius: 10, overflow: "hidden", zIndex: 50, minWidth: 200, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
                {[
                  { label: "Export as CSV",   sub: "Comma-separated",         fn: exportCSV },
                  { label: "Export as Excel", sub: "Formatted .xlsx + Summary", fn: exportExcel },
                ].map(opt => (
                  <button key={opt.label} onClick={opt.fn}
                    onMouseEnter={e => e.currentTarget.style.background = "#1E1E22"}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", width: "100%", padding: "12px 16px", background: "transparent", border: "none", color: "#E8E4DC", cursor: "pointer", textAlign: "left" }}>
                    <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 500 }}>{opt.label}</span>
                    <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#444", letterSpacing: 1, marginTop: 2 }}>{opt.sub}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => { setShowForm(true); setEditId(null); setForm(EMPTY_FORM); }} style={{ background: "#E8E4DC", color: "#0C0C0E", border: "none", borderRadius: 8, padding: "9px 20px", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 7 }}>
            <span style={{ fontSize: 16 }}>+</span> Log Project
          </button>
        </div>
      </div>

      {/* SEARCH + FILTERS */}
      <div style={{ padding: "16px 40px 0", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ position: "relative", flex: "0 0 260px" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#444", fontSize: 13 }}>⌕</span>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search titles, notes, partners…"
            style={{ ...inputSt, paddingLeft: 32, fontSize: 12, height: 36, border: "1px solid #2A2A2F" }} />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#444", cursor: "pointer", fontSize: 12, padding: 0 }}>✕</button>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {["All", ...PRIORITIES, ...STATUS_OPTIONS].map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              background: filter === f ? "#E8E4DC" : "transparent",
              color:      filter === f ? "#0C0C0E"  : "#555",
              border: `1px solid ${filter === f ? "#E8E4DC" : "#2A2A2F"}`,
              borderRadius: 20, padding: "4px 13px",
              fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 1,
              textTransform: "uppercase", cursor: "pointer", transition: "all 0.15s",
            }}>{f}</button>
          ))}
        </div>
        <span style={{ marginLeft: "auto", fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#333", letterSpacing: 1 }}>
          {filtered.length} / {projects.length}
        </span>
      </div>

      {/* PROJECT LIST */}
      <div style={{ padding: "14px 40px 0" }}>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#2A2A2F", fontFamily: "'DM Mono', monospace", fontSize: 12, letterSpacing: 2 }}>
            {searchQuery ? `NO RESULTS FOR "${searchQuery.toUpperCase()}"` : "NO PROJECTS LOGGED YET"}
          </div>
        )}
        {filtered.map((p, i) => {
          const pc         = PRIORITY_CONFIG[p.priority];
          const expanded   = expandedId === p.id;
          const done       = p.status === "Complete";
          const hasReminder = reminders.some(r => r.project_id === p.id);
          return (
            <div key={p.id} style={{ background: "#111114", border: "1px solid #1E1E22", borderLeft: `3px solid ${done ? "#2A2A2F" : pc.color}`, borderRadius: 10, marginBottom: 9, opacity: done ? 0.5 : 1, transition: "all 0.2s", animation: `fadeSlide 0.3s ease ${i * 0.04}s both` }}>
              <div onClick={() => setExpandedId(expanded ? null : p.id)} style={{ padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 13 }}>
                <div onClick={e => { e.stopPropagation(); handleStatusCycle(p.id); }} title={`${p.status} — click to cycle`}
                  style={{ width: 11, height: 11, borderRadius: "50%", background: done ? "#2A2A2F" : pc.dot, flexShrink: 0, cursor: "pointer", boxShadow: done ? "none" : `0 0 7px ${pc.dot}88`, transition: "all 0.2s" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: done ? "#444" : "#E8E4DC", textDecoration: done ? "line-through" : "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {highlight(p.title, searchQuery)}
                  </div>
                  {p.partners && (
                    <div style={{ fontSize: 11, color: "#555", marginTop: 2, fontFamily: "'DM Mono', monospace", letterSpacing: 0.4 }}>
                      {highlight(p.partners, searchQuery)}
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 9, flexShrink: 0 }}>
                  {hasReminder && <span title="Reminder set" style={{ fontSize: 11 }}>🔔</span>}
                  <span style={{ fontSize: 10, fontFamily: "'DM Mono', monospace", color: pc.color, background: pc.bg, border: `1px solid ${pc.color}33`, borderRadius: 4, padding: "2px 7px", letterSpacing: 1, textTransform: "uppercase" }}>{p.priority}</span>
                  <DueBadge date={p.due_date} />
                  <span style={{ fontSize: 9, color: "#3A3A3F", fontFamily: "'DM Mono', monospace", letterSpacing: 0.5 }}>{p.status.toUpperCase()}</span>
                  <span style={{ color: "#333", fontSize: 11, display: "inline-block", transition: "transform 0.2s", transform: expanded ? "rotate(180deg)" : "none" }}>▾</span>
                </div>
              </div>

              {expanded && (
                <div style={{ padding: "0 18px 16px 42px", borderTop: "1px solid #181818" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 24px", marginTop: 12 }}>
                    <MiniField label="Due Date"    value={p.due_date ? new Date(p.due_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"} />
                    <MiniField label="Status"      value={p.status} />
                    <MiniField label="Key Partners" value={p.partners || "—"} />
                    <MiniField label="Priority"    value={p.priority} color={pc.color} />
                  </div>
                  {p.notes && (
                    <div style={{ marginTop: 10 }}>
                      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 2, color: "#3A3A3F", textTransform: "uppercase", marginBottom: 4 }}>Notes</div>
                      <div style={{ fontSize: 13, color: "#777", lineHeight: 1.65 }}>{highlight(p.notes, searchQuery)}</div>
                    </div>
                  )}
                  {hasReminder && (() => {
                    const r = reminders.find(r => r.project_id === p.id);
                    return (
                      <div style={{ marginTop: 10, padding: "8px 12px", background: "#17170C", border: "1px solid #F5C84233", borderRadius: 6, fontSize: 11, color: "#F5C842", fontFamily: "'DM Mono', monospace", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>🔔 REMINDER · {r.days_before}d BEFORE DUE · {r.email}</span>
                        <button onClick={() => removeReminder(p.id)} style={{ background: "none", border: "none", color: "#F5C842", cursor: "pointer", fontSize: 11, opacity: 0.6 }}>✕</button>
                      </div>
                    );
                  })()}
                  <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                    {[
                      { label: "Edit",                                           fn: () => handleEdit(p),             color: "#888" },
                      { label: hasReminder ? "Update Reminder" : "Set Reminder", fn: () => openReminderFor(p.id),     color: "#F5C842" },
                      { label: "Cycle Status",                                   fn: () => handleStatusCycle(p.id),   color: "#4ECDC4" },
                      { label: "Delete",                                         fn: () => handleDelete(p.id),        color: "#FF3B3B" },
                    ].map(btn => (
                      <button key={btn.label} onClick={btn.fn} style={{ padding: "7px 13px", background: "transparent", color: btn.color, border: `1px solid ${btn.color}33`, borderRadius: 6, fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer" }}>
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* LOG / EDIT MODAL */}
      {showForm && (
        <ModalWrap onClose={() => { setShowForm(false); setEditId(null); }}>
          <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, marginBottom: 22, color: "#F0EBE0" }}>{editId ? "Edit Project" : "Log New Project"}</div>
          <FField label="Project Title *">
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Q3 Revenue Reforecast" style={inputSt} autoFocus />
          </FField>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <FField label="Due Date">
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} style={inputSt} />
            </FField>
            <FField label="Priority">
              <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={inputSt}>
                {PRIORITIES.map(p => <option key={p}>{p}</option>)}
              </select>
            </FField>
          </div>
          <FField label="Status">
            <div style={{ display: "flex", gap: 8 }}>
              {STATUS_OPTIONS.map(s => (
                <button key={s} onClick={() => setForm(f => ({ ...f, status: s }))} style={{ flex: 1, padding: "8px 0", background: form.status === s ? "#E8E4DC" : "transparent", color: form.status === s ? "#0C0C0E" : "#555", border: `1px solid ${form.status === s ? "#E8E4DC" : "#2A2A2F"}`, borderRadius: 6, fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 1, textTransform: "uppercase", cursor: "pointer", transition: "all 0.15s" }}>{s}</button>
              ))}
            </div>
          </FField>
          <FField label="Key Partners">
            <input value={form.partners} onChange={e => setForm(f => ({ ...f, partners: e.target.value }))} placeholder="e.g. Legal, Sarah K., Audit Team" style={inputSt} />
          </FField>
          <FField label="Notes">
            <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any context or blockers…" rows={3} style={{ ...inputSt, resize: "vertical", lineHeight: 1.5 }} />
          </FField>
          <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
            <button onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY_FORM); }} style={{ flex: 1, padding: "12px 0", background: "#1A1A1E", color: "#555", border: "1px solid #2A2A2F", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 13, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleSubmit} disabled={!form.title.trim() || saving} style={{ flex: 2, padding: "12px 0", background: form.title.trim() ? "#E8E4DC" : "#1A1A1E", color: form.title.trim() ? "#0C0C0E" : "#333", border: "none", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: form.title.trim() ? "pointer" : "not-allowed", transition: "all 0.2s" }}>
              {saving ? "Saving…" : editId ? "Save Changes" : "Log Project"}
            </button>
          </div>
        </ModalWrap>
      )}

      {/* REMINDER MODAL */}
      {showReminder && (
        <ModalWrap onClose={() => setShowReminder(false)}>
          {!reminderSent ? (
            <>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, marginBottom: 6, color: "#F0EBE0" }}>🔔 Email Reminder</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#444", letterSpacing: 1, marginBottom: 22, textTransform: "uppercase" }}>
                {projects.find(p => p.id === reminder.project_id)?.title}
              </div>
              <FField label="Send reminder to">
                <input type="email" value={reminder.email} onChange={e => setReminder(r => ({ ...r, email: e.target.value }))} placeholder="you@company.com" style={inputSt} autoFocus />
              </FField>
              <FField label="Days before due date">
                <div style={{ display: "flex", gap: 8 }}>
                  {[1, 2, 3, 5, 7, 14].map(d => (
                    <button key={d} onClick={() => setReminder(r => ({ ...r, days_before: d }))} style={{ flex: 1, padding: "9px 0", background: reminder.days_before === d ? "#F5C842" : "transparent", color: reminder.days_before === d ? "#0C0C0E" : "#555", border: `1px solid ${reminder.days_before === d ? "#F5C842" : "#2A2A2F"}`, borderRadius: 6, fontFamily: "'DM Mono', monospace", fontSize: 11, fontWeight: 600, cursor: "pointer", transition: "all 0.15s" }}>{d}</button>
                  ))}
                </div>
              </FField>
              {(() => {
                const proj = projects.find(p => p.id === reminder.project_id);
                const rd   = proj?.due_date
                  ? new Date(new Date(proj.due_date).getTime() - reminder.days_before * 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                  : null;
                return <div style={{ fontSize: 12, color: "#444", fontFamily: "'DM Mono', monospace", letterSpacing: 0.5, marginBottom: 20, lineHeight: 1.7 }}>Reminder logged {reminder.days_before}d before due{rd ? ` — triggers ${rd}` : ""}.</div>;
              })()}
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setShowReminder(false)} style={{ flex: 1, padding: "12px 0", background: "#1A1A1E", color: "#555", border: "1px solid #2A2A2F", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontSize: 13, cursor: "pointer" }}>Cancel</button>
                <button onClick={saveReminder} disabled={!reminder.email} style={{ flex: 2, padding: "12px 0", background: reminder.email ? "#F5C842" : "#1A1A1E", color: reminder.email ? "#0C0C0E" : "#333", border: "none", borderRadius: 8, fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 13, cursor: reminder.email ? "pointer" : "not-allowed", transition: "all 0.2s" }}>Save Reminder</button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "24px 0" }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>🔔</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#F0EBE0", marginBottom: 8 }}>Reminder Saved</div>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#555", letterSpacing: 1 }}>{reminder.email} · {reminder.days_before}d before due</div>
            </div>
          )}
        </ModalWrap>
      )}

      <style>{`
        @keyframes fadeSlide { from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:translateY(0);} }
        input[type=date]::-webkit-calendar-picker-indicator{filter:invert(0.4);cursor:pointer;}
        select option{background:#111114;color:#E8E4DC;}
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:#0C0C0E;}::-webkit-scrollbar-thumb{background:#2A2A2F;border-radius:4px;}
        input::placeholder,textarea::placeholder{color:#333;}
      `}</style>
    </div>
  );
}

// ─── Small components ─────────────────────────────────────────────────────────

function ModalWrap({ children, onClose }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, backdropFilter: "blur(4px)", padding: 20 }}>
      <div style={{ background: "#111114", border: "1px solid #2A2A2F", borderRadius: 16, padding: "32px 36px", width: "100%", maxWidth: 460, boxShadow: "0 24px 80px rgba(0,0,0,0.6)" }}>
        {children}
      </div>
    </div>
  );
}

function FField({ label, children }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: "block", fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 2, color: "#555", textTransform: "uppercase", marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function MiniField({ label, value, color }) {
  return (
    <div>
      <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 2, color: "#3A3A3F", textTransform: "uppercase", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, color: color || "#777" }}>{value}</div>
    </div>
  );
}
