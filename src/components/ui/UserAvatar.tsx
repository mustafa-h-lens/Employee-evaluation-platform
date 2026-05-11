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

  // Image case — uses `display: block` parent so the <img> child can
  // fill the entire content box. Avoids the height-resolution glitch
  // that happens when the parent is inline-flex + align-items:center:
  // for some browsers, `height: 100%` on a flex item is computed
  // against intrinsic height (not the explicit parent height), which
  // would leave the img smaller than the circle and show a dark band.
  if (avatarUrl) {
    return (
      <span
        className={`${ringClassName} ${className}`}
        style={{
          width: px,
          height: px,
          borderRadius: '50%',
          flexShrink: 0,
          overflow: 'hidden',
          display: 'block',
          background: 'var(--bg-overlay)',
          border: '1px solid var(--border-soft)',
          lineHeight: 0, // prevents the inline-baseline gap that pushes the img up
        }}
      >
        <img
          src={avatarUrl}
          alt={name}
          loading="lazy"
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            objectFit: 'cover',
            objectPosition: 'center top',
          }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      </span>
    );
  }

  // Initials fallback — uses inline-flex centering for the text glyphs.
  const palette = hashToPalette(name);
  const initials = getInitials(name, initialsLength);

  return (
    <span
      className={`${ringClassName} ${className}`}
      style={{
        width: px,
        height: px,
        borderRadius: '50%',
        flexShrink: 0,
        overflow: 'hidden',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
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
