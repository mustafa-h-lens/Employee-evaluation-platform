import React from 'react';

export interface Tab {
  key: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabsProps {
  tabs: Tab[];
  activeKey: string;
  onChange: (key: string) => void;
  variant?: 'default' | 'colored' | 'pill';
  className?: string;
}

const variantClassMap: Record<string, string> = {
  default: 'tabs',
  colored: 'tabs-colored',
  pill: 'tabs-pill',
};

export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeKey,
  onChange,
  variant = 'default',
  className = '',
}) => {
  return (
    <div className={`${variantClassMap[variant]} ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          className={`tab ${activeKey === tab.key ? 'on' : ''}`}
          onClick={() => onChange(tab.key)}
          type="button"
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );
};
