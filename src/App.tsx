import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { PageLayout } from './components/layout/PageLayout';

import { AdminDashboard } from './pages/admin/Dashboard';
import { Departments } from './pages/admin/Departments';
import { Employees } from './pages/admin/Employees';
import { Reports } from './pages/admin/Reports';
import { Managers } from './pages/admin/Managers';
import { EvaluationPeriods } from './pages/admin/EvaluationPeriods';
import { EvaluationCriteria } from './pages/admin/EvaluationCriteria';
import { AuditLog } from './pages/admin/AuditLog';
import { AdminSettings } from './pages/admin/Settings';
import { DirectorManagement } from './pages/admin/DirectorManagement';
import { Directorates } from './pages/admin/Directorates';
import { AllEvaluations } from './pages/admin/AllEvaluations';

import { CeoDashboard } from './pages/ceo/Dashboard';
import { CeoDirectors } from './pages/ceo/Directors';
import { DirectorEvaluationForm } from './pages/ceo/DirectorEvaluationForm';
import { CeoReports } from './pages/ceo/Reports';
import { PendingApprovals } from './pages/ceo/PendingApprovals';
import { DirectorCriteria } from './pages/ceo/DirectorCriteria';


import { ManagerDashboard } from './pages/manager/Dashboard';
import { EvaluationForm } from './pages/manager/EvaluationForm';
import { MyEmployees } from './pages/manager/MyEmployees';
import { DepartmentCriteria } from './pages/manager/DepartmentCriteria';
import { ManagerMyEvaluations } from './pages/manager/ManagerMyEvaluations';

import { DirectorDashboard } from './pages/director/Dashboard';
import { DirectorMyEvaluations } from './pages/director/MyEvaluations';
import { MyManagers } from './pages/director/MyManagers';
import { ManagerEvaluationForm } from './pages/director/ManagerEvaluationForm';
import { DirectorSpecificCriteria } from './pages/director/DirectorCriteria';

import { EmployeeDashboard } from './pages/employee/Dashboard';
import { MyEvaluations } from './pages/employee/MyEvaluations';

import { ChangePassword } from './pages/shared/ChangePassword';

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
        case '/directors':
          return <DirectorManagement />;
        case '/directorates':
          return <Directorates />;
        case '/all-evaluations':
          return <AllEvaluations />;
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
        case '/director-managers':
          return <MyManagers onNavigate={setCurrentPath} />;
        case '/director-evaluate':
          return <ManagerEvaluationForm managerId={params.get('manager') || undefined} />;
        case '/director-criteria':
          return <DirectorSpecificCriteria />;
        case '/director-evaluations':
          return <DirectorMyEvaluations />;
        case '/settings':
          return <ChangePassword />;
        default:
          return <DirectorDashboard />;
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
        case '/department-criteria':
          return <DepartmentCriteria />;
        case '/manager-my-evaluations':
          return <ManagerMyEvaluations />;
        case '/settings':
          return <ChangePassword />;
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
case '/settings':
          return <ChangePassword />;
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


function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
