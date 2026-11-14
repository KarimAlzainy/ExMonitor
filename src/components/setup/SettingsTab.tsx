import React, { useEffect, useState } from 'react';
import {
  Bell,
  Check,
  Cpu,
  Download,
  ExternalLink,
  HardDrive,
  Loader2,
  LucideIcon,
  QrCode,
  Radio,
  RefreshCw,
  Settings,
  ShieldCheck,
  User,
  Users,
  X
} from 'lucide-react';
import { AiModelTier } from '../../types/telemetry';
import { useTelemetry } from '../../context/TelemetryContext';
import {
  MODEL_OPTIONS,
  modelName,
  modelOption,
  loadBundleModel
} from '../../services/aiModels';
import { isModelReady, prepareModel, unloadModel } from '../../services/flightSurgeon';
import {
  AlertPermission,
  alertPermission,
  notificationsSupported,
  persistentStorageStatus,
  requestAlertPermission,
  requestPersistentStorage,
  showTestNotification
} from '../../services/notifications';
import { InfoTip } from '../ui/InfoTip';
import { SensorScanner } from './SensorScanner';

interface SettingsTabProps {
  onRunSetup: () => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ onRunSetup }) => {
  const {
    profile,
    updateProfile,
    connectSensor,
    aiModelTier,
    setAiModelTier,
    diagnostic,
    runHardwareDiagnostic,
    peers,
    crewLinkMode,
    nodeId,
    sensorStatus
  } = useTelemetry();

  const [name, setName] = useState(profile.name);
  const [label, setLabel] = useState(profile.label);
  const [saved, setSaved] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

  const [permission, setPermission] = useState<AlertPermission>(() => alertPermission());
  const [persisted, setPersisted] = useState(false);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [testSent, setTestSent] = useState<boolean | null>(null);

  const [modelBusy, setModelBusy] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);
  const [modelMessage, setModelMessage] = useState('');
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(() => isModelReady(aiModelTier));
  const [bundleLabel, setBundleLabel] = useState<string | null>(null);

  const [scanningDevice, setScanningDevice] = useState(false);

  useEffect(() => {
    setName(profile.name);
    setLabel(profile.label);
  }, [profile.name, profile.label]);

  useEffect(() => {
    setModelReady(isModelReady(aiModelTier));
  }, [aiModelTier]);

  useEffect(() => {
    void persistentStorageStatus().then(setPersisted);
    void loadBundleModel().then((bundle) => {
      if (!bundle) return;
      setBundleLabel(`${modelName(bundle.model)} · built ${bundle.builtAt || bundle.version}`);
    });
  }, []);

  const saveDetails = () => {
    updateProfile({ name, label });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2200);
  };

  const enableNotifications = async () => {
    setPermissionBusy(true);
    setTestSent(null);
    const result = await requestAlertPermission();
    setPermission(result);
    if (result === 'granted') {
      setTestSent(await showTestNotification());
      await requestPersistentStorage().then(setPersisted);
    }
    setPermissionBusy(false);
  };

  const protectStorage = async () => {
    setPersisted(await requestPersistentStorage());
  };

  const runDeviceScan = async () => {
    setScanningDevice(true);
    await runHardwareDiagnostic();
    setScanningDevice(false);
  };

  const downloadModel = async () => {
    if (aiModelTier === 'none') return;
    setModelError(null);
    setModelBusy(true);
    setModelProgress(0);
    setModelMessage('Checking this device');
    try {
      await prepareModel(aiModelTier, (progress) => {
        setModelProgress(progress.progress);
        setModelMessage(progress.text);
      });
      setModelReady(true);
      setModelProgress(1);
      setModelMessage('Ready on this device');
    } catch (error) {
      setModelError(
        error instanceof Error
          ? error.message
          : 'The model could not start. The written NASA rules still work.'
      );
      setModelReady(false);
    } finally {
      setModelBusy(false);
    }
  };

  const removeModel = async () => {
    setModelBusy(true);
    await unloadModel();
    setModelReady(false);
    setModelProgress(0);
    setModelMessage('Removed from memory. The files stay downloaded.');
    setModelBusy(false);
  };

  const sensorText =
    sensorStatus === 'connected'
      ? 'Sending readings now'
      : sensorStatus === 'waiting'
        ? 'Waiting for the first reading'
        : sensorStatus === 'stale'
          ? 'Stopped sending'
          : 'Not connected';

  const linkText =
    crewLinkMode === 'relay'
      ? 'Connected through the local relay'
      : crewLinkMode === 'local'
        ? 'This browser only'
        : 'Not connected';

  const selected = modelOption(aiModelTier);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-medium tracking-tight text-ink-100">
          <Settings className="h-5 w-5 text-ink-400" strokeWidth={1.5} />
          Settings
        </h1>
        <p className="mt-1 max-w-xl text-[13px] leading-6 text-ink-400">
          Everything on this page stays on this device. Change your details, reconnect the sensor, choose the
          on-board assistant or check the crew link.
        </p>
      </div>

      <Section
        icon={User}
        title="Your details"
        note="The name and label appear on your readings and on any alert you send."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-[12px] font-medium text-ink-200" htmlFor="settings-name">
              Your name
            </label>
            <input
              id="settings-name"
              value={name}
              maxLength={40}
              onChange={(event) => setName(event.target.value)}
              className="mt-2 h-10 w-full rounded-lg border border-white/[0.08] bg-space-950 px-3 text-[13px] text-ink-100 outline-none placeholder:text-ink-500 focus:border-signal/50"
              placeholder="For example, Sam"
            />
          </div>
          <div>
            <label className="flex items-center text-[12px] font-medium text-ink-200" htmlFor="settings-label">
              Your label
              <InfoTip text="Free text, such as Medic, Engineer or Team lead. It helps the crew know who sent an alert." />
            </label>
            <input
              id="settings-label"
              value={label}
              maxLength={40}
              onChange={(event) => setLabel(event.target.value)}
              className="mt-2 h-10 w-full rounded-lg border border-white/[0.08] bg-space-950 px-3 text-[13px] text-ink-100 outline-none placeholder:text-ink-500 focus:border-signal/50"
              placeholder="For example, Medic"
            />
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={saveDetails}
            disabled={!name.trim() || !label.trim()}
            className="h-9 rounded-lg bg-ink-100 px-3 text-[12px] font-medium text-space-950 transition-colors hover:bg-white disabled:opacity-40"
          >
            Save details
          </button>
          {saved && (
            <span className="flex items-center gap-1.5 text-[11px] text-positive">
              <Check className="h-3.5 w-3.5" strokeWidth={2} /> Saved on this device
            </span>
          )}
        </div>
      </Section>

      <Section
        icon={Radio}
        title="Body sensor"
        note="The sensor page turns a phone or another computer into the body sensors. Both devices must be on the same Wi-Fi or hotspot."
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border ${
                sensorStatus === 'connected'
                  ? 'border-positive/30 bg-positive/[0.08] text-positive'
                  : 'border-white/[0.08] bg-space-850 text-ink-400'
              }`}
            >
              <Radio className="h-5 w-5" strokeWidth={1.5} />
            </span>
            <div>
              <p className="text-[13px] font-medium text-ink-100">{sensorText}</p>
              <p className="mt-0.5 font-mono text-[11px] text-ink-400">
                {profile.sensorId ?? 'No sensor saved'}
              </p>
              {!profile.sensorId && (
                <p className="mt-1 max-w-md text-[11px] leading-5 text-ink-500">
                  Practice readings are showing. They behave like a calm crew member and never need a second
                  device.
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              className="flex h-9 items-center gap-1.5 rounded-lg bg-ink-100 px-3 text-[12px] font-medium text-space-950 transition-colors hover:bg-white"
            >
              <QrCode className="h-4 w-4" strokeWidth={1.7} />
              {profile.sensorId ? 'Replace sensor' : 'Scan sensor code'}
            </button>
            <a
              href="sensors.html"
              target="_blank"
              rel="noreferrer"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-space-850 px-3 text-[12px] font-medium text-ink-200 transition-colors hover:border-white/15"
            >
              <ExternalLink className="h-4 w-4" strokeWidth={1.6} />
              Sensor page
            </a>
            {profile.sensorId && (
              <button
                type="button"
                onClick={() => connectSensor(null)}
                className="flex h-9 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-space-850 px-3 text-[12px] font-medium text-ink-300 transition-colors hover:border-critical/30 hover:text-critical"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.8} />
                Remove
              </button>
            )}
          </div>
        </div>
      </Section>

      <Section
        icon={Bell}
        title="Emergency alerts"
        note="Another crew device can show a system notification as well as the full-screen alert. Browsers only deliver it while Ex-Monitor is open or installed."
      >
        <div className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-white/[0.06] bg-space-950 p-4">
            <div>
              <p className="text-[12px] font-medium text-ink-200">System notifications</p>
              <p className="mt-1 max-w-md text-[11px] leading-5 text-ink-400">
                {!notificationsSupported()
                  ? 'This address cannot show system notifications. Open the app on localhost or HTTPS. The full-screen alert still works.'
                  : permission === 'granted'
                    ? 'Allowed on this device. A test notification was available during setup.'
                    : permission === 'denied'
                      ? 'Blocked in the browser settings. The full-screen alert still works while the app is open.'
                      : 'Not enabled yet. Allow alerts so a crew emergency is visible from another tab.'}
              </p>
            </div>
            {notificationsSupported() && permission !== 'granted' && permission !== 'denied' && (
              <button
                type="button"
                onClick={() => void enableNotifications()}
                disabled={permissionBusy}
                className="flex h-9 items-center gap-2 rounded-lg bg-ink-100 px-3 text-[12px] font-medium text-space-950 transition-colors hover:bg-white disabled:opacity-50"
              >
                {permissionBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />}
                Allow alerts
              </button>
            )}
            {permission === 'granted' && (
              <span className="flex items-center gap-1.5 text-[11px] text-positive">
                <Check className="h-3.5 w-3.5" strokeWidth={2} /> Allowed
              </span>
            )}
          </div>

          {testSent !== null && (
            <p className={`text-[11px] leading-5 ${testSent ? 'text-positive' : 'text-caution'}`}>
              {testSent
                ? 'A test notification was sent. If you did not see it, check the system notification settings.'
                : 'The browser allowed alerts but could not show a test. The in-app alert still works.'}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-white/[0.06] bg-space-950 p-4">
            <div className="flex items-start gap-3">
              <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" strokeWidth={1.5} />
              <div>
                <p className="text-[12px] font-medium text-ink-200">Keep data on this device</p>
                <p className="mt-1 max-w-md text-[11px] leading-5 text-ink-400">
                  Ask the browser not to clear the downloaded model, your name and your settings when storage
                  runs low.
                </p>
              </div>
            </div>
            {persisted ? (
              <span className="flex items-center gap-1.5 text-[11px] text-positive">
                <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.8} /> Protected
              </span>
            ) : (
              <button
                type="button"
                onClick={() => void protectStorage()}
                className="h-9 rounded-lg border border-white/[0.08] bg-space-850 px-3 text-[12px] font-medium text-ink-200 transition-colors hover:border-white/15"
              >
                Protect storage
              </button>
            )}
          </div>
        </div>
      </Section>

      <Section
        icon={Cpu}
        title="On-board assistant"
        note="The assistant runs on this device. The first use downloads the model once; after that it works without the internet."
      >
        <div className="rounded-lg border border-white/[0.06] bg-space-950 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12px] text-ink-300">
              This device:{' '}
              <span className="text-ink-100">
                {diagnostic.estimatedRamGb} GB memory · {diagnostic.cpuCores} cores · {diagnostic.gpuTier}
              </span>
            </p>
            <button
              type="button"
              onClick={() => void runDeviceScan()}
              disabled={scanningDevice}
              className="flex items-center gap-1.5 text-[11px] font-medium text-signal-strong transition-colors hover:text-ink-100 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${scanningDevice ? 'animate-spin' : ''}`} strokeWidth={1.8} />
              Scan again
            </button>
          </div>
          <p className="mt-1 text-[11px] text-ink-500">
            Suggested for this device: {modelName(diagnostic.recommendedModel)}
            {!diagnostic.webGpu && ' · no WebGPU found, so the written rules are the safe choice'}
          </p>
          {bundleLabel && <p className="mt-1 text-[10.5px] text-ink-500">Included in this download: {bundleLabel}</p>}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {MODEL_OPTIONS.map((option) => {
            const active = option.id === aiModelTier;
            const ready = option.id !== 'none' && isModelReady(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => {
                  setAiModelTier(option.id);
                  setModelError(null);
                  setModelMessage('');
                }}
                className={`rounded-lg border p-3 text-left transition-colors ${
                  active
                    ? 'border-signal/50 bg-signal/[0.06]'
                    : 'border-white/[0.08] bg-space-950 hover:border-white/15'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[12px] font-medium text-ink-100">{option.name}</span>
                  {ready ? (
                    <span className="flex items-center gap-1 text-[10px] text-positive">
                      <Check className="h-3 w-3" strokeWidth={2.2} /> Ready
                    </span>
                  ) : active ? (
                    <span className="text-[10px] text-signal-strong">Selected</span>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] leading-4 text-ink-400">{option.note}</p>
                <p className="mt-1.5 font-mono text-[10px] text-ink-500">
                  {option.download} · {option.memory}
                </p>
              </button>
            );
          })}
        </div>

        {aiModelTier !== 'none' && (
          <div className="mt-3 rounded-lg border border-white/[0.06] bg-space-950 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[12px] font-medium text-ink-200">{selected.name}</p>
                <p className="mt-0.5 text-[11px] text-ink-500">
                  {modelReady
                    ? 'Loaded in memory and ready to answer.'
                    : `First use downloads ${selected.download}. The files stay cached for offline use.`}
                </p>
              </div>
              <div className="flex gap-2">
                {!modelReady ? (
                  <button
                    type="button"
                    onClick={() => void downloadModel()}
                    disabled={modelBusy}
                    className="flex h-9 items-center gap-2 rounded-lg bg-ink-100 px-3 text-[12px] font-medium text-space-950 transition-colors hover:bg-white disabled:opacity-50"
                  >
                    {modelBusy ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
                    ) : (
                      <Download className="h-3.5 w-3.5" strokeWidth={1.8} />
                    )}
                    {modelBusy ? 'Preparing' : 'Download and prepare'}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void removeModel()}
                    disabled={modelBusy}
                    className="h-9 rounded-lg border border-white/[0.08] bg-space-850 px-3 text-[12px] font-medium text-ink-300 transition-colors hover:border-white/15 disabled:opacity-50"
                  >
                    Unload from memory
                  </button>
                )}
              </div>
            </div>

            {modelBusy && (
              <div className="mt-3">
                <div className="h-1.5 overflow-hidden rounded-full bg-space-800">
                  <div
                    className="h-full rounded-full bg-signal transition-[width] duration-300"
                    style={{ width: `${Math.round(modelProgress * 100)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[10.5px] leading-4 text-ink-500">
                  {Math.round(modelProgress * 100)}% · {modelMessage || 'Starting'}
                </p>
              </div>
            )}

            {!modelBusy && modelMessage && !modelError && (
              <p className="mt-2 text-[11px] text-ink-500">{modelMessage}</p>
            )}
            {modelError && <p className="mt-2 text-[11px] leading-5 text-caution">{modelError}</p>}
          </div>
        )}

        {aiModelTier === 'none' && (
          <p className="mt-3 text-[11px] leading-5 text-ink-500">
            No model will download. The flight surgeon uses the written NASA action cards and the rules engine.
          </p>
        )}
      </Section>

      <Section
        icon={Users}
        title="Crew link"
        note="Alerts and sensor readings travel over a relay on this network. Two tabs in the same browser also find each other without the relay."
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <Fact label="Link" value={linkText} />
          <Fact label="This console" value={nodeId} mono />
          <Fact
            label="Other consoles"
            value={peers.length ? peers.map((peer) => peer.name || 'Unnamed').join(', ') : 'None seen yet'}
          />
        </div>
        <p className="mt-3 text-[11px] leading-5 text-ink-500">
          If the link says “This browser only”, start the relay or the packaged launcher. The sensor page and
          every console must open the same address on the network.
        </p>
      </Section>

      <Section
        icon={Cpu}
        title="This device"
        note="What the console can use for the on-device assistant."
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <Fact label="Memory" value={`${diagnostic.estimatedRamGb} GB`} />
          <Fact label="Processor cores" value={String(diagnostic.cpuCores)} />
          <Fact label="Browser storage" value={`${diagnostic.availableStorageGb} GB`} />
          <Fact label="Graphics" value={diagnostic.webGpu ? 'WebGPU ready' : 'No WebGPU'} />
        </div>
      </Section>

      <Section
        icon={ShieldCheck}
        title="Setup"
        note="Run the welcome steps again to change your name, sensor or alert choice."
      >
        <button
          type="button"
          onClick={onRunSetup}
          className="h-9 rounded-lg border border-white/[0.08] bg-space-850 px-3 text-[12px] font-medium text-ink-200 transition-colors hover:border-white/15"
        >
          Run setup again
        </button>
        <p className="mt-2 text-[11px] leading-5 text-ink-500">
          This is a training simulation. It does not replace real medical care or mission rules.
        </p>
      </Section>

      <SensorScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onCode={(code) => {
          connectSensor(code);
          setScannerOpen(false);
        }}
      />
    </div>
  );
};

function Section({
  icon: Icon,
  title,
  note,
  children
}: {
  icon: LucideIcon;
  title: string;
  note: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-white/[0.08] bg-space-900 p-5">
      <div className="mb-4">
        <h2 className="flex items-center gap-2 text-[15px] font-medium text-ink-100">
          <Icon className="h-4 w-4 text-ink-400" strokeWidth={1.5} />
          {title}
        </h2>
        <p className="mt-1 max-w-2xl text-[11px] leading-5 text-ink-500">{note}</p>
      </div>
      {children}
    </section>
  );
}

function Fact({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-space-950 px-3 py-2.5">
      <p className="text-[10.5px] text-ink-500">{label}</p>
      <p className={`mt-0.5 break-words text-[12px] text-ink-100 ${mono ? 'font-mono text-[11px]' : ''}`}>{value}</p>
    </div>
  );
}
