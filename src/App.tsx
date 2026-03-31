import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { PageLayout } from './components/layout/PageLayout';

import { AdminDashboard } from './pages/admin/Dashboard';
import { Departments } from './pages/admin/Departments';
import { Employees } from './pages/admin/Employees';
import { RegisterUser } from './pages/admin/RegisterUser';
import { Reports } from './pages/admin/Reports';
import { Managers } from './pages/admin/Managers';
import { EvaluationPeriods } from './pages/admin/EvaluationPeriods';
import { EvaluationCriteria } from './pages/admin/EvaluationCriteria';
import { AuditLog } from './pages/admin/AuditLog';

import { ManagerDashboard } from './pages/manager/Dashboard';
import { EvaluationForm } from './pages/manager/EvaluationForm';
import { MyEmployees } from './pages/manager/MyEmployees';

import { EmployeeDashboard } from './pages/employee/Dashboard';
import { MyEvaluations } from './pages/employee/MyEvaluations';
import { MyNotes } from './pages/employee/MyNotes';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPath, setCurrentPath] = useState('/');

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
    return <Login />;
  }

  const renderPage = () => {
    if (user.role === 'admin') {
      switch (currentPath) {
        case '/':
          return <AdminDashboard />;
        case '/departments':
          return <Departments />;
        case '/employees':
          return <Employees />;
        case '/register-user':
          return <RegisterUser />;
        case '/reports':
          return <Reports />;
        case '/managers':
          return <Managers />;
        case '/periods':
          return <EvaluationPeriods />;
        case '/criteria':
          return <EvaluationCriteria />;
        case '/audit':
          return <AuditLog />;
        case '/settings':
          return <ComingSoonPage />;
        default:
          return <AdminDashboard />;
      }
    }

    if (user.role === 'manager') {
      const basePath = currentPath.split('?')[0];
      const params = new URLSearchParams(currentPath.split('?')[1] || '');

      switch (basePath) {
        case '/':
          return <ManagerDashboard />;
        case '/my-employees':
          return <MyEmployees onNavigate={setCurrentPath} />;
        case '/evaluations':
          return <EvaluationForm employeeId={params.get('employee') || undefined} />;
        case '/development-plans':
          return <DevelopmentPlansPage />;
        case '/settings':
          return <ComingSoonPage />;
        default:
          return <ManagerDashboard />;
      }
    }

    if (user.role === 'employee') {
      switch (currentPath) {
        case '/':
          return <EmployeeDashboard />;
        case '/my-evaluations':
          return <MyEvaluations />;
        case '/my-notes':
          return <MyNotes />;
        case '/my-development':
          return <MyDevelopmentPage />;
        case '/settings':
          return <ComingSoonPage />;
        default:
          return <EmployeeDashboard />;
      }
    }

    return <div>صفحة غير موجودة</div>;
  };

  return (
    <PageLayout currentPath={currentPath} onNavigate={setCurrentPath}>
      {renderPage()}
    </PageLayout>
  );
}

const ComingSoonPage: React.FC = () => (
  <div className="flex items-center justify-center min-h-[60vh]">
    <div className="text-center">
      <p className="text-2xl font-semibold text-gray-400">قريبًا...</p>
    </div>
  </div>
);

const DevelopmentPlansPage: React.FC = () => (
  <div className="space-y-6">
    <h1 className="text-3xl font-bold text-gray-900">خطط التطوير</h1>
    <p className="text-gray-600">قريبًا...</p>
  </div>
);


const MyDevelopmentPage: React.FC = () => (
  <div className="space-y-6">
    <h1 className="text-3xl font-bold text-gray-900">خطة التطوير</h1>
    <p className="text-gray-600">قريبًا...</p>
  </div>
);

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
