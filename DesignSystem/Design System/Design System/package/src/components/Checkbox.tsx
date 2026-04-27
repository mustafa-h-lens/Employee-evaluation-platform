import React from 'react';

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  onChange,
  label,
  disabled = false,
  error = false,
  className = '',
}) => {
  const classes = [
    'hl-checkbox',
    error ? 'error' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <label className={classes}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
      />
      <span className="checkmark" />
      {label && <span>{label}</span>}
    </label>
  );
};

interface RadioProps {
  checked: boolean;
  onChange: () => void;
  label?: string;
  name?: string;
  disabled?: boolean;
  error?: boolean;
  className?: string;
}

export const Radio: React.FC<RadioProps> = ({
  checked,
  onChange,
  label,
  name,
  disabled = false,
  error = false,
  className = '',
}) => {
  const classes = [
    'hl-radio',
    error ? 'error' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <label className={classes}>
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        name={name}
        disabled={disabled}
      />
      <span className="radiomark" />
      {label && <span>{label}</span>}
    </label>
  );
};

interface CheckGroupProps {
  horizontal?: boolean;
  children: React.ReactNode;
  className?: string;
}

export const CheckGroup: React.FC<CheckGroupProps> = ({
  horizontal = false,
  children,
  className = '',
}) => {
  return (
    <div className={`hl-check-group ${horizontal ? 'horizontal' : ''} ${className}`}>
      {children}
    </div>
  );
};
