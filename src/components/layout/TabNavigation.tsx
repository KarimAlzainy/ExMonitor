import React from 'react';
import { Activity, BookOpen, LucideIcon, Settings, Stethoscope } from 'lucide-react';

export type AppTab = 'telemetry' | 'surgeon' | 'settings' | 'lab';

const TABS: { id: AppTab; label: string; shortLabel: string; icon: LucideIcon }[] = [
  { id: 'telemetry', label: 'Live readings', shortLabel: 'Readings', icon: Activity },
  { id: 'surgeon', label: 'Flight surgeon', shortLabel: 'Surgeon', icon: Stethoscope },
  { id: 'settings', label: 'Settings', shortLabel: 'Settings', icon: Settings },
  { id: 'lab', label: 'How it works', shortLabel: 'Guide', icon: BookOpen }
];

interface TabNavigationProps {
  active: AppTab;
  onChange: (tab: AppTab) => void;
  variant?: 'inline' | 'bar';
}

export const TabNavigation: React.FC<TabNavigationProps> = ({ active, onChange, variant = 'inline' }) => {
  return (
    <nav
      aria-label="Sections"
      className={variant === 'bar' ? 'flex items-center gap-1 overflow-x-auto' : 'flex items-center gap-1'}
    >
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            aria-current={selected ? 'page' : undefined}
            className={`relative flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition-colors sm:gap-2 sm:px-3 sm:text-[13px] ${
              selected
                ? 'border-white/[0.08] bg-space-850 text-ink-100'
                : 'border-transparent text-ink-400 hover:bg-space-900 hover:text-ink-200'
            }`}
          >
            <Icon className="h-4 w-4" strokeWidth={1.5} />
            <span className="sm:hidden">{tab.shortLabel}</span>
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
