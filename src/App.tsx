import React, { useEffect, useState } from 'react';
import { TelemetryProvider } from './context/TelemetryContext';
import { Header } from './components/layout/Header';
import { AppTab } from './components/layout/TabNavigation';
import { DashboardTab } from './components/dashboard/DashboardTab';
import { AiCopilotTab } from './components/ai/AiCopilotTab';
import { SetupTab } from './components/setup/SetupTab';
import { VirtualLabTab } from './components/lab/VirtualLabTab';
import { SimulatorDrawer } from './components/simulator/SimulatorDrawer';
import { EmergencyOverlay } from './components/emergency/EmergencyOverlay';

const AppShell: React.FC = () => {
  const [tab, setTab] = useState<AppTab>('telemetry');
  const [simulatorOpen, setSimulatorOpen] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [tab]);

  return (
    <div className="min-h-screen bg-space-950 text-ink-100">
      <Header activeTab={tab} onTabChange={setTab} onOpenSimulator={() => setSimulatorOpen(true)} />
      <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        {tab === 'telemetry' && <DashboardTab />}
        {tab === 'surgeon' && <AiCopilotTab />}
        {tab === 'setup' && <SetupTab />}
        {tab === 'lab' && <VirtualLabTab />}
      </main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-8 pt-2 text-[11px] text-ink-500 sm:px-6">
        NASA Space Apps Challenge · MR092L / MEDB 5.2 · Earth delay up to 22 min
      </footer>
      <SimulatorDrawer open={simulatorOpen} onClose={() => setSimulatorOpen(false)} />
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
    console.error('ExMonitor render failure:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-space-950 p-6">
          <div className="w-full max-w-md rounded-xl border border-critical/30 bg-space-900 p-6">
            <p className="text-[11px] font-medium text-critical">Telemetry link lost</p>
            <h1 className="mt-2 text-lg font-medium text-ink-100">The console hit an unexpected fault</h1>
            <p className="mt-2 break-words font-mono text-[11px] leading-5 text-ink-400">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-5 h-11 w-full rounded-lg bg-ink-100 text-sm font-medium text-space-950 transition-colors hover:bg-white"
            >
              Reload console
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  return (
    <TelemetryErrorBoundary>
      <TelemetryProvider>
        <AppShell />
      </TelemetryProvider>
    </TelemetryErrorBoundary>
  );
};

export default App;
