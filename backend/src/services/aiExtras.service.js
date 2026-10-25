// Smart leave parsing + dashboard insights. Rule-based and deterministic: never fabricates data;
// output is only a pre-filled suggestion, the user confirms before anything is saved.
const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const URDU_DAYS = { itwar:0, peer:1, pir:1, mangal:2, budh:3, jumeraat:4, jumma:5, hafta:6 };
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => { const x = new Date(d); x.setUTCDate(x.getUTCDate() + n); return x; };

function nextWeekday(from, dow, forceNextWeek) {
  let d = addDays(from, 1);
  while (d.getUTCDay() !== dow) d = addDays(d, 1);
  if (forceNextWeek) {
    // "next Monday": the Monday of the following week if today's week still has it ahead
    const daysAhead = Math.round((d - from) / 86400000);
    if (daysAhead < 7 && from.getUTCDay() !== 0 && dow >= from.getUTCDay() && dow !== 0) d = addDays(d, 0);
  }
  return d;
}

export function parseSmartLeave(text, now = new Date()) {
  const t = (text || '').toLowerCase();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  let type = 'casual';
  if (/(sick|ill|fever|doctor|hospital|bimar|tabiyat|medical)/.test(t)) type = 'sick';
  else if (/(vacation|holiday trip|annual|travel|trip)/.test(t)) type = 'annual';
  else if (/unpaid|without pay/.test(t)) type = 'unpaid';

  const found = [];
  const re = new RegExp(`\\b(${[...DAYS, ...Object.keys(URDU_DAYS)].join('|')})\\b`, 'g');
  let m; while ((m = re.exec(t))) {
    const dow = DAYS.includes(m[1]) ? DAYS.indexOf(m[1]) : URDU_DAYS[m[1]];
    if (!found.includes(dow)) found.push(dow);
  }
  let start = null, end = null;
  const dateMatch = t.match(/(\d{4}-\d{2}-\d{2})/g);
  if (dateMatch) { start = new Date(dateMatch[0] + 'T00:00:00Z'); end = new Date((dateMatch[1] || dateMatch[0]) + 'T00:00:00Z'); }
  else if (found.length) {
    // "next <day>" = first occurrence of that weekday in the next calendar week (Mon-based)
    const nextWeek = /next|agle|agla/.test(t);
    const anchor = nextWeek ? addDays(today, ((8 - today.getUTCDay()) % 7) || 7) : today; // next Monday or today
    const pick = (dow) => { let d = nextWeek ? anchor : addDays(today, 0); while (d.getUTCDay() !== dow || (!nextWeek && d <= today)) d = addDays(d, 1); return d; };
    const ds = found.map(pick).sort((a, b) => a - b);
    start = ds[0]; end = ds[ds.length - 1];
  } else if (/tomorrow|kal/.test(t)) { start = end = addDays(today, 1); }
  else if (/today|aaj/.test(t)) { start = end = today; }
  const n = t.match(/(\d+)\s*(day|days|din)/);
  if (start && n && !dateMatch && found.length <= 1) end = addDays(start, Number(n[1]) - 1);
  if (!start) return { ok: false, message: 'Could not find dates in your sentence. Please fill the form manually.' };

  let reason = (text || '').trim();
  const why = t.match(/(?:for|because|due to|wajah|ke liye)\s+(.+)$/);
  if (why) reason = why[1].replace(/[.!]+$/, '');
  reason = reason.charAt(0).toUpperCase() + reason.slice(1);
  return { ok: true, suggestion: { leaveType: type, startDate: iso(start), endDate: iso(end), reason } };
}

export function summarizeDashboard(role, d) {
  const bullets = [];
  if (role === 'admin') {
    bullets.push(`${d.activeEmployees} active of ${d.totalEmployees} employees across ${d.departments} department(s).`);
    bullets.push(`${d.presentToday} present today, ${d.lateToday} late.`);
    bullets.push(`${d.pendingLeaves} leave request(s) pending approval.`);
    bullets.push(d.payrollSummary?.count ? `Payroll this month: PKR ${Math.round(d.payrollSummary.total).toLocaleString()} net for ${d.payrollSummary.count} employee(s).` : 'No payroll generated for the current month yet.');
    const top = [...(d.departmentBreakdown || [])].sort((a, b) => b.count - a.count)[0];
    if (top) bullets.push(`Largest department: ${top.name} (${top.count}).`);
  } else {
    for (const [k, v] of Object.entries(d)) if (typeof v === 'number') bullets.push(`${k}: ${v}`);
  }
  return bullets;
}
