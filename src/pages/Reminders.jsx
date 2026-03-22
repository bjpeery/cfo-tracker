import { useState } from "react";
import { supabase } from "../supabaseClient.js";
import { EMPTY_REMINDER, INPUT_STYLE, fmtDate, getDaysUntil } from "../constants.js";
import { ModalWrap, FField, CancelBtn, PageShell, PrimaryBtn } from "../components.jsx";

export default function Reminders({ projects, reminders, setReminders }) {
  const [showForm,     setShowForm]     = useState(false);
  const [reminder,     setReminder]     = useState(EMPTY_REMINDER);
  const [editingId,    setEditingId]    = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [reminderSent, setReminderSent] = useState(false);

  const enriched = reminders.map(r => ({ ...r, project: projects.find(p => p.id === r.project_id) }))
    .sort((a,b) => { const da=a.project?.due_date?new Date(a.project.due_date):new Date("9999"); const db=b.project?.due_date?new Date(b.project.due_date):new Date("9999"); return da-db; });

  function openNew()  { setReminder(EMPTY_REMINDER); setEditingId(null); setReminderSent(false); setShowForm(true); }
  function openEdit(r){ setReminder({project_id:r.project_id,email:r.email,days_before:r.days_before}); setEditingId(r.id); setReminderSent(false); setShowForm(true); }

  async function handleSave() {
    if (!reminder.email||!reminder.project_id) return;
    setSaving(true);
    try {
      if (editingId) {
        const { data,error } = await supabase.from("reminders").update({email:reminder.email,days_before:reminder.days_before}).eq("id",editingId).select().single();
        if (!error) setReminders(rs=>rs.map(r=>r.id===editingId?data:r));
      } else {
        const existing = reminders.find(r=>r.project_id===reminder.project_id);
        if (existing) {
          const { data,error } = await supabase.from("reminders").update({email:reminder.email,days_before:reminder.days_before}).eq("id",existing.id).select().single();
          if (!error) setReminders(rs=>rs.map(r=>r.id===existing.id?data:r));
        } else {
          const { data,error } = await supabase.from("reminders").insert([{project_id:reminder.project_id,email:reminder.email,days_before:reminder.days_before}]).select().single();
          if (!error) setReminders(rs=>[...rs,data]);
        }
      }
      setReminderSent(true);
      setTimeout(()=>{ setShowForm(false); setReminderSent(false); },1600);
    } catch(err){ alert("Save failed: "+err.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id) {
    await supabase.from("reminders").delete().eq("id",id);
    setReminders(rs=>rs.filter(r=>r.id!==id));
  }

  const available = projects.filter(p=>!reminders.some(r=>r.project_id===p.id)||(editingId&&reminders.find(r=>r.id===editingId)?.project_id===p.id));
  const triggerDate = (pid,db) => { const proj=projects.find(p=>p.id===pid); if(!proj?.due_date) return null; return new Date(new Date(proj.due_date).getTime()-db*86400000).toLocaleDateString("en-US",{month:"short",day:"numeric"}); };

  return (
    <PageShell title="Reminders" alert={null} actions={<PrimaryBtn onClick={openNew}><span style={{fontSize:16}}>+</span> Add Reminder</PrimaryBtn>}>
      <div style={{ padding:"24px 32px 0" }}>
        {enriched.length===0 ? (
          <div style={{ textAlign:"center",padding:"80px 0" }}>
            <div style={{ fontSize:32,marginBottom:14 }}>🔔</div>
            <div style={{ fontFamily:"'DM Mono',monospace",fontSize:11,color:"#2A2A2F",letterSpacing:2,marginBottom:8 }}>NO REMINDERS SET</div>
            <div style={{ fontFamily:"'DM Sans',sans-serif",fontSize:13,color:"#3A3A3F" }}>Add a reminder to get notified before a project is due.</div>
          </div>
        ) : (
          <div style={{ background:"#111114",border:"1px solid #1E1E22",borderRadius:12,overflow:"auto" }}>
            <div style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr auto",gap:0,borderBottom:"1px solid #1E1E22",background:"#0D0D10",padding:"9px 18px" }}>
              {["Project","Send To","Days Before","Trigger Date",""].map((h,i)=><div key={i} style={{ fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:2,color:"#3A3A3F",textTransform:"uppercase" }}>{h}</div>)}
            </div>
            {enriched.map((r,i)=>{
              const proj=r.project; const days=proj?.due_date?getDaysUntil(proj.due_date):null; const td=triggerDate(r.project_id,r.days_before);
              return (
                <div key={r.id} style={{ display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr auto",gap:0,padding:"13px 18px",borderBottom:i<enriched.length-1?"1px solid #18181C":"none",alignItems:"center" }}>
                  <div>
                    <div style={{ fontSize:13,fontWeight:500,color:proj?"#E8E4DC":"#555" }}>{proj?proj.title:<span style={{ color:"#FF3B3B",fontFamily:"'DM Mono',monospace",fontSize:9 }}>PROJECT DELETED</span>}</div>
                    {proj?.due_date&&<div style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:days!==null&&days<0?"#FF3B3B":"#3A3A3F",marginTop:2 }}>Due {fmtDate(proj.due_date)}{days!==null&&days<0?" — OVERDUE":days!==null&&days<=7?` — ${days}d`:""}</div>}
                  </div>
                  <div style={{ fontFamily:"'DM Mono',monospace",fontSize:10,color:"#666" }}>{r.email}</div>
                  <div><span style={{ background:"#F5C84222",border:"1px solid #F5C84244",color:"#F5C842",borderRadius:4,padding:"2px 7px",fontFamily:"'DM Mono',monospace",fontSize:10 }}>{r.days_before}d before</span></div>
                  <div style={{ fontFamily:"'DM Mono',monospace",fontSize:10,color:td?"#777":"#2A2A2F" }}>{td||"—"}</div>
                  <div style={{ display:"flex",gap:7 }}>
                    <button onClick={()=>openEdit(r)} style={{ padding:"5px 10px",background:"transparent",color:"#777",border:"1px solid #2A2A2F",borderRadius:6,fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:1,textTransform:"uppercase",cursor:"pointer" }}>Edit</button>
                    <button onClick={()=>handleDelete(r.id)} style={{ padding:"5px 10px",background:"transparent",color:"#FF3B3B",border:"1px solid #FF3B3B33",borderRadius:6,fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:1,textTransform:"uppercase",cursor:"pointer" }}>Remove</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ marginTop:18,padding:"12px 16px",background:"#0D0D10",border:"1px solid #1E1E22",borderRadius:8,fontFamily:"'DM Mono',monospace",fontSize:9,color:"#2A2A2F",lineHeight:1.7,letterSpacing:0.5 }}>
          ℹ REMINDERS ARE STORED HERE. TO SEND ACTUAL EMAILS, CONNECT ZAPIER OR MAKE.COM TO POLL THIS TABLE AND SEND WHEN THE TRIGGER DATE IS REACHED.
        </div>
      </div>

      {showForm&&(
        <ModalWrap onClose={()=>{ setShowForm(false); setEditingId(null); }}>
          {!reminderSent?<>
            <div style={{ fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,marginBottom:20,color:"#F0EBE0" }}>🔔 {editingId?"Edit Reminder":"Add Reminder"}</div>
            <FField label="Project">
              <select value={reminder.project_id||""} onChange={e=>setReminder(r=>({...r,project_id:e.target.value}))} style={INPUT_STYLE} disabled={!!editingId}>
                <option value="">Select a project…</option>
                {(editingId?projects.filter(p=>p.id===reminder.project_id):available).map(p=><option key={p.id} value={p.id}>{p.title}</option>)}
              </select>
            </FField>
            <FField label="Send reminder to"><input type="email" value={reminder.email} onChange={e=>setReminder(r=>({...r,email:e.target.value}))} placeholder="you@company.com" style={INPUT_STYLE} /></FField>
            <FField label="Days before due date"><div style={{ display:"flex",gap:7 }}>{[1,2,3,5,7,14].map(d=><button key={d} onClick={()=>setReminder(r=>({...r,days_before:d}))} style={{ flex:1,padding:"8px 0",background:reminder.days_before===d?"#F5C842":"transparent",color:reminder.days_before===d?"#0C0C0E":"#444",border:`1px solid ${reminder.days_before===d?"#F5C842":"#2A2A2F"}`,borderRadius:6,fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:600,cursor:"pointer",transition:"all 0.15s" }}>{d}</button>)}</div></FField>
            {reminder.project_id&&<div style={{ fontSize:11,color:"#444",fontFamily:"'DM Mono',monospace",letterSpacing:0.5,marginBottom:18,lineHeight:1.7 }}>{triggerDate(reminder.project_id,reminder.days_before)?`Reminder triggers on ${triggerDate(reminder.project_id,reminder.days_before)}.`:"Set a due date on the project to calculate trigger date."}</div>}
            <div style={{ display:"flex",gap:10 }}>
              <CancelBtn onClick={()=>{ setShowForm(false); setEditingId(null); }} />
              <button onClick={handleSave} disabled={!reminder.email||!reminder.project_id||saving} style={{ flex:2,padding:"11px 0",background:(reminder.email&&reminder.project_id)?"#F5C842":"#1A1A1E",color:(reminder.email&&reminder.project_id)?"#0C0C0E":"#333",border:"none",borderRadius:8,fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:13,cursor:(reminder.email&&reminder.project_id)?"pointer":"not-allowed",transition:"all 0.2s" }}>{saving?"Saving…":editingId?"Save Changes":"Add Reminder"}</button>
            </div>
          </>:(
            <div style={{ textAlign:"center",padding:"24px 0" }}>
              <div style={{ fontSize:36,marginBottom:12 }}>🔔</div>
              <div style={{ fontFamily:"'Playfair Display',serif",fontSize:18,color:"#F0EBE0",marginBottom:6 }}>Reminder {editingId?"Updated":"Added"}</div>
              <div style={{ fontFamily:"'DM Mono',monospace",fontSize:10,color:"#555",letterSpacing:1 }}>{reminder.email} · {reminder.days_before}d before due</div>
            </div>
          )}
        </ModalWrap>
      )}
    </PageShell>
  );
}
