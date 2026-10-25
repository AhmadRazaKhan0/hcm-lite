import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import { useToast } from '../hooks/useToast.jsx';
import api from '../services/api.js';
import { PageHeader, Loading, Empty, errMsg } from '../components/ui.jsx';
import { Plus, Trash2 } from 'lucide-react';

export default function DepartmentsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user.role === 'admin';
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    api.get('/departments').then((r) => setList(r.data)).catch((e) => toast.error(errMsg(e))).finally(() => setLoading(false));
  }, []); // eslint-disable-line
  useEffect(load, [load]);

  async function add(e) {
    e.preventDefault();
    try { await api.post('/departments', { name, description }); setName(''); setDescription(''); toast.success('Department added'); load(); }
    catch (err) { toast.error(errMsg(err)); }
  }
  async function remove(d) {
    if (!confirm(`Deactivate ${d.name}?`)) return;
    try { await api.delete(`/departments/${d._id}`); toast.success('Department deactivated'); load(); } catch (e) { toast.error(errMsg(e)); }
  }
  const active = list.filter((d) => d.isActive !== false);
  return (
    <>
      <PageHeader title="Departments" subtitle={isAdmin ? 'Set up the company structure' : 'View-only (Admin manages departments)'} />
      {isAdmin && <form onSubmit={add} className="card mb-6 grid md:grid-cols-[1fr_2fr_auto] gap-3 items-end">
        <div className="form-group"><label className="input-label">Name</label><input required className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Engineering" /></div>
        <div className="form-group"><label className="input-label">Description</label><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <button className="btn-primary"><Plus size={16} /> Add</button>
      </form>}
      <div className="card p-0">{loading ? <Loading /> : !active.length ? <Empty text="No departments yet — add one to register employees" /> : (
        <div className="table-container"><table className="hcm-table"><thead><tr><th>Name</th><th>Description</th><th>Active employees</th><th /></tr></thead>
          <tbody>{active.map((d) => (<tr key={d._id}><td className="font-medium text-white">{d.name}</td><td>{d.description || '—'}</td><td>{d.employeeCount}</td>
            <td>{isAdmin && <button className="btn-danger btn-sm" onClick={() => remove(d)}><Trash2 size={13} /></button>}</td></tr>))}</tbody></table></div>)}</div>
    </>
  );
}
