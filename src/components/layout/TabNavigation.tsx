import React from 'react';
import { Activity, Cpu, FlaskConical, Stethoscope } from 'lucide-react';

export type AppTab = 'telemetry' | 'surgeon' | 'setup' | 'lab';

const TABS: { id: AppTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'telemetry', label: 'Live Telemetry', icon: Activity },
  { id: 'surgeon', label: 'AI Flight Surgeon', icon: Stethoscope },
  { id: 'setup', label: 'Setup & Pairing', icon: Cpu },
  { id: 'lab', label: 'Virtual Lab', icon: FlaskConical }
];

interface TabNavigationProps {
  active: AppTab;
  onChange: (tab: AppTab) => void;
}

export const TabNavigation: React.FC<TabNavigationProps> = ({ active, onChange }) => {
  return (
    <nav className="border-b border-space-800 bg-space-950/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-3 py-2 sm:px-6">
        {TABS.map((tab, index) => {
          const Icon = tab.icon;
          const selected = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              aria-current={selected ? 'page' : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 font-mono text-xs sm:text-sm ${
                selected
                  ? 'border-nasa-cyan/40 bg-nasa-cyan/10 text-nasa-cyan'
                  : 'border-transparent text-slate-400 hover:border-space-700 hover:bg-space-900 hover:text-slate-100'
              }`}
            >
              <span className="text-[10px] text-slate-500">{index + 1}</span>
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
