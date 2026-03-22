export const PRIORITIES = ["Critical", "High", "Medium", "Low"];

export const PRIORITY_CONFIG = {
  Critical: { color: "#FF3B3B", bg: "rgba(255,59,59,0.1)",  dot: "#FF3B3B" },
  High:     { color: "#FF8C00", bg: "rgba(255,140,0,0.1)",   dot: "#FF8C00" },
  Medium:   { color: "#F5C842", bg: "rgba(245,200,66,0.1)",  dot: "#F5C842" },
  Low:      { color: "#4ECDC4", bg: "rgba(78,205,196,0.1)",  dot: "#4ECDC4" },
};

export const STATUS_OPTIONS = ["In Progress", "On Hold", "Complete"];

export const EMPTY_FORM = {
  title: "", start_date: "", due_date: "", priority: "High",
  partners: "", notes: "", status: "In Progress",
  is_recurring: false, recurrence_rule: "weekly", recurrence_end: "",
};

export const EMPTY_REMINDER = { project_id: null, email: "", days_before: 3 };

export const INPUT_STYLE = {
  width: "100%", background: "#0C0C0E", border: "1px solid #2A2A2F",
  borderRadius: 8, padding: "10px 12px", color: "#E8E4DC",
  fontFamily: "'DM Sans', sans-serif", fontSize: 13, outline: "none",
};

export function getDaysUntil(dateStr) {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr) - new Date()) / 86400000);
}

export function fmtDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function fmtDateTime(isoStr) {
  if (!isoStr) return "";
  return new Date(isoStr).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// Generate recurring project instances from a template
export function generateRecurringInstances(template, rule, endDate) {
  const instances = [];
  const end = new Date(endDate);
  end.setHours(23, 59, 59);

  let cursor = template.start_date ? new Date(template.start_date) : new Date();
  cursor.setHours(0, 0, 0, 0);

  const durationDays = template.start_date && template.due_date
    ? Math.ceil((new Date(template.due_date) - new Date(template.start_date)) / 86400000)
    : 7;

  let index = 1;
  while (cursor <= end) {
    const start = new Date(cursor);
    const due   = new Date(cursor.getTime() + durationDays * 86400000);

    instances.push({
      title:      `${template.title} ${getInstanceSuffix(rule, start, index)}`,
      start_date: start.toISOString().split("T")[0],
      due_date:   due.toISOString().split("T")[0],
      priority:   template.priority,
      partners:   template.partners,
      notes:      template.notes,
      status:     "In Progress",
      is_recurring: true,
      recurrence_rule: rule,
    });

    // Advance cursor
    if (rule === "weekly")      cursor.setDate(cursor.getDate() + 7);
    else if (rule === "biweekly") cursor.setDate(cursor.getDate() + 14);
    else if (rule === "monthly")  cursor.setMonth(cursor.getMonth() + 1);
    else if (rule === "quarterly") cursor.setMonth(cursor.getMonth() + 3);
    else break;

    index++;
  }
  return instances;
}

function getInstanceSuffix(rule, date, index) {
  if (rule === "weekly" || rule === "biweekly") {
    return `— Wk of ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  }
  if (rule === "monthly") {
    return `— ${date.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
  }
  if (rule === "quarterly") {
    const q = Math.floor(date.getMonth() / 3) + 1;
    return `— Q${q} ${date.getFullYear()}`;
  }
  return `#${index}`;
}
