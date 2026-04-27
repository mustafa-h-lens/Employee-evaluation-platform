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
  { label: 'سجل النشاط', icon: <Activity className="h-5 w-5" />, path: '/audit', roles: ['admin'] },
  { label: 'مديري الإدارات', icon: <Crown className="h-5 w-5" />, path: '/ceo-directors', roles: ['ceo'] },
  { label: 'تقييم المديرين', icon: <FileText className="h-5 w-5" />, path: '/ceo-evaluations', roles: ['ceo'] },
  { label: 'المعايير الخاصة', icon: <ListChecks className="h-5 w-5" />, path: '/ceo-director-criteria', roles: ['ceo'] },
  { label: 'اعتمادية التقييمات', icon: <ClipboardList className="h-5 w-5" />, path: '/ceo-approvals', roles: ['ceo'] },
  { label: 'جميع التقييمات', icon: <FileText className="h-5 w-5" />, path: '/ceo-all-evaluations', roles: ['ceo'] },
  { label: 'التقارير', icon: <BarChart3 className="h-5 w-5" />, path: '/ceo-reports', roles: ['ceo'] },
  { label: 'تقييماتي من الموظفين', icon: <Star className="h-5 w-5" />, path: '/my-ceo-evaluations', roles: ['ceo'] },
  { label: 'الهيكل التنظيمي', icon: <Network className="h-5 w-5" />, path: '/ceo-org-structure', roles: ['ceo'] },
  { label: 'موظفو الإدارات', icon: <Users className="h-5 w-5" />, path: '/director-evaluate', roles: ['director'] },
  { label: 'المعايير الخاصة', icon: <ListChecks className="h-5 w-5" />, path: '/director-criteria', roles: ['director'] },
  { label: 'تقييماتي', icon: <FileText className="h-5 w-5" />, path: '/director-evaluations', roles: ['director'] },
  { label: 'تقييم الإدارة العليا', icon: <Star className="h-5 w-5" />, path: '/ceo-evaluate', roles: ['director'] },
  { label: 'الهيكل التنظيمي', icon: <Network className="h-5 w-5" />, path: '/director-org-structure', roles: ['director'] },
  { label: 'تقييماتي', icon: <FileText className="h-5 w-5" />, path: '/my-evaluations', roles: ['employee'] },
  { label: 'تقييم الإدارة العليا', icon: <Star className="h-5 w-5" />, path: '/ceo-evaluate', roles: ['employee'] },
  { label: 'الهيكل التنظيمي', icon: <Network className="h-5 w-5" />, path: '/employee-org-structure', roles: ['employee'] },

  { label: 'الإعدادات', icon: <Settings className="h-5 w-5" />, path: '/settings', roles: ['admin', 'employee', 'ceo', 'director'] },
];

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

const navItemStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: '10px',
  padding: '10px 12px',
  borderRadius: 'var(--radius-md)',
  cursor: 'pointer',
  transition: 'var(--transition-fast)',
  marginBottom: '2px',
  fontSize: '13px',
  fontWeight: 500,
  border: '1px solid transparent',
  textDecoration: 'none',
  width: '100%',
  textAlign: 'right',
  background: active ? 'var(--accent-glow)' : 'transparent',
  color: active ? 'var(--accent-lighter)' : 'var(--text-secondary)',
  borderColor: active ? 'var(--accent-glow-md)' : 'transparent',
});

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

  const isActive = (p: string) => currentPath.split('?')[0] === p;

  const renderNavButton = (
    label: string,
    icon: React.ReactNode,
    path: string,
  ) => (
    <button
      onClick={() => onNavigate(path)}
      style={navItemStyle(isActive(path))}
      onMouseEnter={(e) => {
        if (!isActive(path)) {
          (e.currentTarget as HTMLButtonElement).style.background = 'var(--mode-badge-bg)';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-primary)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive(path)) {
          (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
          (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
        }
      }}
    >
      <span>{label}</span>
      <span style={{ marginRight: 'auto' }}>{icon}</span>
    </button>
  );

  return (
    <div
      className="h-screen w-64 fixed right-0 top-0 flex flex-col"
      style={{
        background: 'var(--bg-sidebar)',
        borderLeft: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-card)',
      }}
    >
      <div
        className="p-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <div className="flex items-center justify-center">
          <img src="/logo-color.png" alt="Half Lens" className="h-16 w-auto" />
        </div>
        <p
          className="text-center text-sm mt-2"
          style={{ color: 'var(--text-secondary)' }}
        >
          منصة التقييم الوظيفي
        </p>
      </div>

      <nav className="p-4 flex-1 overflow-y-auto">
        <ul className="space-y-1">
          {filteredMenuItems.map((item) => {
            const showDirectorBefore = item.path === '/settings' && user && user.role === 'ceo';
            const showSupervisorBefore = item.path === '/settings' && user && (user.role === 'employee' || user.role === 'director');
            return (
              <React.Fragment key={item.path}>
                {showDirectorBefore && (
                  <>
                    <li className="pt-2 pb-1">
                      <div
                        className="mx-2"
                        style={{ borderTop: '1px solid var(--border-subtle)' }}
                      ></div>
                    </li>
                    <li>
                      {hasDirectorAccess ? (
                        <>
                          {renderNavButton('موظفو الإدارات', <Users className="h-5 w-5" />, '/director-evaluate')}
                          {renderNavButton('معايير الإدارة', <ListChecks className="h-5 w-5" />, '/director-criteria')}
                        </>
                      ) : (
                        <div
                          style={{
                            padding: '12px',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-card)',
                            border: '1px dashed var(--border-subtle)',
                          }}
                        >
                          <div className="flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
                            <span>التقييم كمدير إدارة</span>
                            <span className="mr-auto">
                              <Lock className="h-4 w-4" />
                            </span>
                          </div>
                          <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
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
                      <div
                        className="mx-2"
                        style={{ borderTop: '1px solid var(--border-subtle)' }}
                      ></div>
                    </li>
                    <li>
                      {hasSupervisorAccess ? (
                        <>
                          {renderNavButton('التقييم كمشرف', <Shield className="h-5 w-5" />, '/supervisor-evaluate')}
                          {renderNavButton('معايير المشرف', <ListChecks className="h-5 w-5" />, '/supervisor-criteria')}
                        </>
                      ) : (
                        <div
                          style={{
                            padding: '12px',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-card)',
                            border: '1px dashed var(--border-subtle)',
                          }}
                        >
                          <div className="flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
                            <span>التقييم كمشرف</span>
                            <span className="mr-auto">
                              <Lock className="h-4 w-4" />
                            </span>
                          </div>
                          <p className="text-[11px] mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                            يتم التفعيل عند تعيينك كمشرف من الموارد البشرية
                          </p>
                        </div>
                      )}
                    </li>
                  </>
                )}
                <li>
                  {renderNavButton(item.label, item.icon, item.path)}
                </li>
              </React.Fragment>
            );
          })}
        </ul>
      </nav>

      {user && (
        <div
          className="flex-shrink-0 p-4"
          style={{
            borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-overlay)',
          }}
        >
          <div className="text-right">
            <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user.full_name}</p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{user.email}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
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
