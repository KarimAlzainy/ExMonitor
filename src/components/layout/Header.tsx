import React, { useEffect, useState } from 'react';
import { PanelRight, Radio, Timer, UserRound, Volume2, VolumeX, WifiOff } from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';

interface HeaderProps {
  onOpenSimulator: () => void;
}

function formatMet(totalSeconds: number): string {
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${days.toString().padStart(2, '0')}:${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export const Header: React.FC<HeaderProps> = ({ onOpenSimulator }) => {
  const { astronaut, isMeshOnline, soundMuted, toggleSound, nodeId } = useTelemetry();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const started = Date.now();
    const timer = window.setInterval(() => {
      setElapsed(Math.floor((Date.now() - started) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <header className="border-b border-space-800 bg-space-950/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-3 py-3 sm:gap-3 sm:px-6">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-nasa-cyan">Ex-Monitor</p>
          <h1 className="truncate font-mono text-sm font-semibold text-slate-100 sm:text-base">
            Artemis Bio-Telemetry
          </h1>
          <p className="font-mono text-[10px] text-slate-400 sm:hidden">MET {formatMet(elapsed)}</p>
        </div>

        <div className="hidden shrink-0 items-center gap-1.5 rounded-xl border border-space-700 bg-space-900 px-3 py-1.5 md:flex">
          <Timer className="h-4 w-4 text-slate-400" />
          <span className="font-mono text-[10px] uppercase text-slate-500">MET</span>
          <span className="font-mono text-sm text-slate-100">{formatMet(elapsed)}</span>
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div
            className="flex max-w-[13rem] items-center gap-2 rounded-xl border border-space-700 bg-space-900 px-2.5 py-1.5"
            title={`${astronaut.name} · ${astronaut.role} · ${astronaut.strapSerial}`}
          >
            <UserRound className="h-4 w-4 shrink-0 text-nasa-cyan" />
            <div className="hidden min-w-0 md:block">
              <p className="truncate font-mono text-xs text-slate-100">{astronaut.name}</p>
              <p className="hidden truncate font-mono text-[10px] text-slate-400 xl:block">
                {astronaut.role} · {astronaut.strapSerial}
              </p>
            </div>
          </div>

          <div
            className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-2 font-mono text-[10px] uppercase ${
              isMeshOnline
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-200'
            }`}
            title={`${isMeshOnline ? 'Relay online' : 'Local BroadcastChannel only'} · ${nodeId}`}
          >
            {isMeshOnline ? <Radio className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
            <span className="hidden lg:inline">{isMeshOnline ? 'Mesh relay' : 'Local channel'}</span>
          </div>

          <button
            type="button"
            onClick={toggleSound}
            className="rounded-xl border border-space-700 bg-space-900 p-2 text-slate-200 hover:border-nasa-cyan/40"
            aria-label={soundMuted ? 'Unmute audio' : 'Mute audio'}
            aria-pressed={soundMuted}
            title={soundMuted ? 'Audio muted' : 'Audio on'}
          >
            {soundMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <button
            type="button"
            onClick={onOpenSimulator}
            className="flex items-center gap-1.5 rounded-xl border border-nasa-cyan/30 bg-nasa-blue/40 px-2.5 py-2 font-mono text-[10px] uppercase tracking-wide text-nasa-cyan hover:bg-nasa-blue/60"
            aria-label="Open demo controls"
          >
            <PanelRight className="h-4 w-4" />
            <span className="hidden lg:inline">Demo controls</span>
          </button>
        </div>
      </div>
    </header>
  );
};
