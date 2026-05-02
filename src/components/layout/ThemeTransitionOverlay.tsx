import React from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../../contexts/ThemeContext';

// A celebratory "sunrise/moonrise" overlay shown for ~900ms when the
// theme toggles. A circular wipe of the destination palette expands
// from the click origin while a centered sun (going light) or moon
// (going dark) emerges, twirls, and pulses, surrounded by twinkling
// sparkles. Pointer-events are off so the rest of the UI stays
// interactive — the show is purely visual delight.
//
// Choreography is purely CSS-driven (see `theme-transition-overlay`
// rules in half-lens-ds.css); this component just mounts/unmounts.
export const ThemeTransitionOverlay: React.FC = () => {
  const { transition } = useTheme();
  if (!transition.active) return null;

  const { origin, toDark } = transition;
  // Default to viewport center if we somehow don't have a click origin
  // (e.g. someone toggles via a future keyboard shortcut without
  // a click event).
  const ox = origin ? `${origin.x}px` : '50%';
  const oy = origin ? `${origin.y}px` : '50%';

  return createPortal(
    <div
      className={`theme-transition-overlay ${toDark ? 'going-dark' : 'going-light'}`}
      style={{ ['--ox' as string]: ox, ['--oy' as string]: oy }}
      aria-hidden="true"
    >
      {/* Single radial wipe — kept as one GPU-friendly element using
          only transform + opacity, no filters, so it stays smooth on
          mid-range hardware. */}
      <div className="tt-wipe" />

      {/* The hero icon that emerges from the click origin and arcs to
          screen center where it twirls and pulses. */}
      <div className="tt-icon-stage">
        {toDark ? (
          // Moon — clean crescent built from a full circle minus an
          // offset circle (mask), so the curve is geometrically perfect
          // instead of a hand-drawn bezier. A tiny twinkling star sits
          // beside it for atmosphere.
          <svg className="tt-icon tt-moon" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="moonGlow" cx="35%" cy="35%" r="65%">
                <stop offset="0%"   stopColor="#fefce8" />
                <stop offset="55%"  stopColor="#e0e7ff" />
                <stop offset="100%" stopColor="#a5b4fc" />
              </radialGradient>
              <mask id="moonCrescent">
                <rect width="64" height="64" fill="black" />
                <circle cx="32" cy="32" r="22" fill="white" />
                <circle cx="42" cy="26" r="20" fill="black" />
              </mask>
            </defs>
            <circle cx="32" cy="32" r="22" fill="url(#moonGlow)" mask="url(#moonCrescent)" />
            {/* Subtle craters along the lit edge for a more believable
                surface — kept low-opacity so they read as texture, not
                features. */}
            <circle cx="20" cy="38" r="2"   fill="#a5b4fc" opacity="0.45" mask="url(#moonCrescent)" />
            <circle cx="24" cy="22" r="1.4" fill="#a5b4fc" opacity="0.4"  mask="url(#moonCrescent)" />
            <circle cx="17" cy="28" r="1.1" fill="#a5b4fc" opacity="0.35" mask="url(#moonCrescent)" />
            {/* A single companion star, positioned in the dark side. */}
            <g className="tt-moon-star">
              <path d="M50 14 L51.4 18 L55.4 18.4 L52.2 21 L53.2 25 L50 22.6 L46.8 25 L47.8 21 L44.6 18.4 L48.6 18 Z" fill="#fde68a" />
            </g>
          </svg>
        ) : (
          // Sun — central disc + 12 rays that radiate outward.
          <svg className="tt-icon tt-sun" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%"   stopColor="#fff7d6" />
                <stop offset="50%"  stopColor="#fcd34d" />
                <stop offset="100%" stopColor="#f59e0b" />
              </radialGradient>
            </defs>
            <g className="tt-sun-rays" stroke="#fbbf24" strokeWidth="3" strokeLinecap="round">
              {Array.from({ length: 12 }).map((_, i) => {
                const a = (i * Math.PI) / 6;
                const x1 = 32 + Math.cos(a) * 18;
                const y1 = 32 + Math.sin(a) * 18;
                const x2 = 32 + Math.cos(a) * 28;
                const y2 = 32 + Math.sin(a) * 28;
                return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
              })}
            </g>
            <circle cx="32" cy="32" r="14" fill="url(#sunGlow)" />
          </svg>
        )}

        {/* Sparkles — eight twinkling diamonds that arc outward from the
            icon, scaling and fading as they fly. */}
        {Array.from({ length: 8 }).map((_, i) => (
          <span key={i} className={`tt-spark tt-spark-${i + 1}`} />
        ))}
      </div>
    </div>,
    document.body,
  );
};
