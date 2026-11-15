import React, { useEffect } from 'react';
import { AlertOctagon, Bell } from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';

/**
 * The receiver-style full-screen alert, shown during the demo only. This is
 * what the rest of the crew would see. It never touches the crew link: the
 * Acknowledge button only closes this local panel.
 */
export const DemoAlertOverlay: React.FC = () => {
  const { demoOverlay, dismissDemoOverlay, demo, soundMuted } = useTelemetry();

  useEffect(() => {
    if (!demoOverlay) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [demoOverlay]);

  useEffect(() => {
    // Closing the demo always closes its overlay.
    if (demoOverlay && !demo.running) dismissDemoOverlay();
  }, [demo.running, demoOverlay, dismissDemoOverlay]);

  if (!demoOverlay) return null;

  return (
    <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm sm:p-4">
      <section
        role="alertdialog"
        aria-modal="true"
        aria-live="assertive"
        aria-label={`Demo alert: ${demoOverlay.title}`}
        className="relative max-h-[94dvh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-critical/35 bg-space-900/95 shadow-2xl"
      >
        <div className="h-0.5 w-full bg-critical" aria-hidden="true" />

        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-critical">
              <AlertOctagon className="h-3.5 w-3.5" strokeWidth={1.7} />
              Demo · this is the alert other crew screens would show
            </p>
            <p className="text-[12px] text-ink-400">
              {soundMuted ? 'Alarm muted' : 'Alarm on'} · step “{demoOverlay.stepLabel}”
            </p>
          </div>

          <h2 className="mt-5 text-xl font-medium leading-6 text-ink-100">{demoOverlay.title}</h2>
          <p className="mt-1.5 text-[14px] leading-5 text-ink-300">{demoOverlay.description}</p>
          {demoOverlay.protocol && (
            <p className="mt-2 font-mono text-[11.5px] text-ink-500">{demoOverlay.protocol}</p>
          )}

          <button
            type="button"
            onClick={dismissDemoOverlay}
            className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-chalk text-[14px] font-medium text-space-950 transition-colors hover:brightness-105 active:brightness-95"
          >
            <Bell className="h-4 w-4" strokeWidth={1.7} />
            Acknowledge
          </button>
          <p className="mt-2 text-center text-[12px] leading-5 text-ink-500">
            This closes the demo alert on this screen. The demo keeps running behind it.
          </p>
        </div>
      </section>
    </div>
  );
};
