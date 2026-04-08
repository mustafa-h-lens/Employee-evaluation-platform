import React, { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './pages/Login';
import { PageLayout } from './components/layout/PageLayout';

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
import { DirectorEmployees } from './pages/director/DirectorEmployees';
import { DirectorEvaluateEmployee } from './pages/director/DirectorEvaluateEmployee';
import { DirectorSpecificCriteria } from './pages/director/DirectorCriteria';

import { EmployeeDashboard } from './pages/employee/Dashboard';
import { MyEvaluations } from './pages/employee/MyEvaluations';

import { SupervisorEvaluateForm } from './pages/supervisor/SupervisorEvaluateForm';
import { SupervisorCriteria } from './pages/supervisor/SupervisorCriteria';

import { ChangePassword } from './pages/shared/ChangePassword';
import { OrgStructure } from './pages/shared/OrgStructure';

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
        // Director routes for CEO users assigned as department directors
        case '/director-employees':
          return <DirectorEmployees onNavigate={setCurrentPath} />;
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
        case '/director-employees':
          return <DirectorEmployees onNavigate={setCurrentPath} />;
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
