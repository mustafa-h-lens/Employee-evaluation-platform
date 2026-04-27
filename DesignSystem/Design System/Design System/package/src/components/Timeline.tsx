import React from 'react';

export interface TimelineItem {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  time?: string;
  dotColor?: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'cyan';
}

interface TimelineProps {
  items: TimelineItem[];
  className?: string;
}

const dotColorMap: Record<string, string> = {
  blue: 'dot-blue',
  green: 'dot-green',
  amber: 'dot-amber',
  red: 'dot-red',
  purple: 'dot-purple',
  cyan: 'dot-cyan',
};

export const Timeline: React.FC<TimelineProps> = ({
  items,
  className = '',
}) => {
  return (
    <div className={`timeline ${className}`}>
      {items.map((item, index) => (
        <div key={index} className="timeline-item">
          <div className={`timeline-dot ${item.dotColor ? dotColorMap[item.dotColor] : ''}`}>
            {item.icon}
          </div>
          <div className="timeline-content">
            <div className="timeline-title">{item.title}</div>
            {item.description && <div className="timeline-desc">{item.description}</div>}
          </div>
          {item.time && <div className="timeline-time">{item.time}</div>}
        </div>
      ))}
    </div>
  );
};
