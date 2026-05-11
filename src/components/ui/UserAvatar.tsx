import React from 'react';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

interface UserAvatarProps {
  name: string;
  avatarUrl?: string | null;
  size?: AvatarSize;
  initialsLength?: 1 | 2;
  className?: string;
  ringClassName?: string;
}

const SIZE_PX: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 36,
  lg: 48,
  xl: 64,
  '2xl': 80,
};

const FONT_PX: Record<AvatarSize, number> = {
  xs: 10,
  sm: 12,
  md: 13,
  lg: 17,
  xl: 22,
  '2xl': 28,
};

const PALETTE = [
  { bg: 'var(--sc-blue-icon-bg)',   border: 'var(--sc-blue-icon-b)',   color: 'var(--sc-blue-icon-c)' },
  { bg: 'var(--sc-green-icon-bg)',  border: 'var(--sc-green-icon-b)',  color: 'var(--sc-green-icon-c)' },
  { bg: 'var(--sc-amber-icon-bg)',  border: 'var(--sc-amber-icon-b)',  color: 'var(--sc-amber-icon-c)' },
  { bg: 'var(--sc-purple-icon-bg)', border: 'var(--sc-purple-icon-b)', color: 'var(--sc-purple-icon-c)' },
  { bg: 'var(--info-bg)',           border: 'var(--info-border)',      color: 'var(--info-text)' },
  { bg: 'var(--danger-bg)',         border: 'var(--danger-border)',    color: 'var(--danger-text)' },
];

const hashToPalette = (name: string) => {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
};

const getInitials = (name: string, length: 1 | 2): string => {
  const trimmed = (name || '').trim();
  if (!trimmed) return '?';
  if (length === 1) return trimmed.charAt(0);
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].charAt(0);
  return parts[0].charAt(0) + parts[parts.length - 1].charAt(0);
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  avatarUrl,
  size = 'md',
  initialsLength = 1,
  className = '',
  ringClassName = '',
}) => {
  const px = SIZE_PX[size];
  const fontPx = FONT_PX[size];
  const baseStyle: React.CSSProperties = {
    width: px,
    height: px,
    borderRadius: '50%',
    flexShrink: 0,
    overflow: 'hidden',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (avatarUrl) {
    return (
      <span
        className={`${ringClassName} ${className}`}
        style={{
          ...baseStyle,
          background: 'var(--bg-overlay)',
          border: '1px solid var(--border-soft)',
        }}
      >
        <img
          src={avatarUrl}
          alt={name}
          loading="lazy"
          style={{
            // The parent <span> uses inline-flex + align-items:center
            // (needed for the initials fallback). For an <img> child
            // that should fill the circle, the parent's centering wins
            // over `height: 100%` in some browsers, leaving a gap at
            // the bottom. `alignSelf: stretch` overrides the inherited
            // align-items:center so the img fills the cross axis.
            // `display: block` removes inline line-height padding.
            // `objectPosition: center top` favours keeping the head
            // when a portrait is wider/taller than the square crop.
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center top',
            display: 'block',
            alignSelf: 'stretch',
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      </span>
    );
  }

  const palette = hashToPalette(name);
  const initials = getInitials(name, initialsLength);

  return (
    <span
      className={`${ringClassName} ${className}`}
      style={{
        ...baseStyle,
        background: palette.bg,
        border: `1px solid ${palette.border}`,
        color: palette.color,
        fontWeight: 700,
        fontSize: `${fontPx}px`,
        lineHeight: 1,
        userSelect: 'none',
      }}
    >
      {initials}
    </span>
  );
};
