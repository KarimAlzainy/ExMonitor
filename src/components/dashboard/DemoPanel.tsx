import React from 'react';
import { FlaskConical, Pause, Play, Square } from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import { DEMO_TOTAL_SECONDS } from '../../services/demoRunner';

/**
 * One-tap demo control. It sits at the top of the live readings tab and, while
 * running, shows the step the virtual sensor is on.
 */
export const DemoPanel: React.FC = () => {
  const { demo, startDemo, pauseDemo, resumeDemo, stopDemo } = useTelemetry();

  if (!demo.running) {
    return (
      <section className="glass lift flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-space-850 text-ink-200">
            <FlaskConical className="h-4 w-4" strokeWidth={1.6} />
          </span>
          <div>
            <p className="text-[15px] font-medium text-ink-100">Demo mode</p>
            <p className="mt-1 max-w-xl text-[12.5px] leading-5 text-ink-400">
              Run this console on a pretend body sensor for about {Math.round(DEMO_TOTAL_SECONDS / 5) * 5} seconds:
              normal readings, exercise, then a low-oxygen and a radiation alert. No second device needed.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={startDemo}
          className="flex h-11 shrink-0 items-center gap-2 rounded-lg bg-chalk px-5 text-[14px] font-medium text-space-950 transition-all hover:brightness-105 active:brightness-95"
        >
          <Play className="h-4 w-4" strokeWidth={1.8} />
          Start demo
        </button>
      </section>
    );
  }

  const overall = Math.min(1, (demo.stepIndex + demo.progress) / Math.max(1, demo.stepCount));

  return (
    <section className="glass-tint-critical flex flex-wrap items-center justify-between gap-4 rounded-2xl p-4 sm:p-5">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-critical">
            <span className="h-2 w-2 animate-pulse rounded-full bg-critical" />
            Demo running{demo.paused ? ' · paused' : ''}
          </span>
          <span className="font-mono text-[11.5px] text-ink-500">
            Step {demo.stepIndex + 1} of {demo.stepCount}
          </span>
        </div>
        <p className="mt-1.5 text-[15px] font-medium text-ink-100">{demo.label}</p>
        <p className="mt-0.5 text-[12.5px] leading-5 text-ink-400">{demo.note}</p>
        <div className="mt-3 h-1.5 w-full max-w-md overflow-hidden rounded-full bg-white/[0.08]">
          <div
            className="h-full rounded-full bg-critical transition-[width] duration-200 ease-linear"
            style={{ width: `${Math.round(overall * 100)}%` }}
          />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={demo.paused ? resumeDemo : pauseDemo}
          className="flex h-10 items-center gap-1.5 rounded-lg border border-white/[0.1] bg-space-850 px-3.5 text-[13px] font-medium text-ink-200 transition-colors hover:border-white/20"
        >
          {demo.paused ? (
            <Play className="h-3.5 w-3.5" strokeWidth={1.8} />
          ) : (
            <Pause className="h-3.5 w-3.5" strokeWidth={1.8} />
          )}
          {demo.paused ? 'Resume' : 'Pause'}
        </button>
        <button
          type="button"
          onClick={stopDemo}
          className="flex h-10 items-center gap-1.5 rounded-lg border border-white/[0.1] bg-space-850 px-3.5 text-[13px] font-medium text-ink-200 transition-colors hover:border-white/20"
        >
          <Square className="h-3.5 w-3.5" strokeWidth={1.8} />
          Stop
        </button>
      </div>
    </section>
  );
};
