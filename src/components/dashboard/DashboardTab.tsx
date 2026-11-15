import React from 'react';
import { AlertOctagon, Radio } from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import { EcgMonitor } from './EcgMonitor';
import { VitalCard } from './VitalCard';
import { RadiationHazardBadge } from './RadiationHazardBadge';
import { DemoPanel } from './DemoPanel';
import { InfoTip } from '../ui/InfoTip';
import {
  heartRateSeverity,
  oxygenSeverity,
  stressSeverity,
  temperatureSeverity
} from '../../services/severity';

export const DashboardTab: React.FC = () => {
  const {
    vitals,
    ruleResult,
    triggerEmergencySOS,
    ownAlert,
    sensorId,
    adoptedSensorId
  } = useTelemetry();

  const statusTone =
    ruleResult.statusColor === 'red'
      ? {
          dot: 'bg-critical',
          title: 'text-critical'
        }
      : ruleResult.statusColor === 'yellow'
        ? {
            dot: 'bg-caution',
            title: 'text-caution'
          }
        : {
            dot: 'bg-positive',
            title: 'text-ink-100'
          };

  const alertActive = Boolean(ownAlert && ownAlert.status !== 'cancelled');

  return (
    <div className="space-y-6">
      <DemoPanel />

      {adoptedSensorId && adoptedSensorId === sensorId && (
        <div className="glass flex flex-wrap items-center justify-between gap-3 rounded-2xl border-signal/30 px-4 py-3">
          <p className="flex items-center gap-2 text-[13px] leading-5 text-ink-200">
            <Radio className="h-4 w-4 shrink-0 text-signal-strong" strokeWidth={1.6} />
            A sensor announced itself, so this console paired with it automatically.
            <span className="font-mono text-[11.5px] text-ink-500">{adoptedSensorId}</span>
          </p>
          <a
            href="#settings"
            onClick={(event) => event.preventDefault()}
            className="text-[13px] font-medium text-signal-strong hover:text-ink-100"
          >
            Manage in Settings
          </a>
        </div>
      )}

      <section className={`glass-tint-${ruleResult.statusColor === 'red' ? 'critical' : ruleResult.statusColor === 'yellow' ? 'caution' : 'none'} rounded-2xl p-5 sm:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2.5 text-[20px] font-medium leading-6 text-ink-100">
            <span className={`h-2.5 w-2.5 rounded-full ${statusTone.dot}`} />
            <span className={statusTone.title}>{ruleResult.hazardTitle}</span>
          </p>
          <span className="flex items-center gap-1 font-mono text-[12px] text-ink-400">
            {ruleResult.nasaRef}
            <InfoTip text="The NASA reference or flight rule behind this status." label="NASA reference" />
          </span>
        </div>
        <p className="mt-3 max-w-3xl text-[15px] leading-6 text-ink-300">{ruleResult.hazardDescription}</p>
        <div className="mt-4 max-w-3xl rounded-lg bg-chalk px-4 py-3.5">
          <p className="text-[12px] font-medium text-space-600">What to do now</p>
          <p className="mt-1 text-[15px] font-medium leading-6 text-space-950">{ruleResult.recommendedAction}</p>
        </div>
        {vitals.source === 'builtin' && (
          <p className="mt-3 text-[12px] text-ink-400">These are practice readings, not a real body sensor.</p>
        )}
      </section>

      <EcgMonitor />

      <section className="glass space-y-4 rounded-2xl p-5 sm:p-6">
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
      </section>

      <div className="glass-tint-critical flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-critical" strokeWidth={1.5} />
          <div>
            <p className="text-[15px] font-medium text-ink-100">
              {alertActive ? 'Your crew alert is active' : 'Send a crew alert'}
            </p>
            <p className="mt-1 max-w-xl text-[12px] leading-5 text-ink-400">
              {alertActive
                ? 'The sender panel below shows the alert. Cancel it there to clear it on every crew screen.'
                : 'Every device on the crew link shows a full-screen alert until that crew member acknowledges it, or you cancel it from the sender panel.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden text-[12px] text-ink-400 sm:inline">Crew-declared emergency</span>
          <button
            type="button"
            onClick={() => triggerEmergencySOS()}
            disabled={alertActive}
            aria-label="Send a crew emergency alert"
            className="h-11 rounded-lg border border-critical/40 bg-critical/[0.08] px-4 text-[14px] font-medium text-critical transition-colors hover:bg-critical/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {alertActive ? 'Alert active' : 'Send alert'}
          </button>
        </div>
      </div>

      <p className="text-[12px] leading-5 text-ink-400">
        The console watches the NASA hazards of spaceflight: radiation, isolation, distance from Earth, gravity
        changes and a closed environment.
      </p>
    </div>
  );
};
