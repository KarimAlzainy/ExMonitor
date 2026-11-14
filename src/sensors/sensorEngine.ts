import { SensorFrame, SensorScenario } from '../types/telemetry';

interface Targets {
  heartRate: number;
  spO2: number;
  bodyTemp: number;
  gsrStress: number;
  radiationDoseRate: number;
  motion: number;
}

const TARGETS: Record<SensorScenario, Targets> = {
  rest: { heartRate: 68, spO2: 98, bodyTemp: 36.7, gsrStress: 4.1, radiationDoseRate: 0.04, motion: 0.02 },
  exercise: { heartRate: 137, spO2: 95.6, bodyTemp: 37.7, gsrStress: 17.2, radiationDoseRate: 0.06, motion: 0.9 },
  hypoxia: { heartRate: 112, spO2: 87.4, bodyTemp: 36.9, gsrStress: 12.4, radiationDoseRate: 0.05, motion: 0.08 },
  radiation: { heartRate: 91, spO2: 96.1, bodyTemp: 37.1, gsrStress: 8.8, radiationDoseRate: 2.4, motion: 0.04 },
  recovery: { heartRate: 82, spO2: 97.4, bodyTemp: 37.0, gsrStress: 6.9, radiationDoseRate: 0.35, motion: 0.06 }
};

export const SCENARIO_LABELS: Record<SensorScenario, { name: string; note: string }> = {
  rest: { name: 'At rest', note: 'A calm crew member in the habitat.' },
  exercise: { name: 'Exercise', note: 'A workout raises heart rate, heat and sweat.' },
  hypoxia: { name: 'Low oxygen', note: 'A suit fault drops blood oxygen into the critical range.' },
  radiation: { name: 'Radiation storm', note: 'A solar particle event pushes dose past the limit.' },
  recovery: { name: 'Recovery', note: 'Readings settle after an event.' }
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function noise(amount: number): number {
  return (Math.random() - 0.5) * amount;
}

function approach(current: number, target: number, dt: number, tau: number): number {
  return current + (target - current) * (1 - Math.exp(-dt / tau));
}

export class SensorEngine {
  public readonly sensorId: string;
  public scenario: SensorScenario = 'rest';

  private heartRate = 68;
  private spO2 = 98;
  private bodyTemp = 36.7;
  private gsrStress = 4.1;
  private radiationDoseRate = 0.04;
  private cumulativeRadiation = 1.18;
  private motion = 0.02;
  private battery = 87;
  private seq = 0;
  private ecgPhase = 0;
  private ppgPhase = 0;
  private startedAt = Date.now();

  constructor(sensorId: string) {
    this.sensorId = sensorId;
  }

  public setScenario(scenario: SensorScenario): void {
    this.scenario = scenario;
  }

  private targets(): Targets {
    return TARGETS[this.scenario];
  }

  public step(dtSeconds: number): void {
    const target = this.targets();
    this.heartRate = clamp(
      approach(this.heartRate, target.heartRate, dtSeconds, this.scenario === 'exercise' ? 2.4 : 5.5) +
        noise(this.scenario === 'exercise' ? 1.6 : 0.7),
      38,
      190
    );
    this.spO2 = clamp(approach(this.spO2, target.spO2, dtSeconds, 4.2) + noise(0.09), 70, 100);
    this.bodyTemp = clamp(approach(this.bodyTemp, target.bodyTemp, dtSeconds, 24) + noise(0.006), 34.5, 40.5);
    this.gsrStress = clamp(
      approach(this.gsrStress, target.gsrStress, dtSeconds, 6) + noise(this.scenario === 'exercise' ? 0.8 : 0.18),
      0.5,
      29
    );
    this.radiationDoseRate = clamp(
      approach(this.radiationDoseRate, target.radiationDoseRate, dtSeconds, this.scenario === 'radiation' ? 2.2 : 8) +
        noise(target.radiationDoseRate > 1 ? 0.16 : 0.006),
      0.01,
      6
    );
    this.cumulativeRadiation += (this.radiationDoseRate * dtSeconds) / 3600;
    this.motion = clamp(
      approach(this.motion, target.motion, dtSeconds, 2.5) + noise(target.motion > 0.3 ? 0.18 : 0.01),
      0,
      3
    );
    this.battery = Math.max(4, this.battery - dtSeconds * 0.0004);
  }

  public ecgSample(samplesPerSecond = 250): number {
    const bpm = clamp(this.heartRate, 38, 190);
    this.ecgPhase = (this.ecgPhase + bpm / 60 / samplesPerSecond) % 1;
    const p = this.ecgPhase;
    const t = (Date.now() - this.startedAt) / 1000;

    let value = Math.sin(t * 0.45) * 0.02 + noise(0.018);

    if (p >= 0.08 && p < 0.16) {
      value += Math.sin(((p - 0.08) / 0.08) * Math.PI) * 0.12;
    } else if (p >= 0.2 && p < 0.235) {
      value -= Math.sin(((p - 0.2) / 0.035) * Math.PI) * 0.14;
    } else if (p >= 0.235 && p < 0.29) {
      value += Math.sin(((p - 0.235) / 0.055) * Math.PI) * 1.02;
    } else if (p >= 0.29 && p < 0.335) {
      value -= Math.sin(((p - 0.29) / 0.045) * Math.PI) * 0.3;
    } else if (p >= 0.43 && p < 0.58) {
      value += Math.sin(((p - 0.43) / 0.15) * Math.PI) * 0.23;
    }

    if (this.scenario === 'hypoxia' || this.scenario === 'radiation') {
      value += noise(0.014);
    }

    return value;
  }

  public ppgSample(samplesPerSecond = 50): number {
    const bpm = clamp(this.heartRate, 38, 190);
    this.ppgPhase = (this.ppgPhase + bpm / 60 / samplesPerSecond) % 1;
    const p = this.ppgPhase;
    const t = (Date.now() - this.startedAt) / 1000;

    let value: number;
    if (p < 0.2) {
      value = Math.sin((p / 0.2) * (Math.PI / 2));
    } else {
      value = Math.exp(-(p - 0.2) * 5.2);
    }

    if (p > 0.34 && p < 0.45) {
      value -= Math.sin(((p - 0.34) / 0.11) * Math.PI) * 0.12;
    }

    const respiratory = Math.sin(t * 0.7) * 0.02;
    return value * 0.82 + respiratory + noise(0.008);
  }

  public buildFrame(ecg: number[], ppg: number[]): SensorFrame {
    this.seq += 1;
    const motionPenalty = Math.min(8, this.motion * 4);
    const signalQuality = clamp(98 - motionPenalty - (this.scenario === 'hypoxia' ? 3 : 0) + noise(1.2), 72, 99);

    return {
      sensorId: this.sensorId,
      seq: this.seq,
      sentAt: Date.now(),
      heartRate: Math.round(this.heartRate),
      spO2: Math.round(this.spO2),
      bodyTemp: Number(this.bodyTemp.toFixed(1)),
      gsrStress: Number(this.gsrStress.toFixed(1)),
      radiationDoseRate: Number(this.radiationDoseRate.toFixed(2)),
      cumulativeRadiation: Number(this.cumulativeRadiation.toFixed(3)),
      signalQuality: Math.round(signalQuality),
      battery: Math.round(this.battery),
      motion: Number(this.motion.toFixed(2)),
      scenario: this.scenario,
      ecg: ecg.map((value) => Number(value.toFixed(4))),
      ppg: ppg.map((value) => Number(value.toFixed(4)))
    };
  }
}

export function createSensorId(): string {
  const random = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SENSOR-${random}`;
}
