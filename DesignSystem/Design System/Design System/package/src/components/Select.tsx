import React from 'react';

interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  label?: string;
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  fullWidth?: boolean;
  error?: string;
  className?: string;
}

export const Select: React.FC<SelectProps> = ({
  label,
  value,
  options,
  onChange,
  placeholder,
  fullWidth = false,
  error,
  className = '',
}) => {
  const selectClasses = [
    'input select',
    error ? 'input-error' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={`input-group ${className}`}
      style={fullWidth ? { width: '100%' } : undefined}
    >
      {label && <label className="input-label">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={selectClasses}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <span className="input-hint error">{error}</span>}
    </div>
  );
};
