import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export type Theme = 'light' | 'dark';

interface ToggleOrigin {
  x: number;
  y: number;
}

interface TransitionState {
  active: boolean;
  origin: ToggleOrigin | null;
  // Direction we're heading — used to pick the celestial icon to show.
  toDark: boolean;
}

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: (origin?: ToggleOrigin) => void;
  setTheme: (t: Theme) => void;
  transition: TransitionState;
}

const STORAGE_KEY = 'hl_theme';

const readInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* swallow — fall through */ }
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

const applyTheme = (t: Theme) => {
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', t);
  }
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<Theme>(() => readInitialTheme());
  const [transition, setTransition] = useState<TransitionState>({
    active: false, origin: null, toDark: false,
  });

  useEffect(() => {
    applyTheme(theme);
    try { window.localStorage.setItem(STORAGE_KEY, theme); } catch { /* swallow */ }
  }, [theme]);

  // Track OS-level preference only while the user has not made an explicit
  // choice. Once they toggle, we stop following the system.
  useEffect(() => {
    if (!window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => {
      let stored: string | null = null;
      try { stored = window.localStorage.getItem(STORAGE_KEY); } catch { /* swallow */ }
      if (stored === 'light' || stored === 'dark') return;
      setThemeState(e.matches ? 'dark' : 'light');
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);

  // Smooth, eye-comfortable theme switch:
  //   1. If the browser supports the View Transitions API, the snapshot
  //      is captured and the entire UI crossfades in ~450ms — this is
  //      the most fluid path because the browser interpolates the pixel
  //      buffers directly.
  //   2. Otherwise we add a `theme-transition` class on <html> for
  //      ~500ms. While that class is on, every element with a color/bg/
  //      border in transition gets a 400ms ease-in-out crossfade
  //      (declared in half-lens-ds.css).
  //   3. If the user prefers reduced motion, neither path runs — flip
  //      is instant.
  // Click-time choreography of the toggle:
  //   t=0    overlay mounts; sun/moon ascends from the click origin and
  //          a circular wipe expands outward, sparkles burst.
  //   t=380  the theme actually flips (the wipe is fully across the
  //          screen at this point, so the swap is invisible to the eye).
  //   t=900  overlay unmounts; the page is fully revealed in the new
  //          theme with everything already settled.
  // Reduced-motion users get an instant flip.
  const toggleTheme = useCallback((origin?: ToggleOrigin) => {
    if (typeof document === 'undefined') {
      setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
      return;
    }
    const reducedMotion = !!window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion) {
      setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
      return;
    }

    const goingToDark = theme === 'light';
    setTransition({ active: true, origin: origin ?? null, toDark: goingToDark });

    // Choreography aligned with the celestial arc — the page colors
    // crossfade for the full duration of the sun/moon's centerpiece
    // moment, not just at the swap instant. Class is added BEFORE the
    // theme attribute changes so the transition rule is already armed
    // when the var values flip.
    //   t=0      wipe blooms; theme-transition class armed early
    //   t=480    theme attribute flips → bg-color / color / border-color
    //            on every element start a 950ms ease-out crossfade
    //   t=560    wipe at peak coverage (50%) — color morph at ~8%,
    //            invisible because wipe is opaque
    //   t=900    wipe scale 150 fading out; color morph at ~45%,
    //            beginning to peek through softened wipe edge
    //   t=1150   wipe fully dissolved; color morph at ~70%
    //   t=1430   color morph completes; transition class removed
    //   t=1450   overlay unmounts; everything has fully settled
    const html = document.documentElement;
    html.classList.add('theme-transition');

    window.setTimeout(() => {
      setThemeState(prev => (prev === 'dark' ? 'light' : 'dark'));
    }, 480);

    window.setTimeout(() => {
      html.classList.remove('theme-transition');
    }, 1480);

    window.setTimeout(() => {
      setTransition({ active: false, origin: null, toDark: false });
    }, 1450);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, transition }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
};

// ─── Nav reveal context ───────────────────────────────────────
// Lives next to ThemeContext for convenience — same scope, same
// "global UI choreography" intent. Lets any child trigger the
// brand-reveal overlay around an async action like login/logout.
interface NavRevealOptions {
  // Pin the brand-reveal overlay to its dark palette regardless of the
  // current theme — used for flows that always read on the marketing
  // backdrop (logout to landing, etc).
  forceDark?: boolean;
  // Optional path to switch to after the leaving phase completes.
  // Useful when the action also changes auth state, so the URL/route
  // is already correct by the time the new screen mounts.
  targetPath?: string;
}

interface NavRevealContextValue {
  runWithNavReveal: (
    action: () => Promise<unknown> | void,
    opts?: NavRevealOptions,
  ) => Promise<void>;
}

const NavRevealContext = React.createContext<NavRevealContextValue | undefined>(undefined);

export const NavRevealProvider: React.FC<{
  children: React.ReactNode;
  value: NavRevealContextValue;
}> = ({ children, value }) => (
  <NavRevealContext.Provider value={value}>{children}</NavRevealContext.Provider>
);

export const useNavReveal = (): NavRevealContextValue => {
  const ctx = React.useContext(NavRevealContext);
  if (!ctx) {
    // Allow components to call this safely even when not wrapped — e.g. on
    // the bare Login page before the provider mounts. Fall back to a no-op
    // that just runs the action.
    const noop: NavRevealContextValue['runWithNavReveal'] = async (action) => { await action(); };
    return { runWithNavReveal: noop };
  }
  return ctx;
};
