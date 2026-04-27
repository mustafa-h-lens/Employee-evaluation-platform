import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface AccordionItem {
  key: string;
  title: string;
  content: React.ReactNode;
}

interface AccordionProps {
  items: AccordionItem[];
  defaultOpenKey?: string;
  allowMultiple?: boolean;
  className?: string;
}

export const Accordion: React.FC<AccordionProps> = ({
  items,
  defaultOpenKey,
  allowMultiple = false,
  className = '',
}) => {
  const [openKeys, setOpenKeys] = useState<Set<string>>(
    defaultOpenKey ? new Set([defaultOpenKey]) : new Set()
  );

  const toggle = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(allowMultiple ? prev : []);
      if (prev.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className={`accordion ${className}`}>
      {items.map((item) => {
        const isOpen = openKeys.has(item.key);
        return (
          <div key={item.key} className={`accordion-item ${isOpen ? 'open' : ''}`}>
            <button
              className="accordion-header"
              onClick={() => toggle(item.key)}
              type="button"
            >
              <span>{item.title}</span>
              <ChevronDown size={18} className="chevron-icon" />
            </button>
            <div className="accordion-body">
              <div className="accordion-body-inner">
                {item.content}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
