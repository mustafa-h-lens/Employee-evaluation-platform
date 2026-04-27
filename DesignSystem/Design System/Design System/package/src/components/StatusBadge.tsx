import React from 'react';
import { CheckCircle, XCircle, Ban, Clock } from 'lucide-react';

export type StatusType = 'active' | 'inactive' | 'blocked' | 'pending' | 'completed' | 'cancelled';

interface StatusBadgeProps {
  status: StatusType;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig: Record<StatusType, {
  label: string;
  icon: React.ReactNode;
  badgeClass: string;
}> = {
  active: {
    label: 'نشط',
    icon: <CheckCircle size={14} />,
    badgeClass: 'badge-green',
  },
  inactive: {
    label: 'غير نشط',
    icon: <XCircle size={14} />,
    badgeClass: 'badge-gray',
  },
  blocked: {
    label: 'محظور',
    icon: <Ban size={14} />,
    badgeClass: 'badge-red',
  },
  pending: {
    label: 'قيد الانتظار',
    icon: <Clock size={14} />,
    badgeClass: 'badge-amber',
  },
  completed: {
    label: 'مكتمل',
    icon: <CheckCircle size={14} />,
    badgeClass: 'badge-green',
  },
  cancelled: {
    label: 'ملغي',
    icon: <XCircle size={14} />,
    badgeClass: 'badge-red',
  },
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  showIcon = true,
  size = 'md',
}) => {
  const config = statusConfig[status];

  const sizeStyle: React.CSSProperties | undefined =
    size === 'sm' ? { fontSize: '11px', padding: '2px 8px' } :
    size === 'lg' ? { fontSize: '14px', padding: '5px 12px' } :
    undefined;

  return (
    <span className={`badge ${config.badgeClass}`} style={sizeStyle}>
      {showIcon && config.icon}
      {config.label}
    </span>
  );
};
