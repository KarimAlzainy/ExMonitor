import React from 'react';
import { AlertOctagon, Droplets, HeartPulse, Thermometer, Zap } from 'lucide-react';
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

  const bannerTone =
    ruleResult.statusColor === 'red'
      ? 'border-red-500/50 bg-red-500/10 text-red-200'
      : ruleResult.statusColor === 'yellow'
        ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
        : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100';

  return (
    <div className="space-y-4">
      <EcgMonitor />

      <div className={`rounded-2xl border px-4 py-3 ${bannerTone}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-sm font-semibold tracking-wide">{ruleResult.hazardTitle}</p>
          <span className="font-mono text-[10px] uppercase tracking-wider text-slate-300">{ruleResult.nasaRef}</span>
        </div>
        <p className="mt-1 text-sm text-slate-200">{ruleResult.hazardDescription}</p>
        <p className="mt-2 font-mono text-xs text-slate-300">{ruleResult.recommendedAction}</p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <VitalCard
          title="Heart Rate"
          subtitle="Chest strap · Lead II"
          value={vitals.heartRate}
          unit="BPM"
          icon={HeartPulse}
          severity={hrSeverity(vitals.heartRate)}
          normalRange="60–100 BPM"
          progressPercent={(vitals.heartRate / 180) * 100}
          infoTip="MEDB 5.2"
        />
        <VitalCard
          title="SpO2"
          subtitle="Pulse oximetry"
          value={vitals.spO2}
          unit="%"
          icon={Droplets}
          severity={spo2Severity(vitals.spO2)}
          normalRange="95–100%"
          progressPercent={vitals.spO2}
          infoTip="Critical < 88%"
        />
        <VitalCard
          title="Core Temp"
          subtitle="Suit thermal loop"
          value={vitals.bodyTemp.toFixed(1)}
          unit="°C"
          icon={Thermometer}
          severity={tempSeverity(vitals.bodyTemp)}
          normalRange="36.5–37.5°C"
          progressPercent={((vitals.bodyTemp - 35) / 5) * 100}
          infoTip="LCVG coolant"
        />
        <VitalCard
          title="GSR Stress"
          subtitle="Autonomic load"
          value={vitals.gsrStress.toFixed(1)}
          unit="µS"
          icon={Zap}
          severity={gsrSeverity(vitals.gsrStress)}
          normalRange="2–8 µS"
          progressPercent={(vitals.gsrStress / 28) * 100}
          infoTip="Sympathetic"
        />
      </div>

      <RadiationHazardBadge />

      <button
        type="button"
        onClick={() => triggerEmergencySOS()}
        aria-label="Transmit crew emergency SOS over EXTEM-Mesh"
        className="flex w-full items-center justify-center gap-3 rounded-2xl border border-red-400/70 bg-red-600 px-6 py-5 font-mono text-lg font-bold tracking-[0.18em] text-white shadow-xl shadow-red-950/50 transition hover:bg-red-500 active:scale-[0.99]"
      >
        <AlertOctagon className="h-6 w-6" />
        TRANSMIT SOS
      </button>
      <p className="text-center font-mono text-[10px] text-slate-500">
        Crew-declared SOS · broadcasts over EXTEM-Mesh · raises the full-screen Klaxon takeover
      </p>
    </div>
  );
};
