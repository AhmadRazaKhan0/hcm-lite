import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { useToast } from '../hooks/useToast.jsx';
import api from '../services/api.js';
import { PageHeader, Modal, Loading, Empty, Badge, pkr, errMsg, MONTHS } from '../components/ui.jsx';
import { Play, Lock, FileDown } from 'lucide-react';

function Payslip({ p, onClose }) {
  const name = p.employee?.user?.name;
  const rows = [['Basic salary', p.basicSalary], ['House rent allowance (40%)', p.hra], ['Medical allowance (10%)', p.medical], ['Gross salary', p.grossSalary]];
  const ded = [[`Absent (${p.absentDays} d)`, Math.round(p.absentDays * p.perDaySalary)], [`Half days (${p.halfDays})`, Math.round(p.halfDays * p.perDaySalary * 0.5)],
    [`Unpaid leave (${p.unpaidLeaveDays} d)`, Math.round(p.unpaidLeaveDays * p.perDaySalary)], ['Late deductions', p.lateDeductions], ['Income tax (monthly, illustrative)', p.monthlyTax]];
  return (
    <Modal title="Payslip" onClose={onClose} wide>
      <div id="payslip-print" className="space-y-4 text-sm">
        <div className="flex justify-between"><div><div className="text-lg font-bold text-white">{MONTHS[p.month - 1]} {p.year}</div>
          {name && <div className="text-slate-300">{name} · {p.employee?.employeeId}</div>}</div><Badge s={p.status} /></div>
        <table className="hcm-table w-full"><tbody>
          {rows.map(([l, v]) => <tr key={l}><td>{l}</td><td className="text-right">{pkr(v)}</td></tr>)}
          <tr><td colSpan={2} className="text-xs uppercase text-slate-500 pt-4">Deductions</td></tr>
          {ded.map(([l, v]) => <tr key={l}><td>{l}</td><td className="text-right">− {pkr(v)}</td></tr>)}
          <tr className="font-bold text-white"><td>Net salary</td><td className="text-right">{pkr(p.netSalary)}</td></tr>
        </tbody></table>
        <p className="text-xs text-slate-500">Per-day rate {pkr(p.perDaySalary)} · {p.workingDaysInMonth} working days. Tax slabs are illustrative.</p>
      </div>
      <button className="btn-primary mt-4" onClick={() => window.print()}><FileDown size={16} /> Download PDF (Print → Save as PDF)</button>
    </Modal>
  );
}

export default function PayrollPage() {
  const { user } = useAuth();
  const toast = useToast();
  const now = new Date();
  const isEmp = user.role === 'employee', isAdmin = user.role === 'admin';
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [slip, setSlip] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isEmp) { const { data } = await api.get('/payroll/mine'); setRows(data); }
      else { const { data } = await api.get('/payroll', { params: { month, year, limit: 200 } }); setRows(data.records); }
    } catch (e) { toast.error(errMsg(e)); } finally { setLoading(false); }
  }, [month, year, isEmp]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  async function generate() {
    setBusy(true);
    try { const { data } = await api.post('/payroll/generate', { month, year });
      const created = data.results.filter((r) => r.status === 'created').length;
      toast.success(`Draft generated: ${created} new payslip(s)`); load(); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }
  async function finalize(id) {
    if (!confirm('Finalize this payslip? It will be locked.')) return;
    try { await api.put(`/payroll/${id}/finalize`); toast.success('Payroll finalized'); load(); } catch (e) { toast.error(errMsg(e)); }
  }
  async function finalizeAll() {
    const drafts = rows.filter((r) => r.status !== 'finalized');
    if (!drafts.length || !confirm(`Finalize ${drafts.length} payslip(s) for ${MONTHS[month - 1]} ${year}? This locks them.`)) return;
    let ok = 0;
    for (const d of drafts) { try { await api.put(`/payroll/${d._id}/finalize`); ok++; } catch { /* continue */ } }
    toast.success(`${ok} payslip(s) finalized`); load();
  }
  const total = rows.reduce((s, r) => s + (r.netSalary || 0), 0);

  return (
    <>
      <PageHeader title={isEmp ? 'My Payslips' : 'Payroll'} subtitle={isEmp ? 'Finalized payslips only' : 'Generate the monthly draft; Admin finalizes and locks it'}>
        {!isEmp && <>
          <select className="input w-28" value={month} onChange={(e) => setMonth(+e.target.value)}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
          <input type="number" className="input w-24" value={year} onChange={(e) => setYear(+e.target.value)} />
          <button className="btn-primary" disabled={busy} onClick={generate}><Play size={16} /> {busy ? 'Generating…' : 'Generate draft'}</button>
          {isAdmin && <button className="btn-secondary" onClick={finalizeAll}><Lock size={16} /> Finalize all</button>}
        </>}
      </PageHeader>
      {!isEmp && rows.length > 0 && <div className="card mb-4 text-sm text-slate-300">{rows.length} payslip(s) · total net <span className="font-bold text-white">{pkr(total)}</span></div>}
      <div className="card p-0">{loading ? <Loading /> : !rows.length ? <Empty text={isEmp ? 'No finalized payslips yet' : 'No payroll for this month — generate a draft'} /> : (
        <div className="table-container"><table className="hcm-table">
          <thead><tr>{!isEmp && <th>Employee</th>}<th>Period</th><th>Gross</th><th>Deductions</th><th>Tax</th><th>Net</th><th>Status</th><th /></tr></thead>
          <tbody>{rows.map((r) => (<tr key={r._id}>
            {!isEmp && <td>{r.employee?.user?.name}</td>}
            <td>{MONTHS[r.month - 1]} {r.year}</td><td>{pkr(r.grossSalary)}</td><td>{pkr(r.totalDeductions)}</td><td>{pkr(r.monthlyTax)}</td>
            <td className="font-semibold text-white">{pkr(r.netSalary)}</td><td><Badge s={r.status} /></td>
            <td className="space-x-1 whitespace-nowrap"><button className="btn-ghost btn-sm" onClick={() => setSlip(r)}>View</button>
              {isAdmin && r.status !== 'finalized' && <button className="btn-secondary btn-sm" onClick={() => finalize(r._id)}>Finalize</button>}</td>
          </tr>))}</tbody></table></div>)}</div>
      {slip && <Payslip p={slip} onClose={() => setSlip(null)} />}
    </>
  );
}
