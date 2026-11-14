import React, { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Activity,
  Battery,
  Check,
  Copy,
  ExternalLink,
  Flame,
  HeartPulse,
  LucideIcon,
  QrCode,
  Radiation,
  Radio,
  RotateCcw,
  Signal,
  Wind
} from 'lucide-react';
import { SensorFrame, SensorScenario } from '../types/telemetry';
import { SCENARIO_LABELS, SensorEngine, createSensorId } from './sensorEngine';
import { crewLink } from '../services/crewLink';

const SENSOR_KEY = 'exmonitor.sensor.id';
const SENSOR_PATTERN = /^SENSOR-[A-Z0-9]{4,12}$/;

const SCENARIOS: { id: SensorScenario; icon: LucideIcon }[] = [
  { id: 'rest', icon: Activity },
  { id: 'exercise', icon: Flame },
  { id: 'hypoxia', icon: Wind },
  { id: 'radiation', icon: Radiation },
  { id: 'recovery', icon: RotateCcw }
];

function readSensorId(): string {
  const fromUrl = new URLSearchParams(window.location.search).get('sensor');
  if (fromUrl) {
    const normalized = fromUrl.trim().toUpperCase();
    if (SENSOR_PATTERN.test(normalized)) return normalized;
  }
  try {
    const stored = window.localStorage.getItem(SENSOR_KEY);
    if (stored && SENSOR_PATTERN.test(stored)) return stored;
  } catch {
    // Ignore.
  }
  return createSensorId();
}

function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
  ctx.fillStyle = '#06070a';
  ctx.fillRect(0, 0, width, height);

  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
  for (let x = 0; x < width; x += 12) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 12) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
  for (let x = 0; x < width; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y < height; y += 60) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

function drawSignal(
  canvas: HTMLCanvasElement | null,
  samples: number[],
  color: string,
  centerRatio: number,
  gain: number
) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const width = canvas.width;
  const height = canvas.height;
  drawGrid(ctx, width, height);

  const center = height * centerRatio;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.7;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const visible = samples.slice(-Math.min(samples.length, 900));
  if (visible.length < 2) return;

  ctx.beginPath();
  for (let index = 0; index < visible.length; index += 1) {
    const x = (index / Math.max(1, visible.length - 1)) * width;
    const y = Math.max(4, Math.min(height - 4, center - visible[index] * height * gain));
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

export const SensorPage: React.FC = () => {
  const [sensorId, setSensorId] = useState<string>(() => readSensorId());
  const [scenario, setScenario] = useState<SensorScenario>('rest');
  const [paired, setPaired] = useState(false);
  const [pairedWith, setPairedWith] = useState('');
  const [link, setLink] = useState<'relay' | 'local' | 'off'>('off');
  const [live, setLive] = useState<SensorFrame | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [qrFailed, setQrFailed] = useState(false);
  const [copied, setCopied] = useState(false);

  const engineRef = useRef<SensorEngine | null>(null);
  const pairedRef = useRef(false);
  const ecgBufferRef = useRef<number[]>([]);
  const ppgBufferRef = useRef<number[]>([]);
  const ecgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ppgCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const shareUrl = useMemo(
    () => `${window.location.origin}${window.location.pathname}?sensor=${sensorId}`,
    [sensorId]
  );

  pairedRef.current = paired;

  useEffect(() => {
    try {
      window.localStorage.setItem(SENSOR_KEY, sensorId);
    } catch {
      // Ignore.
    }
    const url = new URL(window.location.href);
    if (url.searchParams.get('sensor') !== sensorId) {
      url.searchParams.set('sensor', sensorId);
      window.history.replaceState(null, '', url.toString());
    }
  }, [sensorId]);

  useEffect(() => {
    let cancelled = false;
    setQrFailed(false);
    QRCode.toDataURL(shareUrl, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 360,
      color: { dark: '#0d0f13', light: '#e9ecf0' }
    })
      .then((data) => {
        if (!cancelled) setQr(data);
      })
      .catch(() => {
        if (!cancelled) {
          setQr(null);
          setQrFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [shareUrl]);

  useEffect(() => {
    const offMessage = crewLink.subscribe((message) => {
      if (message.type === 'SENSOR_PAIR' && message.payload.sensorId === sensorId) {
        setPaired(true);
        setPairedWith(message.payload.crewName || 'A crew console');
        return;
      }
      if (message.type === 'SENSOR_UNPAIR' && message.payload.sensorId === sensorId) {
        setPaired(false);
        setPairedWith('');
      }
    });
    const offConnection = crewLink.onConnectionChange((relayOnline, localChannel) => {
      setLink(relayOnline ? 'relay' : localChannel ? 'local' : 'off');
    });
    return () => {
      offMessage();
      offConnection();
    };
  }, [sensorId]);

  // Tell the console this sensor exists. It answers with a pair message.
  useEffect(() => {
    const announce = () => crewLink.hello(sensorId);
    announce();
    const timer = window.setInterval(announce, paired ? 20000 : 3000);
    return () => window.clearInterval(timer);
  }, [sensorId, paired]);

  useEffect(() => {
    const engine = new SensorEngine(sensorId);
    engineRef.current = engine;
    let ecgRemainder = 0;
    let ppgRemainder = 0;

    const timer = window.setInterval(() => {
      const dt = 0.125;
      engine.step(dt);

      ecgRemainder += 250 * dt;
      const ecgCount = Math.round(ecgRemainder);
      ecgRemainder -= ecgCount;
      ppgRemainder += 50 * dt;
      const ppgCount = Math.round(ppgRemainder);
      ppgRemainder -= ppgCount;

      const ecg: number[] = [];
      for (let index = 0; index < ecgCount; index += 1) ecg.push(engine.ecgSample());
      const ppg: number[] = [];
      for (let index = 0; index < ppgCount; index += 1) ppg.push(engine.ppgSample());

      const frame = engine.buildFrame(ecg, ppg);

      const ecgBuffer = ecgBufferRef.current;
      ecgBuffer.push(...ecg);
      if (ecgBuffer.length > 1500) ecgBuffer.splice(0, ecgBuffer.length - 1500);
      const ppgBuffer = ppgBufferRef.current;
      ppgBuffer.push(...ppg);
      if (ppgBuffer.length > 600) ppgBuffer.splice(0, ppgBuffer.length - 600);

      setLive(frame);
      if (pairedRef.current) crewLink.sendSensorFrame(frame);
    }, 125);

    return () => window.clearInterval(timer);
  }, [sensorId]);

  useEffect(() => {
    let frame = 0;
    const render = () => {
      drawSignal(ecgCanvasRef.current, ecgBufferRef.current, '#59c98d', 0.62, 0.34);
      drawSignal(ppgCanvasRef.current, ppgBufferRef.current, '#7aa7c7', 0.6, 0.3);
      frame = requestAnimationFrame(render);
    };
    render();
    return () => cancelAnimationFrame(frame);
  }, []);

  const changeScenario = (next: SensorScenario) => {
    engineRef.current?.setScenario(next);
    setScenario(next);
  };

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const newCode = () => {
    const next = createSensorId();
    try {
      window.localStorage.setItem(SENSOR_KEY, next);
    } catch {
      // Ignore.
    }
    const url = new URL(window.location.href);
    url.searchParams.set('sensor', next);
    setSensorId(next);
    setPaired(false);
    setPairedWith('');
    window.history.replaceState(null, '', url.toString());
  };

  const linkText =
    link === 'relay' ? 'Relay connected' : link === 'local' ? 'This browser only' : 'Relay offline';
  const linkDot = link === 'relay' ? 'bg-positive' : link === 'local' ? 'bg-caution' : 'bg-ink-500';

  return (
    <div className="min-h-dvh bg-space-950 text-ink-100">
      <header className="border-b border-white/[0.08]">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-space-900 text-ink-300">
              <Radio className="h-4 w-4" strokeWidth={1.6} />
            </span>
            <div>
              <p className="text-[14px] font-semibold leading-5 tracking-tight text-ink-100">Ex-Monitor sensors</p>
              <p className="text-[11px] leading-4 text-ink-500">Pretend body sensor · realistic readings</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-[11px] text-ink-400" title="How this page reaches other devices">
              <span className={`h-1.5 w-1.5 rounded-full ${linkDot}`} />
              {linkText}
            </span>
            <a
              href="./"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-space-900 px-3 text-[12px] font-medium text-ink-200 transition-colors hover:border-white/15"
            >
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.6} />
              Open the console
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-6 sm:px-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-4">
          <section className="rounded-xl border border-white/[0.08] bg-space-900 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-ink-200">Pairing code</p>
                <p className="mt-0.5 text-[11px] leading-4 text-ink-500">
                  Scan this in the console under Settings.
                </p>
              </div>
              <QrCode className="h-4 w-4 text-ink-500" strokeWidth={1.5} />
            </div>

            <div className="mt-4 flex justify-center rounded-lg border border-white/[0.06] bg-ink-100 p-3">
              {qr ? (
                <img src={qr} alt={`Sensor code ${sensorId}`} className="h-48 w-48" />
              ) : qrFailed ? (
                <div className="flex h-48 w-48 items-center justify-center text-center text-[11px] text-space-700">
                  The code image could not be drawn. Type the sensor code instead.
                </div>
              ) : (
                <div className="flex h-48 w-48 items-center justify-center text-center text-[11px] text-space-700">
                  Drawing the code…
                </div>
              )}
            </div>

            <p className="mt-3 text-center font-mono text-[15px] font-medium tracking-wide text-ink-100">
              {sensorId}
            </p>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => void copyUrl()}
                className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-space-850 text-[11.5px] font-medium text-ink-200 transition-colors hover:border-white/15"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-positive" strokeWidth={2} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.6} />}
                {copied ? 'Copied' : 'Copy link'}
              </button>
              <button
                type="button"
                onClick={newCode}
                className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-space-850 px-3 text-[11.5px] font-medium text-ink-300 transition-colors hover:border-white/15"
              >
                New code
              </button>
            </div>

            <div
              className={`mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 ${
                paired
                  ? 'border-positive/25 bg-positive/[0.05]'
                  : 'border-caution/25 bg-caution/[0.04]'
              }`}
            >
              <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${paired ? 'bg-positive' : 'bg-caution'}`} />
              <div>
                <p className={`text-[11.5px] font-medium ${paired ? 'text-positive' : 'text-caution'}`}>
                  {paired ? `Paired with ${pairedWith}` : 'Waiting for a console'}
                </p>
                <p className="mt-0.5 text-[10.5px] leading-4 text-ink-500">
                  {paired
                    ? 'Readings are streaming. Keep this page open.'
                    : 'Open the console on the same Wi-Fi and scan the code.'}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-white/[0.08] bg-space-900 p-5">
            <p className="text-[12px] font-medium text-ink-200">How to connect</p>
            <ol className="mt-3 space-y-2.5">
              <Step number="1" text="Open the console on the other device on the same Wi-Fi or hotspot." />
              <Step number="2" text="Go to Settings, then Scan sensor code." />
              <Step number="3" text="Pick a situation below. Readings start immediately." />
            </ol>
            <p className="mt-3 border-t border-white/[0.06] pt-3 text-[10.5px] leading-5 text-ink-500">
              The code is a name, not a password. This page sends pretend readings only; it does not read a real
              body sensor.
            </p>
          </section>
        </div>

        <div className="space-y-4">
          <section className="rounded-xl border border-white/[0.08] bg-space-900 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h1 className="text-[15px] font-medium text-ink-100">Situation</h1>
                <p className="mt-1 text-[12px] leading-5 text-ink-400">
                  Change the story the sensor is telling. The readings move gradually, not in steps.
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-ink-500">
                <Signal className="h-3.5 w-3.5" strokeWidth={1.6} />
                8 frames per second
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {SCENARIOS.map((entry) => {
                const Icon = entry.icon;
                const meta = SCENARIO_LABELS[entry.id];
                const active = entry.id === scenario;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => changeScenario(entry.id)}
                    aria-pressed={active}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      active
                        ? 'border-signal/50 bg-signal/[0.06]'
                        : 'border-white/[0.08] bg-space-950 hover:border-white/15'
                    }`}
                  >
                    <span className={`flex items-center gap-1.5 text-[12px] font-medium ${active ? 'text-ink-100' : 'text-ink-200'}`}>
                      <Icon className="h-3.5 w-3.5 text-ink-400" strokeWidth={1.6} />
                      {meta.name}
                    </span>
                    <span className="mt-1 block text-[10.5px] leading-4 text-ink-500">{meta.note}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-white/[0.08] bg-space-900 p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="flex items-center gap-2 text-[15px] font-medium text-ink-100">
                <HeartPulse className="h-4 w-4 text-ink-400" strokeWidth={1.5} />
                Live signal preview
              </h2>
              <p className="font-mono text-[10.5px] text-ink-500">
                {live?.seq ? `Frame ${live.seq}` : 'Waiting for the first frame'} ·{' '}
                {live ? new Date(live.sentAt).toLocaleTimeString([], { hour12: false }) : ''}
              </p>
            </div>

            <div className="mt-3 overflow-hidden rounded-lg border border-white/[0.06] bg-[#06070a]">
              <canvas
                ref={ecgCanvasRef}
                width={1000}
                height={190}
                role="img"
                aria-label="Heart electrical signal preview"
                className="block h-40 w-full sm:h-44"
              />
            </div>
            <p className="mt-1.5 text-[10.5px] text-ink-500">Heart electrical signal (ECG)</p>

            <div className="mt-3 overflow-hidden rounded-lg border border-white/[0.06] bg-[#06070a]">
              <canvas
                ref={ppgCanvasRef}
                width={1000}
                height={150}
                role="img"
                aria-label="Pulse wave preview"
                className="block h-32 w-full"
              />
            </div>
            <p className="mt-1.5 text-[10.5px] text-ink-500">Pulse wave (PPG)</p>
          </section>

          <section className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Heart rate" value={live ? String(live.heartRate) : '–'} unit="BPM" />
            <Metric label="Blood oxygen" value={live ? String(live.spO2) : '–'} unit="%" />
            <Metric label="Body temperature" value={live ? live.bodyTemp.toFixed(1) : '–'} unit="°C" />
            <Metric label="Stress signal" value={live ? live.gsrStress.toFixed(1) : '–'} unit="µS" />
            <Metric label="Radiation dose" value={live ? live.radiationDoseRate.toFixed(2) : '–'} unit="mSv/hr" />
            <Metric label="Total mission dose" value={live ? live.cumulativeRadiation.toFixed(2) : '–'} unit="mSv" />
            <Metric label="Signal quality" value={live ? String(live.signalQuality) : '–'} unit="%" />
            <div className="rounded-lg border border-white/[0.06] bg-space-900 px-4 py-3">
              <p className="flex items-center gap-1.5 text-[10.5px] text-ink-500">
                <Battery className="h-3.5 w-3.5" strokeWidth={1.6} />
                Sensor battery
              </p>
              <p className="mt-1 flex items-baseline gap-1">
                <span className="text-[20px] font-medium leading-none tabular-nums text-ink-100">
                  {live ? live.battery : '–'}
                </span>
                <span className="text-[11px] text-ink-400">%</span>
              </p>
            </div>
          </section>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-6xl px-4 pb-8 text-[10.5px] leading-5 text-ink-500 sm:px-6">
        Pretend sensor data for a training simulation. It is not a medical device and does not replace real
        monitoring.
      </footer>
    </div>
  );
};

function Step({ number, text }: { number: string; text: string }) {
  return (
    <li className="flex gap-2.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/10 font-mono text-[9px] text-ink-400">
        {number}
      </span>
      <span className="text-[11px] leading-5 text-ink-300">{text}</span>
    </li>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-space-900 px-4 py-3">
      <p className="text-[10.5px] text-ink-500">{label}</p>
      <p className="mt-1 flex items-baseline gap-1">
        <span className="text-[20px] font-medium leading-none tabular-nums text-ink-100">{value}</span>
        <span className="text-[11px] text-ink-400">{unit}</span>
      </p>
    </div>
  );
}
