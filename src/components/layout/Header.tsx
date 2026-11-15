import React, { useEffect, useState } from 'react';
import { Radio, Volume2, VolumeX } from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import { AppTab, TabNavigation } from './TabNavigation';

interface HeaderProps {
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
}

function formatMet(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${days.toString().padStart(2, '0')}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, onTabChange }) => {
  const { crewLinkMode, peerCount, soundMuted, toggleSound, nodeId, sensorStatus } = useTelemetry();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const key = 'exmonitor.met.startedAt';
    let started = Date.now();
    try {
      const stored = Number(window.localStorage.getItem(key));
      if (Number.isFinite(stored) && stored > 0) {
        started = stored;
      } else {
        window.localStorage.setItem(key, String(started));
      }
    } catch {
      // Private browsing can block storage. The timer still works for this session.
    }
    const tick = () => setElapsed(Math.floor((Date.now() - started) / 1000));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const link =
    crewLinkMode === 'relay'
      ? { dot: 'bg-positive', text: 'Crew link' }
      : crewLinkMode === 'reconnecting'
        ? { dot: 'bg-caution', text: 'Reconnecting' }
        : crewLinkMode === 'local'
          ? { dot: 'bg-caution', text: 'This browser' }
          : { dot: 'bg-ink-500', text: 'Offline' };

  const sensorLabel =
    sensorStatus === 'connected'
      ? 'Sensor connected'
      : sensorStatus === 'waiting'
        ? 'Sensor waiting'
        : sensorStatus === 'stale'
          ? 'Sensor silent'
          : 'Practice readings';

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.08] bg-space-950">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex h-16 items-center gap-3">
          <div className="min-w-0 shrink-0">
            <p className="text-[17px] font-semibold leading-5 tracking-tight text-ink-100">ExMonitor</p>
            <p className="truncate text-[12px] leading-4 text-ink-400">Crew health console</p>
          </div>

          <div className="hidden min-w-0 flex-1 xl:block">
            <TabNavigation active={activeTab} onChange={onTabChange} variant="inline" />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <span
              className="font-mono text-[11px] tabular-nums text-ink-300 sm:text-[12px]"
              title="Mission elapsed time. One-way Earth delay is up to 22 minutes."
            >
              MET {formatMet(elapsed)}
            </span>

            <div
              className="hidden items-center gap-1.5 text-[12px] text-ink-400 sm:flex"
              title={`${link.text} · ${peerCount} other ${peerCount === 1 ? 'console' : 'consoles'} · ${nodeId}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${link.dot}`} />
              <span className="hidden md:inline">{link.text}</span>
            </div>

            <button
              type="button"
              onClick={toggleSound}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-space-850 hover:text-ink-100"
              aria-label={soundMuted ? 'Unmute audio' : 'Mute audio'}
              aria-pressed={soundMuted}
              title={soundMuted ? 'Audio muted' : 'Audio on'}
            >
              {soundMuted ? (
                <VolumeX className="h-4 w-4" strokeWidth={1.5} />
              ) : (
                <Volume2 className="h-4 w-4" strokeWidth={1.5} />
              )}
            </button>

            <a
              href="sensors.html"
              target="_blank"
              rel="noreferrer"
              className="relative hidden h-10 w-10 items-center justify-center rounded-lg border border-white/[0.08] bg-space-850 text-ink-200 transition-colors hover:border-white/15 hover:bg-space-800 sm:flex"
              aria-label={`${sensorLabel}. Open the sensor page in a new tab.`}
              title={`${sensorLabel} · Open the sensor page in a new tab`}
            >
              <Radio className="h-4 w-4" strokeWidth={1.5} />
              <span
                className={`absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ${
                  sensorStatus === 'connected'
                    ? 'bg-positive'
                    : sensorStatus === 'waiting' || sensorStatus === 'stale'
                      ? 'bg-caution'
                      : 'bg-ink-500'
                }`}
              />
            </a>
          </div>
        </div>

        <div className="pb-2 xl:hidden">
          <TabNavigation active={activeTab} onChange={onTabChange} variant="bar" />
        </div>
      </div>
    </header>
  );
};
