import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  VitalsData,
  AstronautProfile,
  AiModelTier,
  SystemDiagnostic,
  EmergencyEvent,
  SimulationPreset
} from '../types/telemetry';
import { evaluateBiometrics, RuleEvaluationResult } from '../services/nasaRules';
import { audioSynth } from '../services/audioSynth';
import { meshBroadcast } from '../services/meshBroadcast';
import { bluetoothService } from '../services/bluetoothService';

export const DEFAULT_ASTRONAUTS: AstronautProfile[] = [
  {
    id: 'astro-karim',
    name: 'Karim (Commander)',
    role: 'Commander',
    strapSerial: 'NASA-STRAP-EVA-409',
    isPaired: true
  },
  {
    id: 'astro-saif',
    name: 'Saif (EVA Specialist)',
    role: 'EVA Specialist',
    strapSerial: 'NASA-STRAP-EVA-410',
    isPaired: true
  },
  {
    id: 'astro-sarah',
    name: 'Sarah (Flight Engineer)',
    role: 'Flight Engineer',
    strapSerial: 'NASA-STRAP-EVA-411',
    isPaired: false
  }
];

interface TelemetryContextType {
  vitals: VitalsData;
  astronaut: AstronautProfile;
  setAstronaut: (profile: AstronautProfile) => void;
  ruleResult: RuleEvaluationResult;
  simulationPreset: SimulationPreset;
  setSimulationPreset: (preset: SimulationPreset) => void;
  setManualVitals: (partial: Partial<VitalsData>) => void;
  aiModelTier: AiModelTier;
  setAiModelTier: (tier: AiModelTier) => void;
  diagnostic: SystemDiagnostic;
  runHardwareDiagnostic: () => Promise<SystemDiagnostic>;
  activeEmergency: EmergencyEvent | null;
  triggerEmergencySOS: (customTitle?: string, customDesc?: string) => void;
  acknowledgeEmergency: () => void;
  soundMuted: boolean;
  toggleSound: () => void;
  nodeId: string;
  isMeshOnline: boolean;
  pairBluetoothStrap: (strapId?: string) => Promise<boolean>;
  isPairing: boolean;
  rawBleHeartRate: number | null;
  isManualHold: boolean;
}

const PRESET_TARGETS: Record<SimulationPreset, Pick<VitalsData, 'heartRate' | 'spO2' | 'bodyTemp' | 'gsrStress' | 'radiationDoseRate'>> = {
  normal: { heartRate: 72, spO2: 98, bodyTemp: 36.8, gsrStress: 3.8, radiationDoseRate: 0.04 },
  workout: { heartRate: 135, spO2: 94, bodyTemp: 37.6, gsrStress: 16.5, radiationDoseRate: 0.06 },
  emergency: { heartRate: 148, spO2: 84, bodyTemp: 38.9, gsrStress: 24.2, radiationDoseRate: 2.45 }
};

const TelemetryContext = createContext<TelemetryContextType | null>(null);

export const TelemetryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [astronaut, setAstronaut] = useState<AstronautProfile>(DEFAULT_ASTRONAUTS[0]);
  const [simulationPreset, setSimulationPresetState] = useState<SimulationPreset>('normal');
  const [isManualHold, setIsManualHold] = useState(false);
  const [isMeshOnline, setIsMeshOnline] = useState<boolean>(meshBroadcast.isNetworkConnected());
  const manualHoldRef = useRef(false);
  const bleHeartRateRef = useRef<number | null>(null);
  const activeEmergencyIdRef = useRef<string | null>(null);
  const autoSosTriggeredRef = useRef<boolean>(false);
  const [aiModelTier, setAiModelTier] = useState<AiModelTier>('phi3');
  const [soundMuted, setSoundMuted] = useState<boolean>(false);
  const [activeEmergency, setActiveEmergency] = useState<EmergencyEvent | null>(null);
  const [isPairing, setIsPairing] = useState<boolean>(false);
  const [rawBleHeartRate, setRawBleHeartRate] = useState<number | null>(null);
  const [nodeId] = useState<string>(meshBroadcast.getNodeId());

  // Base vitals state
  const [vitals, setVitals] = useState<VitalsData>({
    heartRate: 72,
    spO2: 98,
    bodyTemp: 36.8,
    gsrStress: 4.2,
    radiationDoseRate: 0.04,
    cumulativeRadiation: 1.25,
    timestamp: Date.now()
  });

  const [diagnostic, setDiagnostic] = useState<SystemDiagnostic>({
    estimatedRamGb: 8,
    cpuCores: 8,
    availableStorageGb: 64,
    gpuTier: 'Integrated / WebGPU',
    recommendedModel: 'phi3'
  });

  // Calculate deterministic safety rule result
  const ruleResult = evaluateBiometrics(vitals);

  // Sync audio mute state
  const toggleSound = () => {
    const next = !soundMuted;
    setSoundMuted(next);
    audioSynth.setMuted(next);
    // Re-arm the Klaxon if an emergency is still on screen after unmuting.
    if (!next && activeEmergency) {
      audioSynth.startEmergencyKlaxon();
    }
  };

  // Hardware Diagnostic Scan
  const runHardwareDiagnostic = useCallback(async (): Promise<SystemDiagnostic> => {
    let ram = 8;
    const nav = navigator as unknown as { deviceMemory?: number; hardwareConcurrency?: number };
    if (nav.deviceMemory) {
      ram = nav.deviceMemory;
    }
    const cores = nav.hardwareConcurrency || 4;

    let storageGb = 32;
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const est = await navigator.storage.estimate();
        if (est.quota) {
          storageGb = Math.round(est.quota / (1024 * 1024 * 1024));
        }
      } catch {
        // Fallback
      }
    }

    let recommended: AiModelTier = 'phi3';
    if (ram >= 8) {
      recommended = 'phi3';
    } else if (ram >= 4) {
      recommended = 'llama3';
    } else if (ram >= 2) {
      recommended = 'gemma2';
    } else {
      recommended = 'hardcoded_rules';
    }

    const diag: SystemDiagnostic = {
      estimatedRamGb: ram,
      cpuCores: cores,
      availableStorageGb: storageGb,
      gpuTier: 'Edge WebGPU / Direct Hardware',
      recommendedModel: recommended
    };
    setDiagnostic(diag);
    return diag;
  }, []);

  // Run diagnostic on mount
  useEffect(() => {
    runHardwareDiagnostic();
  }, [runHardwareDiagnostic]);

  useEffect(() => meshBroadcast.onConnectionChange(setIsMeshOnline), []);

  // Keep this node discoverable on EXTEM-Mesh, including after a relay reconnect.
  useEffect(() => {
    meshBroadcast.setIdentity(astronaut.name, astronaut.role);
    meshBroadcast.announcePresence(astronaut.name, astronaut.role);
    const heartbeat = window.setInterval(() => {
      meshBroadcast.announcePresence(astronaut.name, astronaut.role);
    }, 7000);
    return () => window.clearInterval(heartbeat);
  }, [astronaut.name, astronaut.role]);

  const setSimulationPreset = useCallback((preset: SimulationPreset) => {
    manualHoldRef.current = false;
    setIsManualHold(false);
    setSimulationPresetState(preset);
    // Selecting a scenario explicitly should let its automatic SOS play again.
    autoSosTriggeredRef.current = false;
    const target = PRESET_TARGETS[preset];
    setVitals((prev) => ({
      ...prev,
      ...target,
      timestamp: Date.now()
    }));
  }, []);

  // Subscribe to EXTEM-Mesh peer broadcasts (incoming SOS from Saif's phone or other tab)
  useEffect(() => {
    const unsubscribe = meshBroadcast.subscribe((msg) => {
      if (msg.type === 'EMERGENCY_SOS') {
        const ev = msg.payload;
        activeEmergencyIdRef.current = ev.id;
        setActiveEmergency(ev);
        audioSynth.startEmergencyKlaxon();
      } else if (msg.type === 'ACKNOWLEDGE_EMERGENCY') {
        // Only the matching alert may be dismissed by a peer acknowledgement.
        if (activeEmergencyIdRef.current === msg.payload.eventId) {
          activeEmergencyIdRef.current = null;
          setActiveEmergency(null);
          audioSynth.stopEmergencyKlaxon();
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Web Bluetooth handler
  const pairBluetoothStrap = async (strapId = 'NASA-STRAP-EVA-409'): Promise<boolean> => {
    setIsPairing(true);
    bluetoothService.setOnVitalsCallback((hr) => {
      // Feed the live strap into the normal-mode simulation target. Preset
      // scenarios keep their scripted values so the judge demo stays reliable.
      bleHeartRateRef.current = hr;
      setRawBleHeartRate(hr);
    });

    try {
      const res = await bluetoothService.requestPairing(strapId);
      if (res.isConnected) {
        setAstronaut((prev) => ({
          ...prev,
          strapSerial: res.deviceSerial || strapId,
          isPaired: true
        }));
        audioSynth.playTelemetryPing();
        setIsPairing(false);
        return true;
      }
    } catch {
      // Ignore
    }
    setIsPairing(false);
    return false;
  };

  // Trigger Local & Mesh Emergency SOS
  const triggerEmergencySOS = useCallback(
    (customTitle?: string, customDesc?: string) => {
      const currentRule = evaluateBiometrics(vitals);
      const vitalEmergency = currentRule.isTriggerEmergency;
      const ev: EmergencyEvent = {
        id: 'SOS-' + Date.now().toString(),
        sourceNodeId: nodeId,
        astronautName: astronaut.name,
        astronautRole: astronaut.role,
        timestamp: Date.now(),
        severity: 'critical',
        title:
          customTitle ||
          (vitalEmergency ? currentRule.hazardTitle : 'Crew-declared medical emergency'),
        description:
          customDesc ||
          (vitalEmergency
            ? currentRule.hazardDescription
            : `Astronaut ${astronaut.name} requested immediate assistance. Automatic rule status is "${currentRule.hazardTitle}"; treat this as a crew-reported emergency and acknowledge over EXTEM-Mesh.`),
        triggerVitals: { ...vitals },
        activeProtocol: vitalEmergency
          ? currentRule.nasaRef
          : 'NASA EVA Crew-Declared Contingency · EXTEM-Mesh'
      };

      setActiveEmergency(ev);
      activeEmergencyIdRef.current = ev.id;
      // Prevent the background rule engine from re-firing the same scenario
      // immediately after the operator acknowledges a manual SOS.
      autoSosTriggeredRef.current = true;
      audioSynth.startEmergencyKlaxon();
      meshBroadcast.broadcastEmergency(ev);
    },
    [astronaut, nodeId, vitals]
  );

  // Acknowledge / Dismiss Emergency
  const acknowledgeEmergency = useCallback(() => {
    if (activeEmergency) {
      meshBroadcast.acknowledgeEmergency(activeEmergency.id, astronaut.name);
    }
    activeEmergencyIdRef.current = null;
    setActiveEmergency(null);
    audioSynth.stopEmergencyKlaxon();
  }, [activeEmergency, astronaut.name]);

  // Automatic Danger Check (Layer 1 Background Safety)
  // If ruleResult is critical and emergency hasn't been triggered yet, trigger automatically!
  useEffect(() => {
    if (ruleResult.isTriggerEmergency && !activeEmergency && !autoSosTriggeredRef.current) {
      autoSosTriggeredRef.current = true;
      triggerEmergencySOS(ruleResult.hazardTitle, ruleResult.hazardDescription);
    } else if (!ruleResult.isTriggerEmergency) {
      autoSosTriggeredRef.current = false;
    }
  }, [ruleResult, activeEmergency, triggerEmergencySOS]);

  // Vitals simulation ticker (updates every 1000ms with realistic biometric fluctuations)
  useEffect(() => {
    const timer = setInterval(() => {
      setVitals((prev) => {
        if (manualHoldRef.current) {
          if (!activeEmergency && Math.random() > 0.4) {
            audioSynth.playHeartbeatBlip(ruleResult.severity === 'caution' ? 950 : 880);
          }
          return {
            ...prev,
            cumulativeRadiation: +(prev.cumulativeRadiation + prev.radiationDoseRate / 3600).toFixed(4),
            timestamp: Date.now()
          };
        }

        // Natural jitter
        const jitter = (Math.random() - 0.5) * 1.5;
        const gsrJitter = (Math.random() - 0.5) * 0.2;

        let targetHr = 72;
        let targetSpO2 = 98;
        let targetTemp = 36.8;
        let targetGsr = 3.8;
        let targetRad = 0.04;

        if (simulationPreset === 'normal') {
          targetHr = bleHeartRateRef.current ?? 72 + jitter;
          targetSpO2 = 98 + Math.round((Math.random() - 0.5));
          targetTemp = 36.8;
          targetGsr = 3.8 + gsrJitter;
          targetRad = 0.04;
        } else if (simulationPreset === 'workout') {
          targetHr = 135 + jitter * 2;
          targetSpO2 = 94;
          targetTemp = 37.6;
          targetGsr = 16.5 + gsrJitter * 2;
          targetRad = 0.06;
        } else if (simulationPreset === 'emergency') {
          // Dangerous hypoxia and radiation breach
          targetHr = 148 + jitter * 3;
          targetSpO2 = 84;
          targetTemp = 38.9;
          targetGsr = 24.2 + gsrJitter * 3;
          targetRad = 2.45;
        }

        // Smooth gradual step toward targets
        const newHr = Math.round(prev.heartRate + (targetHr - prev.heartRate) * 0.2);
        const newSpO2 = Math.round(prev.spO2 + (targetSpO2 - prev.spO2) * 0.25);
        const newTemp = +(prev.bodyTemp + (targetTemp - prev.bodyTemp) * 0.1).toFixed(1);
        const newGsr = +(prev.gsrStress + (targetGsr - prev.gsrStress) * 0.15).toFixed(1);
        const newRad = +(prev.radiationDoseRate + (targetRad - prev.radiationDoseRate) * 0.2).toFixed(2);
        const newCumulative = +(prev.cumulativeRadiation + (newRad / 3600)).toFixed(4);

        // Sound subtle monitor blip if nominal or caution
        if (!activeEmergency && Math.random() > 0.4) {
          audioSynth.playHeartbeatBlip(ruleResult.severity === 'caution' ? 950 : 880);
        }

        return {
          heartRate: newHr,
          spO2: Math.min(100, Math.max(70, newSpO2)),
          bodyTemp: newTemp,
          gsrStress: Math.max(1, newGsr),
          radiationDoseRate: Math.max(0.01, newRad),
          cumulativeRadiation: newCumulative,
          timestamp: Date.now()
        };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [simulationPreset, activeEmergency, ruleResult.severity]);

  const setManualVitals = (partial: Partial<VitalsData>) => {
    manualHoldRef.current = true;
    setIsManualHold(true);
    setVitals((prev) => ({
      ...prev,
      ...partial,
      timestamp: Date.now()
    }));
  };

  return (
    <TelemetryContext.Provider
      value={{
        vitals,
        astronaut,
        setAstronaut,
        ruleResult,
        simulationPreset,
        setSimulationPreset,
        setManualVitals,
        aiModelTier,
        setAiModelTier,
        diagnostic,
        runHardwareDiagnostic,
        activeEmergency,
        triggerEmergencySOS,
        acknowledgeEmergency,
        soundMuted,
        toggleSound,
        nodeId,
        isMeshOnline,
        pairBluetoothStrap,
        isPairing,
        rawBleHeartRate,
        isManualHold
      }}
    >
      {children}
    </TelemetryContext.Provider>
  );
};

export function useTelemetry(): TelemetryContextType {
  const ctx = useContext(TelemetryContext);
  if (!ctx) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return ctx;
}
