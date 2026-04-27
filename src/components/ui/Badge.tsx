import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'danger' | 'info' | 'default' | 'primary';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'md',
  className = ''
}) => {
  const variantClass = {
    success: 'badge-green',
    warning: 'badge-amber',
    danger: 'badge-red',
    info: 'badge-blue',
    primary: 'badge-blue',
    default: 'badge-gray',
  }[variant];

  const sizeStyle: React.CSSProperties =
    size === 'sm' ? { padding: '2px 8px', fontSize: '11px' }
    : size === 'lg' ? { padding: '6px 16px', fontSize: '14px' }
    : {};

  return (
    <span className={`badge ${variantClass} ${className}`} style={sizeStyle}>
      {children}
    </span>
  );
};

export const getStatusBadgeVariant = (status: string): 'success' | 'warning' | 'danger' | 'info' | 'default' => {
  const statusMap: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'default'> = {
    'نشطة': 'success',
    'active': 'success',
    'مغلقة': 'danger',
    'قادمة': 'info',
    'مسودة': 'default',
    'بانتظار الموافقة': 'warning',
    'موافقة': 'success',
    'مرفوض': 'danger',
    'تم الإرسال': 'info',
    'اطلع الموظف': 'warning',
    'اطلع المدير': 'warning',
    'مغلق': 'danger',
    'ممتاز': 'success',
    'جيد جدًا': 'info',
    'جيد': 'warning',
    'يحتاج تحسين': 'danger'
  };

  return statusMap[status] || 'default';
};
