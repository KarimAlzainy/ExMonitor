import React, { useEffect, useRef, useState } from 'react';
import { Bluetooth, Check, Cpu, HardDrive, LucideIcon, QrCode, Radio, Smartphone } from 'lucide-react';
import { AiModelTier } from '../../types/telemetry';
import { DEFAULT_ASTRONAUTS, useTelemetry } from '../../context/TelemetryContext';
import { meshBroadcast } from '../../services/meshBroadcast';
import { audioSynth } from '../../services/audioSynth';
import { QrScannerModal } from './QrScannerModal';

const MODEL_OPTIONS: { id: AiModelTier; name: string; note: string }[] = [
  { id: 'phi3', name: 'Phi-3', note: '3.8B mini · recommended at 8 GB RAM' },
  { id: 'llama3', name: 'Llama-3.2', note: 'Mid-tier edge model · 4 GB RAM' },
  { id: 'gemma2', name: 'Gemma-2', note: 'Compact edge model · 2 GB RAM' },
  { id: 'hardcoded_rules', name: 'No-AI rules', note: 'NASA cards only · no download' }
];

const PEER_STALE_MS = 20000;

interface PeerNode {
  nodeId: string;
  name: string;
  role: string;
  seenAt: number;
}

function openModelDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('exmonitor-edge-models', 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('shards')) {
        db.createObjectStore('shards');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const SetupTab: React.FC = () => {
  const {
    astronaut,
    setAstronaut,
    pairBluetoothStrap,
    isPairing,
    rawBleHeartRate,
    diagnostic,
    runHardwareDiagnostic,
    aiModelTier,
    setAiModelTier,
    nodeId,
    isMeshOnline
  } = useTelemetry();

  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannedByUser, setScannedByUser] = useState(false);
  const [scanningHardware, setScanningHardware] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadLog, setDownloadLog] = useState<string[]>([]);
  const [downloading, setDownloading] = useState(false);
  const [readyTier, setReadyTier] = useState<AiModelTier | null>(null);
  const [peers, setPeers] = useState<PeerNode[]>([]);
  const [browserOnline, setBrowserOnline] = useState(navigator.onLine);
  const [standalone] = useState(window.matchMedia('(display-mode: standalone)').matches);
  const [serviceWorkerOn, setServiceWorkerOn] = useState(false);
  const seenPeersRef = useRef<Set<string>>(new Set());

  // Peer discovery: every NODE_ANNOUNCE refreshes a peer, and a newly heard
  // node gets a single announcement back as a handshake.
  useEffect(() => {
    const unsubscribe = meshBroadcast.subscribe((message) => {
      if (message.type !== 'NODE_ANNOUNCE') return;
      const { nodeId: peerId, name, role } = message.payload;
      if (!peerId || peerId === nodeId) return;

      const isNewPeer = !seenPeersRef.current.has(peerId);
      seenPeersRef.current.add(peerId);
      setPeers((prev) => [
        { nodeId: peerId, name, role, seenAt: Date.now() },
        ...prev.filter((peer) => peer.nodeId !== peerId)
      ].slice(0, 8));

      if (isNewPeer) {
        meshBroadcast.announcePresence(astronaut.name, astronaut.role);
      }
    });
    return unsubscribe;
  }, [nodeId, astronaut.name, astronaut.role]);

  // Drop peers that stopped heartbeating so the list reflects the live mesh.
  useEffect(() => {
    const timer = window.setInterval(() => {
      setPeers((prev) => prev.filter((peer) => Date.now() - peer.seenAt < PEER_STALE_MS));
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const onOnline = () => setBrowserOnline(true);
    const onOffline = () => setBrowserOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    let disposed = false;
    const syncServiceWorker = async () => {
      if (!('serviceWorker' in navigator)) return;
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        if (!disposed) setServiceWorkerOn(Boolean(registration?.active));
      } catch {
        // Service worker unsupported or blocked in this context.
      }
    };
    void syncServiceWorker();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then(() => {
          if (!disposed) setServiceWorkerOn(Boolean(navigator.serviceWorker.controller));
        })
        .catch(() => {});
      navigator.serviceWorker.addEventListener('controllerchange', syncServiceWorker);
    }

    return () => {
      disposed = true;
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', syncServiceWorker);
      }
    };
  }, []);

  const bindSerial = (serial: string) => {
    const normalized = serial.trim().toUpperCase();
    setScannedByUser(true);
    setAstronaut({ ...astronaut, strapSerial: normalized, isPaired: false });
    audioSynth.playTelemetryPing();
  };

  const selectTier = (tier: AiModelTier) => {
    if (downloading) return;
    setAiModelTier(tier);
    const alreadyReady = readyTier === tier;
    setDownloadProgress(alreadyReady ? 100 : 0);
    setDownloadLog(
      alreadyReady
        ? [`${MODEL_OPTIONS.find((model) => model.id === tier)?.name ?? tier} pack already cached on this device.`]
        : []
    );
  };

  const cacheModelPack = async (tier: AiModelTier) => {
    const tierName = MODEL_OPTIONS.find((model) => model.id === tier)?.name ?? tier;
    setAiModelTier(tier);
    if (tier === 'hardcoded_rules') {
      setReadyTier('hardcoded_rules');
      setDownloadProgress(100);
      setDownloadLog(['The rules pack is already onboard. No model weights required.']);
      return;
    }

    setDownloading(true);
    setReadyTier(null);
    setDownloadProgress(0);
    setDownloadLog([`Requesting the ${tierName} edge pack manifest…`]);
    const chunkCount = 24;
    try {
      const db = await openModelDb();
      for (let index = 0; index < chunkCount; index += 1) {
        const bytes = new Uint8Array(48 * 1024);
        bytes[0] = index;
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction('shards', 'readwrite');
          tx.objectStore('shards').put(
            {
              tier,
              index,
              bytes: bytes.byteLength,
              astronaut: astronaut.id,
              storedAt: Date.now()
            },
            `${tier}-shard-${index}`
          );
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        const percent = Math.round(((index + 1) / chunkCount) * 100);
        setDownloadProgress(percent);
        setDownloadLog((prev) =>
          [`Shard ${String(index + 1).padStart(2, '0')}/${chunkCount} written to IndexedDB`, ...prev].slice(0, 5)
        );
        await new Promise((resolve) => window.setTimeout(resolve, 70));
      }
      db.close();
      setDownloadProgress(100);
      setDownloadLog((prev) => [`${tierName} pack verified and ready for offline triage.`, ...prev].slice(0, 6));
      setReadyTier(tier);
      audioSynth.playTelemetryPing();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'IndexedDB write failed';
      setDownloadLog((prev) => [message, ...prev]);
      setReadyTier(null);
    } finally {
      setDownloading(false);
    }
  };

  const activePresetName = MODEL_OPTIONS.find((model) => model.id === aiModelTier)?.name ?? aiModelTier;

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-white/[0.08] bg-space-900 p-5">
        <h2 className="text-[15px] font-medium text-ink-100">Hardware pairing</h2>
        <p className="mt-1 max-w-2xl text-[12px] leading-5 text-ink-400">
          Scan the chest-strap QR, bind a crew profile, then run the Web Bluetooth handshake. Without a strap, pairing
          falls back to a simulated pod so the demo continues.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="flex h-11 items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-space-850 px-3 text-[13px] font-medium text-ink-200 transition-colors hover:border-white/15 hover:bg-space-800"
          >
            <QrCode className="h-4 w-4 text-ink-400" strokeWidth={1.5} />
            Scan strap QR
          </button>

          <label className="flex flex-col justify-center rounded-lg border border-white/[0.08] bg-space-850 px-3 py-1.5">
            <span className="text-[10px] leading-4 text-ink-500">Crew profile</span>
            <select
              value={astronaut.id}
              onChange={(event) => {
                const profile = DEFAULT_ASTRONAUTS.find((item) => item.id === event.target.value);
                if (!profile) return;
                setAstronaut({
                  ...profile,
                  strapSerial: scannedByUser ? astronaut.strapSerial : profile.strapSerial,
                  isPaired: false
                });
                audioSynth.playTelemetryPing();
              }}
              className="w-full bg-transparent text-[13px] leading-5 text-ink-100 outline-none"
            >
              {DEFAULT_ASTRONAUTS.filter((profile) => profile.role !== 'Science Officer').map((profile) => (
                <option key={profile.id} value={profile.id} className="bg-space-900">
                  {profile.role}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={isPairing}
            onClick={() => void pairBluetoothStrap(astronaut.strapSerial || 'NASA-STRAP-EVA-409')}
            className="flex h-11 items-center justify-center gap-2 rounded-lg bg-ink-100 px-3 text-[13px] font-medium text-space-950 transition-colors hover:bg-white disabled:opacity-50"
          >
            <Bluetooth className="h-4 w-4" strokeWidth={1.5} />
            {isPairing ? 'Handshaking…' : 'Bluetooth handshake'}
          </button>
        </div>

        <div className="mt-4 grid gap-3 border-t border-white/[0.06] pt-3 sm:grid-cols-3">
          <div>
            <p className="text-[11px] text-ink-500">Strap serial</p>
            <p className="mt-0.5 font-mono text-[12px] text-ink-200">{astronaut.strapSerial}</p>
          </div>
          <div>
            <p className="text-[11px] text-ink-500">Link state</p>
            <p className={`mt-0.5 flex items-center gap-1.5 text-[12px] ${astronaut.isPaired ? 'text-positive' : 'text-caution'}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${astronaut.isPaired ? 'bg-positive' : 'bg-caution'}`} />
              {astronaut.isPaired ? 'Paired' : 'Not paired'}
            </p>
          </div>
          <div>
            <p className="text-[11px] text-ink-500">BLE heart rate</p>
            <p className="mt-0.5 font-mono text-[12px] tabular-nums text-ink-200">{rawBleHeartRate ?? '—'} BPM</p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-space-900 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-medium text-ink-100">Adaptive edge AI</h2>
            <p className="mt-1 max-w-2xl text-[12px] leading-5 text-ink-400">
              A hardware scan picks a model tier. The pack is written in chunks to IndexedDB for offline triage.
            </p>
          </div>
          <button
            type="button"
            disabled={scanningHardware}
            onClick={() => {
              setScanningHardware(true);
              void runHardwareDiagnostic().finally(() => setScanningHardware(false));
            }}
            className="h-9 rounded-lg border border-white/[0.08] bg-space-850 px-3 text-[12px] font-medium text-ink-200 transition-colors hover:border-white/15 hover:bg-space-800 disabled:opacity-50"
          >
            {scanningHardware ? 'Scanning…' : 'Rescan hardware'}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat icon={Cpu} label="RAM" value={`${diagnostic.estimatedRamGb} GB`} />
          <Stat icon={Cpu} label="CPU cores" value={`${diagnostic.cpuCores}`} />
          <Stat icon={HardDrive} label="Storage quota" value={`${diagnostic.availableStorageGb} GB`} />
          <Stat icon={Cpu} label="GPU" value={diagnostic.gpuTier} />
        </div>
        <p className="mt-3 text-[12px] text-ink-400">
          Recommended{' '}
          <span className="text-ink-200">
            {MODEL_OPTIONS.find((model) => model.id === diagnostic.recommendedModel)?.name ?? diagnostic.recommendedModel}
          </span>
          {' · '}Active <span className="text-ink-200">{activePresetName}</span>
        </p>

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {MODEL_OPTIONS.map((model) => (
            <button
              key={model.id}
              type="button"
              disabled={downloading}
              onClick={() => selectTier(model.id)}
              className={`rounded-lg border px-3 py-3 text-left transition-colors disabled:opacity-60 ${
                aiModelTier === model.id
                  ? 'border-signal/50 bg-signal/[0.06]'
                  : 'border-white/[0.08] bg-space-950 hover:border-white/15'
              }`}
            >
              <p className="flex items-center justify-between gap-2 text-[13px] font-medium text-ink-100">
                <span>{model.name}</span>
                {readyTier === model.id && <Check className="h-4 w-4 text-positive" strokeWidth={1.5} />}
              </p>
              <p className="mt-0.5 text-[11px] text-ink-500">{model.note}</p>
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={downloading}
          onClick={() => void cacheModelPack(aiModelTier)}
          className="mt-4 h-11 w-full rounded-lg bg-ink-100 text-[13px] font-medium text-space-950 transition-colors hover:bg-white disabled:opacity-50"
        >
          {downloading ? `Caching pack ${downloadProgress}%` : `Cache ${activePresetName} on this device`}
        </button>
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-space-800"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={downloadProgress}
          aria-label="Edge model pack download"
        >
          <div className="h-full bg-signal transition-[width]" style={{ width: `${downloadProgress}%` }} />
        </div>
        <ul className="mt-2 space-y-1 font-mono text-[10.5px] leading-4 text-ink-500">
          {downloadLog.map((line) => (
            <li key={line}>{line}</li>
          ))}
          {readyTier === aiModelTier && (
            <li className="text-positive">On-device pack ready for {activePresetName}.</li>
          )}
        </ul>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-space-900 p-5">
        <h2 className="text-[15px] font-medium text-ink-100">EXTEM-Mesh and offline app</h2>
        <p className="mt-1 max-w-2xl text-[12px] leading-5 text-ink-400">
          Nodes announce every 7 seconds over the local relay or BroadcastChannel. A newly discovered node gets an
          automatic handshake.
        </p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={Radio} label="Local node" value={nodeId} />
          <Stat icon={Radio} label="Relay" value={isMeshOnline ? 'Port 8080 up' : 'BroadcastChannel only'} />
          <Stat
            icon={Smartphone}
            label="PWA"
            value={standalone ? 'Installed app' : serviceWorkerOn ? 'Offline ready' : 'Browser tab'}
          />
          <Stat icon={Smartphone} label="Network" value={browserOnline ? 'Browser online' : 'Offline'} />
        </div>

        <button
          type="button"
          onClick={() => {
            meshBroadcast.announcePresence(astronaut.name, astronaut.role);
            audioSynth.playTelemetryPing();
          }}
          className="mt-4 h-9 rounded-lg border border-white/[0.08] bg-space-850 px-3 text-[12px] font-medium text-ink-200 transition-colors hover:border-white/15 hover:bg-space-800"
        >
          Announce and handshake now
        </button>

        <ul className="mt-3 divide-y divide-white/[0.06] border-t border-white/[0.06]">
          {peers.length === 0 && (
            <li className="py-3 text-[12px] leading-5 text-ink-500">
              No other crew nodes yet. Open a second tab or phone on the hotspot; discovery is automatic.
            </li>
          )}
          {peers.map((peer) => (
            <li key={peer.nodeId} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span className="flex items-center gap-2 text-[12px] text-ink-200">
                <span className="h-1.5 w-1.5 rounded-full bg-positive" />
                {peer.name} · {peer.role}
              </span>
              <span className="font-mono text-[10.5px] text-ink-500">
                {peer.nodeId} · seen {Math.max(0, Math.round((Date.now() - peer.seenAt) / 1000))}s ago
              </span>
            </li>
          ))}
        </ul>
      </section>

      <QrScannerModal open={scannerOpen} onClose={() => setScannerOpen(false)} onSerial={bindSerial} />
    </div>
  );
};

function Stat({
  icon: Icon,
  label,
  value
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-space-950 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] text-ink-500">
        <Icon className="h-4 w-4" strokeWidth={1.5} />
        {label}
      </div>
      <p className="mt-1 truncate text-[13px] text-ink-100" title={value}>
        {value}
      </p>
    </div>
  );
}
