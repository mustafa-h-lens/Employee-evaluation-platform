import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  LayoutDashboard,
  Building2,
  Users,
  UserCog,
  UserPlus,
  Calendar,
  ClipboardList,
  BarChart3,
  Activity,
  Settings,
  FileText,
  Target
} from 'lucide-react';

interface MenuItem {
  label: string;
  icon: React.ReactNode;
  path: string;
  roles: string[];
}

const menuItems: MenuItem[] = [
  { label: 'الرئيسية', icon: <LayoutDashboard className="h-5 w-5" />, path: '/', roles: ['admin', 'manager', 'employee'] },
  { label: 'الأقسام', icon: <Building2 className="h-5 w-5" />, path: '/departments', roles: ['admin'] },
  { label: 'الموظفون', icon: <Users className="h-5 w-5" />, path: '/employees', roles: ['admin'] },
  { label: 'تسجيل المستخدمين', icon: <UserPlus className="h-5 w-5" />, path: '/register-user', roles: ['admin'] },
  { label: 'مدراء الأقسام', icon: <UserCog className="h-5 w-5" />, path: '/managers', roles: ['admin'] },
  { label: 'فترات التقييم', icon: <Calendar className="h-5 w-5" />, path: '/periods', roles: ['admin'] },
  { label: 'معايير التقييم', icon: <ClipboardList className="h-5 w-5" />, path: '/criteria', roles: ['admin'] },
  { label: 'التقارير', icon: <BarChart3 className="h-5 w-5" />, path: '/reports', roles: ['admin'] },
  { label: 'سجل النشاط', icon: <Activity className="h-5 w-5" />, path: '/audit', roles: ['admin'] },
  { label: 'موظفو القسم', icon: <Users className="h-5 w-5" />, path: '/my-employees', roles: ['manager'] },
  { label: 'التقييمات', icon: <FileText className="h-5 w-5" />, path: '/evaluations', roles: ['manager'] },
  { label: 'خطط التطوير', icon: <Target className="h-5 w-5" />, path: '/development-plans', roles: ['manager'] },
  { label: 'تقييماتي', icon: <FileText className="h-5 w-5" />, path: '/my-evaluations', roles: ['employee'] },
  { label: 'ملاحظاتي', icon: <ClipboardList className="h-5 w-5" />, path: '/my-notes', roles: ['employee'] },
  { label: 'خطة التطوير', icon: <Target className="h-5 w-5" />, path: '/my-development', roles: ['employee'] },
  { label: 'الإعدادات', icon: <Settings className="h-5 w-5" />, path: '/settings', roles: ['admin', 'manager', 'employee'] },
];

interface SidebarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPath, onNavigate }) => {
  const { user } = useAuth();

  const filteredMenuItems = menuItems.filter(item =>
    user && item.roles.includes(user.role)
  );

  return (
    <div className="h-screen w-64 bg-white border-l border-gray-200 fixed right-0 top-0 overflow-y-auto">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-center mb-2">
          <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-xl">HL</span>
          </div>
        </div>
        <h1 className="text-center text-lg font-bold text-gray-900">HALF LENS</h1>
        <p className="text-center text-sm text-gray-600 mt-1">منصة التقييم الوظيفي</p>
      </div>

      <nav className="p-4">
        <ul className="space-y-1">
          {filteredMenuItems.map((item) => (
            <li key={item.path}>
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
          ))}
        </ul>
      </nav>

      {user && (
        <div className="absolute bottom-0 right-0 left-0 p-4 border-t border-gray-200 bg-gray-50">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{user.full_name}</p>
            <p className="text-xs text-gray-600">{user.email}</p>
            <p className="text-xs text-gray-500 mt-1">
              {user.role === 'admin' ? 'مدير النظام' : user.role === 'manager' ? 'مدير قسم' : 'موظف'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
