export type AlertSeverity = 'nominal' | 'caution' | 'critical';

export interface VitalsData {
  heartRate: number;
  spO2: number;
  bodyTemp: number;
  gsrStress: number;
  radiationDoseRate: number;
  cumulativeRadiation: number;
  timestamp: number;
  signalQuality: number;
  source: 'sensor' | 'builtin';
}

export interface CrewProfile {
  id: string;
  name: string;
  label: string;
  sensorId: string | null;
  notificationsAsked: boolean;
  createdAt: number;
  completedAt: number | null;
}

export type AiModelTier = 'phi3' | 'llama3' | 'gemma2' | 'none';

export interface SystemDiagnostic {
  estimatedRamGb: number;
  cpuCores: number;
  availableStorageGb: number;
  gpuTier: string;
  webGpu: boolean;
  recommendedModel: AiModelTier;
}

export interface EmergencyEvent {
  id: string;
  sourceNodeId: string;
  astronautName: string;
  astronautLabel: string;
  timestamp: number;
  severity: 'critical' | 'caution';
  title: string;
  description: string;
  triggerVitals: VitalsData;
  activeProtocol: string;
}

export interface ChatMessage {
  id: string;
  sender: 'astronaut' | 'ai' | 'system';
  text: string;
  timestamp: number;
  vitalsSnapshot?: VitalsData;
  protocolBadge?: string;
  isStreaming?: boolean;
}

export interface OwnAlert {
  event: EmergencyEvent;
  status: 'sending' | 'sent' | 'cancelled';
  acknowledgedBy: string[];
}

export type SensorStatus = 'off' | 'waiting' | 'connected' | 'stale';

export type SensorScenario = 'rest' | 'exercise' | 'hypoxia' | 'radiation' | 'recovery';

export interface SensorFrame {
  sensorId: string;
  seq: number;
  sentAt: number;
  heartRate: number;
  spO2: number;
  bodyTemp: number;
  gsrStress: number;
  radiationDoseRate: number;
  cumulativeRadiation: number;
  signalQuality: number;
  battery: number;
  motion: number;
  scenario: SensorScenario;
  ecg: number[];
  ppg: number[];
}

export interface PeerNode {
  nodeId: string;
  name: string;
  label: string;
  seenAt: number;
}

export interface BundleModelConfig {
  model: AiModelTier;
  version: string;
  builtAt: string;
  source?: string;
}
