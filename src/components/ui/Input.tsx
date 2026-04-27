import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  helperText,
  className = '',
  ...props
}) => {
  return (
    <div className="input-group" style={{ width: '100%' }}>
      {label && <label className="input-label">{label}</label>}
      <input
        className={`input ${error ? 'input-error' : ''} ${className}`}
        {...props}
      />
      {error && <p className="input-hint error">{error}</p>}
      {helperText && !error && <p className="input-hint">{helperText}</p>}
    </div>
  );
};

interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const TextArea: React.FC<TextAreaProps> = ({
  label,
  error,
  helperText,
  className = '',
  ...props
}) => {
  return (
    <div className="input-group" style={{ width: '100%' }}>
      {label && <label className="input-label">{label}</label>}
      <textarea
        className={`input ${error ? 'input-error' : ''} ${className}`}
        style={{ height: 'auto', minHeight: '80px', padding: '10px 14px', resize: 'vertical' }}
        {...props}
      />
      {error && <p className="input-hint error">{error}</p>}
      {helperText && !error && <p className="input-hint">{helperText}</p>}
    </div>
  );
};

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export const Select: React.FC<SelectProps> = ({
  label,
  error,
  options,
  className = '',
  ...props
}) => {
  return (
    <div className="input-group" style={{ width: '100%' }}>
      {label && <label className="input-label">{label}</label>}
      <select
        className={`input select ${error ? 'input-error' : ''} ${className}`}
        {...props}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && <p className="input-hint error">{error}</p>}
    </div>
  );
};
