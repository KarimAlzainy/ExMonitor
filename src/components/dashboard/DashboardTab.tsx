import React from 'react';
import { AlertOctagon, Play, Radio, Square } from 'lucide-react';
import { AlertSeverity } from '../../types/telemetry';
import { useTelemetry } from '../../context/TelemetryContext';
import { THRESHOLDS } from '../../services/safetyRules';
import { SCENARIO_LABELS } from '../../sensors/sensorEngine';
import { EcgMonitor } from './EcgMonitor';
import { VitalCard } from './VitalCard';
import { RadiationHazardBadge } from './RadiationHazardBadge';
import { InfoTip } from '../ui/InfoTip';

function heartRateSeverity(heartRate: number): AlertSeverity {
  if (heartRate > THRESHOLDS.heartRate.high || heartRate < THRESHOLDS.heartRate.low) return 'critical';
  if (heartRate > THRESHOLDS.heartRate.cautionHigh) return 'caution';
  return 'nominal';
}

function oxygenSeverity(spO2: number): AlertSeverity {
  if (spO2 < THRESHOLDS.spO2.critical) return 'critical';
  if (spO2 < THRESHOLDS.spO2.caution) return 'caution';
  return 'nominal';
}

function temperatureSeverity(bodyTemp: number): AlertSeverity {
  if (bodyTemp >= THRESHOLDS.bodyTemp.critical) return 'critical';
  if (bodyTemp >= THRESHOLDS.bodyTemp.caution) return 'caution';
  return 'nominal';
}

function stressSeverity(gsrStress: number): AlertSeverity {
  if (gsrStress >= THRESHOLDS.gsrStress.critical) return 'critical';
  if (gsrStress >= THRESHOLDS.gsrStress.caution) return 'caution';
  return 'nominal';
}

export const DashboardTab: React.FC = () => {
  const {
    vitals,
    ruleResult,
    triggerEmergencySOS,
    ownAlert,
    sensorStatus,
    sensorId,
    demoActive,
    demoScenario,
    startDemo,
    stopDemo
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
      {demoActive ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-signal/30 bg-signal/[0.06] px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="mt-1.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-signal" />
            <div>
              <p className="text-[13px] font-medium text-ink-100">
                Demo running · {demoScenario ? SCENARIO_LABELS[demoScenario].name : 'starting'}
              </p>
              <p className="mt-0.5 text-[12px] leading-5 text-ink-400">
                {demoScenario
                  ? `${SCENARIO_LABELS[demoScenario].note} The console will raise the crew alert during the low-oxygen phase.`
                  : 'Starting the built-in sensor.'}{' '}
                No second device or network needed.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={stopDemo}
            className="flex h-10 items-center gap-2 rounded-lg border border-white/[0.1] bg-space-900 px-3 text-[13px] font-medium text-ink-200 transition-colors hover:border-white/20 hover:text-ink-100"
          >
            <Square className="h-3.5 w-3.5" strokeWidth={2} />
            Stop demo
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.08] bg-space-900 px-4 py-3">
          <div>
            <p className="text-[13px] font-medium text-ink-100">See it work in one tap</p>
            <p className="mt-0.5 max-w-xl text-[12px] leading-5 text-ink-400">
              Runs a sensor inside this console and cycles rest, exercise, low oxygen, radiation storm and recovery.
              It needs no second device, no camera and no network.
            </p>
          </div>
          <button
            type="button"
            onClick={startDemo}
            className="flex h-10 items-center gap-2 rounded-lg bg-chalk px-4 text-[13px] font-medium text-space-950 transition-colors hover:brightness-105"
          >
            <Play className="h-3.5 w-3.5" strokeWidth={2} />
            Start Demo
          </button>
        </div>
      )}

      {!demoActive && sensorNotice && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-caution/25 bg-caution/[0.04] px-4 py-3">
          <p className="flex items-center gap-2 text-[13px] leading-5 text-ink-200">
            <Radio className="h-4 w-4 shrink-0 text-caution" strokeWidth={1.6} />
            {sensorNotice}
            {sensorId && <span className="font-mono text-[11.5px] text-ink-500">{sensorId}</span>}
          </p>
          <a
            href="sensors.html"
            target="_blank"
            rel="noreferrer"
            className="text-[13px] font-medium text-signal-strong hover:text-ink-100"
          >
            Open the sensor page
          </a>
        </div>
      )}

      <EcgMonitor />

      <section className={`rounded-xl border p-5 ${statusTone.border} ${statusTone.surface}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-[16px] font-medium text-ink-100">
            <span className={`h-2 w-2 rounded-full ${statusTone.dot}`} />
            <span className={statusTone.title}>{ruleResult.hazardTitle}</span>
          </p>
          <span className="flex items-center gap-1 font-mono text-[12px] text-ink-400">
            {ruleResult.guidanceRef}
            <InfoTip
              text="The written rule behind this status. The rules use teaching values for a training simulation, not real flight rules."
              label="Rule"
            />
          </span>
        </div>
        <p className="mt-3 max-w-3xl text-[14px] leading-6 text-ink-300">{ruleResult.hazardDescription}</p>
        <div className="mt-3 max-w-3xl border-l-2 border-chalk/40 pl-3">
          <p className="text-[12px] font-medium text-ink-400">What to do</p>
          <p className="mt-1 text-[14px] leading-6 text-ink-100">{ruleResult.recommendedAction}</p>
        </div>
        {vitals.source === 'builtin' && (
          <p className="mt-3 text-[12px] text-ink-400">These are practice readings, not a real body sensor.</p>
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

      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-critical/30 bg-critical/[0.04] p-4 sm:p-5">
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
        The console watches five hazards of spaceflight: radiation, isolation, distance from Earth, gravity changes
        and a closed environment. All readings are simulated.
      </p>
    </div>
  );
};
