import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCog,
  Calendar,
  ClipboardList,
  BarChart3,
  Activity,
  Settings,
  FileText,
  Target,
  LogOut,
  ListChecks,
  Crown,
  Landmark,
  Shield,
  Lock
} from 'lucide-react';

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  roles: string[];
}

const menuItems: MenuItem[] = [
  { label: 'الرئيسية', icon: <LayoutDashboard className="h-5 w-5" />, path: '/', roles: ['admin', 'manager', 'employee', 'ceo', 'director'] },
  { label: 'الأقسام', icon: <Building2 className="h-5 w-5" />, path: '/departments', roles: ['admin'] },
  { label: 'الموظفون', icon: <Users className="h-5 w-5" />, path: '/employees', roles: ['admin'] },
  { label: 'مدراء الأقسام', icon: <UserCog className="h-5 w-5" />, path: '/managers', roles: ['admin'] },
  { label: 'الإدارات', icon: <Landmark className="h-5 w-5" />, path: '/directorates', roles: ['admin'] },
  { label: 'مديري الإدارات', icon: <Crown className="h-5 w-5" />, path: '/directors', roles: ['admin'] },
  { label: 'فترات التقييم', icon: <Calendar className="h-5 w-5" />, path: '/periods', roles: ['admin'] },
  { label: 'إدارة المعايير', icon: <ClipboardList className="h-5 w-5" />, path: '/criteria', roles: ['admin'] },
  { label: 'جميع التقييمات', icon: <FileText className="h-5 w-5" />, path: '/all-evaluations', roles: ['admin'] },
  { label: 'التقارير', icon: <BarChart3 className="h-5 w-5" />, path: '/reports', roles: ['admin'] },
  { label: 'تعيين مشرف', icon: <Shield className="h-5 w-5" />, path: '/supervisor-assignments', roles: ['admin'] },
  { label: 'سجل النشاط', icon: <Activity className="h-5 w-5" />, path: '/audit', roles: ['admin'] },
  { label: 'مديري الإدارات', icon: <Crown className="h-5 w-5" />, path: '/ceo-directors', roles: ['ceo'] },
  { label: 'تقييم المديرين', icon: <FileText className="h-5 w-5" />, path: '/ceo-evaluations', roles: ['ceo'] },
  { label: 'المعايير الخاصة', icon: <ListChecks className="h-5 w-5" />, path: '/ceo-director-criteria', roles: ['ceo'] },
  { label: 'اعتمادية التقييمات', icon: <ClipboardList className="h-5 w-5" />, path: '/ceo-approvals', roles: ['ceo'] },
  { label: 'جميع التقييمات', icon: <FileText className="h-5 w-5" />, path: '/ceo-all-evaluations', roles: ['ceo'] },
  { label: 'التقارير', icon: <BarChart3 className="h-5 w-5" />, path: '/ceo-reports', roles: ['ceo'] },
  { label: 'مدراء الأقسام', icon: <Users className="h-5 w-5" />, path: '/director-managers', roles: ['director'] },
  { label: 'التقييمات', icon: <FileText className="h-5 w-5" />, path: '/director-evaluate', roles: ['director'] },
  { label: 'المعايير الخاصة', icon: <ListChecks className="h-5 w-5" />, path: '/director-criteria', roles: ['director'] },
  { label: 'تقييماتي', icon: <FileText className="h-5 w-5" />, path: '/director-evaluations', roles: ['director'] },
  { label: 'موظفو القسم', icon: <Users className="h-5 w-5" />, path: '/my-employees', roles: ['manager'] },
  { label: 'المعايير الخاصة', icon: <ListChecks className="h-5 w-5" />, path: '/department-criteria', roles: ['manager'] },
  { label: 'التقييمات', icon: <FileText className="h-5 w-5" />, path: '/evaluations', roles: ['manager'] },
  { label: 'تقييماتي', icon: <FileText className="h-5 w-5" />, path: '/manager-my-evaluations', roles: ['manager'] },
  { label: 'تقييماتي', icon: <FileText className="h-5 w-5" />, path: '/my-evaluations', roles: ['employee'] },

  { label: 'الإعدادات', icon: <Settings className="h-5 w-5" />, path: '/settings', roles: ['admin', 'manager', 'employee', 'ceo', 'director'] },
];

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate }) => {
  const { user, logout } = useAuth();
  const [hasSupervisorAccess, setHasSupervisorAccess] = useState(false);

  useEffect(() => {
    if (user && (user.role === 'employee' || user.role === 'manager')) {
      const checkAccess = async () => {
        const today = new Date().toISOString().split('T')[0];
        const { data } = await supabase
          .from('supervisor_assignments')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .lte('start_date', today)
          .gte('end_date', today)
          .limit(1);
        setHasSupervisorAccess(!!data && data.length > 0);
      };
      checkAccess();
    }
  }, [user]);

  const filteredMenuItems = menuItems.filter(item =>
    user && item.roles.includes(user.role)
  );

  return (
    <div className="h-screen w-64 bg-white border-l border-gray-200 fixed right-0 top-0 overflow-y-auto">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-center">
          <img src="/logo-color.png" alt="Half Lens" className="h-16 w-auto" />
        </div>
        <p className="text-center text-sm text-gray-600 mt-2">منصة التقييم الوظيفي</p>
      </div>

      <nav className="p-4">
        <ul className="space-y-1">
          {filteredMenuItems.map((item) => {
            // Insert supervisor item before settings for employee/manager
            const showSupervisorBefore = item.path === '/settings' && user && (user.role === 'employee' || user.role === 'manager');
            return (
              <React.Fragment key={item.path}>
                {showSupervisorBefore && (
                  <li>
                    <button
                      onClick={() => hasSupervisorAccess && onNavigate('/supervisor-evaluate')}
                      disabled={!hasSupervisorAccess}
                      title={!hasSupervisorAccess ? 'سيتم تفعيل هذا القسم عند تعيينك كمشرف من قبل الموارد البشرية' : ''}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-right transition-colors ${
                        !hasSupervisorAccess
                          ? 'text-gray-400 cursor-not-allowed opacity-60'
                          : currentPath.split('?')[0] === '/supervisor-evaluate'
                            ? 'bg-blue-50 text-blue-600 font-medium'
                            : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      <span>التقييم كمشرف</span>
                      <span className="mr-auto">
                        {hasSupervisorAccess
                          ? <Shield className="h-5 w-5" />
                          : <Lock className="h-5 w-5" />
                        }
                      </span>
                    </button>
                    {!hasSupervisorAccess && (
                      <p className="text-xs text-gray-400 px-4 mt-0.5 mb-1">
                        يتم التفعيل من الموارد البشرية
                      </p>
                    )}
                  </li>
                )}
                <li>
                  <button
                    onClick={() => onNavigate(item.path)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-right transition-colors ${
                      currentPath.split('?')[0] === item.path
                        ? 'bg-blue-50 text-blue-600 font-medium'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className="mr-auto">{item.icon}</span>
                  </button>
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      </nav>

      {user && (
        <div className="absolute bottom-0 right-0 left-0 p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
            <p className="text-xs text-gray-600">{user.email}</p>
            <p className="text-xs text-gray-500 mt-1">
              {user.role === 'admin' ? 'مدير النظام' : user.role === 'ceo' ? 'الإدارة العليا' : user.role === 'director' ? 'مدير إدارة' : user.role === 'manager' ? 'مدير قسم' : 'موظف'}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 mt-3"
          >
            <LogOut className="h-4 w-4" />
            <span>تسجيل الخروج</span>
          </Button>
        </div>
      )}
    </div>
  );
};
