import React, { useEffect, useRef } from 'react';
import { Activity } from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';

export const EcgMonitor: React.FC = () => {
  const { vitals, ruleResult } = useTelemetry();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const sweepRef = useRef<{
    x: number;
    points: number[];
    phase: number;
  }>({
    x: 0,
    points: [],
    phase: 0
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    const width = canvas.width;
    const height = canvas.height;
    const baselineY = height * 0.6;

    let waveColor = '#59c98d';
    let glowColor = 'rgba(89, 201, 141, 0.35)';
    if (ruleResult.statusColor === 'yellow') {
      waveColor = '#d7a45a';
      glowColor = 'rgba(215, 164, 90, 0.32)';
    } else if (ruleResult.statusColor === 'red') {
      waveColor = '#e56767';
      glowColor = 'rgba(229, 103, 103, 0.38)';
    }

    const render = () => {
      if (sweepRef.current.points.length === 0) {
        sweepRef.current.points = new Array(width).fill(baselineY);
      }

      const bpm = Math.max(40, Math.min(190, vitals.heartRate));
      const beatIntervalFrames = Math.max(18, Math.round((60 / bpm) * 60));

      sweepRef.current.phase = (sweepRef.current.phase + 1) % beatIntervalFrames;
      const normalizedPhase = sweepRef.current.phase / beatIntervalFrames;

      let sampleY = baselineY;

      if (normalizedPhase >= 0.12 && normalizedPhase <= 0.2) {
        const pNorm = (normalizedPhase - 0.12) / 0.08;
        sampleY -= Math.sin(pNorm * Math.PI) * 10;
      } else if (normalizedPhase >= 0.26 && normalizedPhase < 0.28) {
        sampleY += 7;
      } else if (normalizedPhase >= 0.28 && normalizedPhase <= 0.32) {
        const rNorm = (normalizedPhase - 0.28) / 0.04;
        sampleY -= Math.sin(rNorm * Math.PI) * 64;
      } else if (normalizedPhase > 0.32 && normalizedPhase <= 0.35) {
        sampleY += 14;
      } else if (normalizedPhase >= 0.48 && normalizedPhase <= 0.64) {
        const tNorm = (normalizedPhase - 0.48) / 0.16;
        sampleY -= Math.sin(tNorm * Math.PI) * 15;
      } else {
        sampleY += (Math.random() - 0.5) * 1.2;
      }

      const curX = sweepRef.current.x;
      sweepRef.current.points[curX] = sampleY;
      sweepRef.current.x = (curX + 2) % width;

      ctx.fillStyle = '#06070a';
      ctx.fillRect(0, 0, width, height);

      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
      for (let gx = 0; gx < width; gx += 20) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = 0; gy < height; gy += 20) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
      for (let gx = 0; gx < width; gx += 100) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = 0; gy < height; gy += 80) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.beginPath();
      ctx.moveTo(0, baselineY);
      ctx.lineTo(width, baselineY);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.beginPath();
      ctx.moveTo(curX, 0);
      ctx.lineTo(curX, height);
      ctx.stroke();

      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 6;
      ctx.strokeStyle = waveColor;
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      ctx.beginPath();
      for (let i = 0; i < width; i++) {
        const dist = (i - sweepRef.current.x + width) % width;
        if (dist > 5 && dist < width - 15) {
          if (i === 0 || dist === 6) {
            ctx.moveTo(i, sweepRef.current.points[i]);
          } else {
            ctx.lineTo(i, sweepRef.current.points[i]);
          }
        }
      }
      ctx.stroke();
      ctx.restore();

      ctx.beginPath();
      ctx.arc(curX, sampleY, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = waveColor;
      ctx.fill();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [vitals.heartRate, ruleResult.statusColor]);

  const statusTone =
    ruleResult.statusColor === 'red'
      ? { dot: 'bg-critical', text: 'text-critical' }
      : ruleResult.statusColor === 'yellow'
        ? { dot: 'bg-caution', text: 'text-caution' }
        : { dot: 'bg-positive', text: 'text-positive' };

  const rhythm =
    vitals.heartRate > 125 ? 'Sinus tachycardia' : vitals.heartRate < 45 ? 'Bradycardia' : 'Normal sinus rhythm';

  return (
    <section className="rounded-xl border border-white/[0.08] bg-space-900 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-ink-400" strokeWidth={1.5} />
            <h2 className="text-[15px] font-medium text-ink-100">Lead II ECG</h2>
          </div>
          <p className="mt-1 text-[11px] text-ink-500">Continuous 3-lead telemetry · 25 mm/s · 10 mm/mV · SNR 38 dB</p>
        </div>

        <div className="text-right">
          <div className="flex items-baseline justify-end gap-1.5">
            <span className="text-[32px] font-medium leading-none tracking-tight tabular-nums text-ink-100">
              {vitals.heartRate}
            </span>
            <span className="text-xs text-ink-400">BPM</span>
          </div>
          <div className={`mt-1.5 flex items-center justify-end gap-1.5 text-[11px] ${statusTone.text}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${statusTone.dot}`} />
            {rhythm}
          </div>
        </div>
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-white/[0.06] bg-[#06070a]">
        <canvas
          ref={canvasRef}
          width={1000}
          height={240}
          role="img"
          aria-label="Live Lead II ECG waveform"
          className="block h-52 w-full md:h-64"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-white/[0.06] pt-4 sm:grid-cols-4">
        <div className="flex items-baseline justify-between gap-2 sm:block">
          <span className="text-[11px] text-ink-500">PR interval</span>
          <span className="text-[13px] font-medium tabular-nums text-ink-200 sm:mt-0.5 sm:block">158 ms</span>
        </div>
        <div className="flex items-baseline justify-between gap-2 sm:block">
          <span className="text-[11px] text-ink-500">QRS width</span>
          <span className="text-[13px] font-medium tabular-nums text-ink-200 sm:mt-0.5 sm:block">88 ms</span>
        </div>
        <div className="flex items-baseline justify-between gap-2 sm:block">
          <span className="text-[11px] text-ink-500">QTc (Bazett)</span>
          <span className="text-[13px] font-medium tabular-nums text-ink-200 sm:mt-0.5 sm:block">412 ms</span>
        </div>
        <div className="flex items-baseline justify-between gap-2 sm:block">
          <span className="text-[11px] text-ink-500">ST deviation</span>
          <span
            className={`text-[13px] font-medium tabular-nums sm:mt-0.5 sm:block ${
              ruleResult.severity === 'critical' ? 'text-critical' : 'text-ink-200'
            }`}
          >
            {ruleResult.severity === 'critical' ? '+1.8 mm' : '0.0 mm'}
          </span>
        </div>
      </div>
    </section>
  );
};
