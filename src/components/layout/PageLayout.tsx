import React, { useCallback, useEffect, useState } from 'react';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useTheme } from '../../contexts/ThemeContext';

interface PageLayoutProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
}

// PageLayout wraps every authenticated page with its global chrome.
//
// Desktop (≥ lg, 1024px): a permanent 256px sidebar on the right with
// the main content offset by `lg:mr-64`. Behaviour matches the prior
// design exactly — nothing changes at this width.
//
// Mobile / tablet (< lg): the sidebar becomes a slide-out drawer that
// translates in from the right. A slim top bar sits across the top of
// the viewport with the hamburger button + Half Lens logo. The main
// content fills the viewport (no margin offset). Backdrop dismisses the
// drawer; ESC closes it; body-scroll-lock prevents background scroll
// while the drawer is open; nav clicks auto-close the drawer.
export const PageLayout: React.FC<PageLayoutProps> = ({ children, currentPath, onNavigate }) => {
  const { theme } = useTheme();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Wrap onNavigate so any nav-item tap inside the drawer also closes
  // the drawer. Desktop is unaffected — closing a drawer that was never
  // open is a no-op.
  const handleNavigate = useCallback((path: string) => {
    onNavigate(path);
    closeDrawer();
  }, [onNavigate, closeDrawer]);

  // ESC closes the drawer. Lives at the page level so the Sidebar
  // component stays purely presentational.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen, closeDrawer]);

  // Body-scroll-lock while the drawer is open (mirrors the Modal
  // pattern). Restored on close or unmount.
  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [drawerOpen]);

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }} dir="rtl">
      {/* Mobile top bar — visible below lg only. Provides the hamburger
          entry point now that the persistent sidebar is hidden. */}
      <div
        className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 flex items-center justify-between px-4 border-b"
        style={{
          background: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="فتح القائمة"
          className="-mr-2 p-2 rounded-lg transition-colors hover:bg-ds-overlay"
          style={{ color: 'var(--text-primary)' }}
        >
          <Menu className="h-5 w-5" />
        </button>
        <img
          src={theme === 'dark' ? '/logo-white.png' : '/logo-color.png'}
          alt="Half Lens"
          className="h-8 w-auto"
          draggable={false}
        />
      </div>

      {/* Drawer backdrop — only when open, only below lg. */}
      {drawerOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40"
          style={{
            background: 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(4px)',
          }}
          onClick={closeDrawer}
          aria-hidden="true"
        />
      )}

      <Sidebar
        currentPath={currentPath}
        onNavigate={handleNavigate}
        isOpen={drawerOpen}
      />

      <main className="mr-0 lg:mr-64 pt-14 lg:pt-0">
        <div className="p-4 lg:p-6">
          {children}
        </div>
      </main>
    </div>
  );
};
