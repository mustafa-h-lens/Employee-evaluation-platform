import React from 'react';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface TooltipProps {
  text: string;
  position?: TooltipPosition;
  children: React.ReactNode;
  className?: string;
}

export const Tooltip: React.FC<TooltipProps> = ({
  text,
  position = 'top',
  children,
  className = '',
}) => {
  return (
    <span
      className={`tooltip tooltip-${position} ${className}`}
      data-tip={text}
    >
      {children}
    </span>
  );
};
