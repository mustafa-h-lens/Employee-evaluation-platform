import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Bell, LogOut } from 'lucide-react';
import { Button } from '../ui/Button';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header
      className="h-16 fixed top-0 left-0 right-64 z-10"
      style={{
        background: 'var(--bg-surface)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <div className="h-full px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={logout}
            className="flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span>تسجيل الخروج</span>
          </Button>
        </div>

        <div className="flex items-center gap-4">
          <button
            className="relative p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <Bell className="h-5 w-5" />
            <span
              className="absolute top-1 right-1 w-2 h-2 rounded-full"
              style={{ background: 'var(--danger)' }}
            ></span>
          </button>

          {user && (
            <div className="text-right">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{user.full_name}</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {user.role === 'admin' ? 'مدير النظام' : 'موظف'}
              </p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
