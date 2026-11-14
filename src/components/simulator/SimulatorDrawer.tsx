import React, { useEffect } from 'react';
import { AlertOctagon, Activity, Flame, LucideIcon, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
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
  icon: LucideIcon;
}[] = [
  { id: 'normal', label: 'Normal mode', detail: '72 BPM · 98% SpO2', icon: Activity },
  { id: 'workout', label: 'Workout / stress mode', detail: '135 BPM · 94% SpO2', icon: Flame },
  { id: 'emergency', label: 'Emergency danger mode', detail: '84% SpO2 · 2.45 mSv/hr', icon: AlertOctagon }
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

  const statusTone =
    ruleResult.statusColor === 'red'
      ? { dot: 'bg-critical', border: 'border-critical/30', text: 'text-critical' }
      : ruleResult.statusColor === 'yellow'
        ? { dot: 'bg-caution', border: 'border-caution/30', text: 'text-caution' }
        : { dot: 'bg-positive', border: 'border-white/[0.08]', text: 'text-ink-200' };

  return (
    <aside
      role="dialog"
      aria-label="Demo controls"
      className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-sm flex-col border-l border-white/[0.08] bg-space-950"
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.08] px-4 py-4">
        <div className="flex items-start gap-2.5">
          <SlidersHorizontal className="mt-0.5 h-4 w-4 text-ink-500" strokeWidth={1.5} />
          <div>
            <h2 className="text-[15px] font-medium text-ink-100">Demo controls</h2>
            <p className="mt-0.5 text-[11px] text-ink-500">
              {isManualHold ? 'Manual hold' : `Preset · ${simulationPreset}`}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-space-850 hover:text-ink-100"
          aria-label="Close demo controls"
        >
          <X className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      <div className="scrollbar-thin flex-1 space-y-5 overflow-y-auto p-4">
        <div className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-[12px] ${statusTone.border} ${statusTone.text}`}>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusTone.dot}`} />
          <span>{ruleResult.hazardTitle}</span>
        </div>

        <div>
          <p className="mb-2 text-[11px] text-ink-500">Simulation preset</p>
          <div className="space-y-2">
            {PRESETS.map((preset) => {
              const Icon = preset.icon;
              const selected = simulationPreset === preset.id && !isManualHold;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setSimulationPreset(preset.id)}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    selected ? 'border-signal/50 bg-signal/[0.06]' : 'border-white/[0.08] bg-space-900 hover:border-white/15'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      preset.id === 'emergency'
                        ? 'text-critical'
                        : preset.id === 'workout'
                          ? 'text-caution'
                          : 'text-ink-400'
                    }`}
                    strokeWidth={1.5}
                  />
                  <span>
                    <span className="block text-[13px] text-ink-100">{preset.label}</span>
                    <span className="block text-[11px] text-ink-500">{preset.detail}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {isManualHold && (
          <button
            type="button"
            onClick={() => setSimulationPreset('normal')}
            className="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-space-900 text-[12px] font-medium text-ink-200 transition-colors hover:border-white/15 hover:bg-space-850"
          >
            <RotateCcw className="h-4 w-4" strokeWidth={1.5} />
            Resume live simulation
          </button>
        )}

        <div className="space-y-4 border-t border-white/[0.06] pt-4">
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
        </div>

        <div className="border-t border-white/[0.06] pt-4">
          <button
            type="button"
            onClick={() => triggerEmergencySOS()}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-critical/30 bg-critical/[0.06] text-[12px] font-medium text-critical transition-colors hover:bg-critical/10"
          >
            <AlertOctagon className="h-4 w-4" strokeWidth={1.5} />
            Broadcast a test SOS
          </button>
          <p className="mt-2 text-[11px] leading-5 text-ink-500">
            Sliders switch the panel into manual hold. Presets restore automatic simulation. Emergency values trip the
            NASA safety rules, the Klaxon, and the full-screen takeover.
          </p>
        </div>
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
  const percent = Math.round(((value - min) / (max - min)) * 100);
  return (
    <label className="block">
      <span className="flex items-baseline justify-between gap-2 text-[12px] text-ink-300">
        <span>{label}</span>
        <span className="font-mono tabular-nums text-ink-100">
          {shown} {unit}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="mt-2 w-full"
        aria-label={label}
        style={{
          background: `linear-gradient(to right, #7aa7c7 ${percent}%, #262b33 ${percent}%) center / 100% 4px no-repeat`
        }}
      />
      <span className="mt-0.5 flex justify-between font-mono text-[10px] text-ink-500">
        <span>{min}</span>
        <span>
          {max} {unit}
        </span>
      </span>
    </label>
  );
}
