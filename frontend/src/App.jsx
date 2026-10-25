import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { ToastProvider } from './hooks/useToast.jsx';
import AppLayout from './layouts/AppLayout.jsx';
import LoginPage from './pages/LoginPage.jsx';
import SignupPage from './pages/SignupPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import EmployeesPage from './pages/EmployeesPage.jsx';
import AttendancePage from './pages/AttendancePage.jsx';
import LeavePage from './pages/LeavePage.jsx';
import PayrollPage from './pages/PayrollPage.jsx';
import DepartmentsPage from './pages/DepartmentsPage.jsx';
import AnnouncementsPage from './pages/AnnouncementsPage.jsx';
import AuditPage from './pages/AuditPage.jsx';
import AIAssistantPage from './pages/AIAssistantPage.jsx';
import UsersPage from './pages/UsersPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';

// Protected route wrapper
function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

// Redirect logged-in users away from auth pages
function GuestRoute({ children }) {
  const { user } = useAuth();
  if (user) return <Navigate to="/dashboard" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Auth routes */}
      <Route path="/login" element={<GuestRoute><LoginPage /></GuestRoute>} />
      <Route path="/signup" element={<GuestRoute><SignupPage /></GuestRoute>} />
      <Route path="/setup" element={<Navigate to="/signup" replace />} />

      {/* App routes inside layout */}
      <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="employees" element={
          <ProtectedRoute allowedRoles={['admin', 'hr']}><EmployeesPage /></ProtectedRoute>
        } />
        <Route path="attendance" element={<AttendancePage />} />
        <Route path="leave" element={<LeavePage />} />
        <Route path="payroll" element={<PayrollPage />} />
        <Route path="departments" element={
          <ProtectedRoute allowedRoles={['admin', 'hr']}><DepartmentsPage /></ProtectedRoute>
        } />
        <Route path="announcements" element={<AnnouncementsPage />} />
        <Route path="audit" element={
          <ProtectedRoute allowedRoles={['admin']}><AuditPage /></ProtectedRoute>
        } />
        <Route path="ai-assistant" element={<AIAssistantPage />} />
        <Route path="users" element={
          <ProtectedRoute allowedRoles={['admin']}><UsersPage /></ProtectedRoute>
        } />
        <Route path="profile" element={<ProfilePage />} />
      </Route>

      {/* Catch-all */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
