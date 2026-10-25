import { useEffect, useState } from 'react';
import { useToast } from '../hooks/useToast.jsx';
import { useAuth } from '../hooks/useAuth.jsx';
import api from '../services/api.js';
import { PageHeader, Loading, Field, fmtDate, errMsg } from '../components/ui.jsx';

export function ChangePasswordForm({ onDone, forced }) {
  const toast = useToast();
  const { setUser } = useAuth();
  const [f, setF] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (f.newPassword !== f.confirm) return toast.error('Passwords do not match');
    setBusy(true);
    try {
      const { data } = await api.post('/auth/change-password', { currentPassword: f.currentPassword, newPassword: f.newPassword });
      localStorage.setItem('hcm_user', JSON.stringify(data.user)); setUser(data.user);
      toast.success('Password changed'); setF({ currentPassword: '', newPassword: '', confirm: '' }); onDone?.();
    } catch (err) { toast.error(errMsg(err)); } finally { setBusy(false); }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label={forced ? 'Temporary password' : 'Current password'}><input required type="password" className="input" value={f.currentPassword} onChange={(e) => setF({ ...f, currentPassword: e.target.value })} /></Field>
      <Field label="New password (min 8)"><input required minLength={8} type="password" className="input" value={f.newPassword} onChange={(e) => setF({ ...f, newPassword: e.target.value })} /></Field>
      <Field label="Confirm new password"><input required type="password" className="input" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
      <button disabled={busy} className="btn-primary w-full justify-center">{busy ? 'Saving…' : 'Change password'}</button>
    </form>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();
  const toast = useToast();
  const [emp, setEmp] = useState(null);
  const [loading, setLoading] = useState(true);
  const [contact, setContact] = useState({ phone: '', address: '' });

  useEffect(() => {
    if (user.role === 'admin') return setLoading(false);
    api.get('/employees/me').then((r) => { setEmp(r.data); setContact({ phone: r.data.phone || '', address: r.data.address || '' }); })
      .catch(() => {}).finally(() => setLoading(false));
  }, [user.role]);

  async function saveContact(e) {
    e.preventDefault();
    try { await api.put(`/employees/${emp._id}`, contact); toast.success('Profile updated'); } catch (err) { toast.error(errMsg(err)); }
  }
  if (loading) return <Loading />;
  return (
    <>
      <PageHeader title="My Profile" subtitle={`${user.name} · ${user.email}`} />
      <div className="grid md:grid-cols-2 gap-6">
        {emp && <div className="card">
          <h3 className="font-semibold text-white mb-4">Details</h3>
          <dl className="grid grid-cols-2 gap-y-2 text-sm mb-5">
            <dt className="text-slate-500">Employee ID</dt><dd className="text-slate-200">{emp.employeeId}</dd>
            <dt className="text-slate-500">Job title</dt><dd className="text-slate-200">{emp.jobTitle || '—'}</dd>
            <dt className="text-slate-500">Joined</dt><dd className="text-slate-200">{fmtDate(emp.joiningDate)}</dd>
            <dt className="text-slate-500">Status</dt><dd className="text-slate-200">{emp.employmentStatus}</dd>
          </dl>
          <form onSubmit={saveContact} className="space-y-3">
            <Field label="Phone"><input className="input" value={contact.phone} onChange={(e) => setContact({ ...contact, phone: e.target.value })} /></Field>
            <Field label="Address"><input className="input" value={contact.address} onChange={(e) => setContact({ ...contact, address: e.target.value })} /></Field>
            <button className="btn-primary">Save contact details</button>
          </form></div>}
        <div className="card"><h3 className="font-semibold text-white mb-4">Change password</h3><ChangePasswordForm /></div>
      </div>
    </>
  );
}
