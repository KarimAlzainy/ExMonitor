import React, { useEffect, useRef, useState } from 'react';
import { Camera, QrCode, ScanLine, X } from 'lucide-react';

interface BarcodeHit {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<BarcodeHit[]>;
}

interface SensorScannerProps {
  open: boolean;
  onClose: () => void;
  onCode: (sensorId: string) => void;
}

export function parseSensorCode(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const url = new URL(trimmed);
    const value = url.searchParams.get('sensor');
    if (value) {
      const match = value.toUpperCase().match(/SENSOR-[A-Z0-9]{4,12}/);
      if (match) return match[0];
    }
  } catch {
    // Not a URL, try the raw form below.
  }

  const match = trimmed.toUpperCase().match(/SENSOR-[A-Z0-9]{4,12}/);
  return match ? match[0] : null;
}

export const SensorScanner: React.FC<SensorScannerProps> = ({ open, onClose, onCode }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const closeRef = useRef(onClose);
  const codeRef = useRef(onCode);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [status, setStatus] = useState('Opening the camera');
  const [manual, setManual] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);

  closeRef.current = onClose;
  codeRef.current = onCode;

  const accept = (raw: string) => {
    const sensorId = parseSensorCode(raw);
    if (!sensorId) {
      setManualError('That code does not look like a sensor code. It should contain SENSOR- and four letters or numbers.');
      setStatus('Code not recognized');
      return;
    }
    codeRef.current(sensorId);
    closeRef.current();
  };

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    let detecting = false;

    setCameraError(null);
    setStatus('Opening the camera');
    setManual('');
    setManualError(null);

    const stop = () => {
      stopped = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('This browser cannot open a camera. Type the sensor code below instead.');
        setStatus('Camera not available');
        return;
      }

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false
        });
        if (stopped) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setStatus('Point the camera at the code on the sensor page');

        const Detector = (
          window as unknown as {
            BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
          }
        ).BarcodeDetector;

        if (!Detector || !videoRef.current) {
          setStatus('Live scanning is not available here. Type the sensor code below.');
          return;
        }

        const detector = new Detector({ formats: ['qr_code'] });
        timer = window.setInterval(async () => {
          if (stopped || detecting || !videoRef.current || videoRef.current.readyState < 2) return;
          detecting = true;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue;
            if (value && parseSensorCode(value)) accept(value);
          } catch {
            // A missed camera frame should not close the scanner.
          } finally {
            detecting = false;
          }
        }, 650);
      } catch (error) {
        if (stopped) return;
        const message = error instanceof Error ? error.message : 'Camera access was blocked';
        setCameraError(message);
        setStatus('Camera blocked. Type the sensor code below.');
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
    };

    window.addEventListener('keydown', onKeyDown);
    void start();

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      stop();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Scan the sensor code"
        className="w-full max-w-lg rounded-xl border border-white/[0.08] bg-space-900 p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-ink-400" strokeWidth={1.5} />
            <h3 className="text-[15px] font-medium text-ink-100">Scan the sensor code</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-space-850 hover:text-ink-100"
            aria-label="Close the scanner"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="relative overflow-hidden rounded-lg border border-white/[0.08] bg-black">
          <video ref={videoRef} className="h-64 w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-6 rounded-lg border border-white/30" />
          <ScanLine
            className="pointer-events-none absolute left-8 right-8 top-1/2 h-6 -translate-y-1/2 text-signal/60"
            strokeWidth={1.5}
          />
        </div>

        <p className="mt-3 text-[12px] leading-5 text-ink-300">{status}</p>
        {cameraError && <p className="mt-1 text-[11px] leading-5 text-caution">{cameraError}</p>}

        <div className="mt-4 rounded-lg border border-white/[0.06] bg-space-950 p-3">
          <label className="block text-[11px] text-ink-500" htmlFor="sensor-code">
            Sensor code
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id="sensor-code"
              value={manual}
              onChange={(event) => {
                setManual(event.target.value);
                setManualError(null);
              }}
              placeholder="SENSOR-AB12"
              className="h-10 min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-space-900 px-3 font-mono text-[13px] uppercase text-ink-100 outline-none placeholder:text-ink-500 focus:border-signal/50"
            />
            <button
              type="button"
              onClick={() => accept(manual)}
              disabled={!manual.trim()}
              className="flex h-10 items-center gap-1.5 rounded-lg bg-ink-100 px-3 text-[12px] font-medium text-space-950 transition-colors hover:bg-white disabled:opacity-40"
            >
              <QrCode className="h-4 w-4" strokeWidth={1.5} />
              Use code
            </button>
          </div>
          {manualError && <p className="mt-2 text-[11px] leading-5 text-caution">{manualError}</p>}
        </div>
      </div>
    </div>
  );
};
