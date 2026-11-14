import React, { useEffect } from 'react';
import { AlertOctagon, Bell, Radio } from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';

export const EmergencyOverlay: React.FC = () => {
  const {
    incomingEmergency,
    incomingCount,
    acknowledgeEmergency,
    soundMuted,
    crewLinkMode
  } = useTelemetry();

  useEffect(() => {
    if (!incomingEmergency) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [incomingEmergency]);

  if (!incomingEmergency) return null;

  const event = incomingEmergency;
  const vitals = event.triggerVitals;
  const clock = new Date(event.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-3 sm:p-4">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-live="assertive"
        aria-label={`Emergency alert from ${event.astronautName}`}
        className="relative max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-xl border border-critical/35 bg-space-900"
      >
        <div className="h-0.5 w-full bg-critical" aria-hidden="true" />

        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[11px] font-medium text-critical">
              <Radio className="h-3.5 w-3.5" strokeWidth={1.6} />
              Crew emergency from {event.astronautName}
            </p>
            <p className="text-[11px] text-ink-400">
              {soundMuted ? 'Alarm muted' : 'Alarm on'} · {clock}
              {incomingCount > 1 ? ` · ${incomingCount} alerts waiting` : ''}
            </p>
          </div>

          <div className="mt-4 flex items-start gap-3">
            <AlertOctagon className="mt-0.5 h-5 w-5 shrink-0 text-critical" strokeWidth={1.6} />
            <div>
              <h2 className="text-xl font-medium leading-6 text-ink-100">{event.astronautName}</h2>
              <p className="mt-1 text-[12px] leading-5 text-ink-400">
                {event.astronautLabel} · sent {clock}
              </p>
            </div>
          </div>

          <h3 className="mt-5 text-[15px] font-medium text-ink-100">{event.title}</h3>
          <p className="mt-1.5 text-[13px] leading-5 text-ink-300">{event.description}</p>
          {event.activeProtocol && (
            <p className="mt-2 font-mono text-[10.5px] text-ink-500">{event.activeProtocol}</p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.06] sm:grid-cols-3">
            <Vital label="Heart rate" value={`${vitals.heartRate} BPM`} />
            <Vital label="Blood oxygen" value={`${vitals.spO2}%`} />
            <Vital label="Body temperature" value={`${vitals.bodyTemp.toFixed(1)}°C`} />
            <Vital label="Stress signal" value={`${vitals.gsrStress.toFixed(1)} µS`} />
            <Vital label="Radiation dose" value={`${vitals.radiationDoseRate.toFixed(2)} mSv/hr`} />
            <Vital label="Total dose" value={`${vitals.cumulativeRadiation.toFixed(2)} mSv`} />
          </div>

          <p className="mt-3 font-mono text-[10px] text-ink-500">
            {event.id} · from {event.sourceNodeId}
          </p>

          <button
            type="button"
            onClick={() => acknowledgeEmergency(event.id)}
            className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-ink-100 text-[13px] font-medium text-space-950 transition-colors hover:bg-white active:bg-ink-200"
          >
            <Bell className="h-4 w-4" strokeWidth={1.7} />
            Acknowledge on this device
          </button>
          <p className="mt-2 text-center text-[11px] leading-5 text-ink-500">
            This clears the alert here and tells the sender. Other crew devices keep it until they acknowledge it
            too, or the sender cancels it.
          </p>
          <p className="mt-1 text-center text-[10.5px] leading-5 text-ink-500">
            Crew link: {crewLinkMode === 'relay' ? 'relay connected' : crewLinkMode === 'local' ? 'this browser only' : 'offline'}
          </p>
        </div>
      </section>
    </div>
  );
};

function Vital({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-space-950 px-3 py-2.5">
      <p className="text-[10.5px] text-ink-500">{label}</p>
      <p className="mt-0.5 text-[13px] font-medium tabular-nums text-ink-100">{value}</p>
    </div>
  );
}
