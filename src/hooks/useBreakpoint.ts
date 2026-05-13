import { useEffect, useState } from 'react';

export type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

// Tailwind default breakpoints (mirrored here because tailwind.config.js
// does not customize them).
const BREAKPOINTS: Record<Exclude<Breakpoint, 'xs'>, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

const widthToBreakpoint = (w: number): Breakpoint => {
  if (w >= BREAKPOINTS['2xl']) return '2xl';
  if (w >= BREAKPOINTS.xl) return 'xl';
  if (w >= BREAKPOINTS.lg) return 'lg';
  if (w >= BREAKPOINTS.md) return 'md';
  if (w >= BREAKPOINTS.sm) return 'sm';
  return 'xs';
};

// Returns the active Tailwind breakpoint name based on the current
// viewport width. Re-renders the consumer whenever the window crosses
// a breakpoint boundary. Use sparingly — most styling should stay in
// Tailwind responsive prefixes; this hook is for the rare case where
// JS logic genuinely needs to branch (e.g. choosing between two
// completely different component trees, picking a default for a state
// variable based on viewport).
//
// SSR-safe: returns 'lg' on the server / before first paint so the
// initial markup matches the desktop layout we ship to crawlers.
export const useBreakpoint = (): Breakpoint => {
  const [bp, setBp] = useState<Breakpoint>(() => {
    if (typeof window === 'undefined') return 'lg';
    return widthToBreakpoint(window.innerWidth);
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setBp(widthToBreakpoint(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return bp;
};

// Convenience helpers for the common "is at least X" checks. These
// avoid awkward string comparison on the consumer side.
const ORDER: Breakpoint[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
export const isAtLeast = (bp: Breakpoint, min: Breakpoint): boolean =>
  ORDER.indexOf(bp) >= ORDER.indexOf(min);
