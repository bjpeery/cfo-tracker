import { useMemo, useState } from "react";
import { PRIORITIES, PRIORITY_CONFIG, getDaysUntil } from "../constants.js";
import { PageShell } from "../components.jsx";

function addDays(date, days) { const d = new Date(date); d.setDate(d.getDate() + days); return d; }
function startOfDay(date)    { const d = new Date(date); d.setHours(0,0,0,0); return d; }

export default function Timeline({ projects }) {
  const [hoveredId, setHoveredId] = useState(null);
  const today       = startOfDay(new Date());
  const windowEnd   = addDays(today, 91);
  const totalDays   = 91;

  const visible = useMemo(() => projects
    .filter(p => p.status !== "Complete")
    .filter(p => {
      const s = p.start_date ? startOfDay(new Date(p.start_date)) : null;
      const e = p.due_date   ? startOfDay(new Date(p.due_date))   : null;
      if (!s && !e) return false;
      return (e || s) >= today && (s || e) <= windowEnd;
    })
    .sort((a,b) => new Date(a.start_date || a.due_date) - new Date(b.start_date || b.due_date)),
  [projects]);

  const months = useMemo(() => {
    const result = []; let d = new Date(today); d.setDate(1);
    while (d <= windowEnd) {
      const offset = Math.max(0,(startOfDay(d)-today)/86400000);
      if (offset <= totalDays) result.push({ label: d.toLocaleDateString("en-US",{month:"short",year:"2-digit"}), offset });
      d.setMonth(d.getMonth()+1);
    }
    return result;
  }, []);

  const weekLines = useMemo(() => { const l=[]; for(let i=7;i<totalDays;i+=7) l.push(i); return l; }, []);
  const pct = days => (days/totalDays)*100;

  function getBar(p) {
    const s = p.start_date ? startOfDay(new Date(p.start_date)) : null;
    const e = p.due_date   ? startOfDay(new Date(p.due_date))   : null;
    let barStart, barEnd;
    if (s&&e){barStart=s;barEnd=e;} else if(s){barStart=s;barEnd=addDays(s,1);} else{barStart=e;barEnd=addDays(e,1);}
    const startOff = Math.max(0,(barStart-today)/86400000);
    const endOff   = Math.min(totalDays,(barEnd-today)/86400000);
    return { left:pct(startOff), width:pct(Math.max(endOff-startOff,0.5)), pointOnly:!p.start_date||!p.due_date };
  }

  return (
    <PageShell title="Timeline" alert={`${visible.length} ACTIVE PROJECT${visible.length!==1?"S":""} · NEXT 3 MONTHS`}>
      <div style={{ padding:"20px 32px 0" }}>
        {/* Legend */}
        <div style={{ display:"flex",gap:18,marginBottom:16,flexWrap:"wrap" }}>
          {PRIORITIES.map(p=>{ const pc=PRIORITY_CONFIG[p]; return <div key={p} style={{ display:"flex",alignItems:"center",gap:5 }}><div style={{ width:11,height:11,borderRadius:3,background:pc.color,opacity:0.8 }} /><span style={{ fontFamily:"'DM Mono',monospace",fontSize:8,color:"#444",letterSpacing:1,textTransform:"uppercase" }}>{p}</span></div>; })}
          <div style={{ display:"flex",alignItems:"center",gap:5 }}><div style={{ width:2,height:11,background:"#E8E4DC" }} /><span style={{ fontFamily:"'DM Mono',monospace",fontSize:8,color:"#444",letterSpacing:1,textTransform:"uppercase" }}>Today</span></div>
          <div style={{ display:"flex",alignItems:"center",gap:5 }}><div style={{ width:10,height:3,borderRadius:2,background:"#333",border:"1px dashed #555" }} /><span style={{ fontFamily:"'DM Mono',monospace",fontSize:8,color:"#444",letterSpacing:1,textTransform:"uppercase" }}>Due only</span></div>
        </div>

        {visible.length===0 ? (
          <div style={{ textAlign:"center",padding:"80px 0",color:"#2A2A2F",fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:2 }}>NO ACTIVE PROJECTS WITH DATES IN THIS WINDOW</div>
        ) : (
          <div style={{ background:"#111114",border:"1px solid #1E1E22",borderRadius:12,overflow:"hidden" }}>
            {/* Month header */}
            <div style={{ position:"relative",height:30,borderBottom:"1px solid #1E1E22",background:"#0D0D10" }}>
              {weekLines.map(w=><div key={w} style={{ position:"absolute",left:`${pct(w)}%`,top:0,bottom:0,width:1,background:"#18181C" }} />)}
              {months.map(m=><div key={m.label} style={{ position:"absolute",left:`${pct(m.offset)}%`,top:0,bottom:0,display:"flex",alignItems:"center",paddingLeft:8 }}><span style={{ fontFamily:"'DM Mono',monospace",fontSize:8,color:"#444",letterSpacing:1,textTransform:"uppercase",whiteSpace:"nowrap" }}>{m.label}</span></div>)}
              <div style={{ position:"absolute",left:"0%",top:0,bottom:0,width:2,background:"#E8E4DC",opacity:0.5 }} />
            </div>

            {/* Rows */}
            {visible.map((p,i)=>{
              const pc=PRIORITY_CONFIG[p.priority];
              const bar=getBar(p);
              const hov=hoveredId===p.id;
              const days=getDaysUntil(p.due_date);
              return (
                <div key={p.id} onMouseEnter={()=>setHoveredId(p.id)} onMouseLeave={()=>setHoveredId(null)} style={{ position:"relative",height:42,borderBottom:i<visible.length-1?"1px solid #18181C":"none",display:"flex",alignItems:"center",background:hov?"#161619":"transparent",transition:"background 0.15s" }}>
                  {weekLines.map(w=><div key={w} style={{ position:"absolute",left:`${pct(w)}%`,top:0,bottom:0,width:1,background:"#18181C",pointerEvents:"none" }} />)}
                  <div style={{ position:"absolute",left:"0%",top:0,bottom:0,width:2,background:"#E8E4DC",opacity:0.15,pointerEvents:"none",zIndex:1 }} />
                  {/* Label */}
                  <div style={{ width:190,flexShrink:0,padding:"0 12px",zIndex:2 }}>
                    <div style={{ fontSize:11,fontWeight:500,color:"#E8E4DC",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{p.title}</div>
                    <div style={{ display:"flex",alignItems:"center",gap:4,marginTop:2 }}>
                      <span style={{ width:5,height:5,borderRadius:"50%",background:pc.dot,flexShrink:0 }} />
                      <span style={{ fontFamily:"'DM Mono',monospace",fontSize:8,color:"#3A3A3F",letterSpacing:0.5 }}>{p.priority.toUpperCase()}</span>
                      {days!==null&&days<0&&<span style={{ fontFamily:"'DM Mono',monospace",fontSize:8,color:"#FF3B3B",letterSpacing:0.5 }}>OVERDUE</span>}
                    </div>
                  </div>
                  {/* Bar area */}
                  <div style={{ flex:1,position:"relative",height:"100%",overflow:"visible" }}>
                    {bar.pointOnly ? (
                      <div style={{ position:"absolute",left:`${bar.left}%`,top:"50%",transform:"translate(-50%,-50%) rotate(45deg)",width:9,height:9,background:pc.color,opacity:0.9,zIndex:2 }} />
                    ) : (
                      <div style={{ position:"absolute",left:`${bar.left}%`,width:`${bar.width}%`,top:"50%",transform:"translateY(-50%)",height:16,borderRadius:4,background:`linear-gradient(90deg,${pc.color}CC,${pc.color}77)`,border:`1px solid ${pc.color}55`,boxShadow:hov?`0 0 8px ${pc.color}44`:"none",transition:"box-shadow 0.15s",zIndex:2,minWidth:5 }} />
                    )}
                    {hov&&(
                      <div style={{ position:"absolute",left:`${Math.min(bar.left,75)}%`,top:"calc(50% + 14px)",background:"#1A1A1E",border:"1px solid #2A2A2F",borderRadius:8,padding:"8px 12px",zIndex:100,whiteSpace:"nowrap",boxShadow:"0 4px 20px rgba(0,0,0,0.5)",pointerEvents:"none" }}>
                        <div style={{ fontFamily:"'DM Mono',monospace",fontSize:10,color:"#E8E4DC",fontWeight:600,marginBottom:3 }}>{p.title}</div>
                        {p.start_date&&<div style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:"#555" }}>START {new Date(p.start_date).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</div>}
                        {p.due_date&&<div style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:days!==null&&days<0?"#FF3B3B":days!==null&&days<=3?"#FF8C00":"#555" }}>DUE {new Date(p.due_date).toLocaleDateString("en-US",{month:"short",day:"numeric"})} {days!==null?`(${days<0?"OVERDUE":days+"d"})`:""}</div>}
                        {p.partners&&<div style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:"#3A3A3F",marginTop:2 }}>{p.partners}</div>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PageShell>
  );
}
