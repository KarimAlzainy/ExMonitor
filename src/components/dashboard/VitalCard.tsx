import React from 'react';
import { AlertSeverity } from '../../types/telemetry';
import { InfoTip } from '../ui/InfoTip';

interface VitalCardProps {
  label: string;
  tip?: string;
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
    value: 'text-ink-100',
    surface: 'glass'
  },
  caution: {
    dot: 'bg-caution',
    text: 'text-caution',
    value: 'text-caution',
    surface: 'glass-tint-caution'
  },
  critical: {
    dot: 'bg-critical',
    text: 'text-critical',
    value: 'text-critical',
    surface: 'glass-tint-critical'
  }
} as const;

const LABEL = {
  nominal: 'Normal',
  caution: 'Watch',
  critical: 'Critical'
} as const;

export const VitalCard: React.FC<VitalCardProps> = ({ label, tip, meta, value, unit, severity, range }) => {
  const tone = TONE[severity] ?? TONE.nominal;

  return (
    <div className={`flex h-full flex-col rounded-2xl p-5 lift ${tone.surface}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center text-[14px] font-medium text-ink-200">
            {label}
            {tip && <InfoTip text={tip} label={label} />}
          </p>
          <p className="mt-0.5 truncate text-[12px] text-ink-400">{meta}</p>
        </div>
        <span className={`flex shrink-0 items-center gap-1.5 rounded-full bg-space-950 px-2 py-0.5 text-[12px] font-medium ${tone.text}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${tone.dot}`} />
          {LABEL[severity] ?? 'Normal'}
        </span>
      </div>

      <div className="mt-5 flex items-baseline gap-1.5">
        <span className={`text-[34px] font-medium leading-none tracking-tight tabular-nums ${tone.value}`}>{value}</span>
        <span className="text-[13px] text-ink-400">{unit}</span>
      </div>

      <p className="mt-auto pt-3 text-[12px] text-ink-400">{range}</p>
    </div>
  );
};
