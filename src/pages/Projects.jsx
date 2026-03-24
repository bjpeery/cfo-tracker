import { useState, useRef, useEffect } from "react";
import { supabase } from "../supabaseClient.js";
import { PRIORITIES, PRIORITY_CONFIG, STATUS_OPTIONS, EMPTY_FORM, EMPTY_TASK, EMPTY_REMINDER, INPUT_STYLE, DAY_TO_DAY_TITLE, getDaysUntil, fmtDate, fmtDateTime, getTaskProgress, generateRecurringInstances } from "../constants.js";
import { ModalWrap, FField, MiniField, DueBadge, PriorityBadge, ProgressBar, highlight, PageShell, PrimaryBtn, SecondaryBtn, GhostBtn, CancelBtn } from "../components.jsx";
import * as XLSX from "xlsx";

export default function Projects({ projects, setProjects, tasks, setTasks, reminders, setReminders, session }) {
  // Project state
  const [form,        setForm]        = useState(EMPTY_FORM);
  const [showForm,    setShowForm]    = useState(false);
  const [editId,      setEditId]      = useState(null);
  const [saving,      setSaving]      = useState(false);
  const [expandedId,  setExpandedId]  = useState(null);
  const [search,      setSearch]      = useState("");
  const [filterPri,   setFilterPri]   = useState([]);
  const [filterStat,  setFilterStat]  = useState([]);
  const [sortBy,      setSortBy]      = useState("priority");
  const [sortDir,     setSortDir]     = useState("asc");

  // Task state
  const [showTaskForm,  setShowTaskForm]  = useState(false);
  const [taskForm,      setTaskForm]      = useState(EMPTY_TASK);
  const [editTaskId,    setEditTaskId]    = useState(null);
  const [savingTask,    setSavingTask]    = useState(false);
  const [taskProjectId, setTaskProjectId] = useState(null); // for inline add

  // Notes state
  const [projectNotes, setProjectNotes] = useState({});
  const [taskNotes,    setTaskNotes]    = useState({});
  const [noteText,     setNoteText]     = useState("");
  const [expandedNoteId, setExpandedNoteId] = useState(null); // task id whose notes are open
  const [noteLoading,  setNoteLoading]  = useState(false);

  // Reminders
  const [showReminder, setShowReminder] = useState(false);
  const [reminder,     setReminder]     = useState(EMPTY_REMINDER);
  const [reminderSent, setReminderSent] = useState(false);

  // Recurring
  const [showRecurring, setShowRecurring] = useState(false);
  const [recurPreview,  setRecurPreview]  = useState([]);
  const [recurSaving,   setRecurSaving]   = useState(false);

  // Drag-and-drop
  const [dragTaskId,    setDragTaskId]    = useState(null);
  const [dragOverId,    setDragOverId]    = useState(null);
  const [dragProjectId, setDragProjectId] = useState(null);

  // Export
  const [showExport, setShowExport] = useState(false);
  const exportRef = useRef(null);

  useEffect(() => {
    function h(e) { if (exportRef.current && !exportRef.current.contains(e.target)) setShowExport(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Load notes when project expanded
  useEffect(() => {
    if (expandedId && !projectNotes[expandedId]) fetchProjectNotes(expandedId);
  }, [expandedId]);

  async function fetchProjectNotes(projectId) {
    const { data } = await supabase.from("project_notes").select("*").eq("project_id", projectId).order("created_at", { ascending: true });
    setProjectNotes(n => ({ ...n, [projectId]: data || [] }));
  }

  async function fetchTaskNotes(taskId) {
    const { data } = await supabase.from("task_notes").select("*").eq("task_id", taskId).order("created_at", { ascending: true });
    setTaskNotes(n => ({ ...n, [taskId]: data || [] }));
  }

  // ── Project CRUD ───────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!form.title.trim()) return;
    setSaving(true);
    if (form.is_recurring && !editId) {
      const instances = generateRecurringInstances(form, form.recurrence_rule, form.recurrence_end || addMonths(new Date(), 3));
      setRecurPreview(instances);
      setShowRecurring(true);
      setSaving(false);
      return;
    }
    try {
      const payload = { ...form };
      delete payload.is_recurring; delete payload.recurrence_rule; delete payload.recurrence_end;
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
      setProjects(ps => [...(data||[]), ...ps]);
      setShowRecurring(false); setShowForm(false); setForm(EMPTY_FORM); setRecurPreview([]);
    } catch (err) { alert("Save failed: " + err.message); }
    finally { setRecurSaving(false); }
  }

  async function handleDeleteProject(id) {
    await supabase.from("task_notes").delete().in("task_id", tasks.filter(t=>t.project_id===id).map(t=>t.id));
    await supabase.from("tasks").delete().eq("project_id", id);
    await supabase.from("project_notes").delete().eq("project_id", id);
    await supabase.from("reminders").delete().eq("project_id", id);
    await supabase.from("projects").delete().eq("id", id);
    setProjects(ps => ps.filter(p => p.id !== id));
    setTasks(ts => ts.filter(t => t.project_id !== id));
    setReminders(rs => rs.filter(r => r.project_id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  async function handleStatusCycle(id) {
    const proj = projects.find(p => p.id === id);
    const next = STATUS_OPTIONS[(STATUS_OPTIONS.indexOf(proj.status) + 1) % STATUS_OPTIONS.length];
    await supabase.from("projects").update({ status: next, updated_at: new Date().toISOString() }).eq("id", id);
    setProjects(ps => ps.map(p => p.id === id ? { ...p, status: next } : p));
  }

  function handleEditProject(p) {
    setForm({ title:p.title, start_date:p.start_date||"", due_date:p.due_date||"", priority:p.priority, partners:p.partners||"", notes:p.notes||"", status:p.status, is_recurring:false, recurrence_rule:"weekly", recurrence_end:"" });
    setEditId(p.id); setShowForm(true); setExpandedId(null);
  }

  // ── Task CRUD ──────────────────────────────────────────────────────────────
  function openAddTask(projectId) {
    setTaskForm({ ...EMPTY_TASK, project_id: projectId });
    setEditTaskId(null);
    setShowTaskForm(true);
  }

  function openGlobalAddTask() {
    setTaskForm({ ...EMPTY_TASK, project_id: projects[0]?.id || "" });
    setEditTaskId(null);
    setShowTaskForm(true);
  }

  function openEditTask(t) {
    setTaskForm({ title:t.title, due_date:t.due_date||"", priority:t.priority, assignee:t.assignee||"", project_id:t.project_id, complete:t.complete, sort_order:t.sort_order });
    setEditTaskId(t.id);
    setShowTaskForm(true);
  }

  async function handleSaveTask() {
    if (!taskForm.title.trim() || !taskForm.project_id) return;
    setSavingTask(true);
    try {
      if (editTaskId) {
        const { error } = await supabase.from("tasks").update({ ...taskForm, updated_at: new Date().toISOString() }).eq("id", editTaskId);
        if (error) throw error;
        setTasks(ts => ts.map(t => t.id === editTaskId ? { ...t, ...taskForm } : t));
      } else {
        const projectTasks = tasks.filter(t => t.project_id === taskForm.project_id);
        const maxOrder = projectTasks.length > 0 ? Math.max(...projectTasks.map(t => t.sort_order||0)) : -1;
        const payload = { ...taskForm, sort_order: maxOrder + 1 };
        const { data, error } = await supabase.from("tasks").insert([payload]).select().single();
        if (error) throw error;
        setTasks(ts => [...ts, data]);
      }
      setShowTaskForm(false); setTaskForm(EMPTY_TASK); setEditTaskId(null);
    } catch (err) { alert("Save failed: " + err.message); }
    finally { setSavingTask(false); }
  }

  async function handleDeleteTask(id) {
    await supabase.from("task_notes").delete().eq("task_id", id);
    await supabase.from("tasks").delete().eq("id", id);
    setTasks(ts => ts.filter(t => t.id !== id));
    setTaskNotes(n => { const copy={...n}; delete copy[id]; return copy; });
  }

  async function toggleTaskComplete(task) {
    const complete = !task.complete;
    await supabase.from("tasks").update({ complete, updated_at: new Date().toISOString() }).eq("id", task.id);
    setTasks(ts => ts.map(t => t.id === task.id ? { ...t, complete } : t));
  }

  // ── Task reordering ────────────────────────────────────────────────────────
  async function moveTask(projectId, taskId, direction) {
    const projTasks = tasks.filter(t => t.project_id === projectId).sort((a,b) => (a.sort_order||0)-(b.sort_order||0));
    const idx = projTasks.findIndex(t => t.id === taskId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= projTasks.length) return;
    const a = projTasks[idx], b = projTasks[swapIdx];
    const aOrder = a.sort_order||0, bOrder = b.sort_order||0;
    await supabase.from("tasks").update({ sort_order: bOrder }).eq("id", a.id);
    await supabase.from("tasks").update({ sort_order: aOrder }).eq("id", b.id);
    setTasks(ts => ts.map(t => t.id === a.id ? { ...t, sort_order: bOrder } : t.id === b.id ? { ...t, sort_order: aOrder } : t));
  }

  function handleDragStart(e, taskId, projectId) {
    setDragTaskId(taskId); setDragProjectId(projectId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragOver(e, taskId) {
    e.preventDefault(); setDragOverId(taskId);
  }

  async function handleDrop(e, targetTaskId, projectId) {
    e.preventDefault();
    if (!dragTaskId || dragTaskId === targetTaskId || dragProjectId !== projectId) { setDragTaskId(null); setDragOverId(null); return; }
    const projTasks = tasks.filter(t => t.project_id === projectId).sort((a,b) => (a.sort_order||0)-(b.sort_order||0));
    const fromIdx   = projTasks.findIndex(t => t.id === dragTaskId);
    const toIdx     = projTasks.findIndex(t => t.id === targetTaskId);
    const reordered = [...projTasks];
    const [moved]   = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const updates   = reordered.map((t, i) => ({ id: t.id, sort_order: i }));
    await Promise.all(updates.map(u => supabase.from("tasks").update({ sort_order: u.sort_order }).eq("id", u.id)));
    setTasks(ts => ts.map(t => { const u = updates.find(u => u.id === t.id); return u ? { ...t, sort_order: u.sort_order } : t; }));
    setDragTaskId(null); setDragOverId(null);
  }

  // ── Notes ──────────────────────────────────────────────────────────────────
  async function addProjectNote(projectId, text) {
    if (!text.trim()) return;
    setNoteLoading(true);
    const { data, error } = await supabase.from("project_notes").insert([{ project_id:projectId, body:text.trim(), author_email:session.user.email, author_name:session.user.user_metadata?.display_name||session.user.email }]).select().single();
    if (!error) setProjectNotes(n => ({ ...n, [projectId]: [...(n[projectId]||[]), data] }));
    setNoteLoading(false);
  }

  async function addTaskNote(taskId, text) {
    if (!text.trim()) return;
    const { data, error } = await supabase.from("task_notes").insert([{ task_id:taskId, body:text.trim(), author_email:session.user.email, author_name:session.user.user_metadata?.display_name||session.user.email }]).select().single();
    if (!error) setTaskNotes(n => ({ ...n, [taskId]: [...(n[taskId]||[]), data] }));
  }

  async function deleteProjectNote(projectId, noteId) {
    await supabase.from("project_notes").delete().eq("id", noteId);
    setProjectNotes(n => ({ ...n, [projectId]: n[projectId].filter(x => x.id !== noteId) }));
  }

  async function deleteTaskNote(taskId, noteId) {
    await supabase.from("task_notes").delete().eq("id", noteId);
    setTaskNotes(n => ({ ...n, [taskId]: n[taskId].filter(x => x.id !== noteId) }));
  }

  // ── Reminders ──────────────────────────────────────────────────────────────
  function openReminderFor(projectId) {
    const existing = reminders.find(r => r.project_id === projectId);
    setReminder(existing ? { ...existing } : { ...EMPTY_REMINDER, project_id: projectId });
    setReminderSent(false); setShowReminder(true);
  }

  async function saveReminder() {
    if (!reminder.email || !reminder.project_id) return;
    const existing = reminders.find(r => r.project_id === reminder.project_id);
    let result;
    if (existing) result = await supabase.from("reminders").update({ email:reminder.email, days_before:reminder.days_before }).eq("id", existing.id).select().single();
    else result = await supabase.from("reminders").insert([{ project_id:reminder.project_id, email:reminder.email, days_before:reminder.days_before }]).select().single();
    if (!result.error) setReminders(rs => [...rs.filter(r => r.project_id !== reminder.project_id), result.data]);
    setReminderSent(true);
    setTimeout(() => { setShowReminder(false); setReminderSent(false); }, 1600);
  }

  // ── Export ─────────────────────────────────────────────────────────────────
  function exportCSV() {
    const rows = [["Project","Task","Priority","Assignee","Status","Due Date","Days Until Due"],...tasks.map(t=>{ const proj=projects.find(p=>p.id===t.project_id); return [proj?.title||"",t.title,t.priority,t.assignee,t.complete?"Complete":"Incomplete",t.due_date,getDaysUntil(t.due_date)??""]; })];
    const csv = rows.map(r=>r.map(c=>`"${String(c??"").replace(/"/g,'""')}"`).join(",")).join("\n");
    const a = document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download="cfo-tasks.csv"; a.click(); setShowExport(false);
  }

  function exportExcel() {
    const data = tasks.map(t=>{ const proj=projects.find(p=>p.id===t.project_id); return { "Project":proj?.title||"","Task":t.title,"Priority":t.priority,"Assignee":t.assignee,"Status":t.complete?"Complete":"Incomplete","Due Date":t.due_date,"Days Until Due":getDaysUntil(t.due_date)??"" }; });
    const ws = XLSX.utils.json_to_sheet(data); ws["!cols"]=[{wch:30},{wch:36},{wch:12},{wch:20},{wch:12},{wch:14},{wch:16}];
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,ws,"Tasks"); XLSX.writeFile(wb,"cfo-tasks.xlsx"); setShowExport(false);
  }

  // ── Filter + sort ──────────────────────────────────────────────────────────
  function toggle(arr, setArr, val) { setArr(p => p.includes(val) ? p.filter(v=>v!==val) : [...p,val]); }
  const activeFilters = filterPri.length + filterStat.length;

  const filteredProjects = projects
    .filter(p => filterPri.length===0  || filterPri.includes(p.priority))
    .filter(p => filterStat.length===0 || filterStat.includes(p.status))
    .filter(p => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      const projMatch = p.title.toLowerCase().includes(q) || (p.partners||"").toLowerCase().includes(q) || (p.notes||"").toLowerCase().includes(q);
      const taskMatch = tasks.filter(t=>t.project_id===p.id).some(t => t.title.toLowerCase().includes(q));
      return projMatch || taskMatch;
    })
    .sort((a, b) => {
      // Day-to-Day always first
      if (a.title === DAY_TO_DAY_TITLE) return -1;
      if (b.title === DAY_TO_DAY_TITLE) return 1;
      const dir = sortDir==="asc"?1:-1;
      if (sortBy==="priority")   { const d=PRIORITIES.indexOf(a.priority)-PRIORITIES.indexOf(b.priority); return d!==0?d*dir:(new Date(a.due_date)-new Date(b.due_date)); }
      if (sortBy==="start_date") { const da=a.start_date?new Date(a.start_date):new Date("9999"); const db=b.start_date?new Date(b.start_date):new Date("9999"); return (da-db)*dir; }
      if (sortBy==="due_date")   { const da=a.due_date?new Date(a.due_date):new Date("9999"); const db=b.due_date?new Date(b.due_date):new Date("9999"); return (da-db)*dir; }
      if (sortBy==="status")     { const d=STATUS_OPTIONS.indexOf(a.status)-STATUS_OPTIONS.indexOf(b.status); return d!==0?d*dir:PRIORITIES.indexOf(a.priority)-PRIORITIES.indexOf(b.priority); }
      return 0;
    });

  const criticalCount = projects.filter(p=>p.priority==="Critical"&&p.status!=="Complete").length;

  return (
    <PageShell
      title="Projects"
      alert={criticalCount>0?`● ${criticalCount} CRITICAL ITEM${criticalCount>1?"S":""} NEED ATTENTION`:null}
      actions={<>
        <div ref={exportRef} style={{ position:"relative" }}>
          <SecondaryBtn onClick={()=>setShowExport(v=>!v)}>↓ Export</SecondaryBtn>
          {showExport&&(
            <div style={{ position:"absolute",right:0,top:"calc(100% + 8px)",background:"#17171A",border:"1px solid #2A2A2F",borderRadius:10,overflow:"hidden",zIndex:50,minWidth:200,boxShadow:"0 8px 32px rgba(0,0,0,0.5)" }}>
              {[{label:"Export Tasks CSV",fn:exportCSV},{label:"Export Tasks Excel",fn:exportExcel}].map(o=>(
                <button key={o.label} onClick={o.fn} onMouseEnter={e=>e.currentTarget.style.background="#1E1E22"} onMouseLeave={e=>e.currentTarget.style.background="transparent"} style={{ display:"flex",alignItems:"center",width:"100%",padding:"11px 16px",background:"transparent",border:"none",color:"#E8E4DC",cursor:"pointer",fontFamily:"'DM Sans',sans-serif",fontSize:13,fontWeight:500 }}>{o.label}</button>
              ))}
            </div>
          )}
        </div>
        <SecondaryBtn onClick={openGlobalAddTask}>+ Add Task</SecondaryBtn>
        <PrimaryBtn onClick={()=>{ setShowForm(true); setEditId(null); setForm(EMPTY_FORM); }}>
          <span style={{ fontSize:16 }}>+</span> New Project
        </PrimaryBtn>
      </>}
    >
      {/* Search + Sort + Filters */}
      <div style={{ padding:"14px 32px 0" }}>
        <div style={{ display:"flex",gap:10,alignItems:"center",flexWrap:"wrap",marginBottom:8 }}>
          <div style={{ position:"relative",flex:"0 0 240px" }}>
            <span style={{ position:"absolute",left:11,top:"50%",transform:"translateY(-50%)",color:"#444",fontSize:13 }}>⌕</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search projects & tasks…" style={{ ...INPUT_STYLE,paddingLeft:30,fontSize:12,height:34,border:"1px solid #2A2A2F" }} />
            {search&&<button onClick={()=>setSearch("")} style={{ position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:"#444",cursor:"pointer",fontSize:11,padding:0 }}>✕</button>}
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:5 }}>
            <span style={{ fontFamily:"'DM Mono',monospace",fontSize:8,color:"#3A3A3F",letterSpacing:1,textTransform:"uppercase" }}>Sort</span>
            {[{k:"priority",l:"Priority"},{k:"start_date",l:"Start"},{k:"due_date",l:"Due"},{k:"status",l:"Status"}].map(o=>(
              <button key={o.k} onClick={()=>{ if(sortBy===o.k) setSortDir(d=>d==="asc"?"desc":"asc"); else{setSortBy(o.k);setSortDir("asc");} }} style={{ background:sortBy===o.k?"#1E1E22":"transparent",color:sortBy===o.k?"#E8E4DC":"#444",border:`1px solid ${sortBy===o.k?"#3A3A3F":"#2A2A2F"}`,borderRadius:6,padding:"4px 10px",fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",display:"flex",alignItems:"center",gap:3 }}>
                {o.l}{sortBy===o.k&&<span>{sortDir==="asc"?"↑":"↓"}</span>}
              </button>
            ))}
          </div>
          <div style={{ marginLeft:"auto",display:"flex",alignItems:"center",gap:10 }}>
            {(activeFilters>0||search)&&<button onClick={()=>{setFilterPri([]);setFilterStat([]);setSearch("");}} style={{ background:"none",border:"none",color:"#444",fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:1,cursor:"pointer",textDecoration:"underline",textTransform:"uppercase" }}>Clear {activeFilters>0?`(${activeFilters})`:""}</button>}
            <span style={{ fontFamily:"'DM Mono',monospace",fontSize:8,color:"#2A2A2F",letterSpacing:1 }}>{filteredProjects.length}/{projects.length}</span>
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
        {filteredProjects.length===0&&<div style={{ textAlign:"center",padding:"60px 0",color:"#2A2A2F",fontFamily:"'DM Mono',monospace",fontSize:11,letterSpacing:2 }}>NO PROJECTS FOUND</div>}
        {filteredProjects.map((p,i)=>{
          const pc          = PRIORITY_CONFIG[p.priority];
          const expanded    = expandedId===p.id;
          const done        = p.status==="Complete";
          const isPermanent = p.title===DAY_TO_DAY_TITLE;
          const hasReminder = reminders.some(r=>r.project_id===p.id);
          const projTasks   = tasks.filter(t=>t.project_id===p.id).sort((a,b)=>(a.sort_order||0)-(b.sort_order||0));
          const progress    = getTaskProgress(projTasks);
          const projNotes   = projectNotes[p.id]||[];

          return (
            <div key={p.id} style={{ background:"#111114",border:"1px solid #1E1E22",borderLeft:`3px solid ${done?"#2A2A2F":pc.color}`,borderRadius:10,marginBottom:8,opacity:done?0.6:1,transition:"all 0.2s",animation:`fadeSlide 0.3s ease ${i*0.03}s both` }}>
              {/* Project header row */}
              <div onClick={()=>setExpandedId(expanded?null:p.id)} style={{ padding:"12px 16px",cursor:"pointer",display:"flex",alignItems:"center",gap:12 }}>
                <div onClick={e=>{e.stopPropagation();!isPermanent&&handleStatusCycle(p.id);}} style={{ width:10,height:10,borderRadius:"50%",background:done?"#2A2A2F":pc.dot,flexShrink:0,cursor:isPermanent?"default":"pointer",boxShadow:done?"none":`0 0 6px ${pc.dot}88`,transition:"all 0.2s" }} />
                <div style={{ flex:1,minWidth:0 }}>
                  <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:2 }}>
                    <div style={{ fontWeight:600,fontSize:13,color:done?"#444":"#E8E4DC",textDecoration:done?"line-through":"none",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>
                      {isPermanent&&<span style={{ fontFamily:"'DM Mono',monospace",fontSize:8,color:"#444",letterSpacing:1,marginRight:6,textTransform:"uppercase" }}>📌</span>}
                      {highlight(p.title,search)}
                    </div>
                    {isPermanent&&<span style={{ fontFamily:"'DM Mono',monospace",fontSize:8,color:"#2A2A2F",letterSpacing:1,textTransform:"uppercase",flexShrink:0 }}>Permanent</span>}
                  </div>
                  {projTasks.length>0&&<ProgressBar complete={progress.complete} total={progress.total} />}
                  {p.partners&&<div style={{ fontSize:10,color:"#444",marginTop:2,fontFamily:"'DM Mono',monospace",letterSpacing:0.4 }}>{p.partners}</div>}
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

              {/* Expanded content */}
              {expanded&&(
                <div style={{ borderTop:"1px solid #181818" }}>
                  {/* Project details */}
                  <div style={{ padding:"12px 16px 0 38px" }}>
                    <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"8px 20px",marginBottom:10 }}>
                      <MiniField label="Start Date"   value={fmtDate(p.start_date)} />
                      <MiniField label="Due Date"     value={fmtDate(p.due_date)} />
                      <MiniField label="Status"       value={p.status} />
                      <MiniField label="Key Partners" value={p.partners||"—"} />
                      <MiniField label="Priority"     value={p.priority} color={pc.color} />
                      <MiniField label="Progress"     value={`${progress.complete} of ${progress.total} tasks complete`} />
                    </div>
                    {p.notes&&<div style={{ marginBottom:10 }}><div style={{ fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:2,color:"#2A2A2F",textTransform:"uppercase",marginBottom:3 }}>Description</div><div style={{ fontSize:13,color:"#777",lineHeight:1.6 }}>{p.notes}</div></div>}
                  </div>

                  {/* Task list */}
                  <div style={{ padding:"0 16px 0 38px" }}>
                    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8 }}>
                      <div style={{ fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:2,color:"#3A3A3F",textTransform:"uppercase" }}>Tasks ({projTasks.length})</div>
                      <button onClick={()=>openAddTask(p.id)} style={{ background:"transparent",border:"1px solid #2A2A2F",borderRadius:6,padding:"4px 10px",fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",color:"#555" }}>+ Add Task</button>
                    </div>

                    {projTasks.length===0 ? (
                      <div style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:"#2A2A2F",letterSpacing:1,padding:"8px 0 12px" }}>NO TASKS YET</div>
                    ) : (
                      <div style={{ marginBottom:12 }}>
                        {projTasks.map((t, ti) => {
                          const tpc = PRIORITY_CONFIG[t.priority];
                          const isDragging = dragTaskId===t.id;
                          const isDragOver = dragOverId===t.id && dragTaskId!==t.id;
                          const tNotes = taskNotes[t.id];
                          const tNotesExpanded = expandedNoteId===t.id;

                          return (
                            <div key={t.id}
                              draggable
                              onDragStart={e=>handleDragStart(e,t.id,p.id)}
                              onDragOver={e=>handleDragOver(e,t.id)}
                              onDrop={e=>handleDrop(e,t.id,p.id)}
                              onDragEnd={()=>{setDragTaskId(null);setDragOverId(null);}}
                              style={{ background:isDragOver?"#1A1A1E":"#0D0D10",border:`1px solid ${isDragOver?"#3A3A3F":"#1E1E22"}`,borderRadius:8,marginBottom:5,opacity:isDragging?0.4:1,transition:"all 0.15s",cursor:"grab" }}
                            >
                              <div style={{ padding:"9px 12px",display:"flex",alignItems:"center",gap:10 }}>
                                {/* Drag handle */}
                                <div style={{ color:"#2A2A2F",fontSize:12,cursor:"grab",flexShrink:0 }}>⠿</div>

                                {/* Checkbox */}
                                <div onClick={()=>toggleTaskComplete(t)} style={{ width:16,height:16,borderRadius:4,border:`1.5px solid ${t.complete?"#4ECDC4":"#2A2A2F"}`,background:t.complete?"#4ECDC422":"transparent",cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",transition:"all 0.15s" }}>
                                  {t.complete&&<span style={{ color:"#4ECDC4",fontSize:10,lineHeight:1 }}>✓</span>}
                                </div>

                                <div style={{ flex:1,minWidth:0 }}>
                                  <div style={{ fontSize:12,fontWeight:500,color:t.complete?"#444":"#E8E4DC",textDecoration:t.complete?"line-through":"none",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{highlight(t.title,search)}</div>
                                  {t.assignee&&<div style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:"#3A3A3F",marginTop:1 }}>{t.assignee}</div>}
                                </div>

                                <div style={{ display:"flex",alignItems:"center",gap:6,flexShrink:0 }}>
                                  <PriorityBadge priority={t.priority} />
                                  <DueBadge date={t.due_date} />
                                  {/* Arrow buttons */}
                                  <div style={{ display:"flex",flexDirection:"column",gap:1 }}>
                                    <button onClick={()=>moveTask(p.id,t.id,"up")} disabled={ti===0} style={{ background:"none",border:"none",color:ti===0?"#1E1E22":"#444",cursor:ti===0?"default":"pointer",fontSize:9,padding:"0 2px",lineHeight:1 }}>▲</button>
                                    <button onClick={()=>moveTask(p.id,t.id,"down")} disabled={ti===projTasks.length-1} style={{ background:"none",border:"none",color:ti===projTasks.length-1?"#1E1E22":"#444",cursor:ti===projTasks.length-1?"default":"pointer",fontSize:9,padding:"0 2px",lineHeight:1 }}>▼</button>
                                  </div>
                                  {/* Task actions */}
                                  <button onClick={()=>openEditTask(t)} style={{ background:"none",border:"none",color:"#444",cursor:"pointer",fontSize:10,padding:"0 3px" }}>✎</button>
                                  <button onClick={()=>{ if(tNotesExpanded){setExpandedNoteId(null);}else{setExpandedNoteId(t.id);if(!tNotes)fetchTaskNotes(t.id);} }} style={{ background:"none",border:"none",color:tNotesExpanded?"#F5C842":"#444",cursor:"pointer",fontSize:10,padding:"0 3px" }}>💬</button>
                                  <button onClick={()=>handleDeleteTask(t.id)} style={{ background:"none",border:"none",color:"#444",cursor:"pointer",fontSize:10,padding:"0 3px" }}>✕</button>
                                </div>
                              </div>

                              {/* Task notes */}
                              {tNotesExpanded&&(
                                <div style={{ padding:"0 12px 10px 12px",borderTop:"1px solid #181818" }}>
                                  <TaskNoteThread notes={tNotes||[]} taskId={t.id} session={session} onAdd={addTaskNote} onDelete={deleteTaskNote} />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Project note thread */}
                  <div style={{ padding:"0 16px 14px 38px",borderTop:"1px solid #181818",paddingTop:12 }}>
                    <div style={{ fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:2,color:"#2A2A2F",textTransform:"uppercase",marginBottom:8 }}>Project Notes</div>
                    {projNotes.length===0 ? (
                      <div style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:"#2A2A2F",letterSpacing:1,marginBottom:8 }}>NO NOTES YET</div>
                    ) : (
                      <div style={{ marginBottom:10 }}>
                        {projNotes.map(n=>(
                          <div key={n.id} style={{ marginBottom:7,padding:"8px 11px",background:"#0D0D10",borderRadius:8,border:"1px solid #1E1E22" }}>
                            <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:3 }}>
                              <span style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:"#444",letterSpacing:0.5 }}>{n.author_name} · {fmtDateTime(n.created_at)}</span>
                              {n.author_email===session.user.email&&<button onClick={()=>deleteProjectNote(p.id,n.id)} style={{ background:"none",border:"none",color:"#2A2A2F",cursor:"pointer",fontSize:10,padding:0 }}>✕</button>}
                            </div>
                            <div style={{ fontSize:13,color:"#E8E4DC",lineHeight:1.55 }}>{n.body}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    <NoteInput onSubmit={text=>{ addProjectNote(p.id,text); }} loading={noteLoading} />
                  </div>

                  {/* Reminder banner */}
                  {hasReminder&&(()=>{ const r=reminders.find(r=>r.project_id===p.id); return <div style={{ margin:"0 16px 12px 38px",padding:"7px 11px",background:"#17170C",border:"1px solid #F5C84233",borderRadius:6,fontSize:10,color:"#F5C842",fontFamily:"'DM Mono',monospace",display:"flex",justifyContent:"space-between",alignItems:"center" }}><span>🔔 {r.days_before}d BEFORE DUE · {r.email}</span><button onClick={async()=>{await supabase.from("reminders").delete().eq("project_id",p.id);setReminders(rs=>rs.filter(r=>r.project_id!==p.id));}} style={{ background:"none",border:"none",color:"#F5C842",cursor:"pointer",fontSize:10,opacity:0.6 }}>✕</button></div>; })()}

                  {/* Project action buttons */}
                  <div style={{ padding:"0 16px 14px 38px",display:"flex",gap:7,flexWrap:"wrap" }}>
                    <GhostBtn onClick={()=>handleEditProject(p)} color="#777">Edit</GhostBtn>
                    <GhostBtn onClick={()=>openReminderFor(p.id)} color="#F5C842">{hasReminder?"Update Reminder":"Set Reminder"}</GhostBtn>
                    {!isPermanent&&<GhostBtn onClick={()=>handleStatusCycle(p.id)} color="#4ECDC4">Cycle Status</GhostBtn>}
                    {!isPermanent&&<GhostBtn onClick={()=>handleDeleteProject(p.id)} color="#FF3B3B">Delete Project</GhostBtn>}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* New/Edit Project Modal */}
      {showForm&&(
        <ModalWrap wide onClose={()=>{setShowForm(false);setEditId(null);}}>
          <div style={{ fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,marginBottom:20,color:"#F0EBE0" }}>{editId?"Edit Project":"New Project"}</div>
          <FField label="Project Title *"><input value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Q3 Revenue Reforecast" style={INPUT_STYLE} autoFocus /></FField>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12 }}>
            <FField label="Start Date"><input type="date" value={form.start_date} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))} style={INPUT_STYLE} /></FField>
            <FField label="Due Date"><input type="date" value={form.due_date} onChange={e=>setForm(f=>({...f,due_date:e.target.value}))} style={INPUT_STYLE} /></FField>
            <FField label="Priority"><select value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} style={INPUT_STYLE}>{PRIORITIES.map(p=><option key={p}>{p}</option>)}</select></FField>
          </div>
          <FField label="Status"><div style={{ display:"flex",gap:7 }}>{STATUS_OPTIONS.map(s=><button key={s} onClick={()=>setForm(f=>({...f,status:s}))} style={{ flex:1,padding:"7px 0",background:form.status===s?"#E8E4DC":"transparent",color:form.status===s?"#0C0C0E":"#444",border:`1px solid ${form.status===s?"#E8E4DC":"#2A2A2F"}`,borderRadius:6,fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:1,textTransform:"uppercase",cursor:"pointer",transition:"all 0.15s" }}>{s}</button>)}</div></FField>
          <FField label="Key Partners"><input value={form.partners} onChange={e=>setForm(f=>({...f,partners:e.target.value}))} placeholder="e.g. Legal, Sarah K." style={INPUT_STYLE} /></FField>
          <FField label="Notes / Description"><textarea value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Any context…" rows={2} style={{ ...INPUT_STYLE,resize:"vertical",lineHeight:1.5 }} /></FField>
          {!editId&&(
            <div style={{ marginBottom:14 }}>
              <label style={{ display:"flex",alignItems:"center",gap:8,cursor:"pointer" }}>
                <input type="checkbox" checked={form.is_recurring} onChange={e=>setForm(f=>({...f,is_recurring:e.target.checked}))} style={{ accentColor:"#E8E4DC",width:14,height:14 }} />
                <span style={{ fontFamily:"'DM Mono',monospace",fontSize:9,letterSpacing:2,color:"#555",textTransform:"uppercase" }}>Create as recurring series</span>
              </label>
              {form.is_recurring&&(
                <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:12 }}>
                  <FField label="Recurrence"><select value={form.recurrence_rule} onChange={e=>setForm(f=>({...f,recurrence_rule:e.target.value}))} style={INPUT_STYLE}><option value="weekly">Weekly</option><option value="biweekly">Bi-weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option></select></FField>
                  <FField label="Generate until"><input type="date" value={form.recurrence_end} onChange={e=>setForm(f=>({...f,recurrence_end:e.target.value}))} style={INPUT_STYLE} /></FField>
                </div>
              )}
            </div>
          )}
          <div style={{ display:"flex",gap:10,marginTop:8 }}>
            <CancelBtn onClick={()=>{setShowForm(false);setEditId(null);setForm(EMPTY_FORM);}} />
            <button onClick={handleSubmit} disabled={!form.title.trim()||saving} style={{ flex:2,padding:"11px 0",background:form.title.trim()?"#E8E4DC":"#1A1A1E",color:form.title.trim()?"#0C0C0E":"#333",border:"none",borderRadius:8,fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:13,cursor:form.title.trim()?"pointer":"not-allowed",transition:"all 0.2s" }}>
              {saving?"Saving…":editId?"Save Changes":form.is_recurring?"Preview Series →":"Create Project"}
            </button>
          </div>
        </ModalWrap>
      )}

      {/* Add/Edit Task Modal */}
      {showTaskForm&&(
        <ModalWrap onClose={()=>{setShowTaskForm(false);setEditTaskId(null);}}>
          <div style={{ fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,marginBottom:20,color:"#F0EBE0" }}>{editTaskId?"Edit Task":"Add Task"}</div>
          <FField label="Task Title *"><input value={taskForm.title} onChange={e=>setTaskForm(f=>({...f,title:e.target.value}))} placeholder="e.g. Send preliminary numbers to Sarah" style={INPUT_STYLE} autoFocus /></FField>
          <FField label="Project">
            <select value={taskForm.project_id} onChange={e=>setTaskForm(f=>({...f,project_id:e.target.value}))} style={INPUT_STYLE}>
              <option value="">Select a project…</option>
              {projects.map(p=><option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          </FField>
          <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:12 }}>
            <FField label="Due Date"><input type="date" value={taskForm.due_date} onChange={e=>setTaskForm(f=>({...f,due_date:e.target.value}))} style={INPUT_STYLE} /></FField>
            <FField label="Priority"><select value={taskForm.priority} onChange={e=>setTaskForm(f=>({...f,priority:e.target.value}))} style={INPUT_STYLE}>{PRIORITIES.map(p=><option key={p}>{p}</option>)}</select></FField>
          </div>
          <FField label="Assignee"><input value={taskForm.assignee} onChange={e=>setTaskForm(f=>({...f,assignee:e.target.value}))} placeholder="e.g. Sarah K." style={INPUT_STYLE} /></FField>
          <div style={{ display:"flex",gap:10,marginTop:8 }}>
            <CancelBtn onClick={()=>{setShowTaskForm(false);setEditTaskId(null);}} />
            <button onClick={handleSaveTask} disabled={!taskForm.title.trim()||!taskForm.project_id||savingTask} style={{ flex:2,padding:"11px 0",background:(taskForm.title.trim()&&taskForm.project_id)?"#E8E4DC":"#1A1A1E",color:(taskForm.title.trim()&&taskForm.project_id)?"#0C0C0E":"#333",border:"none",borderRadius:8,fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:13,cursor:(taskForm.title.trim()&&taskForm.project_id)?"pointer":"not-allowed",transition:"all 0.2s" }}>
              {savingTask?"Saving…":editTaskId?"Save Changes":"Add Task"}
            </button>
          </div>
        </ModalWrap>
      )}

      {/* Recurring preview */}
      {showRecurring&&(
        <ModalWrap wide onClose={()=>setShowRecurring(false)}>
          <div style={{ fontFamily:"'Playfair Display',serif",fontSize:20,fontWeight:700,marginBottom:6,color:"#F0EBE0" }}>↻ Recurring Series Preview</div>
          <div style={{ fontFamily:"'DM Mono',monospace",fontSize:10,color:"#444",letterSpacing:1,marginBottom:18 }}>{recurPreview.length} INSTANCES WILL BE CREATED</div>
          <div style={{ maxHeight:300,overflowY:"auto",marginBottom:18 }}>
            {recurPreview.map((p,i)=>{ const pc=PRIORITY_CONFIG[p.priority]; return <div key={i} style={{ display:"flex",alignItems:"center",gap:10,padding:"8px 12px",background:"#0D0D10",borderRadius:8,marginBottom:5,border:"1px solid #1E1E22" }}><div style={{ width:7,height:7,borderRadius:"50%",background:pc.dot,flexShrink:0 }} /><div style={{ flex:1,minWidth:0 }}><div style={{ fontSize:12,fontWeight:500,color:"#E8E4DC",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis" }}>{p.title}</div><div style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:"#444",marginTop:2 }}>{fmtDate(p.start_date)} → {fmtDate(p.due_date)}</div></div></div>; })}
          </div>
          <div style={{ display:"flex",gap:10 }}>
            <CancelBtn onClick={()=>setShowRecurring(false)} />
            <button onClick={confirmRecurring} disabled={recurSaving} style={{ flex:2,padding:"11px 0",background:"#E8E4DC",color:"#0C0C0E",border:"none",borderRadius:8,fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:13,cursor:"pointer" }}>{recurSaving?"Creating…":`Create All ${recurPreview.length} Projects`}</button>
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
            </div>
          )}
        </ModalWrap>
      )}
    </PageShell>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────

function NoteInput({ onSubmit, loading }) {
  const [text, setText] = useState("");
  return (
    <div style={{ display:"flex",gap:8 }}>
      <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ onSubmit(text); setText(""); }}} placeholder="Add a note… (Enter to submit)" style={{ ...INPUT_STYLE,flex:1,fontSize:12,padding:"7px 11px" }} />
      <button onClick={()=>{ onSubmit(text); setText(""); }} disabled={!text.trim()||loading} style={{ background:"#E8E4DC",color:"#0C0C0E",border:"none",borderRadius:8,padding:"7px 14px",fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:12,cursor:text.trim()?"pointer":"not-allowed",opacity:text.trim()?1:0.4 }}>Post</button>
    </div>
  );
}

function TaskNoteThread({ notes, taskId, session, onAdd, onDelete }) {
  const [text, setText] = useState("");
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ fontFamily:"'DM Mono',monospace",fontSize:8,letterSpacing:2,color:"#2A2A2F",textTransform:"uppercase",marginBottom:6 }}>Task Notes</div>
      {(!notes||notes.length===0) ? <div style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:"#2A2A2F",marginBottom:8 }}>NO NOTES YET</div> : (
        <div style={{ marginBottom:8 }}>
          {notes.map(n=>(
            <div key={n.id} style={{ marginBottom:6,padding:"7px 10px",background:"#111114",borderRadius:7,border:"1px solid #1E1E22" }}>
              <div style={{ display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:2 }}>
                <span style={{ fontFamily:"'DM Mono',monospace",fontSize:9,color:"#444",letterSpacing:0.5 }}>{n.author_name} · {new Date(n.created_at).toLocaleString("en-US",{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"})}</span>
                {n.author_email===session.user.email&&<button onClick={()=>onDelete(taskId,n.id)} style={{ background:"none",border:"none",color:"#2A2A2F",cursor:"pointer",fontSize:9,padding:0 }}>✕</button>}
              </div>
              <div style={{ fontSize:12,color:"#E8E4DC",lineHeight:1.5 }}>{n.body}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ display:"flex",gap:7 }}>
        <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{ if(e.key==="Enter"&&!e.shiftKey){ onAdd(taskId,text); setText(""); }}} placeholder="Add note… (Enter)" style={{ ...INPUT_STYLE,flex:1,fontSize:11,padding:"6px 10px" }} />
        <button onClick={()=>{ onAdd(taskId,text); setText(""); }} disabled={!text.trim()} style={{ background:"#E8E4DC",color:"#0C0C0E",border:"none",borderRadius:7,padding:"6px 12px",fontFamily:"'DM Sans',sans-serif",fontWeight:600,fontSize:11,cursor:text.trim()?"pointer":"not-allowed",opacity:text.trim()?1:0.4 }}>Post</button>
      </div>
    </div>
  );
}

function addMonths(date, n) { const d=new Date(date); d.setMonth(d.getMonth()+n); return d.toISOString().split("T")[0]; }
