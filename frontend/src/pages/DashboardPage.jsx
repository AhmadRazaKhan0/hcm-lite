import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth.jsx';
import api from '../services/api.js';
import {
  Users, Clock, Calendar, DollarSign, TrendingUp, AlertCircle,
  CheckCircle, Building2, Activity, Briefcase
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';

function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="stat-card">
      <div className="flex items-start justify-between mb-4">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
          <Icon size={20} />
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-white">{value}</div>
        </div>
      </div>
      <div className="text-sm text-slate-400">{label}</div>
      {sub && <div className="text-xs text-slate-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function Skeleton({ className }) {
  return <div className={`skeleton shimmer ${className}`} />;
}

const PIE_COLORS = ['#14b8a6', '#10b981', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];

function DashboardInner() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/dashboard')
      .then(r => setData(r.data))
      .catch(err => setError(err.response?.data?.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center text-red-400">
          <AlertCircle size={48} className="mx-auto mb-3 opacity-50" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  // ── Admin Dashboard ──────────────────────────────────────────────────────────
  if (user?.role === 'admin') {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">Organization overview — {new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array(8).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard label="Total Employees" value={data?.totalEmployees ?? 0} icon={Users} color="bg-teal-500/20 text-teal-400" />
              <StatCard label="Active Today" value={data?.presentToday ?? 0} icon={CheckCircle} color="bg-emerald-500/20 text-emerald-400" />
              <StatCard label="Late Today" value={data?.lateToday ?? 0} icon={Clock} color="bg-amber-500/20 text-amber-400" />
              <StatCard label="Pending Leaves" value={data?.pendingLeaves ?? 0} icon={Calendar} color="bg-emerald-500/20 text-emerald-400" />
              <StatCard label="Departments" value={data?.departments ?? 0} icon={Building2} color="bg-cyan-500/20 text-cyan-400" />
              <StatCard label="Active Employees" value={data?.activeEmployees ?? 0} icon={Briefcase} color="bg-sky-500/20 text-sky-400" />
              <StatCard label="Payroll Count" value={data?.payrollSummary?.count ?? 0} icon={DollarSign} color="bg-green-500/20 text-green-400" sub="This month" />
              <StatCard label="Total Net Payroll" value={`PKR ${((data?.payrollSummary?.total || 0) / 1000).toFixed(0)}K`} icon={TrendingUp} color="bg-rose-500/20 text-rose-400" sub="This month" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Dept breakdown pie */}
              <div className="card">
                <h3 className="text-base font-semibold text-white mb-4">Department Distribution</h3>
                {data?.departmentBreakdown?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={data.departmentBreakdown}
                        cx="50%" cy="50%"
                        outerRadius={80}
                        dataKey="count"
                        nameKey="name"
                      >
                        {data.departmentBreakdown.map((_, i) => (
                          <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-48 text-slate-600 text-sm">No department data</div>
                )}
              </div>

              {/* Recent activity */}
              <div className="card">
                <h3 className="text-base font-semibold text-white mb-4">Recent Activity</h3>
                <div className="space-y-3">
                  {data?.recentActivity?.length > 0 ? data.recentActivity.slice(0, 8).map((log, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <div className="w-7 h-7 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-400 shrink-0">
                        <Activity size={12} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-slate-300 font-medium">{log.actorName}</span>
                        <span className="text-slate-500 mx-1">·</span>
                        <span className="text-slate-500">{log.action.replace(/_/g, ' ')}</span>
                      </div>
                      <span className="text-slate-600 text-xs shrink-0">
                        {new Date(log.createdAt).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  )) : (
                    <div className="text-slate-600 text-sm">No recent activity</div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // ── HR Dashboard ─────────────────────────────────────────────────────────────
  if (user?.role === 'hr') {
    return (
      <div className="space-y-8 animate-fade-in">
        <div>
          <h1 className="text-2xl font-bold text-white">HR Dashboard</h1>
          <p className="text-slate-500 text-sm mt-1">{new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard label="Present Today" value={data?.presentToday ?? 0} icon={CheckCircle} color="bg-emerald-500/20 text-emerald-400" />
              <StatCard label="Late Today" value={data?.lateToday ?? 0} icon={Clock} color="bg-amber-500/20 text-amber-400" />
              <StatCard label="Pending Leaves" value={data?.pendingLeaves ?? 0} icon={Calendar} color="bg-emerald-500/20 text-emerald-400" />
              <StatCard label="On Leave Today" value={data?.onLeaveToday ?? 0} icon={Users} color="bg-rose-500/20 text-rose-400" />
              <StatCard label="Pending Corrections" value={data?.pendingCorrections ?? 0} icon={AlertCircle} color="bg-orange-500/20 text-orange-400" />
              <StatCard label="Total Employees" value={data?.activeEmployees ?? 0} icon={Briefcase} color="bg-cyan-500/20 text-cyan-400" />
            </div>

            {/* Attendance trend chart */}
            <div className="card">
              <h3 className="text-base font-semibold text-white mb-4">7-Day Attendance Trend</h3>
              {data?.attendanceTrend?.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.attendanceTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }} />
                    <Bar dataKey="present" fill="#14b8a6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-48 text-slate-600 text-sm">No attendance data</div>
              )}
            </div>

            {/* Late employees */}
            {data?.lateEmployees?.length > 0 && (
              <div className="card">
                <h3 className="text-base font-semibold text-white mb-4">Late Arrivals Today</h3>
                <div className="space-y-2">
                  {data.lateEmployees.map((r, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm py-2 border-b border-slate-700/50 last:border-0">
                      <div className="w-7 h-7 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 shrink-0 text-xs font-bold">
                        {r.employee?.user?.name?.charAt(0) || '?'}
                      </div>
                      <div className="flex-1">{r.employee?.user?.name || 'Unknown'}</div>
                      <div className="text-slate-500 text-xs">
                        {r.clockIn ? new Date(r.clockIn).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </div>
                      <span className="badge-warning">Late</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  // ── Employee Dashboard ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-white">Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user?.name?.split(' ')[0]}! 👋</h1>
        <p className="text-slate-500 text-sm mt-1">{new Date().toLocaleDateString('en-PK', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : (
        <>
          {/* Today's status */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="card col-span-1 lg:col-span-2">
              <h3 className="text-sm font-semibold text-slate-400 mb-3">Today's Attendance</h3>
              {data?.todayAttendance ? (
                <div className="flex items-center gap-4">
                  <div className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                    data.todayAttendance.status === 'present' ? 'bg-emerald-500/20 text-emerald-400' :
                    data.todayAttendance.status === 'late' ? 'bg-amber-500/20 text-amber-400' :
                    'bg-slate-700 text-slate-400'
                  }`}>
                    {data.todayAttendance.status?.replace('-', ' ').toUpperCase() || 'ABSENT'}
                  </div>
                  {data.todayAttendance.clockIn && (
                    <span className="text-slate-400 text-sm">
                      In: {new Date(data.todayAttendance.clockIn).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {data.todayAttendance.clockOut && (
                    <span className="text-slate-400 text-sm">
                      Out: {new Date(data.todayAttendance.clockOut).toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {data.todayAttendance.workedHours > 0 && (
                    <span className="text-slate-500 text-sm">{data.todayAttendance.workedHours.toFixed(1)}h worked</span>
                  )}
                </div>
              ) : (
                <div className="text-slate-500 text-sm">Not clocked in yet today. Go to <a href="/attendance" className="text-teal-400 underline">Attendance</a> to clock in.</div>
              )}
            </div>

            {/* Leave balance quick view */}
            <div className="card">
              <h3 className="text-sm font-semibold text-slate-400 mb-3">Leave Balance</h3>
              {data?.leaveBalance ? (
                <div className="space-y-2 text-sm">
                  {['annual', 'sick', 'casual'].map(type => {
                    const b = data.leaveBalance[type];
                    const remaining = b ? b.total - b.used : 0;
                    return (
                      <div key={type} className="flex justify-between">
                        <span className="text-slate-500 capitalize">{type}</span>
                        <span className="text-white font-semibold">{remaining} <span className="text-slate-600 font-normal">/ {b?.total ?? 0}</span></span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-slate-600 text-sm">No balance data</div>
              )}
            </div>
          </div>

          {/* Recent leave requests */}
          {data?.recentLeaves?.length > 0 && (
            <div className="card">
              <h3 className="text-base font-semibold text-white mb-4">Recent Leave Requests</h3>
              <div className="space-y-2">
                {data.recentLeaves.map(req => (
                  <div key={req._id} className="flex items-center gap-3 text-sm py-2 border-b border-slate-700/50 last:border-0">
                    <div className="flex-1">
                      <span className="text-slate-300 capitalize">{req.leaveType}</span>
                      <span className="text-slate-500 mx-2">·</span>
                      <span className="text-slate-500">{req.days} day{req.days !== 1 ? 's' : ''}</span>
                    </div>
                    <span className={`badge ${
                      req.status === 'approved' ? 'badge-success' :
                      req.status === 'rejected' ? 'badge-danger' :
                      req.status === 'cancelled' ? 'badge-neutral' :
                      'badge-warning'
                    }`}>{req.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent payslips */}
          {data?.myPayslips?.length > 0 && (
            <div className="card">
              <h3 className="text-base font-semibold text-white mb-4">Recent Payslips</h3>
              <div className="space-y-2">
                {data.myPayslips.map(p => (
                  <div key={p._id} className="flex items-center gap-3 text-sm py-2 border-b border-slate-700/50 last:border-0">
                    <div className="flex-1">
                      <span className="text-slate-300">{new Date(Date.UTC(p.year, p.month - 1, 1)).toLocaleDateString('en-PK', { month: 'long', year: 'numeric' })}</span>
                    </div>
                    <span className="text-white font-semibold">PKR {p.netSalary?.toLocaleString()}</span>
                    <span className="badge-success">Paid</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function InsightsPanel() {
  const [bullets, setBullets] = useState(null);
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try { const { data } = await api.get('/ai/summary'); setBullets(data.bullets); }
    catch { setBullets(['Summary unavailable right now.']); } finally { setBusy(false); }
  }
  return (
    <div className="card mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-white">Insights</h3>
        <button className="btn-secondary btn-sm" disabled={busy} onClick={run}>{busy ? 'Summarizing…' : 'Summarize'}</button>
      </div>
      {bullets ? <><ul className="list-disc ml-5 space-y-1 text-sm text-slate-300">{bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
        <p className="text-[10px] text-slate-500 mt-3">Auto-generated from current records.</p></>
        : <p className="text-sm text-slate-500">Click Summarize for key points from today's real data.</p>}
    </div>
  );
}

function AnnouncementsStrip() {
  const [list, setList] = useState([]);
  useEffect(() => { api.get('/announcements').then((r) => setList(r.data.slice(0, 3))).catch(() => {}); }, []);
  if (!list.length) return null;
  return (
    <div className="card mt-6">
      <h3 className="font-semibold text-white mb-3">Announcements</h3>
      {list.map((a) => <div key={a._id} className="py-2 border-t border-slate-700 first:border-0"><div className="text-sm font-medium text-slate-200">{a.title}</div><div className="text-xs text-slate-400 line-clamp-2">{a.content}</div></div>)}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  return (
    <>
      <DashboardInner />
      {user?.role !== 'employee' && <InsightsPanel />}
      <AnnouncementsStrip />
    </>
  );
}
