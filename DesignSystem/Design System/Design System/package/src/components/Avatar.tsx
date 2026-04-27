import React from 'react';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

interface AvatarProps {
  src?: string;
  alt?: string;
  initials?: string;
  size?: AvatarSize;
  className?: string;
}

const sizeClassMap: Record<AvatarSize, string> = {
  sm: 'av-sm',
  md: 'av-md',
  lg: 'av-lg',
  xl: 'av-xl',
};

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = '',
  initials,
  size = 'md',
  className = '',
}) => {
  return (
    <div className={`avatar ${sizeClassMap[size]} ${className}`}>
      {src ? (
        <img src={src} alt={alt} />
      ) : (
        <span>{initials || alt.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
};

interface AvatarGroupProps {
  children: React.ReactNode;
  className?: string;
}

export const AvatarGroup: React.FC<AvatarGroupProps> = ({
  children,
  className = '',
}) => {
  return <div className={`av-group ${className}`}>{children}</div>;
};
