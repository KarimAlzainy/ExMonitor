export type AlertSeverity = 'nominal' | 'caution' | 'critical';

export interface VitalsData {
  heartRate: number;        // BPM (e.g., 60 - 180)
  spO2: number;             // % (e.g., 85 - 100%)
  bodyTemp: number;         // Celsius (e.g., 36.0 - 39.5°C)
  gsrStress: number;        // Galvanic Skin Response (microSiemens uS, e.g., 1.5 - 28.0)
  radiationDoseRate: number;// mSv/hr (NASA MR092L, e.g. 0.01 - 5.00 mSv/hr)
  cumulativeRadiation: number; // mSv (Total accumulated mission dose)
  timestamp: number;
}

export interface AstronautProfile {
  id: string;
  name: string;
  role: 'Commander' | 'EVA Specialist' | 'Flight Engineer' | 'Science Officer';
  strapSerial: string;
  isPaired: boolean;
  avatarUrl?: string;
}

export type AiModelTier = 'phi3' | 'llama3' | 'gemma2' | 'hardcoded_rules';

export interface SystemDiagnostic {
  estimatedRamGb: number;
  cpuCores: number;
  availableStorageGb: number;
  gpuTier: string;
  recommendedModel: AiModelTier;
}

export interface EmergencyEvent {
  id: string;
  sourceNodeId: string;
  astronautName: string;
  astronautRole: string;
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

export type SimulationPreset = 'normal' | 'workout' | 'emergency';
