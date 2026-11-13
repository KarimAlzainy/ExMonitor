import React, { useEffect, useState } from 'react';
import { TelemetryProvider } from './context/TelemetryContext';
import { Header } from './components/layout/Header';
import { AppTab, TabNavigation } from './components/layout/TabNavigation';
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
    <div className="min-h-screen bg-space-950 text-slate-100">
      <div className="sticky top-0 z-40 shadow-lg shadow-black/20">
        <Header onOpenSimulator={() => setSimulatorOpen(true)} />
        <TabNavigation active={tab} onChange={setTab} />
      </div>
      <main className="mx-auto w-full max-w-6xl px-3 py-4 sm:px-6 sm:py-6">
        {tab === 'telemetry' && <DashboardTab />}
        {tab === 'surgeon' && <AiCopilotTab />}
        {tab === 'setup' && <SetupTab />}
        {tab === 'lab' && <VirtualLabTab />}
      </main>
      <footer className="mx-auto w-full max-w-6xl px-4 pb-6 pt-2 text-center font-mono text-[10px] tracking-wide text-slate-600">
        NASA Space Apps Challenge · MR092L / MEDB 5.2 · Offline-first edge triage
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
        <div className="flex min-h-screen items-center justify-center bg-space-950 p-4">
          <div className="w-full max-w-md rounded-2xl border border-red-500/40 bg-space-900 p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-red-300">Telemetry link lost</p>
            <h1 className="mt-2 font-mono text-lg font-semibold text-slate-100">The console hit an unexpected fault.</h1>
            <p className="mt-2 break-words font-mono text-xs text-slate-400">{this.state.message}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 w-full rounded-xl bg-nasa-cyan py-3 font-mono text-sm font-semibold text-space-950"
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
