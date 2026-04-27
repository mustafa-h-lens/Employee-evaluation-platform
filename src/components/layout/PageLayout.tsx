import React from 'react';
import { Sidebar } from './Sidebar';

interface PageLayoutProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const PageLayout: React.FC<PageLayoutProps> = ({ children, currentPath, onNavigate }) => {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }} dir="rtl">
      <Sidebar currentPath={currentPath} onNavigate={onNavigate} />
      <main className="mr-64">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
};
