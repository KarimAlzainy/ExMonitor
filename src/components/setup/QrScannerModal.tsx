import React, { useEffect, useRef, useState } from 'react';
import { Camera, ScanLine, X } from 'lucide-react';

const SIMULATED_SERIAL = 'NASA-STRAP-EVA-409';
const STRAP_PATTERN = /^NASA-STRAP-[A-Z0-9-]+$/;

interface BarcodeHit {
  rawValue: string;
}

interface BarcodeDetectorLike {
  detect: (source: CanvasImageSource) => Promise<BarcodeHit[]>;
}

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onSerial: (serial: string) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({ open, onClose, onSerial }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const onCloseRef = useRef(onClose);
  const onSerialRef = useRef(onSerial);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [status, setStatus] = useState('Opening camera…');

  onCloseRef.current = onClose;
  onSerialRef.current = onSerial;

  const acceptSerial = (rawValue: string) => {
    const serial = rawValue.trim().toUpperCase();
    if (!STRAP_PATTERN.test(serial)) {
      setStatus(`Unrecognized code "${serial.slice(0, 28)}" — scan a NASA-STRAP label.`);
      return;
    }
    onSerialRef.current(serial);
    onCloseRef.current();
  };

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer = 0;
    let detecting = false;

    setCameraError(null);
    setStatus('Opening camera…');

    const stop = () => {
      stopped = true;
      window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('This browser has no camera API. Use the simulated strap scan.');
        setStatus('Camera unavailable');
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
        setStatus('Point the camera at the strap QR code');

        const Detector = (
          window as unknown as {
            BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
          }
        ).BarcodeDetector;
        if (!Detector || !videoRef.current) {
          setStatus('Live decode is unavailable here. Camera preview is on — use the simulated scan instead.');
          return;
        }

        const detector = new Detector({ formats: ['qr_code'] });
        timer = window.setInterval(async () => {
          if (stopped || detecting || !videoRef.current || videoRef.current.readyState < 2) return;
          detecting = true;
          try {
            const codes = await detector.detect(videoRef.current);
            const value = codes[0]?.rawValue?.trim();
            if (value) acceptSerial(value);
          } catch {
            // A single missed frame should not close the scanner.
          } finally {
            detecting = false;
          }
        }, 700);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Camera permission was denied';
        if (!stopped) {
          setCameraError(message);
          setStatus('Camera blocked. Simulated strap scan is ready.');
        }
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Strap QR scanner"
        className="w-full max-w-lg rounded-2xl border border-space-700 bg-space-900 p-4 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-nasa-cyan" />
            <h3 className="font-mono text-sm text-slate-100">Strap QR scanner</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-300 hover:bg-space-800"
            aria-label="Close scanner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-space-800 bg-black">
          <video ref={videoRef} className="h-64 w-full object-cover" muted playsInline />
          <div className="pointer-events-none absolute inset-6 rounded-xl border-2 border-nasa-cyan/70" />
          <ScanLine className="pointer-events-none absolute left-8 right-8 top-1/2 h-6 -translate-y-1/2 text-nasa-cyan/80" />
        </div>

        <p className="mt-3 font-mono text-xs text-slate-300">{status}</p>
        {cameraError && <p className="mt-1 text-xs text-amber-300">{cameraError}</p>}
        <p className="mt-1 font-mono text-[10px] text-slate-500">Accepted format: NASA-STRAP-*</p>

        <button
          type="button"
          onClick={() => acceptSerial(SIMULATED_SERIAL)}
          className="mt-4 w-full rounded-xl border border-nasa-cyan/40 bg-nasa-cyan/10 py-3 font-mono text-sm text-nasa-cyan hover:bg-nasa-cyan/20"
        >
          Simulate scan · {SIMULATED_SERIAL}
        </button>
      </div>
    </div>
  );
};
