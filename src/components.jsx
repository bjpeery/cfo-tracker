import { PRIORITY_CONFIG, getDaysUntil, INPUT_STYLE } from "./constants.js";

export function ModalWrap({ children, onClose, wide = false }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:"fixed",inset:0,background:"rgba(0,0,0,0.8)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,backdropFilter:"blur(4px)",padding:16 }}>
      <div style={{ background:"#111114",border:"1px solid #2A2A2F",borderRadius:16,padding:"28px 32px",width:"100%",maxWidth:wide?580:480,boxShadow:"0 24px 80px rgba(0,0,0,0.7)",maxHeight:"92vh",overflowY:"auto" }}>
        {children}
      </div>
    </div>
  );
}

export function FField({ label, children }) {
  return (
    <div style={{ marginBottom:14 }}>
      <label style={{ display:"block",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,color:"#555",textTransform:"uppercase",marginBottom:5 }}>{label}</label>
      {children}
    </div>
  );
}

export function MiniField({ label, value, color }) {
  return (
    <div>
      <div style={{ fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,color:"#3A3A3F",textTransform:"uppercase",marginBottom:3 }}>{label}</div>
      <div style={{ fontSize:13,color:color||"#777" }}>{value}</div>
    </div>
  );
}

export function DueBadge({ date }) {
  const days = getDaysUntil(date);
  if (days === null) return null;
  let color="#4ECDC4", label=`${days}d`;
  if (days<0)        { color="#888";    label="Overdue"; }
  else if (days===0) { color="#FF3B3B"; label="Today"; }
  else if (days<=3)  { color="#FF3B3B"; label=`${days}d`; }
  else if (days<=7)  { color="#FF8C00"; label=`${days}d`; }
  return <span style={{ fontSize:11,fontFamily:"'DM Mono',monospace",color,border:`1px solid ${color}`,borderRadius:4,padding:"2px 7px",letterSpacing:1,fontWeight:600 }}>{label}</span>;
}

export function PriorityBadge({ priority }) {
  const pc = PRIORITY_CONFIG[priority];
  if (!pc) return null;
  return <span style={{ fontSize:10,fontFamily:"'DM Mono',monospace",color:pc.color,background:pc.bg,border:`1px solid ${pc.color}33`,borderRadius:4,padding:"2px 7px",letterSpacing:1,textTransform:"uppercase" }}>{priority}</span>;
}

export function ProgressBar({ complete, total }) {
  const pct = total === 0 ? 0 : Math.round((complete / total) * 100);
  const color = pct === 100 ? "#4ECDC4" : pct >= 50 ? "#F5C842" : "#FF8C00";
  return (
    <div style={{ display:"flex",alignItems:"center",gap:8 }}>
      <div style={{ flex:1,height:3,background:"#1E1E22",borderRadius:2,overflow:"hidden" }}>
        <div style={{ width:`${pct}%`,height:"100%",background:color,borderRadius:2,transition:"width 0.3s ease" }} />
      </div>
      <span style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:"#555",letterSpacing:0.5,whiteSpace:"nowrap",flexShrink:0 }}>{complete}/{total}</span>
    </div>
  );
}

export function highlight(text, query) {
  if (!query||!text) return text;
  const safe = query.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  const parts = text.split(new RegExp(`(${safe})`,"gi"));
  return parts.map((p,i) => p.toLowerCase()===query.toLowerCase()
    ? <mark key={i} style={{ background:"#F5C84244",color:"#F5C842",borderRadius:2,padding:"0 1px" }}>{p}</mark>
    : p);
}

export function PageShell({ title, alert, actions, children }) {
  return (
    <div style={{ paddingBottom:80 }}>
      <div style={{ borderBottom:"1px solid #1E1E22",padding:"24px 32px 18px",display:"flex",alignItems:"flex-end",justifyContent:"space-between",background:"linear-gradient(180deg,#111114 0%,#0C0C0E 100%)",flexWrap:"wrap",gap:12 }}>
        <div>
          <div style={{ fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:3,color:"#3A3A3F",textTransform:"uppercase",marginBottom:4 }}>Office of the CFO</div>
          <h1 style={{ margin:0,fontFamily:"'Playfair Display',serif",fontSize:26,fontWeight:800,color:"#F0EBE0" }}>{title}</h1>
          {alert&&<div style={{ marginTop:4,fontFamily:"'DM Mono',monospace",fontSize:10,color:"#FF3B3B",letterSpacing:1 }}>{alert}</div>}
        </div>
        {actions&&<div style={{ display:"flex",gap:8,alignItems:"center",flexWrap:"wrap" }}>{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function PrimaryBtn({ children, onClick, disabled }) {
  return <button onClick={onClick} disabled={disabled} style={{ background:disabled?"#1A1A1E":"#E8E4DC",color:disabled?"#333":"#0C0C0E",border:"none",borderRadius:8,padding:"9px 18px",fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:12,cursor:disabled?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:6,transition:"all 0.15s" }}>{children}</button>;
}

export function GhostBtn({ children, onClick, color="#888" }) {
  return <button onClick={onClick} style={{ background:"transparent",color,border:`1px solid ${color}33`,borderRadius:6,padding:"7px 13px",fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",transition:"all 0.15s" }}>{children}</button>;
}

export function SecondaryBtn({ children, onClick }) {
  return <button onClick={onClick} style={{ background:"#17171A",color:"#888",border:"1px solid #2A2A2F",borderRadius:8,padding:"9px 16px",fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:12,cursor:"pointer",display:"flex",alignItems:"center",gap:6 }}>{children}</button>;
}

export function CancelBtn({ onClick }) {
  return <button onClick={onClick} style={{ flex:1,padding:"11px 0",background:"#1A1A1E",color:"#555",border:"1px solid #2A2A2F",borderRadius:8,fontFamily:"'DM Sans',sans-serif",fontSize:13,cursor:"pointer" }}>Cancel</button>;
}
