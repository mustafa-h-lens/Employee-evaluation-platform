import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

interface PageLayoutProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const PageLayout: React.FC<PageLayoutProps> = ({ children, currentPath, onNavigate }) => {
  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <Sidebar currentPath={currentPath} onNavigate={onNavigate} />
      <Header />
      <main className="mr-64 mt-16">
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  );
};
