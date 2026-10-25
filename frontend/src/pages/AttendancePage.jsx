import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { useToast } from '../hooks/useToast.jsx';
import api from '../services/api.js';
import { PageHeader, Modal, Loading, Empty, Field, Badge, fmtDate, fmtTime, errMsg, MONTHS } from '../components/ui.jsx';
import { LogIn, LogOut, MapPin } from 'lucide-react';

function getPosition() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve({});
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve({}), { timeout: 5000 });
  });
}

function EmployeeView() {
  const toast = useToast();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [today, setToday] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [corr, setCorr] = useState(null);
  const [form, setForm] = useState({ reason: '', requestedClockIn: '', requestedClockOut: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, h] = await Promise.all([api.get('/attendance/today'), api.get('/attendance/mine', { params: { month, year } })]);
      setToday(t.data); setRecords(h.data.records);
    } catch (e) { toast.error(errMsg(e)); } finally { setLoading(false); }
  }, [month, year]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  async function act(kind) {
    setBusy(true);
    try {
      if (kind === 'in') { const pos = await getPosition(); await api.post('/attendance/clock-in', pos); toast.success('Checked in'); }
      else { await api.post('/attendance/clock-out'); toast.success('Checked out'); }
      await load();
    } catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  }

  async function submitCorr(e) {
    e.preventDefault();
    try {
      const body = { reason: form.reason };
      const d = fmtDate(corr.date);
      if (form.requestedClockIn) body.requestedClockIn = new Date(`${d}T${form.requestedClockIn}`).toISOString();
      if (form.requestedClockOut) body.requestedClockOut = new Date(`${d}T${form.requestedClockOut}`).toISOString();
      await api.post(`/attendance/${corr._id}/correction`, body);
      toast.success('Correction requested'); setCorr(null); load();
    } catch (err) { toast.error(errMsg(err)); }
  }

  const checkedIn = !!today?.clockIn, checkedOut = !!today?.clockOut;
  return (
    <>
      <PageHeader title="My Attendance" subtitle="Check in and out, review your history" />
      <div className="card mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-sm text-slate-400">Today · {fmtDate(new Date())}</div>
          <div className="text-xl font-semibold text-white mt-1">
            {!checkedIn ? 'Not checked in' : `In ${fmtTime(today.clockIn)}${checkedOut ? ` · Out ${fmtTime(today.clockOut)}` : ''}`}
          </div>
          {today?.status && <div className="mt-2"><Badge s={today.status} /> {today.withinGeofence === false && <span className="badge-danger ml-1"><MapPin size={11} /> outside office</span>}</div>}
        </div>
        <div className="flex gap-2">
          <button className="btn-primary" disabled={busy || checkedIn} onClick={() => act('in')}><LogIn size={16} /> Check in</button>
          <button className="btn-secondary" disabled={busy || !checkedIn || checkedOut} onClick={() => act('out')}><LogOut size={16} /> Check out</button>
        </div>
      </div>
      <MonthPicker {...{ month, setMonth, year, setYear }} />
      <div className="card p-0">
        {loading ? <Loading /> : !records.length ? <Empty text="No attendance records this month" /> : (
          <div className="table-container"><table className="hcm-table">
            <thead><tr><th>Date</th><th>In</th><th>Out</th><th>Hours</th><th>Status</th><th>Correction</th><th /></tr></thead>
            <tbody>{records.map((r) => (
              <tr key={r._id}><td>{fmtDate(r.date)}</td><td>{fmtTime(r.clockIn)}</td><td>{fmtTime(r.clockOut)}</td>
                <td>{r.workedHours?.toFixed?.(1) ?? '—'}</td><td><Badge s={r.status} /></td>
                <td>{r.correctionRequest?.status ? <Badge s={r.correctionRequest.status} /> : '—'}</td>
                <td>{r.correctionRequest?.status !== 'pending' && <button className="btn-ghost btn-sm" onClick={() => { setCorr(r); setForm({ reason: '', requestedClockIn: '', requestedClockOut: '' }); }}>Request correction</button>}</td></tr>
            ))}</tbody></table></div>)}
      </div>
      {corr && (
        <Modal title={`Correction · ${fmtDate(corr.date)}`} onClose={() => setCorr(null)}>
          <form onSubmit={submitCorr} className="space-y-4">
            <Field label="Reason"><textarea required className="input" rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Correct check-in"><input type="time" className="input" value={form.requestedClockIn} onChange={(e) => setForm({ ...form, requestedClockIn: e.target.value })} /></Field>
              <Field label="Correct check-out"><input type="time" className="input" value={form.requestedClockOut} onChange={(e) => setForm({ ...form, requestedClockOut: e.target.value })} /></Field>
            </div>
            <button className="btn-primary w-full justify-center">Submit request</button>
          </form>
        </Modal>)}
    </>
  );
}

function MonthPicker({ month, setMonth, year, setYear }) {
  return (
    <div className="flex gap-2 mb-4">
      <select className="input w-32" value={month} onChange={(e) => setMonth(+e.target.value)}>{MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}</select>
      <input type="number" className="input w-28" value={year} onChange={(e) => setYear(+e.target.value)} />
    </div>
  );
}

function StaffView() {
  const toast = useToast();
  const [date, setDate] = useState(fmtDate(new Date()));
  const [data, setData] = useState(null);
  const [recs, setRecs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState(null);
  const [note, setNote] = useState('');
  const { user } = useAuth();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, l] = await Promise.all([api.get('/attendance/summary', { params: { date } }), api.get('/attendance', { params: { date, limit: 200 } })]);
      setData(s.data); setRecs(l.data.records);
    } catch (e) { toast.error(errMsg(e)); } finally { setLoading(false); }
  }, [date]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  async function decide(decision) {
    try {
      await api.put(`/attendance/${review._id}/correction`, { decision, reviewNote: note });
      toast.success(`Correction ${decision}`); setReview(null); setNote(''); load();
    } catch (e) { toast.error(errMsg(e)); }
  }
  const pending = recs.filter((r) => r.correctionRequest?.status === 'pending');
  return (
    <>
      <PageHeader title="Attendance Board" subtitle={user.role === 'hr' ? 'Daily board and corrections' : 'Daily attendance overview'}>
        <input type="date" className="input w-44" value={date} onChange={(e) => setDate(e.target.value)} />
      </PageHeader>
      {data && <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {[['Present', data.present], ['Late', data.late], ['Half day', data.halfDay], ['Absent', data.absent]].map(([l, v]) => (
          <div key={l} className="card"><div className="text-3xl font-bold text-white">{v}</div><div className="text-sm text-slate-400">{l}</div></div>))}
      </div>}
      {pending.length > 0 && <div className="card mb-6"><h3 className="font-semibold text-white mb-3">Pending corrections ({pending.length})</h3>
        {pending.map((r) => (<div key={r._id} className="flex items-center justify-between py-2 border-t border-slate-700 text-sm">
          <span className="text-slate-300">{r.employee?.user?.name} · {r.correctionRequest.reason}</span>
          <button className="btn-secondary btn-sm" onClick={() => setReview(r)}>Review</button></div>))}</div>}
      <div className="card p-0">{loading ? <Loading /> : !recs.length ? <Empty text="No records for this date" /> : (
        <div className="table-container"><table className="hcm-table">
          <thead><tr><th>Employee</th><th>ID</th><th>In</th><th>Out</th><th>Hours</th><th>Status</th><th>Geofence</th></tr></thead>
          <tbody>{recs.map((r) => (<tr key={r._id}><td>{r.employee?.user?.name}</td><td>{r.employee?.employeeId}</td><td>{fmtTime(r.clockIn)}</td><td>{fmtTime(r.clockOut)}</td>
            <td>{r.workedHours?.toFixed?.(1)}</td><td><Badge s={r.status} /></td><td>{r.withinGeofence == null ? '—' : r.withinGeofence ? 'Inside' : 'Outside'}</td></tr>))}</tbody></table></div>)}</div>
      {review && (<Modal title="Review correction" onClose={() => setReview(null)}>
        <p className="text-sm text-slate-300 mb-1">{review.employee?.user?.name} · {fmtDate(review.date)}</p>
        <p className="text-sm text-slate-400 mb-3">Reason: {review.correctionRequest.reason}</p>
        <p className="text-xs text-slate-500 mb-3">Requested: in {fmtTime(review.correctionRequest.requestedClockIn)} · out {fmtTime(review.correctionRequest.requestedClockOut)}</p>
        <Field label="Comment"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="flex gap-2 mt-4"><button className="btn-success flex-1 justify-center" onClick={() => decide('approved')}>Approve</button>
          <button className="btn-danger flex-1 justify-center" onClick={() => decide('rejected')}>Reject</button></div></Modal>)}
    </>
  );
}

export default function AttendancePage() {
  const { user } = useAuth();
  return user.role === 'employee' ? <EmployeeView /> : <StaffView />;
}
