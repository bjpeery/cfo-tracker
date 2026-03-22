import { useState, useRef, useEffect } from "react";
import { supabase } from "../supabaseClient.js";
import { PRIORITIES, PRIORITY_CONFIG, STATUS_OPTIONS, EMPTY_FORM, EMPTY_REMINDER, INPUT_STYLE, getDaysUntil, fmtDate, fmtDateTime, generateRecurringInstances } from "../constants.js";
import { ModalWrap, FField, MiniField, DueBadge, PriorityBadge, highlight, PageShell, PrimaryBtn, SecondaryBtn, GhostBtn, CancelBtn } from "../components.jsx";
import * as XLSX from "xlsx";

export default function Projects({ projects, setProjects, reminders, setReminders, session }) {
  const [form,       setForm]       = useState(EMPTY_FORM);
  const [showForm,   setShowForm]   = useState(false);
  const [editId,     setEditId]     = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [search,     setSearch]     = useState("");
  const [filterPri,  setFilterPri]  = useState([]);
  const [filterStat, setFilterStat] = useState([]);
  const [sortBy,     setSortBy]     = useState("priority");
  const [sortDir,    setSortDir]    = useState("asc");

  // Notes
  const [notes,      setNotes]      = useState({}); // { projectId: [...] }
  const [noteText,   setNoteText]   = useState("");
  const [noteLoading,setNoteLoading]= useState(false);

  // Reminders
  const [showReminder,  setShowReminder]  = useState(false);
  const [reminder,      setReminder]      = useState(EMPTY_REMINDER);
  const [reminderSent,  setReminderSent]  = useState(false);

  // Recurring preview
  const [showRecurring, setShowRecurring] = useState(false);
  const [recurPreview,  setRecurPreview]  = useState([]);
  const [recurSaving,   setRecurSaving]   = useState(false);

  // Export
  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef(null);

  useEffect(() => {
    function h(e) { if (exportRef.current && !exportRef.current.contains(e.target)) setShowExport(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Load notes when a project is expanded
  useEffect(() => {
    if (expandedId && !notes[expandedId]) fetchNotes(expandedId);
  }, [expandedId]);

  async function fetchNotes(projectId) {
    const { data } = await supabase.from("project_notes").select("*").eq("project_id", projectId).order("created_at", { ascending: true });
    setNotes(n => ({ ...n, [projectId]: data || [] }));
  }

  async function addNote(projectId) {
    if (!noteText.trim()) return;
    setNoteLoading(true);
    const { data, error } = await supabase.from("project_notes").insert([{
      project_id:   projectId,
      body:         noteText.trim(),
      author_email: session.user.email,
      author_name:  session.user.user_metadata?.display_name || session.user.email,
    }]).select().single();
    if (!error) {
      setNotes(n => ({ ...n, [projectId]: [...(n[projectId] || []), data] }));
      setNoteText("");
    }
    setNoteLoading(false);
  }

  async function deleteNote(projectId, noteId) {
    await supabase.from("project_notes").delete().eq("id", noteId);
    setNotes(n => ({ ...n, [projectId]: n[projectId].filter(x => x.id !== noteId) }));
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!form.title.trim()) return;
    setSaving(true);

    // If recurring, show preview instead of saving directly
    if (form.is_recurring && !editId) {
      const instances = generateRecurringInstances(form, form.recurrence_rule, form.recurrence_end || addMonths(new Date(), 3));
      setRecurPreview(instances);
      setShowRecurring(true);
      setSaving(false);
      return;
    }

    try {
      const payload = { ...form };
      delete payload.is_recurring;
      delete payload.recurrence_rule;
      delete payload.recurrence_end;

      if (editId !== null) {
        const { error } = await supabase.from("projects").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", editId);
        if (error) throw error;
        setProjects(ps => ps.map(p => p.id === editId ? { ...p, ...payload } : p));
        setEditId(null);
      } else {
        const { data, error } = await supabase.from("projects").insert([payload]).select().single();
        if (error) throw error;
        setProjects(ps => [data, ...ps]);
      }
      setForm(EMPTY_FORM); setShowForm(false);
    } catch (err) { alert("Save failed: " + err.message); }
    finally { setSaving(false); }
  }

  async function confirmRecurring() {
    setRecurSaving(true);
    try {
      const { data, error } = await supabase.from("projects").insert(recurPreview).select();
      if (error) throw error;
      setProjects(ps => [...(data || []), ...ps]);
      setShowRecurring(false);
      setShowForm(false);
      setForm(EMPTY_FORM);
      setRecurPreview([]);
    } catch (err) { alert("Save failed: " + err.message); }
    finally { setRecurSaving(false); }
  }

  async function handleDelete(id) {
    await supabase.from("project_notes").delete().eq("project_id", id);
    await supabase.from("reminders").delete().eq("project_id", id);
    await supabase.from("projects").delete().eq("id", id);
    setProjects(ps => ps.filter(p => p.id !== id));
    setReminders(rs => rs.filter(r => r.project_id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  async function handleStatusCycle(id) {
    const proj = projects.find(p => p.id === id);
    const next = STATUS_OPTIONS[(STATUS_OPTIONS.indexOf(proj.status) + 1) % STATUS_OPTIONS.length];
    await supabase.from("projects").update({ status: next, updated_at: new Date().toISOString() }).eq("id", id);
    setProjects(ps => ps.map(p => p.id === id ? { ...p, status: next } : p));
  }

  function handleEdit(p) {
    setForm({ title: p.title, start_date: p.start_date || "", due_date: p.due_date || "", priority: p.priority, partners: p.partners || "", notes: p.notes || "", status: p.status, is_recurring: false, recurrence_rule: "weekly", recurrence_end: "" });
    setEditId(p.id); setShowForm(true); setExpandedId(null);
  }

  // ── Reminders ─────────────────────────────────────────────────────────────
  function openReminderFor(projectId) {
    const existing = reminders.find(r => r.project_id === projectId);
    setReminder(existing ? { ...existing } : { ...EMPTY_REMINDER, project_id: projectId });
    setReminderSent(false); setShowReminder(true);
  }

  async function saveReminder() {
    if (!reminder.email || !reminder.project_id) return;
    const existing = reminders.find(r => r.project_id === reminder.project_id);
    let result;
    if (existing) {
      result = await supabase.from("reminders").update({ email: reminder.email, days_before: reminder.days_before }).eq("id", existing.id).select().single();
    } else {
      result = await supabase.from("reminders").insert([{ project_id: reminder.project_id, email: reminder.email, days_before: reminder.days_before }]).select().single();
    }
    if (!result.error) setReminders(rs => [...rs.filter(r => r.project_id !== reminder.project_id), result.data]);
    setReminderSent(true);
    setTimeout(() => { setShowReminder(false); setReminderSent(false); }, 1600);
  }

  async function removeReminder(projectId) {
    await supabase.from("reminders").delete().eq("project_id", projectId);
    setReminders(rs => rs.filter(r => r.project_id !== projectId));
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  function exportCSV() {
    const rows = [["Title","Priority","Status","Start Date","Due Date","Days Until Due","Partners","Notes"],...projects.map(p=>[p.title,p.priority,p.status,p.start_date,p.due_date,getDaysUntil(p.due_date)??"",p.partners,p.notes])];
    const csv = rows.map(r=>r.map(c=>`"${String(c??"").replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download="cfo-projects.csv"; a.click(); setShowExport(false);
  }

  function exportExcel() {
    const data = projects.map(p=>({ "Title":p.title,"Priority":p.priority,"Status":p.status,"Start Date":p.start_date,"Due Date":p.due_date,"Days Until Due":getDaysUntil(p.due_date)??"","Key Partners":p.partners,"Notes":p.notes }));
    const ws = XLSX.utils.json_to_sheet(data); ws["!cols"]=[{wch:36},{wch:12},{wch:14},{wch:14},{wch:14},{wch:16},{wch:28},{wch:42}];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Projects");
    const summary=[["CFO Project Command"],["Generated",new Date().toLocaleDateString()],["Total",projects.length],["Critical (Open)",projects.filter(p=>p.priority==="Critical"&&p.status!=="Complete").length],["In Progress",projects.filter(p=>p.status==="In Progress").length],["On Hold",projects.filter(p=>p.status==="On Hold").length],["Complete",projects.filter(p=>p.status==="Complete").length]];
    XLSX.utils.book_append_sheet(wb,XLSX.utils.aoa_to_sheet(summary),"Summary"); XLSX.writeFile(wb,"cfo-projects.xlsx"); setShowExport(false);
  }

  // ── Filter + sort ──────────────────────────────────────────────────────────
  function toggle(arr, setArr, val) { setArr(p => p.includes(val) ? p.filter(v=>v!==val) : [...p,val]); }
  const activeFilters = filterPri.length + filterStat.length;

  const filtered = projects
    .filter(p => filterPri.length  === 0 || filterPri.includes(p.priority))
    .filter(p => filterStat.length === 0 || filterStat.includes(p.status))
    .filter(p => { if (!search.trim()) return true; const q=search.toLowerCase(); return p.title.toLowerCase().includes(q)||(p.notes||"").toLowerCase().includes(q)||(p.partners||"").toLowerCase().includes(q); })
    .sort((a,b) => {
      const dir = sortDir==="asc"?1:-1;
      if (sortBy==="priority")   { const d=PRIORITIES.indexOf(a.priority)-PRIORITIES.indexOf(b.priority); return d!==0?d*dir:(new Date(a.due_date)-new Date(b.due_date)); }
      if (sortBy==="start_date") { const da=a.start_date?new Date(a.start_date):new Date("9999-12-31"); const db=b.start_date?new Date(b.start_date):new Date("9999-12-31"); return (da-db)*dir; }
      if (sortBy==="due_date")   { const da=a.due_date?new Date(a.due_date):new Date("9999-12-31"); const db=b.due_date?new Date(b.due_date):new Date("9999-12-31"); return (da-db)*dir; }
      if (sortBy==="status")     { const d=STATUS_OPTIONS.indexOf(a.status)-STATUS_OPTIONS.indexOf(b.status); return d!==0?d*dir:PRIORITIES.indexOf(a.priority)-PRIORITIES.indexOf(b.priority); }
      return 0;
    });

  const criticalCount = projects.filter(p=>p.priority==="Critical"&&p.status!=="Complete").length;

  return (
    <PageShell
      title="Projects"
      alert={criticalCount > 0 ? `● ${criticalCount} CRITICAL ITEM${criticalCount>1?"S":""} NEED ATTENTION` : null}
      actions={<>
        <div ref={exportRef} style={{ position:"relative" }}>
          <SecondaryBtn onClick={()=>setShowExport(v=>!v)}>↓ Export</SecondaryBtn>
          {showExport && (
            <div style={{ position:"absolute",right:0,top:"calc(100% + 8px)",background:"#17171A",border:"1px solid #2A2A2F",borderRadius:10,overflow:"hidden",zIndex:50,minWidth:200,boxShadow:"0 8px 32px rgba(0,0,0,0.5)" }}>
              {[{label:"Export as CSV",sub:"Comma-separated",fn:exportCSV},{label:"Export as Excel",sub:"Formatted .xlsx",fn:exportExcel}].map(o=>(
                <button key={o.label} onClick={o.fn} onMouseEnter={e=>e.currentTarget.style.background="#1E1E22"} onMouseLeave={e=>e.currentTarget.style.background="transparent"} style={{ display:"flex",flexDirection:"column",alignItems:"flex-start",width:"100%",padding:"11px 16px",background:"transparent",border:"none",color:"#E8E4DC",cursor:"pointer" }}>
                  <span style={{ fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:500 }}>{o.label}</span>
                  <span style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:"#444",letterSpacing:1,marginTop:2 }}>{o.sub}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <PrimaryBtn onClick={()=>{ setShowForm(true); setEditId(null); setForm(EMPTY_FORM); }}>
          <span style={{ fontSize:16 }}>+</span> Log Project
        </PrimaryBtn>
      </>}
    >
      {/* Search + Sort + Filters */}
      <div style={{ padding:"14px 32px 0" }}>
        <div style={{ display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:8 }}>
          <div style={{ position:"relative",flex:"0 0 240px" }}>
            <span style={{ position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:"#444",fontSize:13 }}>⌕</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…" style={{ ...INPUT_STYLE,paddingLeft:30,fontSize:12,height:34,border:"1px solid #2A2A2F" }} />
            {search && <button onClick={()=>setSearch("")} style={{ position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#444",cursor:"pointer",fontSize:11,padding:0 }}>✕</button>}
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:5 }}>
            <span style={{ fontFamily:"'DM Mono',monospace",fontSize:8,color:"#3A3A3F",letterSpacing:1,textTransform:"uppercase" }}>Sort</span>
            {[{k:"priority",l:"Priority"},{k:"start_date",l:"Start"},{k:"due_date",l:"Due"},{k:"status",l:"Status"}].map(o=>(
              <button key={o.k} onClick={()=>{ if(sortBy===o.k) setSortDir(d=>d==="asc"?"desc":"asc"); else{setSortBy(o.k);setSortDir("asc");} }} style={{ background:sortBy===o.k?"#1E1E22":"transparent",color:sortBy===o.k?"#E8E4DC":"#444",border:`1px solid ${sortBy===o.k?"#3A3A3F":"#2A2A2F"}`,borderRadius:6,padding:"4px 10px",fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",display:"flex",alignItems:"center",gap:3 }}>
                {o.l} {sortBy===o.k&&<span>{sortDir==="asc"?"↑":"↓"}</span>}
              </button>
            ))}
          </div>
          <div style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:10 }}>
            {(activeFilters>0||search)&&<button onClick={()=>{setFilterPri([]);setFilterStat([]);setSearch("");}} style={{ background:"none",border:"none",color:"#444",fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:1,cursor:"pointer",textDecoration:"underline",textTransform:"uppercase" }}>Clear {activeFilters>0?`(${activeFilters})`:""}</button>}
            <span style={{ fontFamily:"'DM Mono',monospace",fontSize:8,color:"#2A2A2F",letterSpacing:1 }}>{filtered.length}/{projects.length}</span>
          </div>
        </div>
        <div style={{ display:"flex",gap:5,flexWrap:"wrap",alignItems:"center",paddingBottom:12 }}>
          <span style={{ fontFamily:"'DM Mono',monospace",fontSize:8,color:"#3A3A3F",letterSpacing:1,textTransform:"uppercase",marginRight:2 }}>Filter</span>
          {PRIORITIES.map(p=>{ const pc=PRIORITY_CONFIG[p]; const a=filterPri.includes(p); return <button key={p} onClick={()=>toggle(filterPri,setFilterPri,p)} style={{ background:a?pc.bg:"transparent",color:a?pc.color:"#444",border:`1px solid ${a?pc.color:"#2A2A2F"}`,borderRadius:20,padding:"3px 11px",fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",transition:"all 0.15s" }}>{p}</button>; })}
          <span style={{ width:1,height:14,background:"#2A2A2F",margin:"0 3px" }} />
          {STATUS_OPTIONS.map(s=>{ const a=filterStat.includes(s); return <button key={s} onClick={()=>toggle(filterStat,setFilterStat,s)} style={{ background:a?"#1E1E22":"transparent",color:a?"#E8E4DC":"#444",border:`1px solid ${a?"#3A3A3F":"#2A2A2F"}`,borderRadius:20,padding:"3px 11px",fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",transition:"all 0.15s" }}>{s}</button>; })}
        </div>
      </div>

      {/* Project list */}
      <div style={{ padding:"0 32px" }}>
        {filtered.length===0 && <div style={{ textAlign:"center",padding:"60px 0",color:"#2A2A2F",fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:2 }}>{search?`NO RESULTS FOR "${search.toUpperCase()}"` : "NO PROJECTS LOGGED YET"}</div>}
        {filtered.map((p,i)=>{
          const pc=PRIORITY_CONFIG[p.priority];
          const expanded=expandedId===p.id;
          const done=p.status==="Complete";
          const hasReminder=reminders.some(r=>r.project_id===p.id);
          const projNotes=notes[p.id]||[];
          return (
            <div key={p.id} style={{ background:"#111114",border:"1px solid #1E1E22",borderLeft:`3px solid ${done?"#2A2A2F":pc.color}`,borderRadius:10,marginBottom:8,opacity:done?0.5:1,transition:"all 0.2s",animation:`fadeSlide 0.3s ease ${i*0.04}s both` }}>
              <div onClick={()=>setExpandedId(expanded?null:p.id)} style={{ padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12 }}>
                <div onClick={e=>{e.stopPropagation();handleStatusCycle(p.id);}} style={{ width:10,height:10,borderRadius:"50%",background:done?"#2A2A2F":pc.dot,flexShrink:0,cursor:"pointer",boxShadow:done?"none":`0 0 6px ${pc.dot}88`,transition:"all 0.2s" }} />
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ fontWeight:600,fontSize:13,color:done?"#444":"#E8E4DC",textDecoration:done?"line-through":"none",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{highlight(p.title,search)}</div>
                  {p.partners&&<div style={{ fontSize:10,color:"#555",marginTop:1,fontFamily:"'DM Mono',monospace",letterSpacing:0.4 }}>{highlight(p.partners,search)}</div>}
                </div>
                <div style={{ display:"flex",alignItems:"center",gap:8,flexShrink:0 }}>
                  {hasReminder&&<span title="Reminder" style={{ fontSize:10 }}>🔔</span>}
                  {p.is_recurring&&<span title="Recurring" style={{ fontSize:10 }}>↻</span>}
                  <PriorityBadge priority={p.priority} />
                  <DueBadge date={p.due_date} />
                  <span style={{ fontSize:8,color:"#2A2A2F",fontFamily:"'DM Mono',monospace",letterSpacing:0.5 }}>{p.status.toUpperCase()}</span>
                  <span style={{ color:"#2A2A2F",fontSize:10,display:"inline-block",transition:"transform 0.2s",transform:expanded?"rotate(180deg)":"none" }}>▾</span>
                </div>
              </div>

              {expanded&&(
                <div style={{ padding:"0 16px 16px 38px",borderTop:"1px solid #181818" }}>
                  <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px 20px",marginTop:10 }}>
                    <MiniField label="Start Date"   value={fmtDate(p.start_date)} />
                    <MiniField label="Due Date"     value={fmtDate(p.due_date)} />
                    <MiniField label="Status"       value={p.status} />
                    <MiniField label="Key Partners" value={p.partners||"—"} />
                    <MiniField label="Priority"     value={p.priority} color={pc.color} />
                  </div>

                  {p.notes&&<div style={{ marginTop:10 }}><div style={{ fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:2,color:"#2A2A2F",textTransform:"uppercase",marginBottom:3 }}>Description</div><div style={{ fontSize:13,color:"#777",lineHeight:1.6 }}>{highlight(p.notes,search)}</div></div>}

                  {/* Note thread */}
                  <div style={{ marginTop:14 }}>
                    <div style={{ fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:2,color:"#2A2A2F",textTransform:"uppercase",marginBottom:8 }}>Notes Thread</div>
                    {projNotes.length===0 ? (
                      <div style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:"#2A2A2F",letterSpacing:1,marginBottom:8 }}>NO NOTES YET</div>
                    ) : (
                      <div style={{ marginBottom:10 }}>
                        {projNotes.map(n=>(
                          <div key={n.id} style={{ marginBottom:8,padding:"9px 12px",background:"#0D0D10",borderRadius:8,border:"1px solid #1E1E22" }}>
                            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4 }}>
                              <span style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:"#555",letterSpacing:0.5 }}>{n.author_name} · {fmtDateTime(n.created_at)}</span>
                              {n.author_email===session.user.email&&<button onClick={()=>deleteNote(p.id,n.id)} style={{ background:"none",border:"none",color:"#3A3A3F",cursor:"pointer",fontSize:10,padding:0 }}>✕</button>}
                            </div>
                            <div style={{ fontSize:13,color:"#E8E4DC",lineHeight:1.55 }}>{n.body}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{ display:"flex",gap:8 }}>
                      <input value={noteText} onChange={e=>setNoteText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&!e.shiftKey&&addNote(p.id)} placeholder="Add a note… (Enter to submit)" style={{ ...INPUT_STYLE,flex:1,fontSize:12,padding:"8px 11px" }} />
                      <button onClick={()=>addNote(p.id)} disabled={!noteText.trim()||noteLoading} style={{ background:"#E8E4DC",color:"#0C0C0E",border:"none",borderRadius:8,padding:"8px 14px",fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:12,cursor:noteText.trim()?"pointer":"not-allowed",opacity:noteText.trim()?1:0.4 }}>Post</button>
                    </div>
                  </div>

                  {hasReminder&&(()=>{ const r=reminders.find(r=>r.project_id===p.id); return <div style={{ marginTop:10,padding:"7px 11px",background:"#17170C",border:"1px solid #F5C84233",borderRadius:6,fontSize:10,color:"#F5C842",fontFamily:"'DM Mono',monospace",display:"flex",justifyContent:"space-between",alignItems:"center" }}><span>🔔 {r.days_before}d BEFORE DUE · {r.email}</span><button onClick={()=>removeReminder(p.id)} style={{ background:"none",border:"none",color:"#F5C842",cursor:"pointer",fontSize:10,opacity:0.6 }}>✕</button></div>; })()}

                  <div style={{ display:"flex",gap:7,marginTop:12,flexWrap:"wrap" }}>
                    {[{label:"Edit",fn:()=>handleEdit(p),color:"#777"},{label:hasReminder?"Update Reminder":"Set Reminder",fn:()=>openReminderFor(p.id),color:"#F5C842"},{label:"Cycle Status",fn:()=>handleStatusCycle(p.id),color:"#4ECDC4"},{label:"Delete",fn:()=>handleDelete(p.id),color:"#FF3B3B"}].map(btn=>(
                      <GhostBtn key={btn.label} onClick={btn.fn} color={btn.color}>{btn.label}</GhostBtn>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Log/Edit Modal */}
      {showForm&&(
        <ModalWrap wide onClose={()=>{setShowForm(false);setEditId(null);}}>
          <div style={{ fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,marginBottom:20,color:"#F0EBE0" }}>{editId?"Edit Project":"Log New Project"}</div>
          <FField label="Project Title *"><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Q3 Revenue Reforecast" style={INPUT_STYLE} autoFocus /></FField>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12 }}>
            <FField label="Start Date"><input type="date" value={form.start_date} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))} style={INPUT_STYLE} /></FField>
            <FField label="Due Date"><input type="date" value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))} style={INPUT_STYLE} /></FField>
            <FField label="Priority"><select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} style={INPUT_STYLE}>{PRIORITIES.map(p=><option key={p}>{p}</option>)}</select></FField>
          </div>
          <FField label="Status"><div style={{ display:"flex",gap:7 }}>{STATUS_OPTIONS.map(s=><button key={s} onClick={()=>setForm(f=>({...f,status:s}))} style={{ flex:1,padding:"7px 0",background:form.status===s?"#E8E4DC":"transparent",color:form.status===s?"#0C0C0E":"#444",border:`1px solid ${form.status===s?"#E8E4DC":"#2A2A2F"}`,borderRadius:6,fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",transition:"all 0.15s" }}>{s}</button>)}</div></FField>
          <FField label="Key Partners"><input value={form.partners} onChange={e=>setForm(f=>({...f,partners:e.target.value}))} placeholder="e.g. Legal, Sarah K." style={INPUT_STYLE} /></FField>
          <FField label="Notes / Description"><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Any context or blockers…" rows={2} style={{ ...INPUT_STYLE,resize:"vertical",lineHeight:1.5 }} /></FField>

          {/* Recurring */}
          {!editId&&(
            <div style={{ marginBottom:14 }}>
              <label style={{ display:"flex",alignItems:"center",gap:8,cursor:"pointer" }}>
                <input type="checkbox" checked={form.is_recurring} onChange={e=>setForm(f=>({...f,is_recurring:e.target.checked}))} style={{ accentColor:"#E8E4DC",width:14,height:14 }} />
                <span style={{ fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,color:"#555",textTransform:"uppercase" }}>Create as recurring series</span>
              </label>
              {form.is_recurring&&(
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:12 }}>
                  <FField label="Recurrence">
                    <select value={form.recurrence_rule} onChange={e=>setForm(f=>({...f,recurrence_rule:e.target.value}))} style={INPUT_STYLE}>
                      <option value="weekly">Weekly</option>
                      <option value="biweekly">Bi-weekly</option>
                      <option value="monthly">Monthly</option>
                      <option value="quarterly">Quarterly</option>
                    </select>
                  </FField>
                  <FField label="Generate until">
                    <input type="date" value={form.recurrence_end} onChange={e=>setForm(f=>({...f,recurrence_end:e.target.value}))} style={INPUT_STYLE} />
                  </FField>
                </div>
              )}
            </div>
          )}

          <div style={{ display:"flex",gap:10,marginTop:8 }}>
            <CancelBtn onClick={()=>{setShowForm(false);setEditId(null);setForm(EMPTY_FORM);}} />
            <button onClick={handleSubmit} disabled={!form.title.trim()||saving} style={{ flex:2,padding:"11px 0",background:form.title.trim()?"#E8E4DC":"#1A1A1E",color:form.title.trim()?"#0C0C0E":"#333",border:"none",borderRadius:8,fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:13,cursor:form.title.trim()?"pointer":"not-allowed",transition:"all 0.2s" }}>
              {saving?"Saving…":editId?"Save Changes":form.is_recurring?"Preview Series →":"Log Project"}
            </button>
          </div>
        </ModalWrap>
      )}

      {/* Recurring preview modal */}
      {showRecurring&&(
        <ModalWrap wide onClose={()=>setShowRecurring(false)}>
          <div style={{ fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,marginBottom:6,color:"#F0EBE0" }}>↻ Recurring Series Preview</div>
          <div style={{ fontFamily:"'DM Mono',monospace",fontSize:10,color:"#444",letterSpacing:1,marginBottom:18 }}>{recurPreview.length} INSTANCES WILL BE CREATED</div>
          <div style={{ maxHeight:320,overflowY:"auto",marginBottom:18 }}>
            {recurPreview.map((p,i)=>{
              const pc=PRIORITY_CONFIG[p.priority];
              return (
                <div key={i} style={{ display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:"#0D0D10",borderRadius:8,marginBottom:6,border:"1px solid #1E1E22" }}>
                  <div style={{ width:8,height:8,borderRadius:"50%",background:pc.dot,flexShrink:0 }} />
                  <div style={{ flex:1,minWidth:0 }}>
                    <div style={{ fontSize:12,fontWeight:500,color:"#E8E4DC",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{p.title}</div>
                    <div style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:"#444",marginTop:2 }}>{fmtDate(p.start_date)} → {fmtDate(p.due_date)}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ display:"flex",gap:10 }}>
            <CancelBtn onClick={()=>setShowRecurring(false)} />
            <button onClick={confirmRecurring} disabled={recurSaving} style={{ flex:2,padding:"11px 0",background:"#E8E4DC",color:"#0C0C0E",border:"none",borderRadius:8,fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:13,cursor:"pointer" }}>
              {recurSaving?"Creating…":`Create All ${recurPreview.length} Projects`}
            </button>
          </div>
        </ModalWrap>
      )}

      {/* Reminder modal */}
      {showReminder&&(
        <ModalWrap onClose={()=>setShowReminder(false)}>
          {!reminderSent?<>
            <div style={{ fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,marginBottom:6,color:"#F0EBE0" }}>🔔 Email Reminder</div>
            <div style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:"#444",letterSpacing:1,marginBottom:18,textTransform:"uppercase" }}>{projects.find(p=>p.id===reminder.project_id)?.title}</div>
            <FField label="Send reminder to"><input type="email" value={reminder.email} onChange={e=>setReminder(r=>({...r,email:e.target.value}))} placeholder="you@company.com" style={INPUT_STYLE} autoFocus /></FField>
            <FField label="Days before due date"><div style={{ display:"flex",gap:7 }}>{[1,2,3,5,7,14].map(d=><button key={d} onClick={()=>setReminder(r=>({...r,days_before:d}))} style={{ flex:1,padding:"8px 0",background:reminder.days_before===d?"#F5C842":"transparent",color:reminder.days_before===d?"#0C0C0E":"#444",border:`1px solid ${reminder.days_before===d?"#F5C842":"#2A2A2F"}`,borderRadius:6,fontFamily:"'DM Mono',monospace",fontSize:11,fontWeight:600,cursor:"pointer",transition:"all 0.15s" }}>{d}</button>)}</div></FField>
            <div style={{ display:"flex",gap:10 }}>
              <CancelBtn onClick={()=>setShowReminder(false)} />
              <button onClick={saveReminder} disabled={!reminder.email} style={{ flex:2,padding:"11px 0",background:reminder.email?"#F5C842":"#1A1A1E",color:reminder.email?"#0C0C0E":"#333",border:"none",borderRadius:8,fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:13,cursor:reminder.email?"pointer":"not-allowed",transition:"all 0.2s" }}>Save Reminder</button>
            </div>
          </>:(
            <div style={{ textAlign:"center",padding:"24px 0" }}>
              <div style={{ fontSize:36,marginBottom:12 }}>🔔</div>
              <div style={{ fontFamily:"'Playfair Display',serif",fontSize:18,color:"#F0EBE0",marginBottom:6 }}>Reminder Saved</div>
              <div style={{ fontFamily:"'DM Mono',monospace",fontSize:10,color:"#555",letterSpacing:1 }}>{reminder.email} · {reminder.days_before}d before due</div>
            </div>
          )}
        </ModalWrap>
      )}
    </PageShell>
  );
}

function addMonths(date, n) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().split("T")[0];
}
