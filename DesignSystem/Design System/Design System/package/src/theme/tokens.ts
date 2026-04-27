// ═══════════════════════════════════════════════════════════
//  HALF LENS — Design System Tokens (aligned with DS v2.0)
//  Source of truth: Design System/half-lens-ds-v3.html
// ═══════════════════════════════════════════════════════════

export const lightTheme = {
  primary: {
    main: '#2563eb',
    hover: '#1d4ed8',
    active: '#1e40af',
    light: '#dbeafe',
    dark: '#1e40af',
  },
  secondary: {
    main: '#64748b',
    hover: '#475569',
    active: '#334155',
    muted: '#94a3b8',
    light: '#e2e8f0',
  },
  status: {
    success: {
      main: '#059669',
      light: 'rgba(5,150,105,0.07)',
      dark: '#047857',
      text: '#047857',
      border: 'rgba(5,150,105,0.2)',
    },
    warning: {
      main: '#d97706',
      light: 'rgba(217,119,6,0.07)',
      dark: '#b45309',
      text: '#b45309',
      border: 'rgba(217,119,6,0.2)',
    },
    error: {
      main: '#dc2626',
      light: 'rgba(220,38,38,0.07)',
      dark: '#b91c1c',
      text: '#b91c1c',
      border: 'rgba(220,38,38,0.2)',
    },
    info: {
      main: '#0891b2',
      light: 'rgba(8,145,178,0.07)',
      dark: '#0e7490',
      text: '#0e7490',
      border: 'rgba(8,145,178,0.2)',
    },
    purple: {
      main: '#7c3aed',
      light: 'rgba(124,58,237,0.07)',
      dark: '#6d28d9',
      text: '#6d28d9',
      border: 'rgba(124,58,237,0.2)',
    },
  },
  background: {
    page: '#f4f6fb',
    card: 'rgba(255,255,255,0.9)',
    hover: '#f8faff',
    filter: '#eef1f8',
    input: '#ffffff',
    surface: '#ffffff',
    elevated: '#ffffff',
    glass: 'rgba(255,255,255,0.8)',
  },
  text: {
    primary: '#0f172a',
    secondary: '#475569',
    muted: '#94a3b8',
    disabled: '#cbd5e1',
    inverse: '#ffffff',
  },
  border: {
    default: 'rgba(0,0,0,0.1)',
    hover: 'rgba(0,0,0,0.15)',
    focus: '#2563eb',
    divider: 'rgba(0,0,0,0.06)',
    subtle: 'rgba(0,0,0,0.06)',
    strong: 'rgba(0,0,0,0.22)',
    accent: 'rgba(37,99,235,0.35)',
  },
  shadow: {
    sm: '0 1px 3px rgba(0,0,0,0.08)',
    DEFAULT: '0 1px 3px rgba(0,0,0,0.08)',
    md: '0 4px 16px rgba(0,0,0,0.1)',
    lg: '0 8px 32px rgba(0,0,0,0.12)',
    glow: '0 0 20px rgba(37,99,235,0.12), 0 0 60px rgba(37,99,235,0.05)',
    card: '0 1px 4px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.05)',
  },
  accent: {
    main: '#2563eb',
    light: '#3b82f6',
    lighter: '#1d4ed8',
    glow: 'rgba(37,99,235,0.15)',
  },
};

export const darkTheme = {
  primary: {
    main: '#2563eb',
    hover: '#3b82f6',
    active: '#1d4ed8',
    light: '#1e3a5f',
    dark: '#93c5fd',
  },
  secondary: {
    main: '#94a3b8',
    hover: '#cbd5e1',
    active: '#e2e8f0',
    muted: '#64748b',
    light: '#334155',
  },
  status: {
    success: {
      main: '#10b981',
      light: 'rgba(16,185,129,0.1)',
      dark: '#6ee7b7',
      text: '#34d399',
      border: 'rgba(16,185,129,0.25)',
    },
    warning: {
      main: '#f59e0b',
      light: 'rgba(245,158,11,0.1)',
      dark: '#fcd34d',
      text: '#fbbf24',
      border: 'rgba(245,158,11,0.25)',
    },
    error: {
      main: '#ef4444',
      light: 'rgba(239,68,68,0.1)',
      dark: '#fca5a5',
      text: '#f87171',
      border: 'rgba(239,68,68,0.25)',
    },
    info: {
      main: '#06b6d4',
      light: 'rgba(6,182,212,0.1)',
      dark: '#67e8f9',
      text: '#22d3ee',
      border: 'rgba(6,182,212,0.25)',
    },
    purple: {
      main: '#8b5cf6',
      light: 'rgba(139,92,246,0.1)',
      dark: '#c4b5fd',
      text: '#a78bfa',
      border: 'rgba(139,92,246,0.25)',
    },
  },
  background: {
    page: '#050d1e',
    card: 'rgba(255,255,255,0.03)',
    hover: 'rgba(255,255,255,0.06)',
    filter: '#0d2040',
    input: 'rgba(255,255,255,0.03)',
    surface: '#071428',
    elevated: '#0a1a35',
    glass: 'rgba(7,20,45,0.75)',
  },
  text: {
    primary: '#f0f4ff',
    secondary: 'rgba(200,215,255,0.65)',
    muted: 'rgba(150,175,230,0.4)',
    disabled: 'rgba(100,130,200,0.25)',
    inverse: '#050d1e',
  },
  border: {
    default: 'rgba(255,255,255,0.09)',
    hover: 'rgba(255,255,255,0.14)',
    focus: '#2563eb',
    divider: 'rgba(255,255,255,0.05)',
    subtle: 'rgba(255,255,255,0.05)',
    strong: 'rgba(255,255,255,0.22)',
    accent: 'rgba(37,99,235,0.4)',
  },
  shadow: {
    sm: '0 1px 3px rgba(0,0,0,0.4)',
    DEFAULT: '0 1px 3px rgba(0,0,0,0.4)',
    md: '0 4px 16px rgba(0,0,0,0.5)',
    lg: '0 8px 32px rgba(0,0,0,0.6)',
    glow: '0 0 20px rgba(37,99,235,0.2), 0 0 60px rgba(37,99,235,0.07)',
    card: '0 2px 8px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.03)',
  },
  accent: {
    main: '#2563eb',
    light: '#3b82f6',
    lighter: '#60a5fa',
    glow: 'rgba(37,99,235,0.25)',
  },
};

export type Theme = typeof lightTheme;

export const getTheme = (isDark: boolean): Theme => {
  return isDark ? darkTheme : lightTheme;
};

export const spacing = {
  xs: '0.25rem',    // 4px
  sm: '0.5rem',     // 8px
  md: '1rem',       // 16px
  lg: '1.5rem',     // 24px
  xl: '2rem',       // 32px
  '2xl': '3rem',    // 48px
  '3xl': '4rem',    // 64px
};

export const borderRadius = {
  sm: '6px',
  DEFAULT: '10px',
  md: '10px',
  lg: '14px',
  xl: '20px',
  full: '9999px',
};

export const fontSize = {
  xs: '0.75rem',    // 12px
  sm: '0.875rem',   // 14px
  base: '1rem',     // 16px
  lg: '1.125rem',   // 18px
  xl: '1.25rem',    // 20px
  '2xl': '1.5rem',  // 24px
  '3xl': '1.875rem', // 30px
};

export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

export const fontFamily = {
  main: "'Cairo', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

export const transitions = {
  fast: '0.15s cubic-bezier(0.4,0,0.2,1)',
  DEFAULT: '0.25s cubic-bezier(0.4,0,0.2,1)',
  slow: '0.3s cubic-bezier(0.4,0,0.2,1)',
};
