import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  glow?: boolean;
}

const paddingMap: Record<string, string> = {
  none: '0',
  sm: '12px',
  md: '16px',
  lg: '20px',
};

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  style = {},
  padding = 'lg',
  glow = false,
}) => {
  const classes = ['card', glow ? 'card-glow' : '', className].filter(Boolean).join(' ');

  return (
    <div
      className={classes}
      style={{ padding: paddingMap[padding], ...style }}
    >
      {children}
    </div>
  );
};
