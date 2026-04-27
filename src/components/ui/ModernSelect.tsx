import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';

export interface ModernSelectOption {
  value: string;
  label: string;
  hint?: string;
}

interface ModernSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: ModernSelectOption[];
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
}

interface MenuPos {
  top: number;
  left: number;
  width: number;
}

export const ModernSelect: React.FC<ModernSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'اختر…',
  icon,
  className = '',
  ariaLabel,
  disabled = false,
}) => {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const recomputePos = () => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: r.left, width: r.width });
  };

  useLayoutEffect(() => {
    if (open) recomputePos();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => recomputePos();
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        triggerRef.current && !triggerRef.current.contains(t) &&
        menuRef.current && !menuRef.current.contains(t)
      ) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, [open]);

  const selected = options.find(o => o.value === value);

  const menu = open && pos ? createPortal(
    <div
      ref={menuRef}
      className="overflow-hidden"
      style={{
        position: 'fixed',
        top: pos.top,
        left: pos.left,
        width: pos.width,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-soft)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-lg)',
        maxHeight: '320px',
        overflowY: 'auto',
        zIndex: 9999,
      }}
      role="listbox"
      dir="rtl"
    >
      {options.length === 0 && (
        <div
          className="px-4 py-3 text-sm text-center"
          style={{ color: 'var(--text-muted)' }}
        >
          لا توجد خيارات
        </div>
      )}
      {options.map(opt => {
        const isActive = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="option"
            aria-selected={isActive}
            onClick={() => {
              onChange(opt.value);
              setOpen(false);
            }}
            className="w-full flex items-center gap-2 px-4 py-2.5 text-right transition-colors"
            style={{
              background: isActive ? 'var(--accent-glow)' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--text-primary)',
              fontSize: '14px',
              fontWeight: isActive ? 700 : 500,
              cursor: 'pointer',
              borderBottom: '1px solid var(--border-subtle)',
            }}
            onMouseEnter={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-overlay)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isActive) {
                (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
              }
            }}
          >
            <span className="flex-1 truncate">{opt.label}</span>
            {opt.hint && (
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                style={{
                  background: 'var(--success-bg)',
                  color: 'var(--success-text)',
                }}
              >
                {opt.hint}
              </span>
            )}
            {isActive && <Check className="h-4 w-4 flex-shrink-0" />}
          </button>
        );
      })}
    </div>,
    document.body,
  ) : null;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => !disabled && setOpen(o => !o)}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className="w-full flex items-center gap-2 px-4 py-2.5 transition-all"
        style={{
          background: open ? 'var(--accent-glow)' : 'var(--bg-surface)',
          border: '1px solid',
          borderColor: open ? 'var(--accent)' : 'var(--border-soft)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)',
          fontSize: '14px',
          fontWeight: 600,
          boxShadow: open ? '0 0 0 3px rgba(37,99,235,0.12)' : 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {icon && <span style={{ color: 'var(--accent)' }}>{icon}</span>}
        <span className="flex-1 text-right truncate">
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className="h-4 w-4 transition-transform flex-shrink-0"
          style={{
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>
      {menu}
    </div>
  );
};
