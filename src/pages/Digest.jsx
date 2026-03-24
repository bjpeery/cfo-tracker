import { useState, useMemo } from "react";
import { PRIORITY_CONFIG, DAY_TO_DAY_TITLE, getDaysUntil, fmtDate, getTaskProgress } from "../constants.js";
import { PageShell } from "../components.jsx";

export default function Digest({ projects, tasks }) {
  const [copied, setCopied] = useState(false);

  const today  = new Date(); today.setHours(0,0,0,0);
  const in7    = new Date(today.getTime() + 7 * 86400000);
  const weekStr = today.toLocaleDateString("en-US", { month:"long", day:"numeric", year:"numeric" });

  // Exclude Day-to-Day from digest
  const digestProjects = projects.filter(p =>
    p.status !== "Complete" && p.title !== DAY_TO_DAY_TITLE
  );

  const activeTasks = tasks.filter(t => !t.complete);
  const overdueTasks = activeTasks.filter(t => { const d=getDaysUntil(t.due_date); return d!==null&&d<0; });
  const dueThisWeek  = activeTasks.filter(t => { const d=getDaysUntil(t.due_date); return d!==null&&d>=0&&d<=7; });

  // Next steps per project: top 2-3 incomplete tasks sorted by due date then priority
  function getNextSteps(projectId) {
    return activeTasks
      .filter(t => t.project_id === projectId)
      .sort((a,b) => {
        const da = a.due_date ? new Date(a.due_date) : new Date("9999");
        const db = b.due_date ? new Date(b.due_date) : new Date("9999");
        if (da - db !== 0) return da - db;
        const PRIORITIES = ["Critical","High","Medium","Low"];
        return PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority);
      })
      .slice(0, 3);
  }

  const digest = useMemo(() => {
    const lines = [];
    lines.push(`Subject: CFO Project Status — Week of ${weekStr}`);
    lines.push("");
    lines.push(`Hi [CEO Name],`);
    lines.push("");
    lines.push(`Here's a quick look at where we stand heading into the week.`);
    lines.push("");

    // Overview stats
    const totalActive = digestProjects.length;
    const overdueCount = overdueTasks.filter(t => digestProjects.some(p=>p.id===t.project_id)).length;
    const criticalCount = digestProjects.filter(p=>p.priority==="Critical").length;

    lines.push(`OVERVIEW`);
    lines.push(`─────────────────────────────────`);
    lines.push(`Active projects:   ${totalActive}`);
    lines.push(`Overdue tasks:     ${overdueCount}`);
    lines.push(`Critical projects: ${criticalCount}`);
    lines.push("");

    // Overdue callout
    const overdueProjectTasks = overdueTasks.filter(t => digestProjects.some(p=>p.id===t.project_id));
    if (overdueProjectTasks.length > 0) {
      lines.push(`⚠ OVERDUE TASKS (${overdueProjectTasks.length})`);
      lines.push(`─────────────────────────────────`);
      overdueProjectTasks.forEach(t => {
        const proj = digestProjects.find(p=>p.id===t.project_id);
        const days = Math.abs(getDaysUntil(t.due_date));
        lines.push(`• ${t.title}${proj?` [${proj.title}]`:""}`);
        lines.push(`  Was due: ${fmtDate(t.due_date)} (${days}d ago)  |  Priority: ${t.priority}${t.assignee?`  |  Assignee: ${t.assignee}`:""}`);
      });
      lines.push("");
    }

    // Projects grouped with next steps
    lines.push(`PROJECT STATUS`);
    lines.push(`─────────────────────────────────`);
    lines.push("");

    digestProjects.forEach(p => {
      const projTasks  = tasks.filter(t=>t.project_id===p.id);
      const progress   = getTaskProgress(projTasks);
      const nextSteps  = getNextSteps(p.id);
      const daysUntil  = getDaysUntil(p.due_date);
      const dueStr     = daysUntil===null ? "No due date" : daysUntil < 0 ? `Overdue by ${Math.abs(daysUntil)}d` : daysUntil===0 ? "Due today" : `Due in ${daysUntil}d (${fmtDate(p.due_date)})`;

      lines.push(`▸ ${p.title.toUpperCase()}`);
      lines.push(`  Priority: ${p.priority}  |  ${dueStr}  |  Progress: ${progress.complete}/${progress.total} tasks`);
      if (p.partners) lines.push(`  Partners: ${p.partners}`);
      if (p.notes)    lines.push(`  Context: ${p.notes}`);

      if (nextSteps.length > 0) {
        lines.push(`  Next Steps:`);
        nextSteps.forEach((t,i) => {
          const dStr = t.due_date ? ` (due ${fmtDate(t.due_date)})` : "";
          const aStr = t.assignee ? ` — ${t.assignee}` : "";
          lines.push(`  ${i+1}. ${t.title}${dStr}${aStr}`);
        });
      } else {
        lines.push(`  Next Steps: No open tasks`);
      }
      lines.push("");
    });

    lines.push(`Let me know if you'd like to discuss any of these.`);
    lines.push("");
    lines.push(`Ben Peery`);
    lines.push(`Chief Financial Officer`);

    return lines.join("\n");
  }, [projects, tasks]);

  function copyToClipboard() {
    navigator.clipboard.writeText(digest).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <PageShell
      title="CEO Digest"
      actions={
        <button onClick={copyToClipboard} style={{ background:copied?"#4ECDC4":"#E8E4DC",color:"#0C0C0E",border:"none",borderRadius:8,padding:"9px 18px",fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:7,transition:"all 0.2s" }}>
          {copied?"✓ Copied!":"Copy to Clipboard"}
        </button>
      }
    >
      <div style={{ padding:"24px 32px 0" }}>
        {/* Stats */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:24 }}>
          {[
            { label:"Active Projects",   value:digestProjects.length,  color:"#E8E4DC" },
            { label:"Overdue Tasks",     value:overdueTasks.filter(t=>digestProjects.some(p=>p.id===t.project_id)).length, color:overdueTasks.length>0?"#FF3B3B":"#E8E4DC" },
            { label:"Due This Week",     value:dueThisWeek.filter(t=>digestProjects.some(p=>p.id===t.project_id)).length,  color:dueThisWeek.length>0?"#FF8C00":"#E8E4DC" },
            { label:"Critical Projects", value:digestProjects.filter(p=>p.priority==="Critical").length, color:digestProjects.filter(p=>p.priority==="Critical").length>0?"#FF3B3B":"#E8E4DC" },
          ].map(s=>(
            <div key={s.label} style={{ background:"#111114",border:"1px solid #1E1E22",borderRadius:10,padding:"14px 16px" }}>
              <div style={{ fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:2,color:"#3A3A3F",textTransform:"uppercase",marginBottom:6 }}>{s.label}</div>
              <div style={{ fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:700,color:s.color,lineHeight:1 }}>{s.value}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom:14,padding:"10px 14px",background:"#0D0D10",border:"1px solid #1E1E22",borderRadius:8,fontFamily:"'DM Mono',monospace",fontSize:9,color:"#3A3A3F",lineHeight:1.7,letterSpacing:0.5 }}>
          ↑ CLICK "COPY TO CLIPBOARD" THEN PASTE INTO YOUR EMAIL CLIENT. REPLACE [CEO NAME] BEFORE SENDING. DAY-TO-DAY TASKS ARE EXCLUDED.
        </div>

        <div style={{ background:"#111114",border:"1px solid #1E1E22",borderRadius:12,overflow:"hidden" }}>
          <div style={{ padding:"11px 18px",borderBottom:"1px solid #1E1E22",background:"#0D0D10",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
            <span style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:"#444",letterSpacing:2,textTransform:"uppercase" }}>Email Preview</span>
            <span style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:"#2A2A2F",letterSpacing:1 }}>Week of {weekStr}</span>
          </div>
          <pre style={{ margin:0,padding:"18px 22px",fontFamily:"'DM Mono',monospace",fontSize:11,color:"#777",lineHeight:1.8,whiteSpace:"pre-wrap",wordBreak:"break-word",overflowX:"auto",maxHeight:600,overflowY:"auto" }}>
            {digest}
          </pre>
        </div>
      </div>
    </PageShell>
  );
}
