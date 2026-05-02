import React from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../contexts/ThemeContext';

type Phase = 'leaving' | 'waiting' | 'exiting' | 'idle';

// Brand-reveal overlay shown between page navigations. The logo
// appears in the center, breathes in a loop while the new page is
// loading, and only dissolves once the page reports ready. Three
// CSS phases drive the choreography:
//   .nav-overlay-leaving  enter animation, no loop
//   .nav-overlay-waiting  logo breathes / shimmer bar shimmers in loop
//   .nav-overlay-exiting  exit animation, fades + logo lifts away
//
// `forceDark` pins the overlay to the dark palette regardless of the
// current theme — used for the landing↔login transition so the
// brand intro always reads on a deep navy backdrop with the white
// logo, matching the marketing pages.
export const NavTransitionOverlay: React.FC<{ phase: Phase; forceDark?: boolean }> = ({ phase, forceDark = false }) => {
  const { theme } = useTheme();
  if (phase === 'idle') return null;
  const useDark = forceDark || theme === 'dark';
  const logo = useDark ? '/logo-white.png' : '/logo-color.png';
  return createPortal(
    <div
      className={`nav-transition-overlay nav-overlay-${phase} ${forceDark ? 'nav-overlay-force-dark' : ''}`}
      aria-hidden="true"
    >
      <div className="nav-transition-veil" />
      <div className="nav-transition-stage">
        <img className="nav-transition-logo" src={logo} alt="" draggable={false} />
        <div className="nav-transition-progress">
          <span className="nav-transition-progress-bar" />
        </div>
      </div>
    </div>,
    document.body,
  );
};
