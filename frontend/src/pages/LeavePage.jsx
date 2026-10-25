import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { useToast } from '../hooks/useToast.jsx';
import api from '../services/api.js';
import { PageHeader, Modal, Loading, Empty, Field, Badge, fmtDate, errMsg } from '../components/ui.jsx';
import { Plus, Sparkles } from 'lucide-react';

const TYPES = ['annual', 'sick', 'casual', 'unpaid'];

function ApplyModal({ onClose, onSaved }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [filled, setFilled] = useState(false);
  const [f, setF] = useState({ leaveType: 'casual', startDate: '', endDate: '', reason: '' });
  const [saving, setSaving] = useState(false);

  async function smart() {
    if (!text.trim()) return;
    setAiBusy(true);
    try {
      const { data } = await api.post('/ai/smart-leave', { text });
      if (data.ok) { setF(data.suggestion); setFilled(true); } else toast.warning(data.message);
    } catch (e) { toast.error(errMsg(e)); } finally { setAiBusy(false); }
  }
  async function submit(e) {
    e.preventDefault(); setSaving(true);
    try { await api.post('/leave', f); toast.success('Leave request submitted'); onSaved(); }
    catch (err) { toast.error(errMsg(err)); } finally { setSaving(false); }
  }
  return (
    <Modal title="Apply for leave" onClose={onClose}>
      <div className="mb-5 p-3 rounded-xl border border-teal-500/30 bg-teal-500/5">
        <label className="input-label flex items-center gap-1"><Sparkles size={12} /> Smart leave — describe it in plain words</label>
        <div className="flex gap-2">
          <input className="input" placeholder="Need next Monday and Tuesday off for a wedding" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), smart())} />
          <button type="button" className="btn-secondary" disabled={aiBusy} onClick={smart}>{aiBusy ? '…' : 'Fill'}</button>
        </div>
        {filled && <p className="text-xs text-amber-400 mt-2">Suggested by the assistant — please review the form before submitting.</p>}
      </div>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Leave type"><select className="input" value={f.leaveType} onChange={(e) => setF({ ...f, leaveType: e.target.value })}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="From"><input required type="date" className="input" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></Field>
          <Field label="To"><input required type="date" className="input" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></Field>
        </div>
        <Field label="Reason"><textarea required rows={3} className="input" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></Field>
        <button disabled={saving} className="btn-primary w-full justify-center">{saving ? 'Submitting…' : 'Submit request'}</button>
      </form>
    </Modal>
  );
}

export default function LeavePage() {
  const { user } = useAuth();
  const toast = useToast();
  const isEmp = user.role === 'employee';
  const [reqs, setReqs] = useState([]);
  const [bal, setBal] = useState(null);
  const [status, setStatus] = useState(isEmp ? '' : 'pending');
  const [loading, setLoading] = useState(true);
  const [apply, setApply] = useState(false);
  const [review, setReview] = useState(null);
  const [note, setNote] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const calls = [api.get('/leave', { params: { status: status || undefined, limit: 100 } })];
      if (isEmp) calls.push(api.get('/leave/balance'));
      const [l, b] = await Promise.all(calls);
      setReqs(l.data.requests); if (b) setBal(b.data);
    } catch (e) { toast.error(errMsg(e)); } finally { setLoading(false); }
  }, [status, isEmp]); // eslint-disable-line
  useEffect(() => { load(); }, [load]);

  async function decide(decision) {
    try { await api.put(`/leave/${review._id}/review`, { decision, reviewNote: note }); toast.success(`Leave ${decision}`); setReview(null); setNote(''); load(); }
    catch (e) { toast.error(errMsg(e)); }
  }
  async function cancel(id) {
    try { await api.delete(`/leave/${id}`); toast.success('Request cancelled'); load(); } catch (e) { toast.error(errMsg(e)); }
  }

  return (
    <>
      <PageHeader title={isEmp ? 'My Leave' : 'Leave Requests'} subtitle={isEmp ? 'Balance, history and new requests' : 'Approve or reject employee leave'}>
        <select className="input w-40" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All</option>{['pending', 'approved', 'rejected', 'cancelled'].map((s) => <option key={s}>{s}</option>)}
        </select>
        {isEmp && <button className="btn-primary" onClick={() => setApply(true)}><Plus size={16} /> Apply</button>}
      </PageHeader>
      {isEmp && bal && <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {['annual', 'sick', 'casual'].map((t) => (<div key={t} className="card"><div className="text-3xl font-bold text-white">{bal[t].total - bal[t].used}<span className="text-base text-slate-500"> / {bal[t].total}</span></div><div className="text-sm text-slate-400 capitalize">{t} left</div></div>))}
        <div className="card"><div className="text-3xl font-bold text-white">{bal.unpaid.used}</div><div className="text-sm text-slate-400">Unpaid taken</div></div>
      </div>}
      <div className="card p-0">{loading ? <Loading /> : !reqs.length ? <Empty text="No leave requests" /> : (
        <div className="table-container"><table className="hcm-table">
          <thead><tr>{!isEmp && <th>Employee</th>}<th>Type</th><th>From</th><th>To</th><th>Days</th><th>Reason</th><th>Status</th><th /></tr></thead>
          <tbody>{reqs.map((r) => (<tr key={r._id}>
            {!isEmp && <td>{r.employee?.user?.name}</td>}
            <td className="capitalize">{r.leaveType}</td><td>{fmtDate(r.startDate)}</td><td>{fmtDate(r.endDate)}</td><td>{r.days}</td>
            <td className="max-w-xs truncate" title={r.reviewNote ? `${r.reason} — HR: ${r.reviewNote}` : r.reason}>{r.reason}</td>
            <td><Badge s={r.status} /></td>
            <td>{isEmp && r.status === 'pending' && <button className="btn-danger btn-sm" onClick={() => cancel(r._id)}>Cancel</button>}
              {!isEmp && r.status === 'pending' && <button className="btn-secondary btn-sm" onClick={() => setReview(r)}>Review</button>}</td>
          </tr>))}</tbody></table></div>)}</div>
      {apply && <ApplyModal onClose={() => setApply(false)} onSaved={() => { setApply(false); load(); }} />}
      {review && (<Modal title="Review leave" onClose={() => setReview(null)}>
        <p className="text-sm text-slate-300">{review.employee?.user?.name} · <span className="capitalize">{review.leaveType}</span> · {review.days} day(s)</p>
        <p className="text-sm text-slate-400 mb-4">{fmtDate(review.startDate)} → {fmtDate(review.endDate)} · {review.reason}</p>
        <Field label="Comment"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
        <div className="flex gap-2 mt-4"><button className="btn-success flex-1 justify-center" onClick={() => decide('approved')}>Approve</button>
          <button className="btn-danger flex-1 justify-center" onClick={() => decide('rejected')}>Reject</button></div></Modal>)}
    </>
  );
}
