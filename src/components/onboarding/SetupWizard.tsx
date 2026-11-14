import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Check,
  ExternalLink,
  HardDrive,
  Loader2,
  LucideIcon,
  QrCode,
  Radio,
  ShieldCheck,
  Smartphone,
  X
} from 'lucide-react';
import { CrewProfile } from '../../types/telemetry';
import { profileFromParts } from '../../services/profileStore';
import {
  AlertPermission,
  alertPermission,
  isStandalone,
  notificationsSupported,
  persistentStorageStatus,
  requestAlertPermission,
  requestPersistentStorage,
  showTestNotification
} from '../../services/notifications';
import { InfoTip } from '../ui/InfoTip';
import { SensorScanner } from '../setup/SensorScanner';

interface SetupWizardProps {
  initialProfile: CrewProfile;
  onComplete: (profile: CrewProfile) => void;
  onCancel?: () => void;
}

const LABEL_SUGGESTIONS = ['Commander', 'Medic', 'Engineer', 'Scientist'];
const STEP_TITLES = ['Connect the sensor', 'Your details', 'Alerts', 'Ready'];

export const SetupWizard: React.FC<SetupWizardProps> = ({ initialProfile, onComplete, onCancel }) => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialProfile.name);
  const [label, setLabel] = useState(initialProfile.label);
  const [sensorId, setSensorId] = useState<string | null>(initialProfile.sensorId);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [permission, setPermission] = useState<AlertPermission>(() => alertPermission());
  const [persisted, setPersisted] = useState(false);
  const [storageBusy, setStorageBusy] = useState(false);
  const [permissionBusy, setPermissionBusy] = useState(false);
  const [testState, setTestState] = useState<'idle' | 'sent' | 'failed'>('idle');

  useEffect(() => {
    void persistentStorageStatus().then(setPersisted);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  const canContinue = step !== 1 || Boolean(name.trim() && label.trim());

  const enableNotifications = async () => {
    setPermissionBusy(true);
    setTestState('idle');
    const result = await requestAlertPermission();
    setPermission(result);
    if (result === 'granted') {
      const sent = await showTestNotification();
      setTestState(sent ? 'sent' : 'failed');
      await requestPersistentStorage().then(setPersisted);
    }
    setPermissionBusy(false);
  };

  const enableStorage = async () => {
    setStorageBusy(true);
    setPersisted(await requestPersistentStorage());
    setStorageBusy(false);
  };

  const finish = () => {
    const next = profileFromParts(initialProfile, {
      name,
      label,
      sensorId,
      notificationsAsked: initialProfile.notificationsAsked || permission !== 'default'
    });
    onComplete({ ...next, completedAt: Date.now() });
  };

  const next = () => {
    if (step < 3) setStep(step + 1);
  };

  return (
    <div className="min-h-dvh bg-space-950 text-ink-100">
      <div className="mx-auto flex min-h-dvh w-full max-w-5xl flex-col px-4 py-5 sm:px-6 sm:py-8">
        <header className="flex items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
          <div>
            <p className="text-[15px] font-semibold leading-5 tracking-tight text-ink-100">Ex-Monitor</p>
            <p className="mt-0.5 text-[11px] text-ink-500">Crew health console</p>
          </div>
          <div className="flex items-center gap-3">
            <p className="font-mono text-[10.5px] tabular-nums text-ink-500">
              Step {step + 1} of {STEP_TITLES.length}
            </p>
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-400 transition-colors hover:bg-space-850 hover:text-ink-100"
                aria-label="Close setup"
              >
                <X className="h-4 w-4" strokeWidth={1.5} />
              </button>
            )}
          </div>
        </header>

        <div className="mt-5 flex items-center gap-2" aria-label="Setup progress">
          {STEP_TITLES.map((title, index) => {
            const done = index < step;
            const active = index === step;
            return (
              <React.Fragment key={title}>
                <button
                  type="button"
                  disabled={index > step}
                  onClick={() => setStep(index)}
                  className={`flex min-w-0 items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors ${
                    active ? 'text-ink-100' : done ? 'text-ink-300' : 'text-ink-500'
                  }`}
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[9px] ${
                      active
                        ? 'border-signal/60 bg-signal/10 text-signal-strong'
                        : done
                          ? 'border-positive/40 bg-positive/10 text-positive'
                          : 'border-white/10'
                    }`}
                  >
                    {done ? <Check className="h-3 w-3" strokeWidth={2} /> : String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="hidden truncate text-[11px] sm:inline">{title}</span>
                </button>
                {index < STEP_TITLES.length - 1 && <span className="h-px min-w-2 flex-1 bg-white/[0.08]" />}
              </React.Fragment>
            );
          })}
        </div>

        <main className="flex flex-1 items-start justify-center py-6 sm:py-10">
          <div className="w-full max-w-2xl">
            {step === 0 && (
              <section>
                <StepHeading
                  icon={Radio}
                  kicker="First, the body sensor"
                  title="Connect the sensor"
                  text="The sensor page turns a phone or another computer into the body sensors. Open it on that device, then scan its code here. If you skip this, the console uses gentle practice readings instead."
                />
                <div className="mt-6 rounded-xl border border-white/[0.08] bg-space-900 p-5">
                  {sensorId ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-positive/30 bg-positive/[0.08] text-positive">
                          <Check className="h-5 w-5" strokeWidth={1.8} />
                        </span>
                        <div>
                          <p className="text-[13px] font-medium text-ink-100">Sensor saved</p>
                          <p className="mt-0.5 font-mono text-[11px] text-ink-400">{sensorId}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSensorId(null)}
                        className="h-9 rounded-lg border border-white/[0.08] bg-space-850 px-3 text-[12px] text-ink-200 transition-colors hover:border-white/15"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-space-850 text-ink-400">
                        <Radio className="h-5 w-5" strokeWidth={1.5} />
                      </span>
                      <div>
                        <p className="text-[13px] font-medium text-ink-100">No sensor connected</p>
                        <p className="mt-1 text-[12px] leading-5 text-ink-400">
                          Practice readings will keep the screen alive. You can connect a sensor later in Setup.
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => setScannerOpen(true)}
                      className="flex h-11 items-center justify-center gap-2 rounded-lg bg-ink-100 px-3 text-[13px] font-medium text-space-950 transition-colors hover:bg-white"
                    >
                      <QrCode className="h-4 w-4" strokeWidth={1.7} />
                      Scan the sensor code
                    </button>
                    <a
                      href="sensors.html"
                      target="_blank"
                      rel="noreferrer"
                      className="flex h-11 items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-space-850 px-3 text-[13px] font-medium text-ink-200 transition-colors hover:border-white/15 hover:bg-space-800"
                    >
                      <ExternalLink className="h-4 w-4" strokeWidth={1.6} />
                      Open the sensor page
                    </a>
                  </div>

                  <button
                    type="button"
                    onClick={next}
                    className="mt-3 h-9 w-full rounded-lg border border-white/[0.06] text-[12px] text-ink-400 transition-colors hover:bg-space-850 hover:text-ink-200"
                  >
                    Skip the sensor for now
                  </button>

                  <p className="mt-4 border-t border-white/[0.06] pt-3 text-[11px] leading-5 text-ink-500">
                    The sensor page and this console must be open on the same Wi-Fi or hotspot. The sensor code only
                    tells the console which readings to listen for; it is not a password.
                  </p>
                </div>
              </section>
            )}

            {step === 1 && (
              <section>
                <StepHeading
                  icon={Smartphone}
                  kicker="Second, your name"
                  title="Tell the crew who you are"
                  text="This name and label appear on your readings and on any alert you send. Both stay on this device."
                />
                <div className="mt-6 rounded-xl border border-white/[0.08] bg-space-900 p-5">
                  <label className="block text-[12px] font-medium text-ink-200" htmlFor="setup-name">
                    Your name
                  </label>
                  <input
                    id="setup-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="For example, Sam"
                    autoComplete="name"
                    maxLength={40}
                    className="mt-2 h-11 w-full rounded-lg border border-white/[0.08] bg-space-950 px-3 text-[14px] text-ink-100 outline-none placeholder:text-ink-500 focus:border-signal/50"
                  />

                  <label className="mt-5 block text-[12px] font-medium text-ink-200" htmlFor="setup-label">
                    Your label
                    <InfoTip text="A free-text label such as Medic, Engineer or Team lead. It is shown next to your name so the crew knows your job." />
                  </label>
                  <input
                    id="setup-label"
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    placeholder="For example, Medic"
                    maxLength={40}
                    className="mt-2 h-11 w-full rounded-lg border border-white/[0.08] bg-space-950 px-3 text-[14px] text-ink-100 outline-none placeholder:text-ink-500 focus:border-signal/50"
                  />
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {LABEL_SUGGESTIONS.map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => setLabel(suggestion)}
                        className={`h-7 rounded-md border px-2 text-[11px] transition-colors ${
                          label === suggestion
                            ? 'border-signal/50 bg-signal/[0.08] text-ink-100'
                            : 'border-white/[0.08] bg-space-850 text-ink-400 hover:border-white/15 hover:text-ink-200'
                        }`}
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>

                  {!canContinue && (
                    <p className="mt-4 text-[11px] leading-5 text-caution">
                      Add a name and a label to continue.
                    </p>
                  )}
                </div>
              </section>
            )}

            {step === 2 && (
              <section>
                <StepHeading
                  icon={Bell}
                  kicker="Third, alerts"
                  title="Choose how alerts reach you"
                  text="When another crew device sends an emergency alert, this device can show a system notification as well as the full-screen alert. Browsers only deliver it while Ex-Monitor is open or installed."
                />
                <div className="mt-6 space-y-3">
                  <div className="rounded-xl border border-white/[0.08] bg-space-900 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-space-850 text-ink-300">
                          <Bell className="h-5 w-5" strokeWidth={1.5} />
                        </span>
                        <div>
                          <p className="text-[13px] font-medium text-ink-100">System notifications</p>
                          <p className="mt-1 max-w-md text-[12px] leading-5 text-ink-400">
                            {!notificationsSupported()
                              ? 'This address cannot show system notifications. Open the app on localhost or HTTPS. The full-screen alert still works.'
                              : permission === 'granted'
                                ? 'Alerts are allowed on this device.'
                                : permission === 'denied'
                                  ? 'Alerts are blocked in the browser settings. The full-screen alert still works while the app is open.'
                                  : 'Allow alerts so a crew emergency is visible even when you are in another tab.'}
                          </p>
                        </div>
                      </div>
                      {notificationsSupported() && permission !== 'granted' && permission !== 'denied' && (
                        <button
                          type="button"
                          disabled={permissionBusy}
                          onClick={() => void enableNotifications()}
                          className="flex h-9 items-center gap-2 rounded-lg bg-ink-100 px-3 text-[12px] font-medium text-space-950 transition-colors hover:bg-white disabled:opacity-50"
                        >
                          {permissionBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />}
                          Allow alerts
                        </button>
                      )}
                      {permission === 'granted' && (
                        <span className="flex items-center gap-1.5 text-[11px] text-positive">
                          <Check className="h-3.5 w-3.5" strokeWidth={2} />
                          Allowed
                        </span>
                      )}
                    </div>
                    {testState === 'sent' && (
                      <p className="mt-3 text-[11px] leading-5 text-positive">
                        A test notification was sent. If you did not see it, check the system notification settings.
                      </p>
                    )}
                    {testState === 'failed' && (
                      <p className="mt-3 text-[11px] leading-5 text-caution">
                        The browser allowed alerts but could not show the test. The in-app alert still works.
                      </p>
                    )}
                  </div>

                  <div className="rounded-xl border border-white/[0.08] bg-space-900 p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-space-850 text-ink-300">
                          <HardDrive className="h-5 w-5" strokeWidth={1.5} />
                        </span>
                        <div>
                          <p className="text-[13px] font-medium text-ink-100">Keep data on this device</p>
                          <p className="mt-1 max-w-md text-[12px] leading-5 text-ink-400">
                            Ask the browser not to clear the downloaded model, your name and your settings when storage
                            runs low.
                          </p>
                        </div>
                      </div>
                      {persisted ? (
                        <span className="flex items-center gap-1.5 text-[11px] text-positive">
                          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.8} />
                          Protected
                        </span>
                      ) : (
                        <button
                          type="button"
                          disabled={storageBusy}
                          onClick={() => void enableStorage()}
                          className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-space-850 px-3 text-[12px] font-medium text-ink-200 transition-colors hover:border-white/15 disabled:opacity-50"
                        >
                          {storageBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />}
                          Protect storage
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-white/[0.06] bg-space-950 px-4 py-3">
                    <p className="text-[11px] leading-5 text-ink-500">
                      {isStandalone()
                        ? 'This copy is installed as an app. Alerts can appear while it is open.'
                        : 'Tip: install this page as an app from the browser menu to keep it one tap away.'}{' '}
                      Browsers do not allow a closed web app to receive alerts without a cloud service, so keep the
                      console open during a watch.
                    </p>
                  </div>
                </div>
              </section>
            )}

            {step === 3 && (
              <section>
                <StepHeading
                  icon={ShieldCheck}
                  kicker="Setup complete"
                  title="The console is ready"
                  text="These details are saved on this device. You can change them later from the Setup section."
                />
                <div className="mt-6 rounded-xl border border-white/[0.08] bg-space-900 p-5">
                  <dl className="divide-y divide-white/[0.06]">
                    <SummaryRow label="Name" value={name} />
                    <SummaryRow label="Label" value={label} />
                    <SummaryRow label="Sensor" value={sensorId ?? 'Practice readings'} mono={Boolean(sensorId)} />
                    <SummaryRow
                      label="System alerts"
                      value={
                        permission === 'granted'
                          ? 'Allowed'
                          : permission === 'denied'
                            ? 'Blocked in the browser'
                            : 'Not enabled'
                      }
                    />
                    <SummaryRow label="Device storage" value={persisted ? 'Protected' : 'Browser managed'} />
                  </dl>

                  <button
                    type="button"
                    onClick={finish}
                    className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink-100 text-[13px] font-medium text-space-950 transition-colors hover:bg-white"
                  >
                    Enter the console
                    <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                </div>
              </section>
            )}
          </div>
        </main>

        <footer className="flex items-center justify-between border-t border-white/[0.08] pt-4">
          <button
            type="button"
            onClick={() => (step === 0 ? onCancel?.() : setStep(step - 1))}
            disabled={step === 0 && !onCancel}
            className="flex h-10 items-center gap-2 rounded-lg border border-white/[0.08] bg-space-900 px-3 text-[12px] font-medium text-ink-300 transition-colors hover:border-white/15 hover:text-ink-100 disabled:opacity-30"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.6} />
            {step === 0 ? 'Cancel' : 'Back'}
          </button>

          {step < 3 ? (
            <button
              type="button"
              onClick={next}
              disabled={!canContinue}
              className="flex h-10 items-center gap-2 rounded-lg bg-ink-100 px-4 text-[12px] font-medium text-space-950 transition-colors hover:bg-white disabled:opacity-40"
            >
              {step === 0 && !sensorId ? 'Continue without a sensor' : 'Next'}
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </button>
          ) : (
            <button
              type="button"
              onClick={finish}
              className="flex h-10 items-center gap-2 rounded-lg bg-ink-100 px-4 text-[12px] font-medium text-space-950 transition-colors hover:bg-white"
            >
              Enter the console
              <ArrowRight className="h-4 w-4" strokeWidth={1.8} />
            </button>
          )}
        </footer>
      </div>

      <SensorScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onCode={(code) => {
          setSensorId(code);
          setScannerOpen(false);
        }}
      />
    </div>
  );
};

function StepHeading({
  icon: Icon,
  kicker,
  title,
  text
}: {
  icon: LucideIcon;
  kicker: string;
  title: string;
  text: string;
}) {
  return (
    <div>
      <p className="flex items-center gap-2 text-[11px] font-medium text-signal-strong">
        <Icon className="h-4 w-4" strokeWidth={1.6} />
        {kicker}
      </p>
      <h1 className="mt-3 text-2xl font-medium tracking-tight text-ink-100 sm:text-[28px]">{title}</h1>
      <p className="mt-2 max-w-xl text-[13px] leading-6 text-ink-400">{text}</p>
    </div>
  );
}

function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-[12px] text-ink-500">{label}</dt>
      <dd className={`text-right text-[12px] text-ink-100 ${mono ? 'font-mono' : ''}`}>{value}</dd>
    </div>
  );
}
