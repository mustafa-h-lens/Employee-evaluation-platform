import React from 'react';

interface ResponsiveTableProps {
  // The desktop table — usually a `<Table>` with its full column set.
  desktop: React.ReactNode;
  // The mobile representation — usually an array of <MobileRow /> in a
  // vertical stack. Wrap in a fragment if multiple siblings.
  mobile: React.ReactNode;
  // Optional className for the OUTER wrapper (rare).
  className?: string;
  // Spacing between mobile cards. Defaults to `space-y-2`.
  mobileSpacing?: string;
}

// Switches between a desktop `<Table>` (≥ lg, 1024px) and a stack of
// `<MobileRow>` cards (< lg). The boundary matches the same `lg:`
// breakpoint used by PageLayout, so the table appears at exactly the
// width the persistent sidebar reappears.
//
// Page authors write BOTH layouts and pass them as props — this avoids
// the cost of trying to derive a card layout from arbitrary table cell
// content. Tables vary too much (status badges, action menus, custom
// renderers) to auto-convert.
//
// Example:
// ```tsx
// <ResponsiveTable
//   desktop={<Table><TableHeader>...</TableHeader><TableBody>{rows.map(...)}</TableBody></Table>}
//   mobile={rows.map(r => <MobileRow key={r.id} ... />)}
// />
// ```
export const ResponsiveTable: React.FC<ResponsiveTableProps> = ({
  desktop,
  mobile,
  className = '',
  mobileSpacing = 'space-y-2',
}) => {
  return (
    <div className={className}>
      <div className="hidden lg:block">{desktop}</div>
      <div className={`lg:hidden ${mobileSpacing}`}>{mobile}</div>
    </div>
  );
};
