import { useMemo, useState, useEffect, useRef } from "react";
import { PRIORITIES, PRIORITY_CONFIG, DAY_TO_DAY_TITLE, getDaysUntil, fmtDate } from "../constants.js";
import { PageShell, PriorityBadge, ProgressBar } from "../components.jsx";

const BUCKETS = [
  { key:"overdue", label:"Overdue",  test: d => d!==null&&d<0 },
  { key:"0-3",     label:"0–3d",     test: d => d!==null&&d>=0&&d<=3 },
  { key:"4-7",     label:"4–7d",     test: d => d!==null&&d>=4&&d<=7 },
  { key:"8-14",    label:"8–14d",    test: d => d!==null&&d>=8&&d<=14 },
  { key:"15-21",   label:"15–21d",   test: d => d!==null&&d>=15&&d<=21 },
  { key:"21+",     label:"21d+",     test: d => d!==null&&d>21 },
  { key:"no-date", label:"No Date",  test: d => d===null },
];
const BCOL = { overdue:"#FF3B3B","0-3":"#FF3B3B","4-7":"#FF8C00","8-14":"#F5C842","15-21":"#4ECDC4","21+":"#4ECDC4","no-date":"#3A3A3F" };

const MATRIX_PREF_KEY = "cfo_matrix_mode";

export default function Dashboard({ projects, tasks }) {
  const [matrixMode, setMatrixMode] = useState(() => localStorage.getItem(MATRIX_PREF_KEY) || "task");
  const [tooltip, setTooltip] = useState(null); // { items, x, y }
  const tooltipRef = useRef(null);

  useEffect(() => { localStorage.setItem(MATRIX_PREF_KEY, matrixMode); }, [matrixMode]);

  // Close tooltip on outside click
  useEffect(() => {
    function h(e) { if (tooltipRef.current && !tooltipRef.current.contains(e.target)) setTooltip(null); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const activeProjects = projects.filter(p => p.status !== "Complete");
  const activeTasks    = tasks.filter(t => !t.complete);

  const overdueCount  = activeTasks.filter(t => { const d=getDaysUntil(t.due_date); return d!==null&&d<0; }).length;
  const criticalCount = activeTasks.filter(t => t.priority==="Critical").length;
  const completeCount = tasks.filter(t => t.complete).length;

  // Matrix data
  const matrix = useMemo(() => {
    const items = matrixMode === "task" ? activeTasks : activeProjects;
    const dateKey = matrixMode === "task" ? "due_date" : "due_date";
    const result = {};
    PRIORITIES.forEach(pri => {
      result[pri] = {};
      BUCKETS.forEach(b => {
        result[pri][b.key] = items.filter(item =>
          item.priority === pri && b.test(getDaysUntil(item[dateKey]))
        );
      });
    });
    return result;
  }, [matrixMode, activeTasks, activeProjects]);

  const colTotals = useMemo(() => {
    const items = matrixMode === "task" ? activeTasks : activeProjects;
    return BUCKETS.reduce((acc,b) => {
      acc[b.key] = items.filter(item => b.test(getDaysUntil(item.due_date))).length;
      return acc;
    }, {});
  }, [matrixMode, activeTasks, activeProjects]);

  // Lists
  const today = new Date(); today.setHours(0,0,0,0);
  const in7   = new Date(today.getTime() + 7*86400000);

  const startingSoon = activeProjects.filter(p => {
    if (!p.start_date) return false;
    const d = new Date(p.start_date); d.setHours(0,0,0,0);
    return d>=today && d<=in7;
  }).sort((a,b) => new Date(a.start_date)-new Date(b.start_date));

  const dueSoon = activeTasks.filter(t => {
    const d = getDaysUntil(t.due_date);
    return d!==null && d>=0 && d<=7;
  }).sort((a,b) => new Date(a.due_date)-new Date(b.due_date));

  function handleCellHover(e, items) {
    if (items.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltip({ items, x: rect.left + rect.width/2, y: rect.bottom + 8 });
  }

  return (
    <PageShell title="Dashboard" alert={overdueCount>0?`● ${overdueCount} OVERDUE TASK${overdueCount>1?"S":""} REQUIRE ATTENTION`:null}>
      <div style={{ padding:"24px 32px 0" }}>

        {/* Stat cards */}
        <div style={{ display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:28 }}>
          {[
            { label:"Active Tasks",   value:activeTasks.length,  color:"#E8E4DC" },
            { label:"Overdue Tasks",  value:overdueCount,        color:overdueCount>0?"#FF3B3B":"#E8E4DC" },
            { label:"Critical Tasks", value:criticalCount,       color:criticalCount>0?"#FF3B3B":"#E8E4DC" },
            { label:"Tasks Complete", value:completeCount,       color:"#4ECDC4" },
          ].map(s=>(
            <div key={s.label} style={{ background:"#111114",border:"1px solid #1E1E22",borderRadius:10,padding:"16px 18px" }}>
              <div style={{ fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:2,color:"#3A3A3F",textTransform:"uppercase",marginBottom:8 }}>{s.label}</div>
              <div style={{ fontFamily:"'Playfair Display',serif",fontSize:30,fontWeight:700,color:s.color,lineHeight:1 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Matrix */}
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
          <div style={{ fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,color:"#3A3A3F",textTransform:"uppercase" }}>
            Deadline Matrix — {matrixMode==="task"?"Tasks":"Projects"}
          </div>
          <div style={{ display:"flex",gap:6 }}>
            {["task","project"].map(m=>(
              <button key={m} onClick={()=>setMatrixMode(m)} style={{ background:matrixMode===m?"#1E1E22":"transparent",color:matrixMode===m?"#E8E4DC":"#444",border:`1px solid ${matrixMode===m?"#3A3A3F":"#2A2A2F"}`,borderRadius:6,padding:"4px 10px",fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",transition:"all 0.15s" }}>
                {m==="task"?"Tasks":"Projects"}
              </button>
            ))}
          </div>
        </div>

        <div style={{ background:"#111114",border:"1px solid #1E1E22",borderRadius:12,overflow:"auto",marginBottom:28,position:"relative" }}>
          <table style={{ width:"100%",borderCollapse:"collapse",minWidth:540 }}>
            <thead>
              <tr style={{ borderBottom:"1px solid #1E1E22" }}>
                <th style={TH({width:100,textAlign:"left"})}>Priority</th>
                {BUCKETS.map(b=>(
                  <th key={b.key} style={TH({})}>
                    <div style={{ color:BCOL[b.key] }}>{b.label}</div>
                    <div style={{ fontWeight:400,color:"#2A2A2F",marginTop:1 }}>{colTotals[b.key]||""}</div>
                  </th>
                ))}
                <th style={TH({})}>Total</th>
              </tr>
            </thead>
            <tbody>
              {PRIORITIES.map((pri,ri)=>{
                const pc=PRIORITY_CONFIG[pri];
                const rowItems=matrix[pri];
                const rowTotal=Object.values(rowItems).reduce((s,a)=>s+a.length,0);
                return (
                  <tr key={pri} style={{ borderBottom:ri<PRIORITIES.length-1?"1px solid #18181C":"none" }}>
                    <td style={{ padding:"11px 16px" }}>
                      <span style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:pc.color,background:pc.bg,border:`1px solid ${pc.color}33`,borderRadius:4,padding:"2px 7px",letterSpacing:1,textTransform:"uppercase" }}>{pri}</span>
                    </td>
                    {BUCKETS.map(b=>{
                      const cellItems = rowItems[b.key];
                      const count = cellItems.length;
                      return (
                        <td key={b.key} style={{ padding:"11px 16px",textAlign:"center" }}>
                          {count>0 ? (
                            <span
                              onMouseEnter={e=>handleCellHover(e,cellItems)}
                              onMouseLeave={()=>setTooltip(null)}
                              style={{ display:"inline-flex",alignItems:"center",justifyContent:"center",width:26,height:26,borderRadius:"50%",background:`${BCOL[b.key]}22`,border:`1px solid ${BCOL[b.key]}44`,color:BCOL[b.key],fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:600,cursor:"pointer",transition:"transform 0.15s" }}
                            >{count}</span>
                          ) : (
                            <span style={{ color:"#1E1E22",fontFamily:"'DM Mono',monospace",fontSize:10 }}>—</span>
                          )}
                        </td>
                      );
                    })}
                    <td style={{ padding:"11px 16px",textAlign:"center",fontFamily:"'DM Mono',monospace",fontSize:11,color:rowTotal>0?"#666":"#2A2A2F",fontWeight:600 }}>{rowTotal||"—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Tooltip */}
        {tooltip&&(
          <div ref={tooltipRef} style={{ position:"fixed",left:Math.min(tooltip.x,window.innerWidth-260),top:tooltip.y,background:"#1A1A1E",border:"1px solid #2A2A2F",borderRadius:10,padding:"10px 14px",zIndex:300,minWidth:220,maxWidth:300,boxShadow:"0 8px 32px rgba(0,0,0,0.6)",animation:"fadeIn 0.1s ease" }}>
            <div style={{ fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:2,color:"#444",textTransform:"uppercase",marginBottom:8 }}>{tooltip.items.length} ITEM{tooltip.items.length>1?"S":""}</div>
            {tooltip.items.map((item,i)=>{
              const proj = matrixMode==="task" ? null : null;
              const isTask = matrixMode==="task";
              return (
                <div key={item.id||i} style={{ marginBottom:i<tooltip.items.length-1?8:0,paddingBottom:i<tooltip.items.length-1?8:0,borderBottom:i<tooltip.items.length-1?"1px solid #2A2A2F":"none" }}>
                  <div style={{ fontSize:12,fontWeight:500,color:"#E8E4DC",lineHeight:1.4 }}>{item.title}</div>
                  {isTask&&item.project_title&&<div style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:"#555",marginTop:2 }}>{item.project_title}</div>}
                  {item.due_date&&<div style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:"#444",marginTop:2 }}>Due {fmtDate(item.due_date)}</div>}
                </div>
              );
            })}
          </div>
        )}

        {/* Two lists */}
        <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:28 }}>
          <PList title="Projects Starting This Week" items={startingSoon} dateKey="start_date" label="Starts" empty="No projects starting in the next 7 days" showProject={false} />
          <PList title="Tasks Due This Week" items={dueSoon.map(t=>({...t,project_title:projects.find(p=>p.id===t.project_id)?.title}))} dateKey="due_date" label="Due" empty="No tasks due in the next 7 days" showProject={true} />
        </div>
      </div>
    </PageShell>
  );
}

function PList({ title, items, dateKey, label, empty, showProject }) {
  return (
    <div style={{ background:"#111114",border:"1px solid #1E1E22",borderRadius:12,overflow:"hidden" }}>
      <div style={{ padding:"12px 16px",borderBottom:"1px solid #1E1E22",display:"flex",justifyContent:"space-between",alignItems:"center" }}>
        <div style={{ fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,color:"#777",textTransform:"uppercase" }}>{title}</div>
        <span style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:"#333" }}>{items.length}</span>
      </div>
      {items.length===0
        ? <div style={{ padding:"20px 16px",fontFamily:"'DM Mono',monospace",fontSize:9,color:"#2A2A2F",letterSpacing:1,textAlign:"center",textTransform:"uppercase" }}>{empty}</div>
        : items.map((item,i)=>{
          const pc=PRIORITY_CONFIG[item.priority];
          return (
            <div key={item.id||i} style={{ padding:"11px 16px",borderBottom:i<items.length-1?"1px solid #18181C":"none",display:"flex",alignItems:"center",gap:10 }}>
              <div style={{ width:7,height:7,borderRadius:"50%",background:pc.dot,flexShrink:0,boxShadow:`0 0 4px ${pc.dot}88` }} />
              <div style={{ flex:1,minWidth:0 }}>
                <div style={{ fontSize:12,fontWeight:500,color:"#E8E4DC",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{item.title}</div>
                <div style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:"#3A3A3F",marginTop:2 }}>
                  {showProject&&item.project_title&&<span style={{ color:"#444",marginRight:6 }}>{item.project_title} ·</span>}
                  {label} {fmtDate(item[dateKey])}
                </div>
              </div>
              <PriorityBadge priority={item.priority} />
            </div>
          );
        })
      }
    </div>
  );
}

function TH(extra) {
  return { padding:"10px 16px",textAlign:"center",fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:1,color:"#444",textTransform:"uppercase",fontWeight:600,background:"#0D0D10",...extra };
}
