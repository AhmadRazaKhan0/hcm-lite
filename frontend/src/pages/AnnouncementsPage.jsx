import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { useToast } from '../hooks/useToast.jsx';
import api from '../services/api.js';
import { PageHeader, Modal, Loading, Empty, Field, fmtDate, errMsg } from '../components/ui.jsx';
import { Plus, Pin, Trash2 } from 'lucide-react';

export default function AnnouncementsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const canPost = user.role !== 'employee';
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: '', content: '', audience: 'all', isPinned: false });

  const load = useCallback(() => {
    setLoading(true);
    api.get('/announcements').then((r) => setList(r.data)).catch((e) => toast.error(errMsg(e))).finally(() => setLoading(false));
  }, []); // eslint-disable-line
  useEffect(load, [load]);

  async function post(e) {
    e.preventDefault();
    try { await api.post('/announcements', f); toast.success('Announcement posted'); setOpen(false); setF({ title: '', content: '', audience: 'all', isPinned: false }); load(); }
    catch (err) { toast.error(errMsg(err)); }
  }
  async function remove(id) {
    if (!confirm('Remove this announcement?')) return;
    try { await api.delete(`/announcements/${id}`); load(); } catch (e) { toast.error(errMsg(e)); }
  }
  return (
    <>
      <PageHeader title="Announcements" subtitle="Company-wide updates">
        {canPost && <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> New</button>}
      </PageHeader>
      {loading ? <Loading /> : !list.length ? <div className="card"><Empty text="No announcements" /></div> : (
        <div className="space-y-4">{list.map((a) => (
          <div key={a._id} className="card">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="font-semibold text-white flex items-center gap-2">{a.isPinned && <Pin size={14} className="text-amber-400" />}{a.title}</h3>
                <p className="text-xs text-slate-500 mt-0.5">{a.createdBy?.name} · {fmtDate(a.createdAt)} · {a.audience}</p></div>
              {canPost && <button className="btn-danger btn-sm" onClick={() => remove(a._id)}><Trash2 size={13} /></button>}
            </div>
            <p className="text-sm text-slate-300 mt-3 whitespace-pre-wrap">{a.content}</p>
          </div>))}</div>)}
      {open && <Modal title="New announcement" onClose={() => setOpen(false)}>
        <form onSubmit={post} className="space-y-4">
          <Field label="Title"><input required className="input" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></Field>
          <Field label="Message"><textarea required rows={4} className="input" value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} /></Field>
          <Field label="Audience"><select className="input" value={f.audience} onChange={(e) => setF({ ...f, audience: e.target.value })}><option value="all">Everyone</option><option value="hr">HR only</option><option value="employee">Employees</option></select></Field>
          <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={f.isPinned} onChange={(e) => setF({ ...f, isPinned: e.target.checked })} /> Pin to top</label>
          <button className="btn-primary w-full justify-center">Post</button>
        </form></Modal>}
    </>
  );
}
