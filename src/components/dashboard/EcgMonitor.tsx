import React, { useEffect, useRef } from 'react';
import { Activity } from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import { InfoTip } from '../ui/InfoTip';

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export const EcgMonitor: React.FC = () => {
  const { vitals, ruleResult, sensorFrame } = useTelemetry();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const vitalsRef = useRef(vitals);
  const statusRef = useRef(ruleResult.statusColor);
  const sensorFrameRef = useRef(sensorFrame);
  const sensorBufferRef = useRef<number[]>([]);
  const lastSeqRef = useRef(0);

  vitalsRef.current = vitals;
  statusRef.current = ruleResult.statusColor;
  sensorFrameRef.current = sensorFrame;

  const sweepRef = useRef({
    x: 0,
    points: [] as number[],
    phase: 0
  });

  useEffect(() => {
    if (!sensorFrame || sensorFrame.seq <= lastSeqRef.current) return;
    lastSeqRef.current = sensorFrame.seq;

    const canvas = canvasRef.current;
    const height = canvas?.height ?? 240;
    const baseline = height * 0.6;
    const next = sensorBufferRef.current;
    for (const sample of sensorFrame.ecg) {
      next.push(clamp(baseline - sample * 52, 8, height - 8));
    }
    while (next.length > 1000) next.shift();
  }, [sensorFrame]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId = 0;
    const width = canvas.width;
    const height = canvas.height;
    const baselineY = height * 0.6;

    const render = () => {
      const currentStatus = statusRef.current;
      const currentVitals = vitalsRef.current;
      let waveColor = '#59c98d';
      let glowColor = 'rgba(89, 201, 141, 0.28)';
      if (currentStatus === 'yellow') {
        waveColor = '#d7a45a';
        glowColor = 'rgba(215, 164, 90, 0.26)';
      } else if (currentStatus === 'red') {
        waveColor = '#e56767';
        glowColor = 'rgba(229, 103, 103, 0.3)';
      }

      const fromSensor = currentVitals.source === 'sensor' && sensorBufferRef.current.length > 4;

      if (!fromSensor) {
        if (sweepRef.current.points.length === 0) {
          sweepRef.current.points = new Array(width).fill(baselineY);
        }

        const bpm = Math.max(40, Math.min(190, currentVitals.heartRate));
        const beatIntervalFrames = Math.max(18, Math.round((60 / bpm) * 60));
        sweepRef.current.phase = (sweepRef.current.phase + 1) % beatIntervalFrames;
        const normalizedPhase = sweepRef.current.phase / beatIntervalFrames;

        let sampleY = baselineY;
        if (normalizedPhase >= 0.12 && normalizedPhase <= 0.2) {
          sampleY -= Math.sin(((normalizedPhase - 0.12) / 0.08) * Math.PI) * 10;
        } else if (normalizedPhase >= 0.26 && normalizedPhase < 0.28) {
          sampleY += 7;
        } else if (normalizedPhase >= 0.28 && normalizedPhase <= 0.32) {
          sampleY -= Math.sin(((normalizedPhase - 0.28) / 0.04) * Math.PI) * 64;
        } else if (normalizedPhase > 0.32 && normalizedPhase <= 0.35) {
          sampleY += 14;
        } else if (normalizedPhase >= 0.48 && normalizedPhase <= 0.64) {
          sampleY -= Math.sin(((normalizedPhase - 0.48) / 0.16) * Math.PI) * 15;
        } else {
          sampleY += (Math.random() - 0.5) * 1.2;
        }

        const currentX = sweepRef.current.x;
        sweepRef.current.points[currentX] = sampleY;
        sweepRef.current.x = (currentX + 2) % width;
      }

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

      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 6;
      ctx.strokeStyle = waveColor;
      ctx.lineWidth = 1.8;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      if (fromSensor) {
        const buffer = sensorBufferRef.current;
        ctx.beginPath();
        for (let i = 0; i < buffer.length; i += 1) {
          const x = (i / Math.max(1, buffer.length - 1)) * width;
          if (i === 0) ctx.moveTo(x, buffer[i]);
          else ctx.lineTo(x, buffer[i]);
        }
        ctx.stroke();
      } else {
        const currentX = sweepRef.current.x;
        ctx.beginPath();
        for (let i = 0; i < width; i += 1) {
          const distance = (i - currentX + width) % width;
          if (distance > 5 && distance < width - 15) {
            if (i === 0 || distance === 6) ctx.moveTo(i, sweepRef.current.points[i]);
            else ctx.lineTo(i, sweepRef.current.points[i]);
          }
        }
        ctx.stroke();
      }
      ctx.restore();

      if (fromSensor) {
        const buffer = sensorBufferRef.current;
        const last = buffer[buffer.length - 1] ?? baselineY;
        ctx.beginPath();
        ctx.arc(width - 2, last, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = waveColor;
        ctx.fill();
      } else {
        const currentX = sweepRef.current.x;
        const currentY = sweepRef.current.points[currentX] ?? baselineY;
        ctx.beginPath();
        ctx.arc(currentX, currentY, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = waveColor;
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationFrameId);
  }, []);

  const statusTone =
    ruleResult.statusColor === 'red'
      ? { dot: 'bg-critical', text: 'text-critical' }
      : ruleResult.statusColor === 'yellow'
        ? { dot: 'bg-caution', text: 'text-caution' }
        : { dot: 'bg-positive', text: 'text-positive' };

  const rhythm =
    vitals.heartRate > 125 ? 'Fast rhythm' : vitals.heartRate < 45 ? 'Slow rhythm' : 'Steady rhythm';
  const updated = new Date(vitals.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  return (
    <section className="rounded-xl border border-white/[0.08] bg-space-900 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-ink-400" strokeWidth={1.5} />
            <h2 className="flex items-center text-[15px] font-medium text-ink-100">
              Heart trace
              <InfoTip
                text="The electrocardiogram (ECG) shows the heart's electrical signal. The shape and spacing of each beat help the crew spot strain or an irregular rhythm."
                label="Heart trace"
              />
            </h2>
          </div>
          <p className="mt-1 text-[11px] text-ink-500">Continuing trace · 25 mm/s · 10 mm/mV</p>
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
          aria-label="Live heart trace"
          className="block h-52 w-full md:h-64"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-white/[0.06] pt-4 sm:grid-cols-4">
        <Reading label="Rhythm" value={rhythm} />
        <Reading label="Signal" value={`${vitals.signalQuality}%`} />
        <Reading label="Reading from" value={vitals.source === 'sensor' ? 'Paired sensor' : 'Practice generator'} />
        <Reading label="Updated" value={updated} mono />
      </div>
    </section>
  );
};

function Reading({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2 sm:block">
      <span className="text-[11px] text-ink-500">{label}</span>
      <span className={`text-[13px] font-medium text-ink-200 sm:mt-0.5 sm:block ${mono ? 'font-mono tabular-nums' : ''}`}>
        {value}
      </span>
    </div>
  );
}
