import React from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onChange, disabled = false, size = 'md' }) => {
  const isSmall = size === 'sm';

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onChange}
      style={{
        direction: 'ltr',
        // off-state needs more contrast in light mode than border-medium gives
        background: checked ? 'var(--success)' : 'var(--text-disabled)',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
      className={`
        relative inline-flex shrink-0 rounded-full transition-colors duration-300 ease-in-out
        ${isSmall ? 'w-9 h-[22px]' : 'w-[44px] h-[26px]'}
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
      `}
    >
      <span
        className={`
          pointer-events-none absolute top-[2px] rounded-full shadow-md
          transition-all duration-300 ease-in-out
          ${isSmall ? 'w-[18px] h-[18px]' : 'w-[22px] h-[22px]'}
          ${checked
            ? (isSmall ? 'left-[17px]' : 'left-[20px]')
            : 'left-[2px]'
          }
        `}
        style={{ background: '#ffffff', boxShadow: '0 1px 3px rgba(0,0,0,0.2), 0 1px 2px rgba(0,0,0,0.12)' }}
      />
    </button>
  );
};
