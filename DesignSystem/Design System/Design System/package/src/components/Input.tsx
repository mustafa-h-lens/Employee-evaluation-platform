import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  fullWidth = false,
  className = '',
  style = {},
  ...props
}) => {
  const inputClasses = [
    'input',
    error ? 'input-error' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={`input-group ${className}`}
      style={fullWidth ? { width: '100%' } : undefined}
    >
      {label && <label className="input-label">{label}</label>}
      {icon ? (
        <div className="input-wrap">
          <input
            {...props}
            className={inputClasses}
            style={style}
          />
          <span className="input-icon">{icon}</span>
        </div>
      ) : (
        <input
          {...props}
          className={inputClasses}
          style={style}
        />
      )}
      {error && <span className="input-hint error">{error}</span>}
    </div>
  );
};
