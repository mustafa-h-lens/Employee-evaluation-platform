import React from 'react';

export interface BreadcrumbItem {
  label: string;
  onClick?: () => void;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumb: React.FC<BreadcrumbProps> = ({
  items,
  className = '',
}) => {
  return (
    <nav className={`breadcrumb ${className}`}>
      {items.map((item, index) => {
        const isCurrent = index === items.length - 1;
        return (
          <React.Fragment key={index}>
            {index > 0 && <span className="breadcrumb-sep">/</span>}
            <span
              className={`breadcrumb-item ${isCurrent ? 'current' : ''}`}
              onClick={!isCurrent ? item.onClick : undefined}
              style={!isCurrent && item.onClick ? { cursor: 'pointer' } : undefined}
            >
              {item.label}
            </span>
          </React.Fragment>
        );
      })}
    </nav>
  );
};
