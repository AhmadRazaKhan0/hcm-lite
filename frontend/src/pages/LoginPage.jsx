import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { Eye, EyeOff, Lock, Mail, Sparkles } from 'lucide-react';
import api from '../services/api.js';

const QUICK = [
  { role: 'admin', label: 'Admin', email: 'admin@hcm.local', password: 'Admin@12345' },
  { role: 'hr', label: 'HR', email: 'hr@hcm.local', password: 'Hr@12345' },
  { role: 'employee', label: 'Employee', email: 'employee@hcm.local', password: 'Employee@12345' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [needsSetup, setNeedsSetup] = useState(false);

  useEffect(() => {
    api.get('/setup/status').then(r => {
      if (r.data.needsSetup) setNeedsSetup(true);
    }).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Login failed';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* Left hero panel */}
      <div className="hidden lg:flex w-[52%] flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0f172a 0%, #042f2e 50%, #0f172a 100%)' }}>
        {/* Decorative circles */}
        <div className="absolute top-[-100px] right-[-100px] w-[400px] h-[400px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #14b8a6, transparent)' }} />
        <div className="absolute bottom-[-150px] left-[-100px] w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #10b981, transparent)' }} />

        <div className="relative">
          <div className="flex items-center gap-3 mb-16">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">HCM</span>
            </div>
            <span className="text-white font-bold text-xl">HCM Lite</span>
          </div>

          <div className="space-y-2 mb-6">
            <div className="flex items-center gap-2 text-teal-400 text-sm font-semibold uppercase tracking-widest">
              <Sparkles size={14} />
              <span>Saylani Hackathon Edition</span>
            </div>
            <h1 className="text-5xl font-bold text-white leading-tight">
              People first.<br />
              <span className="gradient-text">Work simplified.</span>
            </h1>
          </div>

          <p className="text-slate-400 text-lg leading-relaxed max-w-md">
            A smarter HR platform built for growing teams. Manage attendance, payroll, leaves, and more — all in one place.
          </p>

          <div className="mt-10 space-y-4">
            {[
              ['🔐', 'Secure Role-Based Access', 'Admin, HR, and Employee roles'],
              ['📊', 'Real-time Dashboards', 'Live data from your organization'],
              ['🤖', 'AI HR Assistant', 'Natural language queries in Urdu & English'],
              ['📋', 'Complete HR Workflows', 'Attendance, Leave, Payroll in one system'],
            ].map(([icon, title, desc]) => (
              <div key={title} className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl glass flex items-center justify-center text-lg shrink-0">
                  {icon}
                </div>
                <div>
                  <div className="text-white font-semibold text-sm">{title}</div>
                  <div className="text-slate-500 text-xs">{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="text-slate-600 text-xs">
          © 2026 HCM Lite · Built for Saylani Welfare Hackathon
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-900">
        <div className="w-full max-w-md animate-fade-in">
          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">HCM</span>
            </div>
            <span className="text-white font-bold text-xl">HCM Lite</span>
          </div>

          {needsSetup && (
            <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
              No workspace found. <Link to="/signup" className="underline font-semibold">Sign up →</Link>
            </div>
          )}

          <div className="text-teal-400 text-xs font-semibold uppercase tracking-widest mb-2">Welcome back</div>
          <h2 className="text-3xl font-bold text-white mb-1">Sign in to HCM Lite</h2>
          <p className="text-slate-500 text-sm mb-8">Enter your credentials to access your HR workspace.</p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="form-group">
              <label className="input-label">Email address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="email"
                  type="email"
                  className="input pl-10"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="input-label">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  id="password"
                  type={showPwd ? 'text' : 'password'}
                  className="input pl-10 pr-10"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
                  onClick={() => setShowPwd(!showPwd)}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              id="login-btn"
              type="submit"
              className="btn-primary w-full justify-center py-3 text-base"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                  </svg>
                  Signing in...
                </span>
              ) : 'Sign In →'}
            </button>
          </form>

          <div className="mt-8">
            <div className="text-xs uppercase tracking-widest text-slate-500 mb-3 text-center">Quick sign-in (test accounts)</div>
            <div className="grid grid-cols-3 gap-2">
              {QUICK.map((q) => (
                <button key={q.role} type="button" className="btn-secondary justify-center" onClick={() => { setEmail(q.email); setPassword(q.password); setError(''); }}>
                  {q.label}
                </button>))}
            </div>
            <p className="text-[11px] text-slate-600 mt-2 text-center">Click a role to fill its email and password, then press Sign In.</p>
          </div>
          <p className="mt-6 text-sm text-slate-500 text-center">
            New company? <Link to="/signup" className="text-teal-400 font-semibold hover:underline">Sign up</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
