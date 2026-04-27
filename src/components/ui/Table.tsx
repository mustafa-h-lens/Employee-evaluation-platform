import React from 'react';

interface TableProps {
  children: React.ReactNode;
  className?: string;
}

export const Table: React.FC<TableProps> = ({ children, className = '' }) => {
  return (
    <div className={`table-wrap ${className}`} style={{ overflowX: 'auto' }}>
      <table style={{ minWidth: '100%' }}>
        {children}
      </table>
    </div>
  );
};

interface TableHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const TableHeader: React.FC<TableHeaderProps> = ({ children, className = '' }) => {
  return <thead className={className}>{children}</thead>;
};

interface TableBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const TableBody: React.FC<TableBodyProps> = ({ children, className = '' }) => {
  return <tbody className={className}>{children}</tbody>;
};

interface TableRowProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export const TableRow: React.FC<TableRowProps> = ({ children, className = '', onClick }) => {
  return (
    <tr
      className={`${onClick ? 'cursor-pointer' : ''} ${className}`}
      onClick={onClick}
    >
      {children}
    </tr>
  );
};

interface TableHeadProps {
  children: React.ReactNode;
  className?: string;
}

export const TableHead: React.FC<TableHeadProps> = ({ children, className = '' }) => {
  return <th className={className}>{children}</th>;
};

interface TableCellProps {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}

export const TableCell: React.FC<TableCellProps> = ({ children, className = '', colSpan }) => {
  return (
    <td colSpan={colSpan} className={className}>
      {children}
    </td>
  );
};

interface EmptyStateProps {
  message: string;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ message, icon }) => {
  return (
    <div
      className="text-center"
      style={{
        padding: '48px 24px',
        background: 'var(--bg-card)',
        border: '1px dashed var(--border-soft)',
        borderRadius: 'var(--radius-lg)',
      }}
    >
      {icon && (
        <div
          className="mx-auto mb-4 flex items-center justify-center"
          style={{
            width: '56px',
            height: '56px',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--accent-glow)',
            color: 'var(--accent-lighter)',
          }}
        >
          {icon}
        </div>
      )}
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{message}</p>
    </div>
  );
};
