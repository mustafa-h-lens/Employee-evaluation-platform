import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

export interface DropdownItem {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  divider?: boolean;
}

interface DropdownProps {
  trigger?: React.ReactNode;
  label?: string;
  items: DropdownItem[];
  className?: string;
}

export const Dropdown: React.FC<DropdownProps> = ({
  trigger,
  label,
  items,
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={ref} className={`dropdown ${open ? 'open' : ''} ${className}`}>
      {trigger ? (
        <div onClick={() => setOpen(!open)}>{trigger}</div>
      ) : (
        <button
          className="dropdown-trigger"
          onClick={() => setOpen(!open)}
          type="button"
        >
          {label}
          <ChevronDown size={16} />
        </button>
      )}
      <div className="dropdown-menu">
        {items.map((item) =>
          item.divider ? (
            <div key={item.key} className="dropdown-divider" />
          ) : (
            <button
              key={item.key}
              className="dropdown-item"
              onClick={() => {
                item.onClick?.();
                setOpen(false);
              }}
              type="button"
            >
              {item.icon}
              {item.label}
            </button>
          )
        )}
      </div>
    </div>
  );
};
