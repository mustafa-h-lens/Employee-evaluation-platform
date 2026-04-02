import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface FractionalScoreSelectorProps {
  value: number;
  onChange: (score: number) => void;
  color?: 'blue' | 'emerald';
  disabled?: boolean;
}

export const FractionalScoreSelector: React.FC<FractionalScoreSelectorProps> = ({
  value,
  onChange,
  color = 'blue',
  disabled = false,
}) => {
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const baseInt = Math.floor(value);
  const frac = value ? +(value - baseInt).toFixed(2) : 0;
  const isBlue = color === 'blue';

  return (
    <div className="flex items-start gap-2" ref={containerRef}>
      {[1, 2, 3, 4, 5].map(score => {
        const isSelected = baseInt === score;
        const hasFraction = isSelected && frac > 0;
        const isDropdownOpen = openDropdown === score;
        const displayText = hasFraction ? `${value}` : `${score}`;

        return (
          <div key={score} className="flex-1 relative">
            {/* Main score button */}
            <button
              type="button"
              disabled={disabled}
              onClick={() => {
                if (disabled) return;
                onChange(score);
                setOpenDropdown(null);
              }}
              className={`w-full py-3 px-2 ${score < 5 && !disabled ? 'rounded-t-lg border-b-0' : 'rounded-lg'} border-2 font-bold text-lg transition-all ${
                disabled ? 'cursor-default' : ''
              } ${
                isSelected
                  ? isBlue
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-emerald-600 text-white border-emerald-600'
                  : disabled
                    ? 'bg-gray-50 text-gray-400 border-gray-200'
                    : isBlue
                      ? 'bg-white text-gray-700 border-gray-300 hover:border-blue-400'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-emerald-400'
              }`}
            >
              {displayText}
            </button>

            {/* Small dropdown trigger button (not for 5) */}
            {score < 5 && !disabled && (
              <button
                type="button"
                onClick={() => setOpenDropdown(isDropdownOpen ? null : score)}
                className={`w-full py-1 rounded-b-lg border-2 border-t flex items-center justify-center transition-all ${
                  isSelected
                    ? isBlue
                      ? 'bg-blue-700 text-blue-200 border-blue-600 border-t-blue-500 hover:bg-blue-800'
                      : 'bg-emerald-700 text-emerald-200 border-emerald-600 border-t-emerald-500 hover:bg-emerald-800'
                    : isBlue
                      ? 'bg-gray-50 text-gray-400 border-gray-300 border-t-gray-200 hover:bg-gray-100'
                      : 'bg-gray-50 text-gray-400 border-gray-300 border-t-gray-200 hover:bg-gray-100'
                }`}
              >
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
            )}

            {/* Dropdown */}
            {isDropdownOpen && (
              <div className={`absolute top-full left-1/2 -translate-x-1/2 mt-1 z-20 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[80px] ${
                isBlue ? 'ring-1 ring-blue-200' : 'ring-1 ring-emerald-200'
              }`}>
                {[0.25, 0.5, 0.75].map(f => {
                  const fracValue = score + f;
                  const isFracSelected = value === fracValue;
                  return (
                    <button
                      key={f}
                      type="button"
                      onClick={() => {
                        onChange(fracValue);
                        setOpenDropdown(null);
                      }}
                      className={`w-full px-3 py-1.5 text-sm font-semibold text-center transition-colors ${
                        isFracSelected
                          ? isBlue
                            ? 'bg-blue-50 text-blue-700'
                            : 'bg-emerald-50 text-emerald-700'
                          : 'text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {fracValue.toFixed(2)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
