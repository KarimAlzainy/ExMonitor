import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AiModelTier,
  CrewProfile,
  EmergencyEvent,
  OwnAlert,
  PeerNode,
  SensorFrame,
  SensorStatus,
  SystemDiagnostic,
  VitalsData
} from '../types/telemetry';
import { evaluateBiometrics, RuleEvaluationResult } from '../services/nasaRules';
import { audioSynth } from '../services/audioSynth';
import { crewLink } from '../services/crewLink';
import { showAlertNotification } from '../services/notifications';
import {
  loadBundleModel,
  recommendedTier,
  resolveInitialTier,
  storeTier
} from '../services/aiModels';
import { hasWebGpu } from '../services/flightSurgeon';
import { saveProfile } from '../services/profileStore';

interface TelemetryContextType {
  vitals: VitalsData;
  profile: CrewProfile;
  updateProfile: (parts: Partial<CrewProfile>) => void;
  connectSensor: (sensorId: string | null) => void;
  ruleResult: RuleEvaluationResult;
  aiModelTier: AiModelTier;
  setAiModelTier: (tier: AiModelTier) => void;
  diagnostic: SystemDiagnostic;
  runHardwareDiagnostic: () => Promise<SystemDiagnostic>;
  incomingEmergency: EmergencyEvent | null;
  incomingCount: number;
  ownAlert: OwnAlert | null;
  triggerEmergencySOS: (customTitle?: string, customDescription?: string) => void;
  acknowledgeEmergency: (eventId?: string) => void;
  cancelOwnAlert: () => void;
  dismissOwnAlert: () => void;
  soundMuted: boolean;
  toggleSound: () => void;
  nodeId: string;
  crewLinkMode: 'relay' | 'local' | 'off';
  peerCount: number;
  peers: PeerNode[];
  sensorStatus: SensorStatus;
  sensorFrame: SensorFrame | null;
  sensorId: string | null;
}

const TelemetryContext = createContext<TelemetryContextType | null>(null);

const INITIAL_VITALS: VitalsData = {
  heartRate: 72,
  spO2: 98,
  bodyTemp: 36.8,
  gsrStress: 4.1,
  radiationDoseRate: 0.04,
  cumulativeRadiation: 1.18,
  timestamp: Date.now(),
  signalQuality: 96,
  source: 'builtin'
};

function makeEmergencyId(): string {
  return `alert-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export const TelemetryProvider: React.FC<{ children: React.ReactNode; initialProfile: CrewProfile }> = ({
  children,
  initialProfile
}) => {
  const [profile, setProfile] = useState<CrewProfile>(initialProfile);
  const [vitals, setVitals] = useState<VitalsData>(INITIAL_VITALS);
  const [soundMuted, setSoundMuted] = useState(false);
  const [aiModelTier, setAiModelTierState] = useState<AiModelTier>('none');
  const [incoming, setIncoming] = useState<EmergencyEvent[]>([]);
  const [ownAlert, setOwnAlert] = useState<OwnAlert | null>(null);
  const [peers, setPeers] = useState<PeerNode[]>([]);
  const [crewLinkMode, setCrewLinkMode] = useState<'relay' | 'local' | 'off'>('off');
  const [sensorStatus, setSensorStatus] = useState<SensorStatus>(initialProfile.sensorId ? 'waiting' : 'off');
  const [sensorFrame, setSensorFrame] = useState<SensorFrame | null>(null);
  const [diagnostic, setDiagnostic] = useState<SystemDiagnostic>({
    estimatedRamGb: 8,
    cpuCores: 8,
    availableStorageGb: 64,
    gpuTier: 'Checking this device',
    webGpu: false,
    recommendedModel: 'none'
  });

  const profileRef = useRef(profile);
  const vitalsRef = useRef(vitals);
  const ownAlertRef = useRef(ownAlert);
  const incomingRef = useRef(incoming);
  const sensorStatusRef = useRef(sensorStatus);
  const soundMutedRef = useRef(soundMuted);
  const lastSensorFrameAtRef = useRef(0);
  const lastSensorSeqRef = useRef(0);
  const autoSosRef = useRef(false);
  const sentTimerRef = useRef<number | null>(null);
  const builtinRef = useRef({ heartRate: 72, spO2: 98, bodyTemp: 36.8, gsrStress: 4.1, radiationDoseRate: 0.04 });
  const announceTimerRef = useRef<number | null>(null);

  profileRef.current = profile;
  vitalsRef.current = vitals;
  ownAlertRef.current = ownAlert;
  incomingRef.current = incoming;
  sensorStatusRef.current = sensorStatus;
  soundMutedRef.current = soundMuted;

  const ruleResult = useMemo(() => evaluateBiometrics(vitals), [vitals]);

  const updateProfile = useCallback((parts: Partial<CrewProfile>) => {
    setProfile((previous) => {
      const next: CrewProfile = {
        ...previous,
        ...parts,
        name: typeof parts.name === 'string' ? parts.name.trim() : previous.name,
        label: typeof parts.label === 'string' ? parts.label.trim() : previous.label,
        sensorId:
          parts.sensorId === undefined
            ? previous.sensorId
            : parts.sensorId
              ? parts.sensorId.trim().toUpperCase()
              : null
      };
      saveProfile(next);
      return next;
    });
  }, []);

  const connectSensor = useCallback(
    (sensorId: string | null) => {
      const normalized = sensorId ? sensorId.trim().toUpperCase() : null;
      const previous = profileRef.current.sensorId;
      if (previous && previous !== normalized) crewLink.unpairSensor(previous);
      lastSensorFrameAtRef.current = 0;
      lastSensorSeqRef.current = 0;
      setSensorFrame(null);
      setSensorStatus(normalized ? 'waiting' : 'off');
      updateProfile({ sensorId: normalized });
      if (normalized) crewLink.pairSensor(normalized, profileRef.current.name);
    },
    [updateProfile]
  );

  const runHardwareDiagnostic = useCallback(async (): Promise<SystemDiagnostic> => {
    const nav = navigator as unknown as {
      deviceMemory?: number;
      hardwareConcurrency?: number;
      gpu?: { requestAdapter: () => Promise<{ info?: { vendor?: string; architecture?: string } } | null> };
    };
    const ram = nav.deviceMemory ?? 8;
    const cores = nav.hardwareConcurrency ?? 4;
    let storageGb = 32;
    if (navigator.storage?.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        if (estimate.quota) storageGb = Math.round(estimate.quota / (1024 * 1024 * 1024));
      } catch {
        // Keep the default.
      }
    }

    const webGpu = await hasWebGpu();
    let gpuTier = webGpu ? 'WebGPU ready' : 'WebGPU not available';
    if (webGpu && nav.gpu) {
      try {
        const adapter = await nav.gpu.requestAdapter();
        if (adapter?.info?.vendor) gpuTier = `WebGPU · ${adapter.info.vendor}`;
      } catch {
        // The simple label is enough.
      }
    }

    const next: SystemDiagnostic = {
      estimatedRamGb: ram,
      cpuCores: cores,
      availableStorageGb: storageGb,
      gpuTier,
      webGpu,
      recommendedModel: recommendedTier(ram, webGpu)
    };
    setDiagnostic(next);
    return next;
  }, []);

  useEffect(() => {
    void runHardwareDiagnostic();
  }, [runHardwareDiagnostic]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const tier = await resolveInitialTier();
      if (!cancelled) setAiModelTierState(tier);
      await loadBundleModel();
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setAiModelTier = useCallback((tier: AiModelTier) => {
    setAiModelTierState(tier);
    storeTier(tier);
  }, []);

  // Crew link connection state.
  useEffect(() => {
    return crewLink.onConnectionChange((relayOnline, localChannel) => {
      if (relayOnline) setCrewLinkMode('relay');
      else if (localChannel) setCrewLinkMode('local');
      else setCrewLinkMode('off');
    });
  }, []);

  // Presence heartbeat. It also runs immediately after a reconnect.
  useEffect(() => {
    const announce = () => crewLink.announce(profile.name, profile.label);
    announce();
    if (announceTimerRef.current !== null) window.clearInterval(announceTimerRef.current);
    announceTimerRef.current = window.setInterval(announce, 7000);
    return () => {
      if (announceTimerRef.current !== null) {
        window.clearInterval(announceTimerRef.current);
        announceTimerRef.current = null;
      }
    };
  }, [profile.name, profile.label, crewLinkMode]);

  useEffect(() => {
    const unsubscribe = crewLink.subscribe((message) => {
      if (message.type === 'CREW_ANNOUNCE') {
        const { nodeId, name, label } = message.payload;
        if (!nodeId || nodeId === crewLink.nodeId) return;
        setPeers((previous) => [
          { nodeId, name, label, seenAt: Date.now() },
          ...previous.filter((peer) => peer.nodeId !== nodeId)
        ].slice(0, 12));
        return;
      }

      if (message.type === 'EMERGENCY_SOS') {
        const event = message.payload;
        if (!event || event.sourceNodeId === crewLink.nodeId) return;
        setIncoming((previous) => {
          if (previous.some((item) => item.id === event.id)) return previous;
          return [...previous, event];
        });
        audioSynth.startEmergencyKlaxon();
        void showAlertNotification(event);
        return;
      }

      if (message.type === 'ACKNOWLEDGE_EMERGENCY') {
        const { eventId, acknowledgedBy } = message.payload;
        setOwnAlert((previous) =>
          previous && previous.event.id === eventId
            ? {
                ...previous,
                acknowledgedBy: previous.acknowledgedBy.includes(acknowledgedBy)
                  ? previous.acknowledgedBy
                  : [...previous.acknowledgedBy, acknowledgedBy]
              }
            : previous
        );
        return;
      }

      if (message.type === 'CANCEL_EMERGENCY') {
        const { eventId } = message.payload;
        setIncoming((previous) => previous.filter((item) => item.id !== eventId));
        setOwnAlert((previous) =>
          previous && previous.event.id === eventId ? { ...previous, status: 'cancelled' } : previous
        );
        return;
      }

      if (message.type === 'SENSOR_HELLO') {
        const active = profileRef.current.sensorId;
        if (active && message.payload.sensorId === active) {
          crewLink.pairSensor(active, profileRef.current.name);
        }
        return;
      }

      if (message.type === 'SENSOR_FRAME') {
        const frame = message.payload;
        const active = profileRef.current.sensorId;
        if (!frame || !active || frame.sensorId !== active) return;
        const gap = Date.now() - lastSensorFrameAtRef.current;
        if (frame.seq <= lastSensorSeqRef.current && gap < 2500) return;

        lastSensorSeqRef.current = frame.seq;
        lastSensorFrameAtRef.current = Date.now();
        setSensorStatus('connected');
        setSensorFrame(frame);
        setVitals({
          heartRate: frame.heartRate,
          spO2: frame.spO2,
          bodyTemp: frame.bodyTemp,
          gsrStress: frame.gsrStress,
          radiationDoseRate: frame.radiationDoseRate,
          cumulativeRadiation: frame.cumulativeRadiation,
          timestamp: frame.sentAt,
          signalQuality: frame.signalQuality,
          source: 'sensor'
        });
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPeers((previous) => previous.filter((peer) => Date.now() - peer.seenAt < 22000));
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  // Sensor staleness and the automatic fallback generator.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const active = profileRef.current.sensorId;
      if (!active) {
        if (sensorStatusRef.current !== 'off') setSensorStatus('off');
        return;
      }
      if (!lastSensorFrameAtRef.current) {
        if (sensorStatusRef.current !== 'waiting') setSensorStatus('waiting');
        return;
      }
      if (Date.now() - lastSensorFrameAtRef.current > 6000 && sensorStatusRef.current !== 'stale') {
        setSensorStatus('stale');
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (sensorStatusRef.current === 'connected') return;

      const base = builtinRef.current;
      const seconds = Date.now() / 1000;
      const slow = Math.sin(seconds / 42);
      const targetHeartRate = 72 + slow * 4 + (Math.random() - 0.5) * 2.4;
      const targetSpo2 = 98 + Math.sin(seconds / 63) * 0.8;
      const targetTemp = 36.8 + Math.sin(seconds / 190) * 0.16;
      const targetGsr = 4.1 + Math.sin(seconds / 28) * 0.7 + (Math.random() - 0.5) * 0.3;
      const targetRadiation = 0.04 + Math.sin(seconds / 110) * 0.008;

      base.heartRate += (targetHeartRate - base.heartRate) * 0.18;
      base.spO2 += (targetSpo2 - base.spO2) * 0.16;
      base.bodyTemp += (targetTemp - base.bodyTemp) * 0.08;
      base.gsrStress += (targetGsr - base.gsrStress) * 0.14;
      base.radiationDoseRate += (targetRadiation - base.radiationDoseRate) * 0.1;

      const heartRate = Math.round(base.heartRate);
      setVitals((previous) => ({
        heartRate,
        spO2: Math.round(Math.min(100, Math.max(90, base.spO2))),
        bodyTemp: Number(base.bodyTemp.toFixed(1)),
        gsrStress: Number(Math.max(0.5, base.gsrStress).toFixed(1)),
        radiationDoseRate: Number(Math.max(0.01, base.radiationDoseRate).toFixed(2)),
        cumulativeRadiation: Number(
          (previous.cumulativeRadiation + Math.max(0.01, base.radiationDoseRate) / 3600).toFixed(4)
        ),
        timestamp: Date.now(),
        signalQuality: 100,
        source: 'builtin'
      }));

      if (!soundMutedRef.current && incomingRef.current.length === 0 && Math.random() > 0.45) {
        audioSynth.playHeartbeatBlip(heartRate > 120 ? 950 : 880);
      }
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (incoming.length === 0) {
      audioSynth.stopEmergencyKlaxon();
    } else {
      audioSynth.startEmergencyKlaxon();
    }
  }, [incoming.length]);

  const triggerEmergencySOS = useCallback((customTitle?: string, customDescription?: string) => {
    const current = ownAlertRef.current;
    if (current && current.status !== 'cancelled') return;

    const currentVitals = vitalsRef.current;
    const currentProfile = profileRef.current;
    const currentRule = evaluateBiometrics(currentVitals);
    const vitalEmergency = currentRule.isTriggerEmergency;

    const event: EmergencyEvent = {
      id: makeEmergencyId(),
      sourceNodeId: crewLink.nodeId,
      astronautName: currentProfile.name || 'Crew member',
      astronautLabel: currentProfile.label || 'Crew',
      timestamp: Date.now(),
      severity: 'critical',
      title:
        customTitle ||
        (vitalEmergency ? currentRule.hazardTitle : 'Crew-declared medical emergency'),
      description:
        customDescription ||
        (vitalEmergency
          ? currentRule.hazardDescription
          : `${currentProfile.name || 'A crew member'} pressed the emergency alert. Check the readings and send help.`),
      triggerVitals: { ...currentVitals },
      activeProtocol: vitalEmergency ? currentRule.nasaRef : 'Crew-declared alert'
    };

    setOwnAlert({ event, status: 'sending', acknowledgedBy: [] });
    crewLink.sendEmergency(event);
    audioSynth.playTelemetryPing();

    if (sentTimerRef.current !== null) window.clearTimeout(sentTimerRef.current);
    sentTimerRef.current = window.setTimeout(() => {
      setOwnAlert((previous) =>
        previous && previous.event.id === event.id && previous.status === 'sending'
          ? { ...previous, status: 'sent' }
          : previous
      );
      sentTimerRef.current = null;
    }, 900);
  }, []);

  const acknowledgeEmergency = useCallback((eventId?: string) => {
    const targetId = eventId ?? incomingRef.current[0]?.id;
    if (!targetId) return;
    setIncoming((previous) => previous.filter((item) => item.id !== targetId));
    crewLink.acknowledgeEmergency(targetId, profileRef.current.name || 'Crew member');
  }, []);

  const cancelOwnAlert = useCallback(() => {
    const current = ownAlertRef.current;
    if (!current || current.status === 'cancelled') return;
    crewLink.cancelEmergency(current.event.id, profileRef.current.name || 'Crew member');
    setOwnAlert({ ...current, status: 'cancelled' });
    if (sentTimerRef.current !== null) {
      window.clearTimeout(sentTimerRef.current);
      sentTimerRef.current = null;
    }
  }, []);

  const dismissOwnAlert = useCallback(() => {
    if (ownAlertRef.current?.status === 'sending') return;
    setOwnAlert(null);
  }, []);

  useEffect(() => {
    if (!ruleResult.isTriggerEmergency) {
      autoSosRef.current = false;
      return;
    }
    if (autoSosRef.current || ownAlertRef.current) return;
    autoSosRef.current = true;
    triggerEmergencySOS(ruleResult.hazardTitle, ruleResult.hazardDescription);
  }, [ruleResult.isTriggerEmergency, ruleResult.hazardTitle, ruleResult.hazardDescription, triggerEmergencySOS]);

  useEffect(() => {
    return () => {
      if (sentTimerRef.current !== null) window.clearTimeout(sentTimerRef.current);
    };
  }, []);

  const toggleSound = useCallback(() => {
    setSoundMuted((previous) => {
      const next = !previous;
      audioSynth.setMuted(next);
      if (!next && incomingRef.current.length > 0) {
        audioSynth.startEmergencyKlaxon();
      }
      return next;
    });
  }, []);

  const value: TelemetryContextType = {
    vitals,
    profile,
    updateProfile,
    connectSensor,
    ruleResult,
    aiModelTier,
    setAiModelTier,
    diagnostic,
    runHardwareDiagnostic,
    incomingEmergency: incoming[0] ?? null,
    incomingCount: incoming.length,
    ownAlert,
    triggerEmergencySOS,
    acknowledgeEmergency,
    cancelOwnAlert,
    dismissOwnAlert,
    soundMuted,
    toggleSound,
    nodeId: crewLink.nodeId,
    crewLinkMode,
    peerCount: peers.length,
    peers,
    sensorStatus,
    sensorFrame,
    sensorId: profile.sensorId
  };

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
};

export function useTelemetry(): TelemetryContextType {
  const context = useContext(TelemetryContext);
  if (!context) throw new Error('useTelemetry must be used inside TelemetryProvider');
  return context;
}
