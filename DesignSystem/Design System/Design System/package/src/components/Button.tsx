import React from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
  loading?: boolean;
  tooltip?: string;
}

const variantClassMap: Record<ButtonVariant, string> = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  success: 'btn-success',
  warning: 'btn-warning',
  error: 'btn-danger',
  ghost: 'btn-ghost',
};

const sizeClassMap: Record<ButtonSize, string> = {
  sm: 'btn-sm',
  md: '',
  lg: 'btn-lg',
};

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  fullWidth = false,
  loading = false,
  disabled = false,
  tooltip,
  className = '',
  style = {},
  ...props
}) => {
  const classes = [
    'btn',
    variantClassMap[variant],
    sizeClassMap[size],
    className,
  ].filter(Boolean).join(' ');

  const btnStyle: React.CSSProperties = {
    ...(fullWidth ? { width: '100%' } : {}),
    ...(disabled || loading ? { opacity: 0.5, pointerEvents: 'none' } : {}),
    ...style,
  };

  return (
    <button
      {...props}
      disabled={disabled || loading}
      className={classes}
      style={Object.keys(btnStyle).length ? btnStyle : undefined}
      title={tooltip}
    >
      {loading && (
        <svg
          className="animate-spin"
          style={{ width: '1rem', height: '1rem' }}
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            style={{ opacity: 0.25 }}
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            style={{ opacity: 0.75 }}
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      )}
      {icon && iconPosition === 'left' && !loading && icon}
      {children}
      {icon && iconPosition === 'right' && !loading && icon}
    </button>
  );
};
