import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.jsx';
import { useState, useEffect } from 'react';
import api from '../services/api.js';
import { ChangePasswordForm } from '../pages/ProfilePage.jsx';
import { Modal } from '../components/ui.jsx';
import {
  LayoutDashboard, Users, Clock, Calendar, DollarSign,
  Building2, Megaphone, Shield, Bot, UserCog, User,
  LogOut, Menu, X, ChevronRight, Bell
} from 'lucide-react';

// Navigation items by role
const NAV_ITEMS = {
  admin: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/employees', icon: Users, label: 'Employees' },
    { to: '/attendance', icon: Clock, label: 'Attendance' },
    { to: '/leave', icon: Calendar, label: 'Leave' },
    { to: '/payroll', icon: DollarSign, label: 'Payroll' },
    { to: '/departments', icon: Building2, label: 'Departments' },
    { to: '/announcements', icon: Megaphone, label: 'Announcements' },
    { to: '/users', icon: UserCog, label: 'User Management' },
    { to: '/audit', icon: Shield, label: 'Audit Log' },
    { to: '/ai-assistant', icon: Bot, label: 'AI Assistant' },
  ],
  hr: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/employees', icon: Users, label: 'Employees' },
    { to: '/attendance', icon: Clock, label: 'Attendance' },
    { to: '/leave', icon: Calendar, label: 'Leave' },
    { to: '/payroll', icon: DollarSign, label: 'Payroll' },
    { to: '/departments', icon: Building2, label: 'Departments' },
    { to: '/announcements', icon: Megaphone, label: 'Announcements' },
    { to: '/ai-assistant', icon: Bot, label: 'AI Assistant' },
  ],
  employee: [
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/attendance', icon: Clock, label: 'My Attendance' },
    { to: '/leave', icon: Calendar, label: 'Leave' },
    { to: '/payroll', icon: DollarSign, label: 'My Payslips' },
    { to: '/announcements', icon: Megaphone, label: 'Announcements' },
    { to: '/ai-assistant', icon: Bot, label: 'AI Assistant' },
  ],
};

const ROLE_COLORS = {
  admin: 'bg-amber-500/20 text-amber-300',
  hr: 'bg-cyan-500/20 text-cyan-300',
  employee: 'bg-emerald-500/20 text-emerald-300',
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notes, setNotes] = useState({ items: [], unread: 0 });
  const [bell, setBell] = useState(false);

  useEffect(() => {
    if (user?.mustChangePassword) return;
    const load = () => api.get('/notifications').then((r) => setNotes(r.data)).catch(() => {});
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [user?.mustChangePassword]);

  async function openBell() {
    setBell((b) => !b);
    if (!bell && notes.unread) { await api.post('/notifications/read-all').catch(() => {}); setNotes((n) => ({ ...n, unread: 0 })); }
  }

  const navItems = NAV_ITEMS[user?.role] || NAV_ITEMS.employee;
  const initials = user?.name?.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`sidebar transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0`}>
        {/* Brand */}
        <div className="flex items-center gap-3 px-5 py-6 border-b border-teal-500/10">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center">
            <span className="text-white font-bold text-xs">HCM</span>
          </div>
          <div>
            <div className="font-bold text-white text-sm">HCM Lite</div>
            <div className="text-[10px] text-teal-400">Human Capital Management</div>
          </div>
          <button
            className="ml-auto lg:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-slate-600 px-3 mb-2">
            Main Menu
          </div>
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <Icon size={16} />
              <span className="flex-1">{label}</span>
              <ChevronRight size={12} className="opacity-0 group-hover:opacity-100" />
            </NavLink>
          ))}
        </nav>

        {/* User section */}
        <div className="p-3 border-t border-white/5">
          <NavLink
            to="/profile"
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} mb-1`}
            onClick={() => setSidebarOpen(false)}
          >
            <User size={16} />
            <span>My Profile</span>
          </NavLink>
          <button
            className="nav-item w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
            onClick={handleLogout}
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>

          {/* User info */}
          <div className="flex items-center gap-3 mt-3 px-3 py-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-300 truncate">{user?.name}</div>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ROLE_COLORS[user?.role] || 'bg-slate-500/20 text-slate-400'}`}>
                {user?.role?.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
        {/* Top bar */}
        <header className="h-16 flex items-center gap-4 px-6 border-b border-slate-700/50 bg-slate-900/50 backdrop-blur-sm shrink-0">
          <button
            className="lg:hidden text-slate-400 hover:text-white"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>

          <div className="flex-1" />

          <div className="relative">
            <button className="relative text-slate-400 hover:text-white" onClick={openBell} aria-label="Notifications">
              <Bell size={20} />
              {notes.unread > 0 && <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">{notes.unread}</span>}
            </button>
            {bell && (
              <div className="absolute right-0 mt-3 w-80 max-w-[85vw] card p-0 z-50 shadow-2xl max-h-96 overflow-y-auto">
                {!notes.items.length ? <div className="p-4 text-sm text-slate-500">No notifications</div> : notes.items.map((n) => (
                  <div key={n._id} className="px-4 py-3 border-b border-slate-700 last:border-0">
                    <div className="text-sm font-medium text-slate-200">{n.title}</div>
                    <div className="text-xs text-slate-400">{n.message}</div>
                    <div className="text-[10px] text-slate-600 mt-1">{new Date(n.createdAt).toLocaleString()}</div>
                  </div>))}
              </div>)}
          </div>

          {/* User badge in topbar */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold text-slate-200">{user?.name}</div>
              <div className="text-xs text-slate-500">{user?.email}</div>
            </div>
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white text-sm font-bold">
              {initials}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
      {user?.mustChangePassword && (
        <Modal title="Set a new password" onClose={() => {}}>
          <p className="text-sm text-slate-400 mb-4">You signed in with a temporary password. Please choose a new one to continue.</p>
          <ChangePasswordForm forced />
          <button className="btn-ghost w-full justify-center mt-3" onClick={handleLogout}>Sign out</button>
        </Modal>
      )}
    </div>
  );
}
