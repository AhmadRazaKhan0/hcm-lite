import { useEffect, useState, useCallback } from 'react';
import { useToast } from '../hooks/useToast.jsx';
import api from '../services/api.js';
import { PageHeader, Modal, Loading, Empty, Field, errMsg } from '../components/ui.jsx';
import { UserPlus, KeyRound } from 'lucide-react';

export default function UsersPage() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState('');
  const [reset, setReset] = useState(null);
  const [pw, setPw] = useState('');
  const [hrOpen, setHrOpen] = useState(false);
  const [hr, setHr] = useState({ name: '', email: '', tempPassword: '' });

  const load = useCallback(() => {
    setLoading(true);
    api.get('/users', { params: { role: role || undefined, limit: 100 } }).then((r) => setUsers(r.data.users)).catch((e) => toast.error(errMsg(e))).finally(() => setLoading(false));
  }, [role]); // eslint-disable-line
  useEffect(load, [load]);

  async function toggle(u) {
    try { await api.put(`/users/${u._id}`, { isActive: !u.isActive }); toast.success(u.isActive ? 'User deactivated' : 'User activated'); load(); } catch (e) { toast.error(errMsg(e)); }
  }
  async function doReset(e) {
    e.preventDefault();
    try { await api.post(`/users/${reset._id}/reset-password`, { newPassword: pw }); toast.success('Password reset'); setReset(null); setPw(''); } catch (err) { toast.error(errMsg(err)); }
  }
  async function createHr(e) {
    e.preventDefault();
    try {
      await api.post('/employees', { ...hr, role: 'hr', employeeId: `HR-${Date.now().toString().slice(-6)}`, jobTitle: 'HR Manager', joiningDate: new Date().toISOString().slice(0, 10), basicSalary: 0 });
      toast.success('HR login created'); setHrOpen(false); setHr({ name: '', email: '', tempPassword: '' }); load();
    } catch (err) { toast.error(errMsg(err)); }
  }
  return (
    <>
      <PageHeader title="User Management" subtitle="Create HR logins, deactivate or reset any login">
        <select className="input w-36" value={role} onChange={(e) => setRole(e.target.value)}><option value="">All roles</option><option value="admin">Admin</option><option value="hr">HR</option><option value="employee">Employee</option></select>
        <button className="btn-primary" onClick={() => setHrOpen(true)}><UserPlus size={16} /> Create HR login</button>
      </PageHeader>
      <div className="card p-0">{loading ? <Loading /> : !users.length ? <Empty /> : (
        <div className="table-container"><table className="hcm-table"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th /></tr></thead>
          <tbody>{users.map((u) => (<tr key={u._id}><td className="text-white">{u.name}</td><td>{u.email}</td><td><span className="badge-purple">{u.role}</span></td>
            <td><span className={u.isActive ? 'badge-success' : 'badge-neutral'}>{u.isActive ? 'active' : 'inactive'}</span></td>
            <td className="space-x-1 whitespace-nowrap"><button className="btn-ghost btn-sm" onClick={() => setReset(u)}><KeyRound size={13} /> Reset</button>
              <button className="btn-secondary btn-sm" onClick={() => toggle(u)}>{u.isActive ? 'Deactivate' : 'Activate'}</button></td></tr>))}</tbody></table></div>)}</div>
      {reset && <Modal title={`Reset password · ${reset.email}`} onClose={() => setReset(null)}><form onSubmit={doReset} className="space-y-4">
        <Field label="Temporary password (min 8)"><input required minLength={8} className="input" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <p className="text-xs text-slate-500">The user must change it at next sign-in.</p><button className="btn-primary w-full justify-center">Reset</button></form></Modal>}
      {hrOpen && <Modal title="Create HR login" onClose={() => setHrOpen(false)}><form onSubmit={createHr} className="space-y-4">
        <Field label="Name"><input required className="input" value={hr.name} onChange={(e) => setHr({ ...hr, name: e.target.value })} /></Field>
        <Field label="Email"><input required type="email" className="input" value={hr.email} onChange={(e) => setHr({ ...hr, email: e.target.value })} /></Field>
        <Field label="Temporary password (min 8)"><input required minLength={8} className="input" value={hr.tempPassword} onChange={(e) => setHr({ ...hr, tempPassword: e.target.value })} /></Field>
        <button className="btn-primary w-full justify-center">Create</button></form></Modal>}
    </>
  );
}
