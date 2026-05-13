import React from 'react';
import { ChevronLeft } from 'lucide-react';

export interface MobileRowField {
  label: string;
  // Either a plain string (rendered as text) or any React node (badge, etc.)
  value: React.ReactNode;
  // Optional small icon shown to the right of the value (RTL: leading side)
  icon?: React.ReactNode;
}

interface MobileRowProps {
  // Primary title — usually the entity name
  title: React.ReactNode;
  // Optional subtitle below the title
  subtitle?: React.ReactNode;
  // Optional leading visual (avatar, role icon, etc.)
  leading?: React.ReactNode;
  // Optional trailing slot in the header — usually a status Badge
  statusBadge?: React.ReactNode;
  // Label/value pairs rendered as a 2-column grid inside the card body
  fields?: MobileRowField[];
  // Tap handler — when set the whole card is tappable and shows a
  // ChevronLeft affordance on the left edge (RTL: forward direction)
  onClick?: () => void;
  // Optional override for the chevron — pass `false` to hide it even
  // when onClick is set (e.g. when the card has its own action menu)
  showChevron?: boolean;
  // Optional explicit action slot (e.g. a kebab menu) — replaces the
  // chevron and stops click propagation so it doesn't trigger onClick
  action?: React.ReactNode;
  // Optional className additive
  className?: string;
}

// Mobile-card row used as a replacement for `<TableRow>` content on
// phones / tablets. Visually styled like the InfoCell pattern from the
// org-structure profile modal: bordered card, icon-tile (via `leading`)
// to the right, title + subtitle stack, body grid of label/value pairs,
// optional tap affordance.
//
// Designed to be composed inside a `lg:hidden` wrapper alongside a
// regular `<Table>` for desktop. See ResponsiveTable.
export const MobileRow: React.FC<MobileRowProps> = ({
  title,
  subtitle,
  leading,
  statusBadge,
  fields,
  onClick,
  showChevron,
  action,
  className = '',
}) => {
  const tappable = !!onClick;
  const chevron = showChevron ?? tappable;

  const content = (
    <>
      <div className="flex items-start gap-3">
        {leading && <div className="flex-shrink-0">{leading}</div>}
        <div className="flex-1 min-w-0 text-right">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="font-bold text-ds-text text-sm leading-snug break-words">{title}</div>
              {subtitle && (
                <div className="text-xs text-ds-faint mt-0.5 break-words">{subtitle}</div>
              )}
            </div>
            {statusBadge && <div className="flex-shrink-0">{statusBadge}</div>}
          </div>
        </div>
        {chevron && !action && (
          <div className="flex-shrink-0 mt-0.5">
            <ChevronLeft className="h-5 w-5 text-ds-faint" />
          </div>
        )}
        {action && (
          <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {action}
          </div>
        )}
      </div>

      {fields && fields.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 pt-3 border-t border-ds-border-subtle">
          {fields.map((f, i) => (
            <div key={i} className="min-w-0">
              <div className="text-[10px] text-ds-faint font-medium">{f.label}</div>
              <div className="text-sm font-semibold text-ds-text mt-0.5 flex items-center gap-1.5">
                {f.icon && <span className="flex-shrink-0 text-ds-faint">{f.icon}</span>}
                <span className="min-w-0 truncate">{f.value}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );

  const base = 'bg-ds-surface border border-ds-border-subtle rounded-xl p-4 shadow-sm';
  const interactive = tappable ? 'cursor-pointer transition-colors hover:bg-ds-overlay/40 active:bg-ds-overlay/60' : '';

  if (tappable) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${base} ${interactive} w-full text-right ${className}`}
      >
        {content}
      </button>
    );
  }
  return (
    <div className={`${base} ${className}`}>
      {content}
    </div>
  );
};
