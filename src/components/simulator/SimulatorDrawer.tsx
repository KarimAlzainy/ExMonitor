import React, { useEffect } from 'react';
import { AlertOctagon, Activity, Flame, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { SimulationPreset } from '../../types/telemetry';
import { useTelemetry } from '../../context/TelemetryContext';

interface SimulatorDrawerProps {
  open: boolean;
  onClose: () => void;
}

const PRESETS: {
  id: SimulationPreset;
  label: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'normal', label: 'Normal Mode', detail: '72 BPM · 98% SpO2', icon: Activity },
  { id: 'workout', label: 'Workout / Stress Mode', detail: '135 BPM · 94% SpO2', icon: Flame },
  { id: 'emergency', label: 'Emergency Danger Mode', detail: '84% SpO2 · 2.45 mSv/hr', icon: AlertOctagon }
];

export const SimulatorDrawer: React.FC<SimulatorDrawerProps> = ({ open, onClose }) => {
  const {
    vitals,
    setManualVitals,
    setSimulationPreset,
    simulationPreset,
    isManualHold,
    ruleResult,
    triggerEmergencySOS
  } = useTelemetry();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <aside
      role="dialog"
      aria-label="Demo control panel"
      className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-sm flex-col border-l border-space-700 bg-space-950/95 shadow-2xl backdrop-blur-md"
    >
      <div className="flex items-center justify-between border-b border-space-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-nasa-cyan" />
          <div>
            <h2 className="font-mono text-sm text-slate-100">Demo control panel</h2>
            <p className="font-mono text-[10px] uppercase text-slate-400">
              {isManualHold ? 'Manual hold' : `Preset · ${simulationPreset}`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-slate-300 hover:bg-space-800"
          aria-label="Collapse demo controls"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="scrollbar-thin flex-1 space-y-4 overflow-y-auto p-4">
        <div
          className={`rounded-xl border px-3 py-2 font-mono text-[11px] ${
            ruleResult.statusColor === 'red'
              ? 'border-red-500/40 bg-red-500/10 text-red-200'
              : ruleResult.statusColor === 'yellow'
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
          }`}
        >
          {ruleResult.hazardTitle}
        </div>

        <div className="space-y-2">
          {PRESETS.map((preset) => {
            const Icon = preset.icon;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => setSimulationPreset(preset.id)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left ${
                  simulationPreset === preset.id && !isManualHold
                    ? 'border-nasa-cyan/50 bg-nasa-cyan/10'
                    : 'border-space-700 bg-space-900'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    preset.id === 'emergency' ? 'text-red-400' : preset.id === 'workout' ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                />
                <span>
                  <span className="block font-mono text-sm text-slate-100">{preset.label}</span>
                  <span className="block font-mono text-[11px] text-slate-400">{preset.detail}</span>
                </span>
              </button>
            );
          })}
        </div>

        {isManualHold && (
          <button
            type="button"
            onClick={() => setSimulationPreset('normal')}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-space-700 bg-space-900 py-2.5 font-mono text-xs text-slate-200 hover:border-nasa-cyan/40"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Resume live simulation
          </button>
        )}

        <Slider
          label="Heart rate"
          min={40}
          max={180}
          step={1}
          value={vitals.heartRate}
          unit="BPM"
          onChange={(value) => setManualVitals({ heartRate: value })}
        />
        <Slider
          label="SpO2"
          min={70}
          max={100}
          step={1}
          value={vitals.spO2}
          unit="%"
          onChange={(value) => setManualVitals({ spO2: value })}
        />
        <Slider
          label="Temperature"
          min={35}
          max={40}
          step={0.1}
          value={vitals.bodyTemp}
          unit="°C"
          onChange={(value) => setManualVitals({ bodyTemp: value })}
        />
        <Slider
          label="GSR"
          min={1}
          max={28}
          step={0.1}
          value={vitals.gsrStress}
          unit="µS"
          onChange={(value) => setManualVitals({ gsrStress: value })}
        />
        <Slider
          label="Radiation"
          min={0.01}
          max={5}
          step={0.01}
          value={vitals.radiationDoseRate}
          unit="mSv/hr"
          onChange={(value) => setManualVitals({ radiationDoseRate: value })}
        />

        <button
          type="button"
          onClick={() => triggerEmergencySOS()}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/50 bg-red-600/20 py-3 font-mono text-xs font-semibold uppercase tracking-wider text-red-200 hover:bg-red-600/30"
        >
          <AlertOctagon className="h-4 w-4" />
          Broadcast a test SOS
        </button>
        <p className="font-mono text-[10px] leading-relaxed text-slate-500">
          Sliders switch the panel into manual hold. Presets restore automatic simulation. Emergency values trip the
          NASA safety rules, the Klaxon, and the full-screen takeover.
        </p>
      </div>
    </aside>
  );
};

function Slider({
  label,
  min,
  max,
  step,
  value,
  unit,
  onChange
}: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  const shown = step < 1 ? value.toFixed(step < 0.1 ? 2 : 1) : Math.round(value).toString();
  return (
    <label className="block rounded-xl border border-space-800 bg-space-900 px-3 py-3">
      <div className="mb-2 flex items-center justify-between font-mono text-xs text-slate-300">
        <span>{label}</span>
        <span className="text-slate-100">
          {shown} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full"
      />
    </label>
  );
}
