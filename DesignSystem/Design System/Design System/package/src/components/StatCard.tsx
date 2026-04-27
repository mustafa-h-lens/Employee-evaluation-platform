import React from 'react';

export type StatCardVariant = 'blue' | 'green' | 'amber' | 'purple';

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  variant?: StatCardVariant;
  subtitle?: string;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  variant = 'blue',
  subtitle,
  className = '',
}) => {
  return (
    <div className={`stat-card sc-${variant} ${className}`}>
      {icon && <div className="sc-icon">{icon}</div>}
      <div className="sc-val">{value}</div>
      <div className="sc-label">{label}</div>
      {subtitle && <div className="sc-sub">{subtitle}</div>}
    </div>
  );
};
