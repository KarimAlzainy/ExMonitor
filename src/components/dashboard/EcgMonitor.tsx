import React, { useRef, useEffect } from 'react';
import { useTelemetry } from '../../context/TelemetryContext';
import { Activity, ShieldCheck, AlertTriangle, AlertOctagon } from 'lucide-react';

export const EcgMonitor: React.FC = () => {
  const { vitals, ruleResult } = useTelemetry();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Maintain sweep state across frames
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
    const baselineY = height * 0.55;

    // Determine wave color based on rule severity
    let waveColor = '#10b981'; // emerald
    let glowColor = 'rgba(16, 185, 129, 0.4)';
    if (ruleResult.statusColor === 'yellow') {
      waveColor = '#f59e0b'; // amber
      glowColor = 'rgba(245, 158, 11, 0.4)';
    } else if (ruleResult.statusColor === 'red') {
      waveColor = '#ef4444'; // crimson
      glowColor = 'rgba(239, 68, 68, 0.5)';
    }

    const render = () => {
      // Draw grid if empty
      if (sweepRef.current.points.length === 0) {
        sweepRef.current.points = new Array(width).fill(baselineY);
      }

      // Calculate beat period in pixels based on BPM
      // At 60 BPM, 1 beat per sec. At 60 fps, 60 frames per beat.
      const bpm = Math.max(40, Math.min(190, vitals.heartRate));
      const beatIntervalFrames = Math.max(18, Math.round((60 / bpm) * 60));
      
      sweepRef.current.phase = (sweepRef.current.phase + 1) % beatIntervalFrames;
      const normalizedPhase = sweepRef.current.phase / beatIntervalFrames; // 0 to 1

      // Generate ECG Cardiac Waveform (P, Q, R, S, T complex)
      let sampleY = baselineY;

      if (normalizedPhase >= 0.12 && normalizedPhase <= 0.20) {
        // P-wave (Atrial Depolarization)
        const pNorm = (normalizedPhase - 0.12) / 0.08;
        sampleY -= Math.sin(pNorm * Math.PI) * 12;
      } else if (normalizedPhase >= 0.26 && normalizedPhase < 0.28) {
        // Q-wave (Negative defection before spike)
        sampleY += 8;
      } else if (normalizedPhase >= 0.28 && normalizedPhase <= 0.32) {
        // R-peak (Sharp high-voltage Ventricular Depolarization spike)
        const rNorm = (normalizedPhase - 0.28) / 0.04;
        sampleY -= Math.sin(rNorm * Math.PI) * 62;
      } else if (normalizedPhase > 0.32 && normalizedPhase <= 0.35) {
        // S-wave (Deep negative deflection)
        sampleY += 16;
      } else if (normalizedPhase >= 0.48 && normalizedPhase <= 0.64) {
        // T-wave (Ventricular Repolarization)
        const tNorm = (normalizedPhase - 0.48) / 0.16;
        sampleY -= Math.sin(tNorm * Math.PI) * 18;
      } else {
        // Baseline noise / subtle muscle artifact
        sampleY += (Math.random() - 0.5) * 1.5;
      }

      // Update sweep point
      const curX = sweepRef.current.x;
      sweepRef.current.points[curX] = sampleY;
      sweepRef.current.x = (curX + 2) % width;

      // Clear Canvas & Draw Phosphor Grid
      ctx.fillStyle = '#07090e';
      ctx.fillRect(0, 0, width, height);

      // Medical ECG Grid lines
      ctx.lineWidth = 0.5;
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.07)';
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

      // Major grid lines
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.14)';
      for (let gx = 0; gx < width; gx += 100) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = 0; gy < height; gy += 60) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      // Draw ECG trace with phosphor glow
      ctx.save();
      ctx.shadowColor = glowColor;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = waveColor;
      ctx.lineWidth = 2.2;
      ctx.lineJoin = 'round';

      ctx.beginPath();
      for (let i = 0; i < width; i++) {
        // Create an erase gap around current sweep head
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

      // Sweep head luminous dot
      ctx.beginPath();
      ctx.arc(curX, sampleY, 4, 0, Math.PI * 2);
      ctx.fillStyle = waveColor;
      ctx.shadowColor = waveColor;
      ctx.shadowBlur = 12;
      ctx.fill();

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [vitals.heartRate, ruleResult.statusColor]);

  return (
    <div className="relative rounded-2xl bg-space-900 border border-space-700/60 p-4 overflow-hidden shadow-2xl backdrop-blur-md">
      {/* HUD Header */}
      <div className="flex items-center justify-between pb-3 border-b border-space-800">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-semibold tracking-wider text-slate-200 uppercase font-mono">
              Lead-II Continuous 3-Lead ECG Telemetry
            </h3>
            <p className="text-xs text-slate-400 font-mono">
              ST-Segment Analysis • Cal: 25mm/s • 10mm/mV • SNR: 38dB
            </p>
          </div>
        </div>

        {/* Status indicator badge */}
        <div className="flex items-center space-x-3">
          <div className="text-right">
            <div className="text-2xl font-bold font-mono tracking-tight text-slate-100 flex items-center justify-end">
              <span>{vitals.heartRate}</span>
              <span className="text-xs text-slate-400 font-sans ml-1.5 font-normal">BPM</span>
            </div>
            <div className="text-[11px] font-mono text-slate-400">
              {vitals.heartRate > 125 ? 'SINUS TACHYCARDIA' : vitals.heartRate < 45 ? 'BRADYCARDIA' : 'NORMAL SINUS RHYTHM'}
            </div>
          </div>

          <div
            className={`px-3 py-1.5 rounded-lg flex items-center space-x-1.5 text-xs font-mono font-medium border ${
              ruleResult.statusColor === 'green'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : ruleResult.statusColor === 'yellow'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-red-500/10 text-red-400 border-red-500/30 animate-pulse'
            }`}
          >
            {ruleResult.statusColor === 'green' ? (
              <ShieldCheck className="w-3.5 h-3.5" />
            ) : ruleResult.statusColor === 'yellow' ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : (
              <AlertOctagon className="w-3.5 h-3.5" />
            )}
            <span className="uppercase">{ruleResult.severity}</span>
          </div>
        </div>
      </div>

      {/* Real-time Oscilloscope Canvas */}
      <div className="relative mt-3 rounded-xl overflow-hidden border border-space-800 bg-space-950">
        <canvas
          ref={canvasRef}
          width={800}
          height={180}
          className="w-full h-40 md:h-48 block"
        />
        {/* CRT Scanline overlay effect */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-emerald-500/[0.02] to-transparent opacity-60" />
      </div>

      {/* Sub-telemetry strip */}
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs font-mono">
        <div className="bg-space-850/80 rounded-lg p-2 border border-space-800">
          <span className="text-slate-400">PR INTERVAL:</span>
          <span className="ml-1.5 text-slate-200 font-semibold">158 ms</span>
        </div>
        <div className="bg-space-850/80 rounded-lg p-2 border border-space-800">
          <span className="text-slate-400">QRS WIDTH:</span>
          <span className="ml-1.5 text-slate-200 font-semibold">88 ms</span>
        </div>
        <div className="bg-space-850/80 rounded-lg p-2 border border-space-800">
          <span className="text-slate-400">QTc (BAZETT):</span>
          <span className="ml-1.5 text-slate-200 font-semibold">412 ms</span>
        </div>
        <div className="bg-space-850/80 rounded-lg p-2 border border-space-800">
          <span className="text-slate-400">ST DEVIATION:</span>
          <span className={`ml-1.5 font-semibold ${ruleResult.severity === 'critical' ? 'text-red-400' : 'text-emerald-400'}`}>
            {ruleResult.severity === 'critical' ? '+1.8 mm (ELEVATED)' : '0.0 mm'}
          </span>
        </div>
      </div>
    </div>
  );
};
