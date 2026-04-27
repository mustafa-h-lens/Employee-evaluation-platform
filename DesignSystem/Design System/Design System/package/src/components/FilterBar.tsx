import React from 'react';
import { X } from 'lucide-react';
import { Button } from './Button';

export interface FilterOption {
  label: string;
  value: string;
}

export interface Filter {
  label: string;
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
}

interface FilterBarProps {
  filters: Filter[];
  onReset?: () => void;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onReset,
  className = '',
}) => {
  return (
    <div
      className={`card ${className}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
        padding: '12px 16px',
        marginBottom: '1.5rem',
        flexWrap: 'wrap',
      }}
    >
      {filters.map((filter, index) => (
        <div key={index} className="input-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}>
          <label className="input-label" style={{ whiteSpace: 'nowrap' }}>{filter.label}:</label>
          <select
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            className="input select"
            style={{ minWidth: '150px', height: '34px', padding: '0 12px 0 32px' }}
          >
            {filter.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      {onReset && (
        <Button
          variant="ghost"
          size="sm"
          icon={<X size={16} />}
          onClick={onReset}
        >
          إعادة تعيين
        </Button>
      )}
    </div>
  );
};
