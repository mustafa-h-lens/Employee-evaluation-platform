import React, { useState, useEffect, useRef } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { Login } from './pages/Login';
import { Landing } from './pages/Landing';
import { PageLayout } from './components/layout/PageLayout';
import { Shield, Settings, X } from 'lucide-react';

import { AdminDashboard } from './pages/admin/Dashboard';

import { Employees } from './pages/admin/Employees';
import { Reports } from './pages/admin/Reports';
import { EvaluationPeriods } from './pages/admin/EvaluationPeriods';
import { EvaluationCriteria } from './pages/admin/EvaluationCriteria';
import { AuditLog } from './pages/admin/AuditLog';
import { AdminSettings } from './pages/admin/Settings';
import { Directorates } from './pages/admin/Directorates';
import { AllEvaluations } from './pages/admin/AllEvaluations';
import { SupervisorAssignments } from './pages/admin/SupervisorAssignments';

import { CeoDashboard } from './pages/ceo/Dashboard';
import { CeoDirectors } from './pages/ceo/Directors';
import { DirectorEvaluationForm } from './pages/ceo/DirectorEvaluationForm';
import { CeoReports } from './pages/ceo/Reports';
import { PendingApprovals } from './pages/ceo/PendingApprovals';
import { DirectorCriteria } from './pages/ceo/DirectorCriteria';


import { DirectorDashboard } from './pages/director/Dashboard';
import { DirectorMyEvaluations } from './pages/director/MyEvaluations';
import { DirectorEvaluateEmployee } from './pages/director/DirectorEvaluateEmployee';
import { DirectorSpecificCriteria } from './pages/director/DirectorCriteria';

import { EmployeeDashboard } from './pages/employee/Dashboard';
import { MyEvaluations } from './pages/employee/MyEvaluations';

import { SupervisorEvaluateForm } from './pages/supervisor/SupervisorEvaluateForm';
import { SupervisorCriteria } from './pages/supervisor/SupervisorCriteria';

import { ChangePassword } from './pages/shared/ChangePassword';
import { OrgStructure } from './pages/shared/OrgStructure';
import { CeoEvaluationForm } from './pages/shared/CeoEvaluationForm';
import { MyCeoEvaluations } from './pages/ceo/MyCeoEvaluations';

const AUTO_DISMISS_MS = 10000;

function PasswordBanner({ onDismiss, onGoSettings }: { onDismiss: () => void; onGoSettings: () => void }) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [progress, setProgress] = useState(100);
  const [paused, setPaused] = useState(false);
  const startRef = useRef(Date.now());
  const remainRef = useRef(AUTO_DISMISS_MS);
  const rafRef = useRef<number>(0);

  const close = () => {
    setExiting(true);
    setTimeout(onDismiss, 400);
  };

  // Slide in
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // Progress bar tick
  useEffect(() => {
    if (paused) {
      cancelAnimationFrame(rafRef.current);
      return;
    }
    startRef.current = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const left = remainRef.current - elapsed;
      if (left <= 0) { close(); return; }
      setProgress((left / AUTO_DISMISS_MS) * 100);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [paused]);

  const handlePause = () => {
    remainRef.current = remainRef.current - (Date.now() - startRef.current);
    setPaused(true);
  };

  return (
    <div
      onMouseEnter={handlePause}
      onMouseLeave={() => setPaused(false)}
      className={`mb-5 rounded-2xl overflow-hidden shadow-lg border transition-all duration-500 ${
        exiting ? 'opacity-0 -translate-y-4' : visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
      style={{ borderColor: 'rgba(99,102,241,0.2)', background: 'linear-gradient(135deg, #eef2ff 0%, #e0e7ff 50%, #ede9fe 100%)' }}
    >
      <div className="px-5 py-4 flex items-center gap-4">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>
          <Shield className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0 text-right">
          <p className="text-sm font-bold text-gray-800">تنبيه أمان</p>
          <p className="text-sm text-gray-600 mt-0.5">
            لا تنسَ تغيير كلمة المرور الافتراضية من صفحة{' '}
            <button
              onClick={() => { onGoSettings(); close(); }}
              className="inline-flex items-center gap-1 font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              الإعدادات
            </button>
          </p>
        </div>
        <button
          onClick={close}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-white/60 hover:text-gray-600 transition-all flex-shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {/* Progress / timer bar */}
      <div className="h-1 w-full" style={{ background: 'rgba(99,102,241,0.1)' }}>
        <div
          className="h-full rounded-full transition-none"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)',
          }}
        />
      </div>
    </div>
  );
}

function AppContent() {
  const { user, loading, isFirstLogin } = useAuth();
  const [currentPath, setCurrentPath] = useState(() => {
    const path = window.location.pathname;
    return path || '/';
  });
  const [showPasswordBanner, setShowPasswordBanner] = useState(false);

  // Sync state → URL bar
  useEffect(() => {
    if (window.location.pathname !== currentPath) {
      window.history.pushState(null, '', currentPath);
    }
  }, [currentPath]);

  // Handle browser back/forward buttons
  useEffect(() => {
    const onPopState = () => {
      setCurrentPath(window.location.pathname || '/');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    if (isFirstLogin) setShowPasswordBanner(true);
  }, [isFirstLogin]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    if (currentPath === '/' || currentPath === '') {
      return <Landing onLogin={() => setCurrentPath('/admin')} />;
    }
    return <Login />;
  }

  const renderPage = () => {
    if (user.role === 'admin') {
      switch (currentPath) {
        case '/':
          return <AdminDashboard />;

        case '/employees':
          return <Employees />;
        case '/reports':
          return <Reports />;
        case '/periods':
          return <EvaluationPeriods />;
        case '/criteria':
          return <EvaluationCriteria />;
        case '/audit':
          return <AuditLog />;
        case '/directorates':
          return <Directorates />;
        case '/all-evaluations':
          return <AllEvaluations />;
        case '/supervisor-assignments':
          return <SupervisorAssignments />;
        case '/org-structure':
          return <OrgStructure />;
        case '/settings':
          return <AdminSettings />;
        default:
          return <AdminDashboard />;
      }
    }

    if (user.role === 'ceo') {
      const basePath = currentPath.split('?')[0];
      const params = new URLSearchParams(currentPath.split('?')[1] || '');

      switch (basePath) {
        case '/':
          return <CeoDashboard />;
        case '/ceo-directors':
          return <CeoDirectors onNavigate={setCurrentPath} />;
        case '/ceo-evaluations':
          return <DirectorEvaluationForm directorId={params.get('director') || undefined} />;
        case '/ceo-reports':
          return <CeoReports />;
        case '/ceo-approvals':
          return <PendingApprovals />;
        case '/ceo-all-evaluations':
          return <AllEvaluations />;
        case '/ceo-director-criteria':
          return <DirectorCriteria />;
        case '/ceo-org-structure':
          return <OrgStructure />;
        case '/my-ceo-evaluations':
          return <MyCeoEvaluations />;
        // Director routes for CEO users assigned as department directors
        case '/director-evaluate':
          return <DirectorEvaluateEmployee employeeId={params.get('employee') || undefined} />;
        case '/director-criteria':
          return <DirectorSpecificCriteria />;
        case '/settings':
          return <ChangePassword />;
        default:
          return <CeoDashboard />;
      }
    }

    if (user.role === 'director') {
      const basePath = currentPath.split('?')[0];
      const params = new URLSearchParams(currentPath.split('?')[1] || '');

      switch (basePath) {
        case '/':
          return <DirectorDashboard />;
        case '/director-evaluate':
          return <DirectorEvaluateEmployee employeeId={params.get('employee') || undefined} />;
        case '/director-criteria':
          return <DirectorSpecificCriteria />;
        case '/director-evaluations':
          return <DirectorMyEvaluations />;
        case '/supervisor-evaluate':
          return <SupervisorEvaluateForm />;
        case '/supervisor-criteria':
          return <SupervisorCriteria />;
        case '/ceo-evaluate':
          return <CeoEvaluationForm />;
        case '/director-org-structure':
          return <OrgStructure />;
        case '/settings':
          return <ChangePassword />;
        default:
          return <DirectorDashboard />;
      }
    }

    if (user.role === 'employee') {
      switch (currentPath) {
        case '/':
          return <EmployeeDashboard />;
        case '/my-evaluations':
          return <MyEvaluations />;
        case '/supervisor-evaluate':
          return <SupervisorEvaluateForm />;
        case '/supervisor-criteria':
          return <SupervisorCriteria />;
        case '/ceo-evaluate':
          return <CeoEvaluationForm />;
        case '/employee-org-structure':
          return <OrgStructure />;
        case '/settings':
          return <ChangePassword />;
        default:
          return <EmployeeDashboard />;
      }
    }

    return <div>صفحة غير موجودة</div>;
  };

  const dismissBanner = () => {
    // Hide for this session only — the banner will reappear next login while
    // the password is still the default. AuthContext.login decides whether
    // to set isFirstLogin based on the typed password, not on persistence.
    setShowPasswordBanner(false);
  };

  return (
    <PageLayout currentPath={currentPath} onNavigate={setCurrentPath}>
      {showPasswordBanner && (
        <PasswordBanner
          onDismiss={dismissBanner}
          onGoSettings={() => setCurrentPath('/settings')}
        />
      )}
      {renderPage()}
    </PageLayout>
  );
}


function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
