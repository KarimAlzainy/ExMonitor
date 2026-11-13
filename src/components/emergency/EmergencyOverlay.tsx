import React, { useEffect } from 'react';
import { AlertOctagon, Radio } from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';

export const EmergencyOverlay: React.FC = () => {
  const { activeEmergency, acknowledgeEmergency, nodeId, soundMuted } = useTelemetry();

  useEffect(() => {
    if (!activeEmergency) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [activeEmergency]);

  if (!activeEmergency) return null;

  const ownAlert = activeEmergency.sourceNodeId === nodeId;
  const vitals = activeEmergency.triggerVitals;
  const clock = new Date(activeEmergency.timestamp).toLocaleTimeString();

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div className="absolute inset-0 animate-strobe bg-red-700" aria-hidden="true" />
      <section
        role="alertdialog"
        aria-modal="true"
        aria-live="assertive"
        aria-label={`${activeEmergency.astronautName} emergency`}
        className="relative max-h-[92dvh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-red-300/50 bg-space-950/95 p-5 shadow-2xl shadow-red-950/60 sm:p-7"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-red-300">
            {ownAlert ? 'SOS transmitted on EXTEM-Mesh' : 'Incoming EXTEM-Mesh SOS'}
          </p>
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-red-200/80">
            <Radio className="h-3 w-3" />
            {soundMuted ? 'Klaxon muted' : 'Klaxon active'}
          </p>
        </div>

        <div className="mt-3 flex items-start gap-3">
          <AlertOctagon className="mt-1 h-9 w-9 shrink-0 animate-pulse text-red-400" />
          <div>
            <h2 className="font-mono text-2xl font-bold text-white">{activeEmergency.astronautName}</h2>
            <p className="font-mono text-sm text-red-200">
              {activeEmergency.astronautRole} · {clock}
            </p>
          </div>
        </div>

        <h3 className="mt-5 font-mono text-lg font-semibold text-red-300">{activeEmergency.title}</h3>
        <p className="mt-2 text-sm text-slate-200">{activeEmergency.description}</p>
        <p className="mt-2 font-mono text-[11px] uppercase text-slate-400">{activeEmergency.activeProtocol}</p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Vital label="Heart rate" value={`${vitals.heartRate} BPM`} />
          <Vital label="SpO2" value={`${vitals.spO2}%`} />
          <Vital label="Core temp" value={`${vitals.bodyTemp.toFixed(1)}°C`} />
          <Vital label="GSR stress" value={`${vitals.gsrStress.toFixed(1)} µS`} />
          <Vital label="Dose rate" value={`${vitals.radiationDoseRate.toFixed(2)} mSv/hr`} />
          <Vital label="Mission dose" value={`${vitals.cumulativeRadiation.toFixed(2)} mSv`} />
        </div>

        <p className="mt-3 font-mono text-[10px] text-slate-500">
          {activeEmergency.id} · source {activeEmergency.sourceNodeId}
        </p>

        <button
          type="button"
          onClick={acknowledgeEmergency}
          className="mt-5 w-full rounded-2xl bg-white py-4 font-mono text-sm font-bold tracking-wide text-red-700 transition hover:bg-red-50 active:scale-[0.99]"
        >
          Acknowledge / Dispatch Assistance
        </button>
        <p className="mt-2 text-center font-mono text-[10px] text-slate-500">
          Acknowledges locally and broadcasts the acknowledgement to all EXTEM-Mesh peers.
        </p>
      </section>
    </div>
  );
};

function Vital({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2">
      <p className="font-mono text-[10px] uppercase text-red-200/80">{label}</p>
      <p className="font-mono text-sm font-semibold text-white">{value}</p>
    </div>
  );
}
