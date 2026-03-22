import { useState, useMemo } from "react";
import { PRIORITY_CONFIG, getDaysUntil, fmtDate } from "../constants.js";
import { PageShell } from "../components.jsx";

export default function Digest({ projects }) {
  const [copied, setCopied] = useState(false);

  const today   = new Date(); today.setHours(0,0,0,0);
  const in7     = new Date(today.getTime() + 7 * 86400000);
  const ago7    = new Date(today.getTime() - 7 * 86400000);

  const active   = projects.filter(p => p.status !== "Complete");
  const overdue  = active.filter(p => { const d=getDaysUntil(p.due_date); return d!==null&&d<0; }).sort((a,b)=>new Date(a.due_date)-new Date(b.due_date));
  const dueThis  = active.filter(p => { const d=getDaysUntil(p.due_date); return d!==null&&d>=0&&d<=7; }).sort((a,b)=>new Date(a.due_date)-new Date(b.due_date));
  const starting = active.filter(p => { if(!p.start_date) return false; const d=new Date(p.start_date); d.setHours(0,0,0,0); return d>=today&&d<=in7; }).sort((a,b)=>new Date(a.start_date)-new Date(b.start_date));
  const completed= projects.filter(p => { if(p.status!=="Complete"||!p.updated_at) return false; const d=new Date(p.updated_at); return d>=ago7; }).sort((a,b)=>new Date(b.updated_at)-new Date(a.updated_at));
  const criticals= active.filter(p => p.priority==="Critical");

  const weekStr = today.toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"});

  const digest = useMemo(() => {
    const lines = [];
    lines.push(`Subject: CFO Project Status — Week of ${weekStr}`);
    lines.push("");
    lines.push(`Hi [CEO Name],`);
    lines.push("");
    lines.push(`Here's a quick snapshot of where we stand heading into the week.`);
    lines.push("");

    // Stats
    lines.push(`OVERVIEW`);
    lines.push(`─────────────────────────────────`);
    lines.push(`Active projects:   ${active.length}`);
    lines.push(`Overdue:           ${overdue.length}`);
    lines.push(`Critical (open):   ${criticals.length}`);
    lines.push(`Completed (7d):    ${completed.length}`);
    lines.push("");

    // Overdue
    if (overdue.length > 0) {
      lines.push(`⚠ OVERDUE (${overdue.length})`);
      lines.push(`─────────────────────────────────`);
      overdue.forEach(p => {
        const days = Math.abs(getDaysUntil(p.due_date));
        lines.push(`• ${p.title}`);
        lines.push(`  Priority: ${p.priority}  |  Was due: ${fmtDate(p.due_date)} (${days}d ago)${p.partners?`  |  Partners: ${p.partners}`:""}`);
      });
      lines.push("");
    }

    // Due this week
    if (dueThis.length > 0) {
      lines.push(`📅 DUE THIS WEEK (${dueThis.length})`);
      lines.push(`─────────────────────────────────`);
      dueThis.forEach(p => {
        const d = getDaysUntil(p.due_date);
        const when = d===0?"Today":d===1?"Tomorrow":`${fmtDate(p.due_date)}`;
        lines.push(`• ${p.title}`);
        lines.push(`  Priority: ${p.priority}  |  Due: ${when}${p.partners?`  |  Partners: ${p.partners}`:""}`);
      });
      lines.push("");
    }

    // Starting this week
    if (starting.length > 0) {
      lines.push(`🚀 STARTING THIS WEEK (${starting.length})`);
      lines.push(`─────────────────────────────────`);
      starting.forEach(p => {
        lines.push(`• ${p.title}`);
        lines.push(`  Priority: ${p.priority}  |  Starts: ${fmtDate(p.start_date)}  |  Due: ${fmtDate(p.due_date)}${p.partners?`  |  Partners: ${p.partners}`:""}`);
      });
      lines.push("");
    }

    // Completed
    if (completed.length > 0) {
      lines.push(`✅ COMPLETED THIS WEEK (${completed.length})`);
      lines.push(`─────────────────────────────────`);
      completed.forEach(p => {
        lines.push(`• ${p.title}${p.partners?`  (${p.partners})`:""}`);
      });
      lines.push("");
    }

    // All critical
    if (criticals.length > 0) {
      lines.push(`🔴 ALL OPEN CRITICAL ITEMS (${criticals.length})`);
      lines.push(`─────────────────────────────────`);
      criticals.forEach(p => {
        const d = getDaysUntil(p.due_date);
        const dueStr = d===null?"No due date set":d<0?`Overdue by ${Math.abs(d)}d`:d===0?"Due today":`Due in ${d}d (${fmtDate(p.due_date)})`;
        lines.push(`• ${p.title}  |  ${dueStr}${p.partners?`  |  Partners: ${p.partners}`:""}`);
        if (p.notes) lines.push(`  Note: ${p.notes}`);
      });
      lines.push("");
    }

    lines.push(`Let me know if you'd like to discuss any of these.`);
    lines.push("");
    lines.push(`Ben Peery`);
    lines.push(`Chief Financial Officer`);

    return lines.join("\n");
  }, [projects]);

  function copyToClipboard() {
    navigator.clipboard.writeText(digest).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <PageShell
      title="CEO Digest"
      alert={null}
      actions={
        <button onClick={copyToClipboard} style={{ background: copied ? "#4ECDC4" : "#E8E4DC", color: "#0C0C0E", border: "none", borderRadius: 8, padding: "9px 18px", fontFamily: "'DM Sans', sans-serif", fontWeight: 600, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, transition: "all 0.2s" }}>
          {copied ? "✓ Copied!" : "Copy to Clipboard"}
        </button>
      }
    >
      <div style={{ padding: "24px 32px 0" }}>
        {/* Stats bar */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:24 }}>
          {[
            { label:"Due this week",  value:dueThis.length,   color:dueThis.length>0?"#FF8C00":"#E8E4DC" },
            { label:"Overdue",        value:overdue.length,   color:overdue.length>0?"#FF3B3B":"#E8E4DC" },
            { label:"Starting",       value:starting.length,  color:"#4ECDC4" },
            { label:"Completed (7d)", value:completed.length, color:"#4ECDC4" },
          ].map(s=>(
            <div key={s.label} style={{ background:"#111114",border:"1px solid #1E1E22",borderRadius:10,padding:"14px 16px" }}>
              <div style={{ fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:2,color:"#3A3A3F",textTransform:"uppercase",marginBottom:6 }}>{s.label}</div>
              <div style={{ fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,color:s.color,lineHeight:1 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Instructions */}
        <div style={{ marginBottom:16,padding:"12px 16px",background:"#0D0D10",border:"1px solid #1E1E22",borderRadius:8,fontFamily:"'DM Mono',monospace",fontSize:9,color:"#3A3A3F",lineHeight:1.7,letterSpacing:0.5 }}>
          ↑ CLICK "COPY TO CLIPBOARD" THEN PASTE INTO YOUR EMAIL CLIENT. REPLACE [CEO NAME] WITH THE RECIPIENT'S NAME.
        </div>

        {/* Digest preview */}
        <div style={{ background:"#111114",border:"1px solid #1E1E22",borderRadius:12,overflow:"hidden" }}>
          <div style={{ padding:"12px 18px",borderBottom:"1px solid #1E1E22",background:"#0D0D10",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <span style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:"#444",letterSpacing:2,textTransform:"uppercase" }}>Email Preview</span>
            <span style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:"#2A2A2F",letterSpacing:1 }}>Week of {weekStr}</span>
          </div>
          <pre style={{ margin:0,padding:"20px 24px",fontFamily:"'DM Mono',monospace",fontSize:11,color:"#888",lineHeight:1.75,whiteSpace:"pre-wrap",wordBreak:"break-word",overflowX:"auto",maxHeight:600,overflowY:"auto" }}>
            {digest}
          </pre>
        </div>
      </div>
    </PageShell>
  );
}
