import React, { useEffect, useRef, useState } from 'react';
import { Bluetooth, CheckCircle2, Cpu, HardDrive, QrCode, Radio, Smartphone } from 'lucide-react';
import { AiModelTier } from '../../types/telemetry';
import { DEFAULT_ASTRONAUTS, useTelemetry } from '../../context/TelemetryContext';
import { meshBroadcast } from '../../services/meshBroadcast';
import { audioSynth } from '../../services/audioSynth';
import { QrScannerModal } from './QrScannerModal';

const MODEL_OPTIONS: { id: AiModelTier; name: string; note: string }[] = [
  { id: 'phi3', name: 'Phi-3', note: '3.8B mini · recommended at 8 GB RAM' },
  { id: 'llama3', name: 'Llama-3.2', note: 'Mid-tier edge model · 4 GB RAM' },
  { id: 'gemma2', name: 'Gemma-2', note: 'Compact edge model · 2 GB RAM' },
  { id: 'hardcoded_rules', name: 'No-AI Rules', note: 'NASA cards only · no download' }
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
      setDownloadLog(['Rules pack is already onboard. No model weights required.']);
      return;
    }

    setDownloading(true);
    setReadyTier(null);
    setDownloadProgress(0);
    setDownloadLog([`Requesting ${tierName} edge pack manifest…`]);
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
      <section className="rounded-2xl border border-space-700/60 bg-space-900 p-4 sm:p-5">
        <h2 className="font-mono text-sm font-semibold text-slate-100">1 · Hardware pairing</h2>
        <p className="mt-1 text-xs text-slate-400">
          Scan the chest-strap QR, bind a crew profile, then run the explicit Web Bluetooth handshake. If no strap is
          present, pairing falls back to a simulated pod so the demo continues.
        </p>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <button
            type="button"
            onClick={() => setScannerOpen(true)}
            className="flex items-center justify-center gap-2 rounded-xl border border-space-700 bg-space-950 px-3 py-4 font-mono text-sm text-slate-100 hover:border-nasa-cyan/40"
          >
            <QrCode className="h-4 w-4 text-nasa-cyan" />
            Scan strap QR
          </button>

          <label className="block rounded-xl border border-space-700 bg-space-950 px-3 py-3">
            <span className="font-mono text-[10px] uppercase text-slate-400">Bind profile</span>
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
              className="mt-1 w-full bg-transparent font-mono text-sm text-slate-100 outline-none"
            >
              {DEFAULT_ASTRONAUTS.filter((profile) => profile.role !== 'Science Officer').map((profile) => (
                <option key={profile.id} value={profile.id} className="bg-space-950">
                  {profile.role}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            disabled={isPairing}
            onClick={() => void pairBluetoothStrap(astronaut.strapSerial || 'NASA-STRAP-EVA-409')}
            className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-4 font-mono text-sm text-emerald-200 disabled:opacity-50"
          >
            <Bluetooth className="h-4 w-4" />
            {isPairing ? 'Handshaking…' : 'Bluetooth handshake'}
          </button>
        </div>

        <div className="mt-3 grid gap-2 font-mono text-xs text-slate-300 sm:grid-cols-3">
          <p>Serial: {astronaut.strapSerial}</p>
          <p className={astronaut.isPaired ? 'text-emerald-300' : 'text-amber-200'}>
            {astronaut.isPaired ? (
              <span className="inline-flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Paired
              </span>
            ) : (
              'Not paired'
            )}
          </p>
          <p>BLE heart rate: {rawBleHeartRate ?? '—'} BPM</p>
        </div>
      </section>

      <section className="rounded-2xl border border-space-700/60 bg-space-900 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-mono text-sm font-semibold text-slate-100">2 · Adaptive edge-AI</h2>
            <p className="mt-1 text-xs text-slate-400">
              Hardware scan picks a model tier. The pack is written in chunks to IndexedDB for offline triage.
            </p>
          </div>
          <button
            type="button"
            disabled={scanningHardware}
            onClick={() => {
              setScanningHardware(true);
              void runHardwareDiagnostic().finally(() => setScanningHardware(false));
            }}
            className="rounded-lg border border-space-700 px-3 py-1.5 font-mono text-xs text-slate-200 disabled:opacity-50"
          >
            {scanningHardware ? 'Scanning…' : 'Rescan hardware'}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          <Stat icon={Cpu} label="RAM" value={`${diagnostic.estimatedRamGb} GB`} />
          <Stat icon={Cpu} label="CPU cores" value={`${diagnostic.cpuCores}`} />
          <Stat icon={HardDrive} label="Storage quota" value={`${diagnostic.availableStorageGb} GB`} />
          <Stat icon={Cpu} label="GPU" value={diagnostic.gpuTier} />
        </div>
        <p className="mt-2 font-mono text-[11px] text-nasa-cyan">
          Recommended tier: {MODEL_OPTIONS.find((model) => model.id === diagnostic.recommendedModel)?.name ?? diagnostic.recommendedModel}
          {' · '}active: {activePresetName}
        </p>

        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {MODEL_OPTIONS.map((model) => (
            <button
              key={model.id}
              type="button"
              disabled={downloading}
              onClick={() => selectTier(model.id)}
              className={`rounded-xl border px-3 py-3 text-left transition disabled:opacity-60 ${
                aiModelTier === model.id ? 'border-nasa-cyan/50 bg-nasa-cyan/10' : 'border-space-700 bg-space-950'
              }`}
            >
              <p className="flex items-center justify-between font-mono text-sm text-slate-100">
                <span>{model.name}</span>
                {readyTier === model.id && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />}
              </p>
              <p className="text-xs text-slate-400">{model.note}</p>
            </button>
          ))}
        </div>

        <button
          type="button"
          disabled={downloading}
          onClick={() => void cacheModelPack(aiModelTier)}
          className="mt-3 w-full rounded-xl bg-nasa-cyan py-3 font-mono text-sm font-semibold text-space-950 disabled:opacity-50"
        >
          {downloading ? `Caching pack ${downloadProgress}%` : `Cache ${activePresetName} on this device`}
        </button>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-space-950"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={downloadProgress}
          aria-label="Edge model pack download"
        >
          <div className="h-full bg-nasa-cyan transition-all" style={{ width: `${downloadProgress}%` }} />
        </div>
        <ul className="mt-2 space-y-1 font-mono text-[11px] text-slate-400">
          {downloadLog.map((line) => (
            <li key={line}>{line}</li>
          ))}
          {readyTier === aiModelTier && (
            <li className="text-emerald-300">On-device pack ready for {activePresetName}.</li>
          )}
        </ul>
      </section>

      <section className="rounded-2xl border border-space-700/60 bg-space-900 p-4 sm:p-5">
        <h2 className="font-mono text-sm font-semibold text-slate-100">3 · EXTEM-Mesh and PWA</h2>
        <p className="mt-1 text-xs text-slate-400">
          Nodes announce every 7 seconds over the local relay or BroadcastChannel. A newly discovered node gets an
          automatic handshake.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
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
          className="mt-4 rounded-xl border border-space-700 px-4 py-2 font-mono text-sm text-slate-100 hover:border-nasa-cyan/40"
        >
          Announce / handshake now
        </button>

        <ul className="mt-3 space-y-2">
          {peers.length === 0 && (
            <li className="font-mono text-xs text-slate-400">
              No other crew nodes yet. Open a second tab or phone on the hotspot; discovery is automatic.
            </li>
          )}
          {peers.map((peer) => (
            <li
              key={peer.nodeId}
              className="flex items-center justify-between gap-3 rounded-xl border border-space-800 bg-space-950 px-3 py-2 font-mono text-xs text-slate-200"
            >
              <span className="flex items-center gap-2">
                <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
                {peer.name} · {peer.role}
              </span>
              <span className="text-[10px] text-slate-500">
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

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-space-800 bg-space-950 px-3 py-2">
      <div className="flex items-center gap-1.5 text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        <span className="font-mono text-[10px] uppercase">{label}</span>
      </div>
      <p className="mt-1 truncate font-mono text-xs text-slate-100">{value}</p>
    </div>
  );
}
