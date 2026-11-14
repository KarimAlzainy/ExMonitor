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
  const { profile, crewLinkMode, peerCount, soundMuted, toggleSound, nodeId, sensorStatus } = useTelemetry();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const link =
    crewLinkMode === 'relay'
      ? { dot: 'bg-positive', text: 'Crew link' }
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
            <p className="text-[15px] font-semibold leading-5 tracking-tight text-ink-100">Ex-Monitor</p>
            <p className="truncate text-[11px] leading-4 text-ink-400">Crew health console</p>
          </div>

          <div className="hidden min-w-0 flex-1 xl:block">
            <TabNavigation active={activeTab} onChange={onTabChange} variant="inline" />
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-1.5 sm:gap-2">
            <div
              className="flex flex-col items-end gap-0 sm:flex-row sm:items-baseline sm:gap-2"
              title="Mission elapsed time. One-way Earth delay is up to 22 minutes."
            >
              <span className="font-mono text-[10px] tabular-nums text-ink-300 sm:text-[11px]">
                MET {formatMet(elapsed)}
              </span>
              <span className="hidden text-[11px] text-ink-500 xl:inline">Earth delay 22 min</span>
            </div>

            <div
              className="hidden items-center gap-1.5 text-[11px] text-ink-400 sm:flex"
              title={`${link.text} · ${peerCount} other ${peerCount === 1 ? 'console' : 'consoles'} · ${nodeId}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${link.dot}`} />
              <span className="hidden 2xl:inline">{link.text}</span>
            </div>

            <div className="hidden max-w-[150px] text-right xl:block">
              <p className="truncate text-xs font-medium leading-4 text-ink-200">{profile.name}</p>
              <p className="hidden truncate text-[11px] leading-4 text-ink-500 2xl:block">{profile.label}</p>
            </div>

            <span
              className="hidden items-center gap-1.5 text-[11px] text-ink-500 2xl:flex"
              title={sensorLabel}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  sensorStatus === 'connected'
                    ? 'bg-positive'
                    : sensorStatus === 'waiting' || sensorStatus === 'stale'
                      ? 'bg-caution'
                      : 'bg-ink-500'
                }`}
              />
              {sensorLabel}
            </span>

            <button
              type="button"
              onClick={toggleSound}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-space-850 hover:text-ink-100"
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
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-space-850 text-ink-200 transition-colors hover:border-white/15 hover:bg-space-800 2xl:w-auto 2xl:gap-1.5 2xl:px-2.5"
              aria-label="Open the sensor page"
              title="Open the sensor page in a new tab"
            >
              <Radio className="h-4 w-4" strokeWidth={1.5} />
              <span className="hidden text-xs font-medium 2xl:inline">Sensor page</span>
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
