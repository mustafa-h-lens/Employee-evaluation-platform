import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Sparkles } from 'lucide-react';

interface Props {
  name: string | null;
  onDismiss: () => void;
}

// Centerpiece welcome card shown briefly after a successful login.
// Vertical layout — sparkle badge above, "أهلاً بعودتك" caption, then
// the user's name in a bold gradient — surrounded by softly twinkling
// sparkle decorations. The whole composition floats in once, lingers
// ~2.2s, and dissolves out. Pointer-events disabled so it's purely
// visual delight; the dashboard underneath stays interactive.
export const WelcomeChip: React.FC<Props> = ({ name, onDismiss }) => {
  const [phase, setPhase] = useState<'enter' | 'show' | 'leave'>('enter');
  // Hold dismissal in a ref so it never re-triggers the effect when the
  // parent recreates the callback. The effect must run exactly once
  // per `name` change — anything else causes flicker/restart.
  const dismissRef = useRef(onDismiss);
  useEffect(() => { dismissRef.current = onDismiss; }, [onDismiss]);

  useEffect(() => {
    if (!name) return;
    setPhase('enter');
    const showId = window.setTimeout(() => setPhase('show'), 30);
    const leaveId = window.setTimeout(() => setPhase('leave'), 2400);
    const doneId  = window.setTimeout(() => dismissRef.current(), 3100);
    return () => {
      window.clearTimeout(showId);
      window.clearTimeout(leaveId);
      window.clearTimeout(doneId);
    };
  }, [name]);

  if (!name) return null;
  return createPortal(
    <div className={`welcome-card welcome-card-${phase}`} aria-live="polite" role="status">
      {/* Soft halo behind the card */}
      <div className="welcome-card-halo" aria-hidden="true" />
      {/* Decorative sparkles around the card */}
      <span className="welcome-spark welcome-spark-1" aria-hidden="true" />
      <span className="welcome-spark welcome-spark-2" aria-hidden="true" />
      <span className="welcome-spark welcome-spark-3" aria-hidden="true" />
      <span className="welcome-spark welcome-spark-4" aria-hidden="true" />

      <div className="welcome-card-icon">
        <Sparkles className="h-7 w-7" />
      </div>
      <div className="welcome-card-greeting">أهلاً بعودتك</div>
      <div className="welcome-card-name">{name}</div>
    </div>,
    document.body,
  );
};
