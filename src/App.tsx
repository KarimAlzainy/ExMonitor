import React, { useEffect, useState } from 'react';
import { TelemetryProvider } from './context/TelemetryContext';
import { Header } from './components/layout/Header';
import { AppTab } from './components/layout/TabNavigation';
import { DashboardTab } from './components/dashboard/DashboardTab';
import { AiCopilotTab } from './components/ai/AiCopilotTab';
import { SettingsTab } from './components/setup/SettingsTab';
import { GuideTab } from './components/guide/GuideTab';
import { EmergencyOverlay } from './components/emergency/EmergencyOverlay';
import { SenderAlertPanel } from './components/emergency/SenderAlertPanel';
import { SetupWizard } from './components/onboarding/SetupWizard';
import { CrewProfile } from './types/telemetry';
import {
  createEmptyProfile,
  isSetupComplete,
  loadProfile,
  saveProfile
} from './services/profileStore';

const AppShell: React.FC<{ onRunSetup: () => void }> = ({ onRunSetup }) => {
  const [tab, setTab] = useState<AppTab>('telemetry');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  return (
    <div className="min-h-screen bg-space-950 text-ink-100">
      <Header activeTab={tab} onTabChange={setTab} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {tab === 'telemetry' && <DashboardTab />}
        {tab === 'surgeon' && <AiCopilotTab />}
        {tab === 'settings' && <SettingsTab onRunSetup={onRunSetup} />}
        {tab === 'lab' && <GuideTab />}
      </main>
      <footer className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-2 px-4 pb-8 pt-2 text-[11px] text-ink-500 sm:px-6">
        <span>NASA Space Apps Challenge · MR092L / MEDB 5.2 · Earth delay up to 22 min</span>
        <a
          href="sensors.html"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-ink-400 transition-colors hover:text-ink-100"
        >
          Sensor page
        </a>
      </footer>
      <SenderAlertPanel />
      <EmergencyOverlay />
    </div>
  );
};

interface BoundaryState {
  hasError: boolean;
  message: string;
}

class TelemetryErrorBoundary extends React.Component<{ children: React.ReactNode }, BoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('Ex-Monitor render failure:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-space-950 p-6">
          <div className="w-full max-w-md rounded-xl border border-critical/30 bg-space-900 p-6">
            <p className="text-[11px] font-medium text-critical">Console fault</p>
            <h1 className="mt-2 text-lg font-medium text-ink-100">The console hit an unexpected problem</h1>
            <p className="mt-2 break-words font-mono text-[11px] leading-5 text-ink-400">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 h-11 w-full rounded-lg bg-ink-100 text-sm font-medium text-space-950 transition-colors hover:bg-white"
            >
              Reload the console
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  const [profile, setProfile] = useState<CrewProfile | null>(() => {
    const stored = loadProfile();
    return isSetupComplete(stored) ? stored : null;
  });
  const [setupOpen, setSetupOpen] = useState(() => profile === null);
  const [wizardProfile, setWizardProfile] = useState<CrewProfile>(
    () => loadProfile() ?? createEmptyProfile()
  );
  const [sessionKey, setSessionKey] = useState(0);

  const openSetup = () => {
    setWizardProfile(loadProfile() ?? profile ?? createEmptyProfile());
    setSetupOpen(true);
  };

  const finishSetup = (next: CrewProfile) => {
    saveProfile(next);
    setProfile(next);
    setWizardProfile(next);
    setSetupOpen(false);
    setSessionKey((previous) => previous + 1);
  };

  return (
    <TelemetryErrorBoundary>
      {setupOpen || !profile ? (
        <SetupWizard
          initialProfile={wizardProfile}
          onComplete={finishSetup}
          onCancel={profile ? () => setSetupOpen(false) : undefined}
        />
      ) : (
        <TelemetryProvider key={sessionKey} initialProfile={profile}>
          <AppShell onRunSetup={openSetup} />
        </TelemetryProvider>
      )}
    </TelemetryErrorBoundary>
  );
};

export default App;
