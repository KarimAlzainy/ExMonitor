import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  AiModelTier,
  CrewProfile,
  DemoState,
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
import { loadBundleModel, resolveInitialTier, storeTier } from '../services/aiModels';
import { assessDevice } from '../services/deviceCheck';
import { saveProfile } from '../services/profileStore';
import { DEMO_SENSOR_ID, DEMO_STEPS, DEMO_STEP_COUNT } from '../services/demoRunner';
import { SensorEngine } from '../sensors/sensorEngine';

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
  demo: DemoState;
  startDemo: () => void;
  pauseDemo: () => void;
  resumeDemo: () => void;
  stopDemo: () => void;
  adoptedSensorId: string | null;
}

const TelemetryContext = createContext<TelemetryContextType | null>(null);

const INITIAL_DEMO: DemoState = {
  running: false,
  paused: false,
  stepIndex: 0,
  stepCount: DEMO_STEP_COUNT,
  label: '',
  note: '',
  progress: 0
};

const DEMO_TICK_MS = 125;

/**
 * Clear the sender's own alert completely, even while it is still flagged as
 * sending. `dismissOwnAlert` alone refuses during that window, which would
 * strand an alert panel.
 */
function vitalsFromFrame(frame: SensorFrame): VitalsData {
  return {
    heartRate: frame.heartRate,
    spO2: frame.spO2,
    bodyTemp: frame.bodyTemp,
    gsrStress: frame.gsrStress,
    radiationDoseRate: frame.radiationDoseRate,
    cumulativeRadiation: frame.cumulativeRadiation,
    timestamp: frame.sentAt,
    signalQuality: frame.signalQuality,
    source: 'sensor'
  };
}

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
  const [demo, setDemo] = useState<DemoState>(INITIAL_DEMO);
  const [adoptedSensorId, setAdoptedSensorId] = useState<string | null>(null);

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
  const lastAdoptAtRef = useRef(0);
  const demoActiveRef = useRef(false);
  const demoPausedRef = useRef(false);
  const demoTickRef = useRef<number | null>(null);
  const demoEngineRef = useRef<SensorEngine | null>(null);
  const demoStepRef = useRef(0);
  const demoStepStartedAtRef = useRef(0);
  const demoAlertFiredRef = useRef(false);
  const demoAlertAtRef = useRef(0);
  const demoAlertClearedRef = useRef(false);
  const demoPreSettledRef = useRef(false);
  const demoPausedAtRef = useRef(0);

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

  /**
   * Single entry point for sensor data. The relay listener keeps its
   * `sensorId === paired` guard; the demo bypasses it and owns the stream
   * while it runs.
   */
  const applySensorFrame = useCallback((frame: SensorFrame, origin: 'relay' | 'demo') => {
    if (origin === 'demo' && !demoActiveRef.current) return;
    if (origin === 'relay') {
      const active = profileRef.current.sensorId;
      if (!active || frame.sensorId !== active) return;
      // The demo is exclusive while it runs.
      if (demoActiveRef.current) return;
      const gap = Date.now() - lastSensorFrameAtRef.current;
      if (frame.seq <= lastSensorSeqRef.current && gap < 2500) return;
    }

    lastSensorSeqRef.current = frame.seq;
    lastSensorFrameAtRef.current = Date.now();
    setSensorStatus('connected');
    setSensorFrame(frame);
    setVitals(vitalsFromFrame(frame));
  }, []);

  const runHardwareDiagnostic = useCallback(async (): Promise<SystemDiagnostic> => {
    const next = await assessDevice();
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
    storeTier(tier, true);
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
        const { sensorId } = message.payload;
        const active = profileRef.current.sensorId;
        if (active) {
          if (sensorId === active) crewLink.pairSensor(active, profileRef.current.name);
          return;
        }
        // Nothing is paired yet: adopt the sensor that announced itself, so
        // choosing a situation on the sensor page drives this console without
        // a manual scan. The demo owns the stream while it runs.
        if (demoActiveRef.current) return;
        if (Date.now() - lastAdoptAtRef.current < 10000) return;
        lastAdoptAtRef.current = Date.now();
        setAdoptedSensorId(sensorId);
        connectSensor(sensorId);
        return;
      }

      if (message.type === 'SENSOR_FRAME') {
        applySensorFrame(message.payload, 'relay');
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
      // The demo owns the stream while it runs.
      if (demoActiveRef.current) return;
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
      if (demoActiveRef.current) return;
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
    // No sound on the sender's own alert: the astronaut raising it may already
    // be under stress. The crew receiving it gets the full alarm.

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

  /**
   * Stop the demo and hand the console back to live readings. This is total:
   * alert, overlay, vitals and sensor status all return to a clean state.
   */
  const stopDemo = useCallback(() => {
    const wasActive = demoActiveRef.current;
    if (demoTickRef.current !== null) {
      window.clearInterval(demoTickRef.current);
      demoTickRef.current = null;
    }
    demoActiveRef.current = false;
    demoPausedRef.current = false;
    demoPausedAtRef.current = 0;
    demoEngineRef.current = null;
    demoStepRef.current = 0;
    demoStepStartedAtRef.current = 0;
    demoAlertFiredRef.current = false;
    demoAlertAtRef.current = 0;
    demoAlertClearedRef.current = false;
    demoPreSettledRef.current = false;
    setDemo(INITIAL_DEMO);
    if (!wasActive) return;

    cancelOwnAlert();
    setOwnAlert(null);
    setSensorFrame(null);
    lastSensorFrameAtRef.current = 0;
    lastSensorSeqRef.current = 0;
    setSensorStatus(profileRef.current.sensorId ? 'waiting' : 'off');
    setVitals({ ...INITIAL_VITALS, timestamp: Date.now() });
  }, [cancelOwnAlert]);

  const startDemo = useCallback(() => {
    if (demoActiveRef.current) return;

    const engine = new SensorEngine(DEMO_SENSOR_ID);
    engine.setScenario(DEMO_STEPS[0].scenario);
    // Settle to the baseline so the first frames already look natural.
    engine.step(6);

    demoEngineRef.current = engine;
    demoActiveRef.current = true;
    demoPausedRef.current = false;
    demoPausedAtRef.current = 0;
    demoStepRef.current = 0;
    demoStepStartedAtRef.current = Date.now();
    demoAlertFiredRef.current = false;
    demoAlertAtRef.current = 0;
    demoAlertClearedRef.current = false;
    demoPreSettledRef.current = false;

    lastSensorFrameAtRef.current = Date.now();
    lastSensorSeqRef.current = 0;
    setSensorStatus('connected');
    setDemo({
      running: true,
      paused: false,
      stepIndex: 0,
      stepCount: DEMO_STEP_COUNT,
      label: DEMO_STEPS[0].label,
      note: DEMO_STEPS[0].note,
      progress: 0
    });

    let ecgRemainder = 0;
    let ppgRemainder = 0;

    const tick = () => {
      if (!demoActiveRef.current || demoPausedRef.current) return;
      const current = demoEngineRef.current;
      const step = DEMO_STEPS[demoStepRef.current];
      if (!current || !step) {
        stopDemo();
        return;
      }

      const now = Date.now();
      current.setScenario(step.scenario);

      // The last step snaps back to the rest profile, so the demo lands on
      // nominal instead of trailing a slowly-decaying radiation dose.
      if (demoStepRef.current === DEMO_STEP_COUNT - 1 && !demoPreSettledRef.current) {
        demoPreSettledRef.current = true;
        current.step(45);
        demoStepStartedAtRef.current = now;
      }

      const dt = DEMO_TICK_MS / 1000;
      current.step(dt);

      ecgRemainder += 250 * dt;
      const ecgCount = Math.round(ecgRemainder);
      ecgRemainder -= ecgCount;
      ppgRemainder += 50 * dt;
      const ppgCount = Math.round(ppgRemainder);
      ppgRemainder -= ppgCount;

      const ecg: number[] = [];
      for (let index = 0; index < ecgCount; index += 1) ecg.push(current.ecgSample());
      const ppg: number[] = [];
      for (let index = 0; index < ppgCount; index += 1) ppg.push(current.ppgSample());

      const frame = current.buildFrame(ecg, ppg);
      applySensorFrame(frame, 'demo');

      // The astronaut in distress only ever gets the small, silent popup
      // (the sender panel) — no full-screen takeover and no alarm sound.
      if (step.critical && !demoAlertFiredRef.current) {
        const rule = evaluateBiometrics(vitalsFromFrame(frame));
        if (rule.isTriggerEmergency) {
          demoAlertFiredRef.current = true;
          demoAlertAtRef.current = now;
        }
      }

      // Hold the small popup long enough to read, then clear it so the next
      // critical step can raise a fresh alert.
      if (
        demoAlertFiredRef.current &&
        !demoAlertClearedRef.current &&
        demoAlertAtRef.current > 0 &&
        now - demoAlertAtRef.current >= 6000
      ) {
        demoAlertClearedRef.current = true;
        cancelOwnAlert();
        setOwnAlert(null);
      }

      const elapsed = (now - demoStepStartedAtRef.current) / 1000;

      if (elapsed >= step.seconds) {
        const nextIndex = demoStepRef.current + 1;
        if (nextIndex >= DEMO_STEP_COUNT) {
          stopDemo();
          return;
        }
        // Leave a critical step with a clean slate so the next critical step
        // can raise a fresh alert.
        if (step.critical) {
          cancelOwnAlert();
          setOwnAlert(null);
          demoAlertFiredRef.current = false;
          demoAlertAtRef.current = 0;
          demoAlertClearedRef.current = false;
        }
        demoStepRef.current = nextIndex;
        demoStepStartedAtRef.current = now;
        setDemo({
          running: true,
          paused: false,
          stepIndex: nextIndex,
          stepCount: DEMO_STEP_COUNT,
          label: DEMO_STEPS[nextIndex].label,
          note: DEMO_STEPS[nextIndex].note,
          progress: 0
        });
        return;
      }

      setDemo({
        running: true,
        paused: false,
        stepIndex: demoStepRef.current,
        stepCount: DEMO_STEP_COUNT,
        label: step.label,
        note: step.note,
        progress: Math.min(1, elapsed / step.seconds)
      });
    };

    demoTickRef.current = window.setInterval(tick, DEMO_TICK_MS);
    tick();
  }, [applySensorFrame, cancelOwnAlert, stopDemo]);

  const pauseDemo = useCallback(() => {
    if (!demoActiveRef.current || demoPausedRef.current) return;
    demoPausedRef.current = true;
    demoPausedAtRef.current = Date.now();
    setDemo((previous) => ({ ...previous, paused: true }));
  }, []);

  const resumeDemo = useCallback(() => {
    if (!demoActiveRef.current || !demoPausedRef.current) return;
    const pausedFor = Date.now() - demoPausedAtRef.current;
    demoStepStartedAtRef.current += pausedFor;
    demoPausedAtRef.current = 0;
    demoPausedRef.current = false;
    setDemo((previous) => ({ ...previous, paused: false }));
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
      if (demoTickRef.current !== null) window.clearInterval(demoTickRef.current);
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
    sensorId: profile.sensorId,
    demo,
    startDemo,
    pauseDemo,
    resumeDemo,
    stopDemo,
    adoptedSensorId
  };

  return <TelemetryContext.Provider value={value}>{children}</TelemetryContext.Provider>;
};

export function useTelemetry(): TelemetryContextType {
  const context = useContext(TelemetryContext);
  if (!context) throw new Error('useTelemetry must be used inside TelemetryProvider');
  return context;
}
