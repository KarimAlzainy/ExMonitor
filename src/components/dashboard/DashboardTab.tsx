import React from 'react';
import { AlertOctagon } from 'lucide-react';
import { AlertSeverity } from '../../types/telemetry';
import { useTelemetry } from '../../context/TelemetryContext';
import { EcgMonitor } from './EcgMonitor';
import { VitalCard } from './VitalCard';
import { RadiationHazardBadge } from './RadiationHazardBadge';

function hrSeverity(heartRate: number): AlertSeverity {
  if (heartRate > 155 || heartRate < 42) return 'critical';
  if (heartRate > 125) return 'caution';
  return 'nominal';
}

function spo2Severity(spO2: number): AlertSeverity {
  if (spO2 < 88) return 'critical';
  if (spO2 < 93) return 'caution';
  return 'nominal';
}

function tempSeverity(bodyTemp: number): AlertSeverity {
  if (bodyTemp >= 38.8) return 'critical';
  if (bodyTemp >= 37.8) return 'caution';
  return 'nominal';
}

function gsrSeverity(gsrStress: number): AlertSeverity {
  if (gsrStress >= 22) return 'critical';
  if (gsrStress >= 12) return 'caution';
  return 'nominal';
}

export const DashboardTab: React.FC = () => {
  const { vitals, ruleResult, triggerEmergencySOS } = useTelemetry();

  const statusTone =
    ruleResult.statusColor === 'red'
      ? {
          dot: 'bg-critical',
          title: 'text-critical',
          border: 'border-critical/30',
          surface: 'bg-critical/[0.04]'
        }
      : ruleResult.statusColor === 'yellow'
        ? {
            dot: 'bg-caution',
            title: 'text-caution',
            border: 'border-caution/30',
            surface: 'bg-caution/[0.04]'
          }
        : {
            dot: 'bg-positive',
            title: 'text-ink-100',
            border: 'border-white/[0.08]',
            surface: 'bg-space-900'
          };

  return (
    <div className="space-y-6">
      <EcgMonitor />

      <section className={`rounded-xl border p-5 ${statusTone.border} ${statusTone.surface}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-medium text-ink-100">
            <span className={`h-2 w-2 rounded-full ${statusTone.dot}`} />
            <span className={statusTone.title}>{ruleResult.hazardTitle}</span>
          </p>
          <span className="font-mono text-[11px] text-ink-500">{ruleResult.nasaRef}</span>
        </div>
        <p className="mt-3 max-w-3xl text-[13px] leading-5 text-ink-300">{ruleResult.hazardDescription}</p>
        <p className="mt-2 max-w-3xl text-[13px] leading-5 text-ink-200">{ruleResult.recommendedAction}</p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <VitalCard
            label="Heart rate"
            meta="Chest strap · Lead II"
            value={vitals.heartRate}
            unit="BPM"
            severity={hrSeverity(vitals.heartRate)}
            range="Target 60–100 BPM"
          />
          <VitalCard
            label="Blood oxygen"
            meta="Pulse oximetry"
            value={vitals.spO2}
            unit="%"
            severity={spo2Severity(vitals.spO2)}
            range="Target 95–100% · critical below 88%"
          />
          <VitalCard
            label="Core temperature"
            meta="Suit thermal loop"
            value={vitals.bodyTemp.toFixed(1)}
            unit="°C"
            severity={tempSeverity(vitals.bodyTemp)}
            range="Target 36.5–37.5°C"
          />
          <VitalCard
            label="GSR stress"
            meta="Autonomic load"
            value={vitals.gsrStress.toFixed(1)}
            unit="µS"
            severity={gsrSeverity(vitals.gsrStress)}
            range="Target 2–8 µS"
          />
        </div>

        <RadiationHazardBadge />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-critical/30 bg-space-900 p-4">
        <div className="flex items-start gap-3">
          <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-critical" strokeWidth={1.5} />
          <div>
            <p className="text-[13px] font-medium text-ink-100">Transmit crew SOS</p>
            <p className="mt-0.5 text-[11px] leading-5 text-ink-500">
              Broadcasts to EXTEM-Mesh and opens the Klaxon takeover.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-[11px] text-ink-500 sm:inline">Crew-declared emergency</span>
          <button
            type="button"
            onClick={() => triggerEmergencySOS()}
            aria-label="Transmit crew emergency SOS over EXTEM-Mesh"
            className="h-9 rounded-lg border border-critical/40 bg-critical/[0.08] px-3 text-[12px] font-medium text-critical transition-colors hover:bg-critical/15"
          >
            Transmit SOS
          </button>
        </div>
      </div>

      <p className="text-[11px] leading-5 text-ink-500">
        NASA hazard coverage: space radiation · isolation · distance from Earth · gravity fields · hostile closed
        environment
      </p>
    </div>
  );
};
