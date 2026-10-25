import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import api from '../services/api.js';
import { Building2, User, Mail, Lock } from 'lucide-react';

const TABS = [['admin', 'Admin'], ['hr', 'HR'], ['employee', 'Employee']];

function AdminForm() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ companyName: '', adminName: '', email: '', password: '' });
  const [open, setOpen] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { api.get('/setup/status').then((r) => setOpen(r.data.needsSetup)).catch(() => setOpen(true)); }, []);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault(); setError(''); setLoading(true);
    try { await api.post('/setup', form); await login(form.email, form.password); navigate('/dashboard'); }
    catch (err) { setError(err.response?.data?.errors?.map((x) => x.reason).join(', ') || err.response?.data?.message || err.message || 'Sign up failed'); }
    finally { setLoading(false); }
  }
  if (open === null) return <p className="text-slate-500 text-sm">Checking…</p>;
  if (!open) return (
    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm">
      An Admin account already exists (there is only one Admin per company). Please <Link to="/login" className="underline font-semibold">sign in</Link>.
      For a test login use the Admin button on the sign-in page.
    </div>);
  const fields = [['companyName', 'Company name', Building2, 'text'], ['adminName', 'Your name', User, 'text'], ['email', 'Email', Mail, 'email'], ['password', 'Password (min 8 characters)', Lock, 'password']];
  return (
    <form onSubmit={submit} className="space-y-4">
      {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">{error}</div>}
      {fields.map(([k, label, Icon, type]) => (
        <div className="form-group" key={k}><label className="input-label">{label}</label>
          <div className="relative"><Icon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input required type={type} minLength={k === 'password' ? 8 : undefined} className="input pl-10" value={form[k]} onChange={set(k)} /></div></div>))}
      <button disabled={loading} className="btn-primary w-full justify-center py-3 text-base">{loading ? 'Creating…' : 'Create Admin account'}</button>
    </form>
  );
}

function Info({ steps }) {
  return (
    <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 text-sm text-slate-300">
      <ol className="list-decimal ml-5 space-y-1.5">{steps.map((s) => <li key={s}>{s}</li>)}</ol>
      <Link to="/login" className="btn-primary w-full justify-center mt-4">Go to Sign in</Link>
    </div>
  );
}

export default function SignupPage() {
  const [tab, setTab] = useState('admin');
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-900">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center"><span className="text-white font-bold text-sm">HCM</span></div>
          <span className="text-white font-bold text-xl">HCM Lite</span>
        </div>
        <h2 className="text-3xl font-bold text-white mb-1">Sign up</h2>
        <p className="text-slate-500 text-sm mb-5">Choose your role.</p>
        <div className="grid grid-cols-3 gap-2 mb-6">
          {TABS.map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={`${tab === k ? 'btn-primary' : 'btn-secondary'} justify-center`}>{l}</button>)}
        </div>
        {tab === 'admin' && <AdminForm />}
        {tab === 'hr' && <Info steps={['HR accounts are created by the Admin.', 'Admin signs in → User Management → Create HR login (email + temporary password).', 'You sign in with that email, then set your own password.']} />}
        {tab === 'employee' && <Info steps={['Employee accounts are created by HR when they register you.', 'HR signs in → Employees → Add Employee (email + temporary password).', 'You sign in with that email, then set your own password.']} />}
        <p className="mt-6 text-sm text-slate-500 text-center">Already have an account? <Link to="/login" className="text-teal-400 font-semibold hover:underline">Sign in</Link></p>
      </div>
    </div>
  );
}
