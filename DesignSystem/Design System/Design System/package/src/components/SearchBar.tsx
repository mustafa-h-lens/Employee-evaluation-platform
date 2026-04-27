import React from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'بحث...',
  className = '',
}) => {
  return (
    <div className={`input-wrap ${className}`} style={{ marginBottom: '1.5rem' }}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input"
      />
      <span className="input-icon">
        <Search size={20} />
      </span>
    </div>
  );
};
