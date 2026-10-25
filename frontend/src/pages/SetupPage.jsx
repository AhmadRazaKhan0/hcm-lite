import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api.js';
import { Building2, User, Mail, Lock, ArrowRight } from 'lucide-react';

export default function SetupPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ companyName: '', adminName: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function update(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/setup', form);
      alert('Workspace created! You can now log in.');
      navigate('/login');
    } catch (err) {
      const errors = err.response?.data?.errors?.map(e => e.reason).join(', ');
      setError(errors || err.response?.data?.message || 'Setup failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
            <span className="text-white font-bold text-sm">HCM</span>
          </div>
          <span className="text-white font-bold text-xl">HCM Lite</span>
        </div>

        <div className="text-teal-400 text-xs font-semibold uppercase tracking-widest mb-2">First-time setup</div>
        <h2 className="text-3xl font-bold text-white mb-1">Create your workspace</h2>
        <p className="text-slate-500 text-sm mb-8">Set up your company and administrator account to get started.</p>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="form-group">
            <label className="input-label">Company Name</label>
            <div className="relative">
              <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="company-name"
                type="text"
                className="input pl-10"
                value={form.companyName}
                onChange={e => update('companyName', e.target.value)}
                placeholder="Your company name"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="input-label">Administrator Name</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="admin-name"
                type="text"
                className="input pl-10"
                value={form.adminName}
                onChange={e => update('adminName', e.target.value)}
                placeholder="Your full name"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="input-label">Admin Email</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="admin-email"
                type="email"
                className="input pl-10"
                value={form.email}
                onChange={e => update('email', e.target.value)}
                placeholder="admin@company.com"
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="input-label">Password (min 8 characters)</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                id="admin-password"
                type="password"
                className="input pl-10"
                value={form.password}
                onChange={e => update('password', e.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
            </div>
          </div>

          <button
            id="setup-btn"
            type="submit"
            className="btn-primary w-full justify-center py-3 text-base mt-2"
            disabled={loading}
          >
            {loading ? 'Creating workspace...' : (
              <span className="flex items-center gap-2">Create workspace <ArrowRight size={16} /></span>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-500">
          Already have a workspace? <a href="/login" className="text-teal-400 hover:underline">Sign in →</a>
        </div>
      </div>
    </div>
  );
}
