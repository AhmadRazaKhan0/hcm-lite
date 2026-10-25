import { useEffect, useState, useCallback } from 'react';
import api from '../services/api.js';
import { useToast } from '../hooks/useToast.jsx';
import { Plus, Search, Filter, Edit, X, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';

const STATUS_BADGE = {
  active: 'badge-success',
  inactive: 'badge-neutral',
  terminated: 'badge-danger',
  on_leave: 'badge-warning',
};

const DEPT_OPTIONS_CACHE = { departments: [], loaded: false };

function EmployeeModal({ employee, departments, onClose, onSaved }) {
  const toast = useToast();
  const isEdit = !!employee;
  const [form, setForm] = useState({
    name: employee?.userInfo?.name || '',
    email: employee?.userInfo?.email || '',
    employeeId: employee?.employeeId || '',
    jobTitle: employee?.jobTitle || '',
    phone: employee?.phone || '',
    department: employee?.departmentInfo?._id || '',
    basicSalary: employee?.basicSalary || '',
    role: employee?.userInfo?.role || 'employee',
    joiningDate: employee?.joiningDate ? employee.joiningDate.slice(0, 10) : new Date().toISOString().slice(0, 10),
    employmentStatus: employee?.employmentStatus || 'active',
    address: employee?.address || '',
    tempPassword: '',
  });
  const [saving, setSaving] = useState(false);

  function update(k, v) { setForm(p => ({ ...p, [k]: v })); }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (isEdit) {
        await api.put(`/employees/${employee._id}`, form);
        toast.success('Employee updated');
      } else {
        await api.post('/employees', { ...form, tempPassword: form.tempPassword || 'Welcome@123' });
        toast.success('Employee created');
      }
      onSaved();
    } catch (err) {
      const errors = err.response?.data?.errors?.map(e => e.reason).join(', ');
      toast.error(errors || err.response?.data?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">{isEdit ? 'Edit Employee' : 'Add Employee'}</h2>
          <button className="btn-ghost btn-sm" onClick={onClose}><X size={16} /></button>
        </div>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="form-group col-span-2">
              <label className="input-label">Full Name *</label>
              <input className="input" value={form.name} onChange={e => update('name', e.target.value)} required disabled={isEdit} />
            </div>
            <div className="form-group col-span-2">
              <label className="input-label">Email *</label>
              <input type="email" className="input" value={form.email} onChange={e => update('email', e.target.value)} required disabled={isEdit} />
            </div>
            <div className="form-group">
              <label className="input-label">Employee ID *</label>
              <input className="input" value={form.employeeId} onChange={e => update('employeeId', e.target.value)} required disabled={isEdit} />
            </div>
            <div className="form-group">
              <label className="input-label">Role</label>
              <select className="input" value={form.role} onChange={e => update('role', e.target.value)} disabled={isEdit}>
                <option value="employee">Employee</option>
                <option value="hr">HR</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="form-group">
              <label className="input-label">Job Title</label>
              <input className="input" value={form.jobTitle} onChange={e => update('jobTitle', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="input-label">Department</label>
              <select className="input" value={form.department} onChange={e => update('department', e.target.value)}>
                <option value="">— None —</option>
                {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="input-label">Phone</label>
              <input className="input" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+92 300 0000000" />
            </div>
            <div className="form-group">
              <label className="input-label">Basic Salary (PKR)</label>
              <input type="number" className="input" value={form.basicSalary} onChange={e => update('basicSalary', e.target.value)} min="0" />
            </div>
            <div className="form-group">
              <label className="input-label">Joining Date</label>
              <input type="date" className="input" value={form.joiningDate} onChange={e => update('joiningDate', e.target.value)} />
            </div>
            {isEdit && (
              <div className="form-group">
                <label className="input-label">Status</label>
                <select className="input" value={form.employmentStatus} onChange={e => update('employmentStatus', e.target.value)}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="on_leave">On Leave</option>
                  <option value="terminated">Terminated</option>
                </select>
              </div>
            )}
            {!isEdit && (
              <div className="form-group col-span-2">
                <label className="input-label">Temporary Password</label>
                <input type="password" className="input" value={form.tempPassword} onChange={e => update('tempPassword', e.target.value)} placeholder="Default: Welcome@123" />
              </div>
            )}
            <div className="form-group col-span-2">
              <label className="input-label">Address</label>
              <input className="input" value={form.address} onChange={e => update('address', e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" className="btn-secondary flex-1" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={saving}>
              {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const toast = useToast();
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editEmployee, setEditEmployee] = useState(null);
  const LIMIT = 15;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: LIMIT };
      if (search) params.search = search;
      if (statusFilter) params.status = statusFilter;
      if (deptFilter) params.department = deptFilter;
      const { data } = await api.get('/employees', { params });
      setEmployees(data.employees);
      setTotal(data.total);
    } catch (err) {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, deptFilter]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    api.get('/departments').then(r => setDepartments(r.data)).catch(() => {});
  }, []);

  // Reset to page 1 on filter change
  useEffect(() => { setPage(1); }, [search, statusFilter, deptFilter]);

  function openAdd() { setEditEmployee(null); setShowModal(true); }
  function openEdit(emp) { setEditEmployee(emp); setShowModal(true); }
  function closeModal() { setShowModal(false); setEditEmployee(null); }
  function onSaved() { closeModal(); load(); }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Employees</h1>
          <p className="text-slate-500 text-sm mt-0.5">{total} total employees</p>
        </div>
        <button id="add-employee-btn" className="btn-primary" onClick={openAdd}>
          <Plus size={16} /> Add Employee
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            id="employee-search"
            className="input pl-9"
            placeholder="Search by name, email, or ID..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select id="status-filter" className="input w-40" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="terminated">Terminated</option>
          <option value="on_leave">On Leave</option>
        </select>
        <select id="dept-filter" className="input w-44" value={deptFilter} onChange={e => setDeptFilter(e.target.value)}>
          <option value="">All Departments</option>
          {departments.map(d => <option key={d._id} value={d._id}>{d.name}</option>)}
        </select>
        <button className="btn-ghost" onClick={load}><RefreshCw size={15} /></button>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="hcm-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>ID</th>
              <th>Department</th>
              <th>Job Title</th>
              <th>Joining Date</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array(6).fill(0).map((_, i) => (
                <tr key={i}>
                  {Array(7).fill(0).map((__, j) => (
                    <td key={j}><div className="skeleton h-4 rounded w-24" /></td>
                  ))}
                </tr>
              ))
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center text-slate-500 py-12">
                  No employees found. {search && 'Try a different search.'} <button className="text-teal-400 underline ml-1" onClick={openAdd}>Add one?</button>
                </td>
              </tr>
            ) : (
              employees.map(emp => (
                <tr key={emp._id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                        {emp.userInfo?.name?.charAt(0) || '?'}
                      </div>
                      <div>
                        <div className="text-white font-medium">{emp.userInfo?.name}</div>
                        <div className="text-slate-500 text-xs">{emp.userInfo?.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="font-mono text-slate-400 text-xs">{emp.employeeId}</td>
                  <td>{emp.departmentInfo?.name || <span className="text-slate-600">—</span>}</td>
                  <td>{emp.jobTitle || <span className="text-slate-600">—</span>}</td>
                  <td className="text-slate-400 text-xs">
                    {emp.joiningDate ? new Date(emp.joiningDate).toLocaleDateString('en-PK') : '—'}
                  </td>
                  <td>
                    <span className={STATUS_BADGE[emp.employmentStatus] || 'badge-neutral'}>
                      {emp.employmentStatus?.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <button className="btn-ghost btn-sm" onClick={() => openEdit(emp)}>
                      <Edit size={13} /> Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > LIMIT && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Showing {Math.min((page - 1) * LIMIT + 1, total)}–{Math.min(page * LIMIT, total)} of {total}</span>
          <div className="flex gap-2">
            <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft size={14} /> Prev
            </button>
            <button className="btn-ghost btn-sm" disabled={page * LIMIT >= total} onClick={() => setPage(p => p + 1)}>
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {showModal && (
        <EmployeeModal
          employee={editEmployee}
          departments={departments}
          onClose={closeModal}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}
