import React from 'react';
import { AlertOctagon, Check, Loader2, Radio, X } from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

export const SenderAlertPanel: React.FC = () => {
  const { ownAlert, cancelOwnAlert, dismissOwnAlert } = useTelemetry();
  if (!ownAlert) return null;

  const { event, status, acknowledgedBy } = ownAlert;
  const cancelled = status === 'cancelled';

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-3 z-[70] flex justify-end sm:inset-x-auto sm:right-5 sm:bottom-5">
      <section
        role="status"
        aria-live="polite"
        className={`pointer-events-auto w-full max-w-sm overflow-hidden rounded-xl border bg-space-900 shadow-2xl ${
          cancelled ? 'border-white/[0.12]' : 'border-critical/35'
        }`}
      >
        <div className={`h-0.5 w-full ${cancelled ? 'bg-ink-500' : 'bg-critical'}`} aria-hidden="true" />
        <div className="p-4">
          <div className="flex items-start gap-3">
            <span
              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${
                cancelled
                  ? 'border-white/[0.08] bg-space-850 text-ink-400'
                  : 'border-critical/30 bg-critical/[0.08] text-critical'
              }`}
            >
              {status === 'sending' ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.8} />
              ) : cancelled ? (
                <X className="h-4 w-4" strokeWidth={1.8} />
              ) : (
                <Check className="h-4 w-4" strokeWidth={1.8} />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-ink-100">
                {status === 'sending'
                  ? 'Sending your alert to the crew'
                  : cancelled
                    ? 'Alert cancelled for everyone'
                    : 'Alert sent to the crew'}
              </p>
              <p className="mt-1 truncate text-[11px] text-ink-400">{event.title}</p>
              <p className="mt-1 font-mono text-[10px] text-ink-500">
                {formatTime(event.timestamp)} · {event.id}
              </p>
              {!cancelled && (
                <p className="mt-2 text-[11px] leading-4 text-ink-500">
                  {acknowledgedBy.length
                    ? `Acknowledged by ${acknowledgedBy.join(', ')}.`
                    : 'It stays on each crew screen until they acknowledge it or you cancel.'}
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            {!cancelled ? (
              <button
                type="button"
                onClick={cancelOwnAlert}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-critical/35 bg-critical/[0.08] text-[12px] font-medium text-critical transition-colors hover:bg-critical/15"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.8} />
                Cancel alert
              </button>
            ) : (
              <button
                type="button"
                onClick={dismissOwnAlert}
                className="h-9 flex-1 rounded-lg border border-white/[0.08] bg-space-850 text-[12px] font-medium text-ink-200 transition-colors hover:border-white/15"
              >
                Close
              </button>
            )}
          </div>

          {!cancelled && (
            <p className="mt-2 flex items-center gap-1.5 text-[10.5px] text-ink-500">
              <Radio className="h-3 w-3" strokeWidth={1.5} />
              Sent through the crew link on this network.
            </p>
          )}
          {cancelled && (
            <p className="mt-2 flex items-center gap-1.5 text-[10.5px] text-ink-500">
              <AlertOctagon className="h-3 w-3" strokeWidth={1.5} />
              The alert was cleared on every crew screen.
            </p>
          )}
        </div>
      </section>
    </div>
  );
};
