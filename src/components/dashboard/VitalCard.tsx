import React from 'react';
import { AlertSeverity } from '../../types/telemetry';

interface VitalCardProps {
  label: string;
  meta: string;
  value: string | number;
  unit: string;
  severity: AlertSeverity;
  range: string;
}

const TONE = {
  nominal: {
    dot: 'bg-positive',
    text: 'text-positive',
    border: 'border-white/[0.08]'
  },
  caution: {
    dot: 'bg-caution',
    text: 'text-caution',
    border: 'border-caution/30'
  },
  critical: {
    dot: 'bg-critical',
    text: 'text-critical',
    border: 'border-critical/40'
  }
} as const;

const LABEL = {
  nominal: 'Nominal',
  caution: 'Caution',
  critical: 'Critical'
} as const;

export const VitalCard: React.FC<VitalCardProps> = ({ label, meta, value, unit, severity, range }) => {
  const tone = TONE[severity] ?? TONE.nominal;

  return (
    <div className={`flex h-full flex-col rounded-xl border bg-space-900 p-5 ${tone.border}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-ink-200">{label}</p>
          <p className="mt-0.5 truncate text-[11px] text-ink-500">{meta}</p>
        </div>
        <span className={`flex shrink-0 items-center gap-1.5 pt-0.5 text-[11px] ${tone.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
          {LABEL[severity] ?? 'Nominal'}
        </span>
      </div>

      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="text-[30px] font-medium leading-none tracking-tight tabular-nums text-ink-100">{value}</span>
        <span className="text-xs text-ink-400">{unit}</span>
      </div>

      <p className="mt-auto pt-3 text-[11px] text-ink-500">{range}</p>
    </div>
  );
};
