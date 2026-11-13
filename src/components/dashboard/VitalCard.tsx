import React from 'react';
import { LucideIcon } from 'lucide-react';
import { AlertSeverity } from '../../types/telemetry';

interface VitalCardProps {
  title: string;
  subtitle: string;
  value: string | number;
  unit: string;
  icon: LucideIcon;
  severity: AlertSeverity;
  normalRange: string;
  progressPercent: number; // 0 to 100
  infoTip?: string;
  highlightColor?: 'emerald' | 'amber' | 'crimson' | 'cyan';
}

export const VitalCard: React.FC<VitalCardProps> = ({
  title,
  subtitle,
  value,
  unit,
  icon: Icon,
  severity,
  normalRange,
  progressPercent,
  infoTip,
  highlightColor
}) => {
  // Border and glow styling based on severity
  const severityColors = {
    nominal: {
      border: 'border-space-700/60 hover:border-emerald-500/40',
      badge: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      bar: 'bg-emerald-500',
      iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      glow: 'shadow-emerald-950/20'
    },
    caution: {
      border: 'border-amber-500/40 hover:border-amber-500/60',
      badge: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      bar: 'bg-amber-500',
      iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
      glow: 'shadow-amber-950/40'
    },
    critical: {
      border: 'border-red-500/60 hover:border-red-500 animate-pulse',
      badge: 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse',
      bar: 'bg-red-500',
      iconBg: 'bg-red-500/20 text-red-400 border-red-500/40',
      glow: 'shadow-red-950/50'
    }
  };

  const style = severityColors[severity] || severityColors.nominal;

  return (
    <div
      className={`relative rounded-2xl bg-space-900 border ${style.border} p-4 sm:p-5 transition-all duration-300 shadow-xl ${style.glow} backdrop-blur-md flex flex-col justify-between`}
    >
      {/* Top Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center space-x-2.5">
          <div className={`p-2 rounded-xl border ${style.iconBg}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold tracking-wide text-slate-100 font-mono">
              {title}
            </h4>
            <p className="text-xs text-slate-400">{subtitle}</p>
          </div>
        </div>

        {/* Severity Badge */}
        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md border uppercase font-medium ${style.badge}`}>
          {severity}
        </span>
      </div>

      {/* Main Metric Value */}
      <div className="my-3 flex items-baseline space-x-2">
        <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-slate-100">
          {value}
        </span>
        <span className="text-sm sm:text-base font-semibold text-slate-400 font-mono">
          {unit}
        </span>
      </div>

      {/* Visual Level Progress Bar */}
      <div className="space-y-1.5">
        <div className="w-full bg-space-950 rounded-full h-1.5 overflow-hidden border border-space-800">
          <div
            className={`h-full rounded-full transition-all duration-500 ${style.bar}`}
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
        </div>

        {/* Normal target range footer */}
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
          <span>Target: {normalRange}</span>
          {infoTip && <span className="text-slate-400 hidden sm:inline">{infoTip}</span>}
        </div>
      </div>
    </div>
  );
};
