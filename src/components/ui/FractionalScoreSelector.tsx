import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';

interface FractionalScoreSelectorProps {
  value: number;
  onChange: (score: number) => void;
  color?: 'blue' | 'emerald';
  disabled?: boolean;
}

export const FractionalScoreSelector: React.FC<FractionalScoreSelectorProps> = ({
  value,
  onChange,
  color = 'blue',
  disabled = false,
}) => {
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const popoverRef = useRef<HTMLDivElement>(null);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number } | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        popoverRef.current && !popoverRef.current.contains(target)
      ) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useLayoutEffect(() => {
    if (openDropdown === null) {
      setPopoverPos(null);
      return;
    }
    const trigger = triggerRefs.current[openDropdown];
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    setPopoverPos({
      top: rect.bottom + 4,
      left: rect.left + rect.width / 2,
    });
  }, [openDropdown]);

  useEffect(() => {
    if (openDropdown === null) return;
    const reposition = () => {
      const trigger = triggerRefs.current[openDropdown];
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      setPopoverPos({
        top: rect.bottom + 4,
        left: rect.left + rect.width / 2,
      });
    };
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [openDropdown]);

  const baseInt = Math.floor(value);
  const frac = value ? +(value - baseInt).toFixed(2) : 0;
  const accent = color === 'blue' ? 'var(--accent)' : 'var(--success)';
  const accentLight = color === 'blue' ? 'var(--accent-glow)' : 'var(--success-bg)';

  const selectedStyle: React.CSSProperties = {
    background: accent,
    color: '#ffffff',
    borderColor: accent,
  };
  const idleStyle: React.CSSProperties = disabled
    ? {
        background: 'var(--bg-overlay)',
        color: 'var(--text-disabled)',
        borderColor: 'var(--border-subtle)',
      }
    : {
        background: 'var(--bg-surface)',
        color: 'var(--text-secondary)',
        borderColor: 'var(--border-soft)',
      };

  return (
    <div className="flex items-start gap-1.5 sm:gap-2" ref={containerRef}>
      {[1, 2, 3, 4, 5].map(score => {
        const isSelected = baseInt === score;
        const hasFraction = isSelected && frac > 0;
        const isDropdownOpen = openDropdown === score;
        const displayText = hasFraction ? `${value}` : `${score}`;

        return (
          <div key={score} className="flex-1 relative min-w-0">
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                onChange(score);
                setOpenDropdown(null);
              }}
              className={`w-full py-2 px-1.5 sm:py-3 sm:px-2 font-bold transition-all tabular-nums truncate ${
                hasFraction ? 'text-sm sm:text-base' : 'text-base sm:text-lg'
              } ${
                score < 5 && !disabled ? 'rounded-t-lg border-b-0' : 'rounded-lg'
              } ${disabled ? 'cursor-default' : ''}`}
              style={{
                borderWidth: '2px',
                borderStyle: 'solid',
                ...(isSelected ? selectedStyle : idleStyle),
              }}
            >
              {displayText}
            </button>

            {score < 5 && !disabled && (
              <button
                type="button"
                ref={el => { triggerRefs.current[score] = el; }}
                onClick={() => setOpenDropdown(isDropdownOpen ? null : score)}
                className="w-full py-1 rounded-b-lg border-t flex items-center justify-center transition-all"
                style={{
                  borderWidth: '2px',
                  borderStyle: 'solid',
                  borderTopWidth: '1px',
                  ...(isSelected
                    ? {
                        background: accent,
                        color: 'rgba(255,255,255,0.85)',
                        borderColor: accent,
                        opacity: 0.9,
                      }
                    : {
                        background: 'var(--bg-overlay)',
                        color: 'var(--text-muted)',
                        borderColor: 'var(--border-soft)',
                      }),
                }}
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            )}
          </div>
        );
      })}

      {openDropdown !== null && popoverPos && createPortal(
        <div
          ref={popoverRef}
          className="py-1 min-w-[80px]"
          style={{
            position: 'fixed',
            top: popoverPos.top,
            left: popoverPos.left,
            transform: 'translateX(-50%)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-soft)',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            zIndex: 1000,
          }}
        >
          {[0.25, 0.5, 0.75].map(f => {
            const fracValue = openDropdown + f;
            const isFracSelected = value === fracValue;
            return (
              <button
                key={f}
                type="button"
                onClick={() => {
                  onChange(fracValue);
                  setOpenDropdown(null);
                }}
                className="w-full px-3 py-1.5 text-sm font-semibold text-center transition-colors tabular-nums"
                style={
                  isFracSelected
                    ? { background: accentLight, color: accent }
                    : { color: 'var(--text-secondary)' }
                }
              >
                {fracValue.toFixed(2)}
              </button>
            );
          })}
        </div>,
        document.body
      )}
    </div>
  );
};
