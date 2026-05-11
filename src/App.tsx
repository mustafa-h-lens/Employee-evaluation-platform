import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './contexts/ToastContext';
import { ThemeProvider, NavRevealProvider } from './contexts/ThemeContext';
import { ThemeTransitionOverlay } from './components/layout/ThemeTransitionOverlay';
import { NavTransitionOverlay } from './components/layout/NavTransitionOverlay';
import { WelcomeChip } from './components/layout/WelcomeChip';
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
import { EmployeeLeaves } from './pages/admin/EmployeeLeaves';

import { CeoDashboard } from './pages/ceo/Dashboard';
import { CeoDirectors } from './pages/ceo/Directors';
import { DirectorEvaluationForm } from './pages/ceo/DirectorEvaluationForm';
import { CeoReports } from './pages/ceo/Reports';
import { PendingApprovals } from './pages/ceo/PendingApprovals';


import { DirectorDashboard } from './pages/director/Dashboard';
import { DirectorMyEvaluations } from './pages/director/MyEvaluations';
import { DirectorEvaluateEmployee } from './pages/director/DirectorEvaluateEmployee';

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
      style={{
        borderColor: 'var(--border-accent)',
        background: 'var(--bg-overlay)',
      }}
    >
      <div className="px-5 py-4 flex items-center gap-4">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md"
          style={{
            background: 'var(--accent-glow)',
            color: 'var(--accent)',
            border: '1px solid var(--border-accent)',
          }}
        >
          <Shield className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0 text-right">
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>تنبيه أمان</p>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            كلمة المرور الحالية قصيرة وضعيفة، ننصح بتغييرها من صفحة{' '}
            <button
              onClick={() => { onGoSettings(); close(); }}
              className="inline-flex items-center gap-1 font-bold transition-colors"
              style={{ color: 'var(--accent)' }}
            >
              <Settings className="h-3.5 w-3.5" />
              الإعدادات
            </button>
          </p>
        </div>
        <button
          onClick={close}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all flex-shrink-0"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-card-hover)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
          }}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {/* Progress / timer bar */}
      <div className="h-1 w-full" style={{ background: 'var(--accent-glow-md)' }}>
        <div
          className="h-full rounded-full transition-none"
          style={{
            width: `${progress}%`,
            background: 'var(--accent)',
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

  // Brand-reveal navigation:
  //   leaving  → outgoing page fades out, overlay enters (300ms)
  //   waiting  → logo breathes in a loop while the new page loads;
  //              overlay polls the page DOM for `.page-loading-placeholder`
  //              and dismisses as soon as it's gone (page is ready)
  //   exiting  → logo dissolves, page fades in (450ms)
  //   idle     → overlay unmounted
  type NavPhase = 'idle' | 'leaving' | 'waiting' | 'exiting';
  const [navPhase, setNavPhase] = useState<NavPhase>('idle');
  // Pin the brand-reveal overlay to its dark palette for the duration
  // of one nav cycle. Used by the sidebar logo "back to landing" flow
  // so the entire transition stays on the marketing backdrop, even
  // while the user is still authenticated during the leaving phase.
  const [forceDarkReveal, setForceDarkReveal] = useState(false);
  const pendingNavRef = useRef<string | null>(null);

  const navigate = useCallback((path: string) => {
    if (path === currentPath || pendingNavRef.current) return;
    const reduced = !!window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      setCurrentPath(path);
      return;
    }
    pendingNavRef.current = path;
    setNavPhase('leaving');
    window.setTimeout(() => {
      setCurrentPath(path);
      setNavPhase('waiting');
    }, 300);
  }, [currentPath]);

  // Wrap an async action (login, logout) in the brand-reveal overlay.
  // Sequence:
  //   1. play 'leaving' (300ms) so overlay slides over the current screen
  //   2. run the action — auth state updates underneath the overlay
  //   3. switch to 'waiting' so the polling effect dismisses once the new
  //      screen reports ready (no placeholder)
  const runWithNavReveal = useCallback(async (
    action: () => Promise<unknown> | void,
    opts?: { forceDark?: boolean; targetPath?: string },
  ) => {
    const reduced = !!window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || pendingNavRef.current || navPhase !== 'idle') {
      if (opts?.targetPath) setCurrentPath(opts.targetPath);
      await action();
      return;
    }
    pendingNavRef.current = '__auth__';
    if (opts?.forceDark) setForceDarkReveal(true);
    setNavPhase('leaving');
    await new Promise(resolve => window.setTimeout(resolve, 300));
    try {
      await action();
      // Set targetPath AFTER the action so the authenticated branch
      // doesn't briefly re-render at the new path (e.g. '/' →
      // AdminDashboard) before auth flips. Once `action()` flips the
      // user, the unauthenticated branch mounts and only then do we
      // switch the path so it lands directly on Landing.
      if (opts?.targetPath) setCurrentPath(opts.targetPath);
    } finally {
      setNavPhase('waiting');
    }
  }, [navPhase]);

  // While in the 'waiting' phase, watch the rendered page for the
  // `.page-loading-placeholder` element. The moment the page finishes
  // loading (placeholder gone), enter the 'exiting' phase. A safety
  // timeout dismisses the overlay if the page never reports ready.
  useEffect(() => {
    if (navPhase !== 'waiting') return;
    const minVisible = 600;   // never flash — keep the reveal feel
    const maxWait = 8000;     // stop the overlay even if the page hangs
    const start = Date.now();

    const isReady = () => {
      const root = document.querySelector('.page-content');
      if (!root) return false;
      // Page is ready when it has rendered children but no placeholder.
      const hasPlaceholder = root.querySelector('.page-loading-placeholder');
      return !hasPlaceholder;
    };

    const beginExit = () => {
      const elapsed = Date.now() - start;
      const wait = Math.max(0, minVisible - elapsed);
      window.setTimeout(() => setNavPhase('exiting'), wait);
    };

    if (isReady()) {
      beginExit();
      return;
    }

    const interval = window.setInterval(() => {
      if (isReady()) {
        clearInterval(interval);
        clearTimeout(safety);
        beginExit();
      }
    }, 80);
    const safety = window.setTimeout(() => {
      clearInterval(interval);
      beginExit();
    }, maxWait);
    return () => {
      clearInterval(interval);
      clearTimeout(safety);
    };
  }, [navPhase, currentPath]);

  useEffect(() => {
    if (navPhase !== 'exiting') return;
    const t = window.setTimeout(() => {
      setNavPhase('idle');
      setForceDarkReveal(false);
      pendingNavRef.current = null;
    }, 450);
    return () => clearTimeout(t);
  }, [navPhase]);

  // Sync state → URL bar
  useEffect(() => {
    if (window.location.pathname !== currentPath) {
      window.history.pushState(null, '', currentPath);
    }
  }, [currentPath]);

  // Handle browser back/forward buttons. Route through `navigate` so
  // the brand-reveal overlay plays for back/forward jumps too —
  // including the login → landing back-button flow.
  useEffect(() => {
    const onPopState = () => {
      const target = window.location.pathname || '/';
      navigate(target);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [navigate]);

  useEffect(() => {
    if (isFirstLogin) setShowPasswordBanner(true);
  }, [isFirstLogin]);

  // Welcome greeting: when user transitions from logged-out → logged-in,
  // briefly show "أهلاً بعودتك, {first name}" floating at the top, then
  // auto-dismiss. Skip on initial app boot when user is restored from a
  // previous session — prevWasLoggedOut tracks whether the previous render
  // genuinely had no user.
  const [welcomeName, setWelcomeName] = useState<string | null>(null);
  const dismissWelcome = useCallback(() => setWelcomeName(null), []);
  const prevAuthRef = useRef<{ wasLoggedIn: boolean; bootstrapped: boolean }>({
    wasLoggedIn: false,
    bootstrapped: false,
  });
  useEffect(() => {
    if (loading) return;
    const isLoggedIn = !!user?.id;
    const prev = prevAuthRef.current;
    if (!prev.bootstrapped) {
      prevAuthRef.current = { wasLoggedIn: isLoggedIn, bootstrapped: true };
      return;
    }
    if (!prev.wasLoggedIn && isLoggedIn) {
      const first = (user?.full_name || '').trim().split(/\s+/)[0] || null;
      setWelcomeName(first);
    }
    prevAuthRef.current = { wasLoggedIn: isLoggedIn, bootstrapped: true };
  }, [user, loading]);

  if (loading) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--bg-base)' }}
      >
        <div className="text-center">
          <div
            className="w-16 h-16 rounded-full mx-auto mb-4 animate-spin"
            style={{
              border: '4px solid var(--border-soft)',
              borderTopColor: 'var(--accent)',
            }}
          ></div>
          <p style={{ color: 'var(--text-secondary)' }}>جاري التحميل...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <NavRevealProvider value={{ runWithNavReveal }}>
        <div
          key={`anon-${currentPath}`}
          className={`page-content ${navPhase === 'leaving' ? 'page-content-leaving' : ''}`}
        >
          {currentPath === '/' || currentPath === ''
            ? <Landing onLogin={() => navigate('/admin')} />
            : <Login />}
        </div>
        {/* Landing/Login navigation reveal is always shown on a dark
            backdrop with the white logo, regardless of the user's
            theme preference, so the brand intro reads consistently. */}
        <NavTransitionOverlay phase={navPhase} forceDark />
      </NavRevealProvider>
    );
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
        case '/employee-leaves':
          return <EmployeeLeaves />;
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
          return <CeoDashboard onNavigate={navigate} />;
        case '/ceo-directors':
          return <CeoDirectors onNavigate={navigate} />;
        case '/ceo-evaluations':
          return <DirectorEvaluationForm directorId={params.get('director') || undefined} />;
        case '/ceo-reports':
          return <CeoReports />;
        case '/ceo-approvals':
          return <PendingApprovals />;
        case '/ceo-all-evaluations':
          return <AllEvaluations />;
        case '/ceo-org-structure':
          return <OrgStructure />;
        case '/my-ceo-evaluations':
          return <MyCeoEvaluations />;
        // Director routes for CEO users assigned as department directors
        case '/director-evaluate':
          return <DirectorEvaluateEmployee employeeId={params.get('employee') || undefined} />;
        case '/settings':
          return <ChangePassword />;
        default:
          return <CeoDashboard onNavigate={navigate} />;
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
    <NavRevealProvider value={{ runWithNavReveal }}>
      <PageLayout currentPath={currentPath} onNavigate={navigate}>
        {showPasswordBanner && (
          <PasswordBanner
            onDismiss={dismissBanner}
            onGoSettings={() => navigate('/settings')}
          />
        )}
        <div
          key={`${user.id}-${currentPath}`}
          className={`page-content ${
            navPhase === 'leaving' ? 'page-content-leaving' : ''
          }`}
        >
          {renderPage()}
        </div>
      </PageLayout>
      <NavTransitionOverlay phase={navPhase} forceDark={forceDarkReveal} />
      <WelcomeChip name={welcomeName} onDismiss={dismissWelcome} />
    </NavRevealProvider>
  );
}


function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ToastProvider>
      <ThemeTransitionOverlay />
    </ThemeProvider>
  );
}

export default App;
