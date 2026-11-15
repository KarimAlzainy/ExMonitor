import { AlertSeverity } from '../types/telemetry';

// One place for the thresholds the dashboard cards, the radiation card and the
// sensor page all use. The clinical rules in nasaRules.ts stay authoritative for
// the overall status; these helpers only decide the colour of one reading.

export function heartRateSeverity(heartRate: number): AlertSeverity {
  if (heartRate > 155 || heartRate < 42) return 'critical';
  if (heartRate > 125) return 'caution';
  return 'nominal';
}

export function oxygenSeverity(spO2: number): AlertSeverity {
  if (spO2 < 88) return 'critical';
  if (spO2 < 93) return 'caution';
  return 'nominal';
}

export function temperatureSeverity(bodyTemp: number): AlertSeverity {
  if (bodyTemp >= 38.8) return 'critical';
  if (bodyTemp >= 37.8) return 'caution';
  return 'nominal';
}

export function stressSeverity(gsrStress: number): AlertSeverity {
  if (gsrStress >= 22) return 'critical';
  if (gsrStress >= 12) return 'caution';
  return 'nominal';
}

export function radiationSeverity(doseRate: number): AlertSeverity {
  if (doseRate >= 1.0) return 'critical';
  if (doseRate >= 0.3) return 'caution';
  return 'nominal';
}

export interface SeverityTone {
  text: string;
  dot: string;
  border: string;
  label: string;
}

const NOMINAL: SeverityTone = {
  text: 'text-ink-100',
  dot: 'bg-positive',
  border: 'border-white/[0.09]',
  label: 'Normal'
};

const CAUTION: SeverityTone = {
  text: 'text-caution',
  dot: 'bg-caution',
  border: 'border-caution/35',
  label: 'Watch'
};

const CRITICAL: SeverityTone = {
  text: 'text-critical',
  dot: 'bg-critical',
  border: 'border-critical/45',
  label: 'Critical'
};

export function severityTone(severity: AlertSeverity): SeverityTone {
  if (severity === 'critical') return CRITICAL;
  if (severity === 'caution') return CAUTION;
  return NOMINAL;
}