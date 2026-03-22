import { useMemo } from "react";
import { PRIORITIES, PRIORITY_CONFIG, getDaysUntil, fmtDate } from "../constants.js";
import { PageShell, PriorityBadge } from "../components.jsx";

const BUCKETS = [
  { key: "overdue", label: "Overdue",  test: d => d !== null && d < 0 },
  { key: "0-3",     label: "0–3d",     test: d => d !== null && d >= 0  && d <= 3 },
  { key: "4-7",     label: "4–7d",     test: d => d !== null && d >= 4  && d <= 7 },
  { key: "8-14",    label: "8–14d",    test: d => d !== null && d >= 8  && d <= 14 },
  { key: "15-21",   label: "15–21d",   test: d => d !== null && d >= 15 && d <= 21 },
  { key: "21+",     label: "21d+",     test: d => d !== null && d > 21 },
  { key: "no-date", label: "No Date",  test: d => d === null },
];

const BCOL = { overdue:"#FF3B3B","0-3":"#FF3B3B","4-7":"#FF8C00","8-14":"#F5C842","15-21":"#4ECDC4","21+":"#4ECDC4","no-date":"#3A3A3F" };

export default function Dashboard({ projects }) {
  const active = projects.filter(p => p.status !== "Complete");
  const overdueCount  = active.filter(p => { const d = getDaysUntil(p.due_date); return d !== null && d < 0; }).length;
  const criticalCount = active.filter(p => p.priority === "Critical").length;
  const completeCount = projects.filter(p => p.status === "Complete").length;

  const matrix = useMemo(() => {
    const r = {};
    PRIORITIES.forEach(pri => { r[pri] = {}; BUCKETS.forEach(b => { r[pri][b.key] = active.filter(p => p.priority === pri && b.test(getDaysUntil(p.due_date))); }); });
    return r;
  }, [active]);

  const colTotals = useMemo(() => BUCKETS.reduce((acc, b) => { acc[b.key] = active.filter(p => b.test(getDaysUntil(p.due_date))).length; return acc; }, {}), [active]);

  const today = new Date(); today.setHours(0,0,0,0);
  const in7   = new Date(today.getTime() + 7 * 86400000);

  const startingSoon = active.filter(p => { if (!p.start_date) return false; const d = new Date(p.start_date); d.setHours(0,0,0,0); return d >= today && d <= in7; }).sort((a,b) => new Date(a.start_date)-new Date(b.start_date));
  const dueSoon      = active.filter(p => { const d = getDaysUntil(p.due_date); return d !== null && d >= 0 && d <= 7; }).sort((a,b) => new Date(a.due_date)-new Date(b.due_date));

  return (
    <PageShell title="Dashboard" alert={overdueCount > 0 ? `● ${overdueCount} OVERDUE PROJECT${overdueCount>1?"S":""} REQUIRE ATTENTION` : null}>
      <div style={{ padding: "24px 32px 0" }}>

        {/* Stat cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 28 }}>
          {[
            { label: "Active",    value: active.length,  color: "#E8E4DC" },
            { label: "Overdue",   value: overdueCount,   color: overdueCount > 0 ? "#FF3B3B" : "#E8E4DC" },
            { label: "Critical",  value: criticalCount,  color: criticalCount > 0 ? "#FF3B3B" : "#E8E4DC" },
            { label: "Complete",  value: completeCount,  color: "#4ECDC4" },
          ].map(s => (
            <div key={s.label} style={{ background: "#111114", border: "1px solid #1E1E22", borderRadius: 10, padding: "16px 18px" }}>
              <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: 2, color: "#3A3A3F", textTransform: "uppercase", marginBottom: 8 }}>{s.label}</div>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 30, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Matrix */}
        <SLabel>Deadline Matrix — Active Projects</SLabel>
        <div style={{ background: "#111114", border: "1px solid #1E1E22", borderRadius: 12, overflow: "auto", marginBottom: 28 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 540 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1E1E22" }}>
                <th style={TH({ width: 100, textAlign: "left" })}>Priority</th>
                {BUCKETS.map(b => <th key={b.key} style={TH({})}><div style={{ color: BCOL[b.key] }}>{b.label}</div><div style={{ fontWeight: 400, color: "#2A2A2F", marginTop: 1 }}>{colTotals[b.key]||""}</div></th>)}
                <th style={TH({})}>Total</th>
              </tr>
            </thead>
            <tbody>
              {PRIORITIES.map((pri, ri) => {
                const pc = PRIORITY_CONFIG[pri];
                const rowProj = matrix[pri];
                const rowTotal = Object.values(rowProj).reduce((s,a)=>s+a.length,0);
                return (
                  <tr key={pri} style={{ borderBottom: ri < PRIORITIES.length-1 ? "1px solid #18181C" : "none" }}>
                    <td style={{ padding: "11px 16px" }}><span style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:pc.color,background:pc.bg,border:`1px solid ${pc.color}33`,borderRadius:4,padding:"2px 7px",letterSpacing:1,textTransform:"uppercase" }}>{pri}</span></td>
                    {BUCKETS.map(b => { const c = rowProj[b.key].length; return (
                      <td key={b.key} style={{ padding:"11px 16px",textAlign:"center" }}>
                        {c > 0 ? <span style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",width:26,height:26,borderRadius:"50%",background:`${BCOL[b.key]}22`,border:`1px solid ${BCOL[b.key]}44`,color:BCOL[b.key],fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:600 }}>{c}</span> : <span style={{ color:"#2A2A2F",fontFamily:"'DM Mono',monospace",fontSize:10 }}>—</span>}
                      </td>
                    );})}
                    <td style={{ padding:"11px 16px",textAlign:"center",fontFamily:"'DM Mono',monospace",fontSize:11,color:rowTotal>0?"#777":"#2A2A2F",fontWeight:600 }}>{rowTotal||"—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Two lists */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 28 }}>
          <PList title="Starting This Week" projects={startingSoon} dateKey="start_date" label="Starts" empty="No projects starting in the next 7 days" />
          <PList title="Due This Week"      projects={dueSoon}      dateKey="due_date"   label="Due"    empty="No projects due in the next 7 days" />
        </div>
      </div>
    </PageShell>
  );
}

function PList({ title, projects, dateKey, label, empty }) {
  return (
    <div style={{ background: "#111114", border: "1px solid #1E1E22", borderRadius: 12, overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #1E1E22", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 2, color: "#777", textTransform: "uppercase" }}>{title}</div>
        <span style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#333" }}>{projects.length}</span>
      </div>
      {projects.length === 0
        ? <div style={{ padding: "20px 16px", fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#2A2A2F", letterSpacing: 1, textAlign: "center", textTransform: "uppercase" }}>{empty}</div>
        : projects.map((p, i) => {
          const pc = PRIORITY_CONFIG[p.priority];
          return (
            <div key={p.id} style={{ padding: "11px 16px", borderBottom: i < projects.length-1 ? "1px solid #18181C" : "none", display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: pc.dot, flexShrink: 0, boxShadow: `0 0 4px ${pc.dot}88` }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "#E8E4DC", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.title}</div>
                <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, color: "#3A3A3F", marginTop: 2 }}>{label} {fmtDate(p[dateKey])}</div>
              </div>
              <PriorityBadge priority={p.priority} />
            </div>
          );
        })
      }
    </div>
  );
}

function SLabel({ children }) {
  return <div style={{ fontFamily: "'DM Mono', monospace", fontSize: 9, letterSpacing: 2, color: "#3A3A3F", textTransform: "uppercase", marginBottom: 8 }}>{children}</div>;
}

function TH(extra) {
  return { padding: "10px 16px", textAlign: "center", fontFamily: "'DM Mono', monospace", fontSize: 8, letterSpacing: 1, color: "#444", textTransform: "uppercase", fontWeight: 600, background: "#0D0D10", ...extra };
}
