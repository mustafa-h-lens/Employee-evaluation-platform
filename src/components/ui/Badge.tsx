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
  const variantClasses = {
    success: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-amber-100 text-amber-800 border-amber-200',
    danger: 'bg-red-100 text-red-800 border-red-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200',
    primary: 'bg-blue-600 text-white border-blue-700',
    default: 'bg-gray-100 text-gray-800 border-gray-200'
  };

  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base'
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border font-medium ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
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
