import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  className?: string;
}

export const Toggle: React.FC<ToggleProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  className = '',
}) => {
  const classes = [
    'toggle-wrap',
    checked ? 'on' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <label
      className={classes}
      style={disabled ? { opacity: 0.5, pointerEvents: 'none' } : undefined}
    >
      {label && <span className="toggle-label">{label}</span>}
      <div className="toggle-sw" onClick={() => onChange(!checked)} />
    </label>
  );
};
