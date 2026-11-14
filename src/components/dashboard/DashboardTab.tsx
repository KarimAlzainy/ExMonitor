import React from 'react';
import { AlertOctagon, Radio } from 'lucide-react';
import { AlertSeverity } from '../../types/telemetry';
import { useTelemetry } from '../../context/TelemetryContext';
import { EcgMonitor } from './EcgMonitor';
import { VitalCard } from './VitalCard';
import { RadiationHazardBadge } from './RadiationHazardBadge';
import { InfoTip } from '../ui/InfoTip';

function heartRateSeverity(heartRate: number): AlertSeverity {
  if (heartRate > 155 || heartRate < 42) return 'critical';
  if (heartRate > 125) return 'caution';
  return 'nominal';
}

function oxygenSeverity(spO2: number): AlertSeverity {
  if (spO2 < 88) return 'critical';
  if (spO2 < 93) return 'caution';
  return 'nominal';
}

function temperatureSeverity(bodyTemp: number): AlertSeverity {
  if (bodyTemp >= 38.8) return 'critical';
  if (bodyTemp >= 37.8) return 'caution';
  return 'nominal';
}

function stressSeverity(gsrStress: number): AlertSeverity {
  if (gsrStress >= 22) return 'critical';
  if (gsrStress >= 12) return 'caution';
  return 'nominal';
}

export const DashboardTab: React.FC = () => {
  const {
    vitals,
    ruleResult,
    triggerEmergencySOS,
    ownAlert,
    sensorStatus,
    sensorId
  } = useTelemetry();

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

  const alertActive = Boolean(ownAlert && ownAlert.status !== 'cancelled');
  const sensorNotice =
    sensorStatus === 'waiting'
      ? 'Waiting for the paired sensor. Practice readings are showing.'
      : sensorStatus === 'stale'
        ? 'The paired sensor stopped sending. Practice readings have taken over.'
        : null;

  return (
    <div className="space-y-6">
      {sensorNotice && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-caution/25 bg-caution/[0.04] px-4 py-3">
          <p className="flex items-center gap-2 text-[12px] leading-5 text-ink-200">
            <Radio className="h-4 w-4 shrink-0 text-caution" strokeWidth={1.6} />
            {sensorNotice}
            {sensorId && <span className="font-mono text-[10.5px] text-ink-500">{sensorId}</span>}
          </p>
          <a
            href="sensors.html"
            target="_blank"
            rel="noreferrer"
            className="text-[11px] font-medium text-signal-strong hover:text-ink-100"
          >
            Open the sensor page
          </a>
        </div>
      )}

      <EcgMonitor />

      <section className={`rounded-xl border p-5 ${statusTone.border} ${statusTone.surface}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-medium text-ink-100">
            <span className={`h-2 w-2 rounded-full ${statusTone.dot}`} />
            <span className={statusTone.title}>{ruleResult.hazardTitle}</span>
          </p>
          <span className="flex items-center gap-1 font-mono text-[11px] text-ink-500">
            {ruleResult.nasaRef}
            <InfoTip text="The NASA reference or flight rule behind this status." label="NASA reference" />
          </span>
        </div>
        <p className="mt-3 max-w-3xl text-[13px] leading-5 text-ink-300">{ruleResult.hazardDescription}</p>
        <p className="mt-2 max-w-3xl text-[13px] leading-5 text-ink-200">{ruleResult.recommendedAction}</p>
        {vitals.source === 'builtin' && (
          <p className="mt-2 text-[11px] text-ink-500">These are practice readings, not a real body sensor.</p>
        )}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <VitalCard
            label="Heart rate"
            tip="How many times the heart beats each minute. A resting adult usually sits between 60 and 100."
            meta="Heart sensor"
            value={vitals.heartRate}
            unit="BPM"
            severity={heartRateSeverity(vitals.heartRate)}
            range="Usual 60–100 BPM"
          />
          <VitalCard
            label="Blood oxygen"
            tip="The share of oxygen carried in the blood, measured as SpO2. Below 93 percent is a warning sign; below 88 is critical."
            meta="Oxygen sensor"
            value={vitals.spO2}
            unit="%"
            severity={oxygenSeverity(vitals.spO2)}
            range="Usual 95–100% · critical below 88%"
          />
          <VitalCard
            label="Body temperature"
            tip="The temperature inside the body. A fever or overheating shows up here before the crew feels it."
            meta="Body sensor"
            value={vitals.bodyTemp.toFixed(1)}
            unit="°C"
            severity={temperatureSeverity(vitals.bodyTemp)}
            range="Usual 36.5–37.5°C"
          />
          <VitalCard
            label="Stress signal"
            tip="Skin conductance (also called GSR) rises when the body sweats under stress. It is a hint, not a diagnosis."
            meta="Skin response"
            value={vitals.gsrStress.toFixed(1)}
            unit="µS"
            severity={stressSeverity(vitals.gsrStress)}
            range="Usual 2–8 µS"
          />
        </div>

        <RadiationHazardBadge />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-critical/30 bg-space-900 p-4">
        <div className="flex items-start gap-3">
          <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-critical" strokeWidth={1.5} />
          <div>
            <p className="text-[13px] font-medium text-ink-100">
              {alertActive ? 'Your crew alert is active' : 'Send a crew alert'}
            </p>
            <p className="mt-0.5 max-w-xl text-[11px] leading-5 text-ink-500">
              {alertActive
                ? 'The sender panel below shows the alert. Cancel it there to clear it on every crew screen.'
                : 'Every device on the crew link shows a full-screen alert until that crew member acknowledges it, or you cancel it from the sender panel.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-[11px] text-ink-500 sm:inline">Crew-declared emergency</span>
          <button
            type="button"
            onClick={() => triggerEmergencySOS()}
            disabled={alertActive}
            aria-label="Send a crew emergency alert"
            className="h-9 rounded-lg border border-critical/40 bg-critical/[0.08] px-3 text-[12px] font-medium text-critical transition-colors hover:bg-critical/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {alertActive ? 'Alert active' : 'Send alert'}
          </button>
        </div>
      </div>

      <p className="text-[11px] leading-5 text-ink-500">
        The console watches the NASA hazards of spaceflight: radiation, isolation, distance from Earth, gravity
        changes and a closed environment.
      </p>
    </div>
  );
};
