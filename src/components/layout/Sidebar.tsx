import React, { useEffect, useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Button } from '../ui/Button';
import {
  LayoutDashboard,

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
  Lock,
  Network,
  Star
} from 'lucide-react';

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  roles: string[];
}

const menuItems: MenuItem[] = [
  { label: 'الرئيسية', icon: <LayoutDashboard className="h-5 w-5" />, path: '/', roles: ['admin', 'employee', 'ceo', 'director'] },

  { label: 'الموظفون', icon: <Users className="h-5 w-5" />, path: '/employees', roles: ['admin'] },
  { label: 'الإدارات', icon: <Landmark className="h-5 w-5" />, path: '/directorates', roles: ['admin'] },
  { label: 'فترات التقييم', icon: <Calendar className="h-5 w-5" />, path: '/periods', roles: ['admin'] },
  { label: 'إدارة المعايير', icon: <ClipboardList className="h-5 w-5" />, path: '/criteria', roles: ['admin'] },
  { label: 'جميع التقييمات', icon: <FileText className="h-5 w-5" />, path: '/all-evaluations', roles: ['admin'] },
  { label: 'التقارير', icon: <BarChart3 className="h-5 w-5" />, path: '/reports', roles: ['admin'] },
  { label: 'تعيين مشرف', icon: <Shield className="h-5 w-5" />, path: '/supervisor-assignments', roles: ['admin'] },
  { label: 'الهيكل التنظيمي', icon: <Network className="h-5 w-5" />, path: '/org-structure', roles: ['admin'] },
  { label: 'فترات تقييم الرؤساء', icon: <Calendar className="h-5 w-5" />, path: '/ceo-eval-periods', roles: ['admin'] },
  { label: 'تقييمات الرؤساء', icon: <Star className="h-5 w-5" />, path: '/all-ceo-evaluations', roles: ['admin'] },
  { label: 'سجل النشاط', icon: <Activity className="h-5 w-5" />, path: '/audit', roles: ['admin'] },
  { label: 'مديري الإدارات', icon: <Crown className="h-5 w-5" />, path: '/ceo-directors', roles: ['ceo'] },
  { label: 'تقييم المديرين', icon: <FileText className="h-5 w-5" />, path: '/ceo-evaluations', roles: ['ceo'] },
  { label: 'المعايير الخاصة', icon: <ListChecks className="h-5 w-5" />, path: '/ceo-director-criteria', roles: ['ceo'] },
  { label: 'اعتمادية التقييمات', icon: <ClipboardList className="h-5 w-5" />, path: '/ceo-approvals', roles: ['ceo'] },
  { label: 'جميع التقييمات', icon: <FileText className="h-5 w-5" />, path: '/ceo-all-evaluations', roles: ['ceo'] },
  { label: 'التقارير', icon: <BarChart3 className="h-5 w-5" />, path: '/ceo-reports', roles: ['ceo'] },
  { label: 'تقييماتي من الموظفين', icon: <Star className="h-5 w-5" />, path: '/my-ceo-evaluations', roles: ['ceo'] },
  { label: 'الهيكل التنظيمي', icon: <Network className="h-5 w-5" />, path: '/ceo-org-structure', roles: ['ceo'] },
  { label: 'الموظفون', icon: <Users className="h-5 w-5" />, path: '/director-employees', roles: ['director'] },
  { label: 'التقييمات', icon: <FileText className="h-5 w-5" />, path: '/director-evaluate', roles: ['director'] },
  { label: 'المعايير الخاصة', icon: <ListChecks className="h-5 w-5" />, path: '/director-criteria', roles: ['director'] },
  { label: 'تقييماتي', icon: <FileText className="h-5 w-5" />, path: '/director-evaluations', roles: ['director'] },
  { label: 'تقييم الرؤساء', icon: <Star className="h-5 w-5" />, path: '/ceo-evaluate', roles: ['director'] },
  { label: 'الهيكل التنظيمي', icon: <Network className="h-5 w-5" />, path: '/director-org-structure', roles: ['director'] },
  { label: 'تقييماتي', icon: <FileText className="h-5 w-5" />, path: '/my-evaluations', roles: ['employee'] },
  { label: 'تقييم الرؤساء', icon: <Star className="h-5 w-5" />, path: '/ceo-evaluate', roles: ['employee'] },
  { label: 'الهيكل التنظيمي', icon: <Network className="h-5 w-5" />, path: '/employee-org-structure', roles: ['employee'] },

  { label: 'الإعدادات', icon: <Settings className="h-5 w-5" />, path: '/settings', roles: ['admin', 'employee', 'ceo', 'director'] },
];

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate }) => {
  const { user, logout } = useAuth();
  const [hasSupervisorAccess, setHasSupervisorAccess] = useState(false);
  const [hasDirectorAccess, setHasDirectorAccess] = useState(false);

  useEffect(() => {
    if (user && (user.role === 'employee' || user.role === 'director')) {
      const checkAccess = async () => {
        const { data } = await supabase
          .from('supervisor_assignments')
          .select('id')
          .eq('user_id', user.id)
          .eq('status', 'active')
          .limit(1);
        setHasSupervisorAccess(!!data && data.length > 0);
      };
      checkAccess();
    }
    // Check if CEO user is assigned as director/co-director
    if (user && user.role === 'ceo') {
      const checkDirectorAccess = async () => {
        const { data } = await supabase
          .from('directorates')
          .select('id')
          .or(`director_id.eq.${user.id},secondary_director_id.eq.${user.id}`)
          .limit(1);
        setHasDirectorAccess(!!data && data.length > 0);
      };
      checkDirectorAccess();
    }
  }, [user]);

  const filteredMenuItems = menuItems.filter(item =>
    user && item.roles.includes(user.role)
  );

  return (
    <div className="h-screen w-64 bg-white border-l border-gray-200 fixed right-0 top-0 flex flex-col">
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex items-center justify-center">
          <img src="/logo-color.png" alt="Half Lens" className="h-16 w-auto" />
        </div>
        <p className="text-center text-sm text-gray-600 mt-2">منصة التقييم الوظيفي</p>
      </div>

      <nav className="p-4 flex-1 overflow-y-auto">
        <ul className="space-y-1">
          {filteredMenuItems.map((item) => {
            // Insert director section before settings for CEO users assigned as directors
            const showDirectorBefore = item.path === '/settings' && user && user.role === 'ceo';
            // Insert supervisor item before settings for employee and director
            const showSupervisorBefore = item.path === '/settings' && user && (user.role === 'employee' || user.role === 'director');
            return (
              <React.Fragment key={item.path}>
                {showDirectorBefore && (
                  <>
                    <li className="pt-2 pb-1">
                      <div className="border-t border-gray-200 mx-2"></div>
                    </li>
                    <li>
                      {hasDirectorAccess ? (
                        <>
                          <button
                            onClick={() => onNavigate('/director-employees')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-right transition-colors ${
                              currentPath.split('?')[0] === '/director-employees'
                                ? 'bg-blue-50 text-blue-600 font-medium'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <span>موظفو الإدارة</span>
                            <span className="mr-auto">
                              <Users className="h-5 w-5" />
                            </span>
                          </button>
                          <button
                            onClick={() => onNavigate('/director-evaluate')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-right transition-colors ${
                              currentPath.split('?')[0] === '/director-evaluate'
                                ? 'bg-blue-50 text-blue-600 font-medium'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <span>تقييم الموظفين</span>
                            <span className="mr-auto">
                              <FileText className="h-5 w-5" />
                            </span>
                          </button>
                          <button
                            onClick={() => onNavigate('/director-criteria')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-right transition-colors ${
                              currentPath.split('?')[0] === '/director-criteria'
                                ? 'bg-blue-50 text-blue-600 font-medium'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <span>معايير الإدارة</span>
                            <span className="mr-auto">
                              <ListChecks className="h-5 w-5" />
                            </span>
                          </button>
                        </>
                      ) : (
                        <div className="px-4 py-3 rounded-lg bg-gray-50/50">
                          <div className="flex items-center gap-3 text-gray-400">
                            <span>التقييم كمدير إدارة</span>
                            <span className="mr-auto">
                              <Lock className="h-4 w-4" />
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                            يتم التفعيل عند تعيينك كمدير إدارة من الموارد البشرية
                          </p>
                        </div>
                      )}
                    </li>
                  </>
                )}
                {showSupervisorBefore && (
                  <>
                    <li className="pt-2 pb-1">
                      <div className="border-t border-gray-200 mx-2"></div>
                    </li>
                    <li>
                      {hasSupervisorAccess ? (
                        <>
                          <button
                            onClick={() => onNavigate('/supervisor-evaluate')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-right transition-colors ${
                              currentPath.split('?')[0] === '/supervisor-evaluate'
                                ? 'bg-blue-50 text-blue-600 font-medium'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <span>التقييم كمشرف</span>
                            <span className="mr-auto">
                              <Shield className="h-5 w-5" />
                            </span>
                          </button>
                          <button
                            onClick={() => onNavigate('/supervisor-criteria')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-right transition-colors ${
                              currentPath.split('?')[0] === '/supervisor-criteria'
                                ? 'bg-blue-50 text-blue-600 font-medium'
                                : 'text-gray-700 hover:bg-gray-50'
                            }`}
                          >
                            <span>معايير المشرف</span>
                            <span className="mr-auto">
                              <ListChecks className="h-5 w-5" />
                            </span>
                          </button>
                        </>
                      ) : (
                        <div className="px-4 py-3 rounded-lg bg-gray-50/50">
                          <div className="flex items-center gap-3 text-gray-400">
                            <span>التقييم كمشرف</span>
                            <span className="mr-auto">
                              <Lock className="h-4 w-4" />
                            </span>
                          </div>
                          <p className="text-[11px] text-gray-400 mt-1 leading-relaxed">
                            يتم التفعيل عند تعيينك كمشرف من الموارد البشرية
                          </p>
                        </div>
                      )}
                    </li>
                  </>
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
        <div className="flex-shrink-0 p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
            <p className="text-xs text-gray-600">{user.email}</p>
            <p className="text-xs text-gray-500 mt-1">
              {user.role === 'admin' ? 'مدير النظام' : user.role === 'ceo' ? 'الإدارة العليا' : user.role === 'director' ? 'مدير إدارة' : 'موظف'}
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
