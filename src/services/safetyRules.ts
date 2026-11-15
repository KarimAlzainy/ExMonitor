/**
 * Written safety rules for ExMonitor (the deterministic "Layer 1" safety net).
 *
 * Honesty note. These thresholds are teaching values for a training
 * simulation. They are inspired by published human-spaceflight practice and by
 * ordinary clinical vital-sign ranges, but they are NOT operational flight
 * rules and must never be used for real medical decisions.
 *
 * The only numbers here that come from a real, published NASA document are the
 * radiation limits shown on the Radiation card: NASA-STD-3001 Volume 1,
 * Revision C sets a 600 mSv career effective-dose limit and a 250 mSv limit per
 * solar particle event ([V1 4030] and [V1 4031]). The dose-rate alert lines
 * below (0.30 and 1.00 mSv per hour) are simulation alert levels chosen for
 * this game; they are not NASA values.
 *
 * Earlier versions of this file quoted document numbers such as "MR092L",
 * "MEDB 5.2", "EVA-3.8", "MED-10.4", "MED-8.1", "Med-3.2", "EVA Med-Rule
 * 4.1.2" and "EMU Suit Ops 2.4". Those could not be verified against any
 * published NASA document and have been removed. (The MEDB/MRID family does
 * exist, but the numbers used here did not match real entries, so they are
 * gone.)
 *
 * Every threshold the console uses lives in THRESHOLDS so the vital cards, the
 * heart trace and the assistant all agree with this engine.
 */
import { AlertSeverity, VitalsData } from '../types/telemetry';

export const THRESHOLDS = {
  heartRate: {
    /** Critical bradycardia line, BPM. */
    low: 42,
    /** Critical tachycardia line, BPM. */
    high: 155,
    /** Caution tachycardia line, BPM. */
    cautionHigh: 125,
    /** Below this the heart trace is labelled a slow rhythm, BPM. */
    slowRhythm: 45
  },
  spO2: {
    /** Critical hypoxia line, percent. */
    critical: 88,
    /** Caution hypoxia line, percent. */
    caution: 93
  },
  bodyTemp: {
    /** Critical hyperthermia line, degrees Celsius. */
    critical: 38.8,
    /** Caution hyperthermia line, degrees Celsius. */
    caution: 37.8
  },
  gsrStress: {
    /** Critical skin-conductance line, microsiemens. */
    critical: 22,
    /** Caution skin-conductance line, microsiemens. */
    caution: 12
  },
  radiationDoseRate: {
    /** Critical dose-rate alert line, mSv per hour (simulation value). */
    critical: 1.0,
    /** Caution dose-rate alert line, mSv per hour (simulation value). */
    caution: 0.3
  },
  /** Career effective-dose limit from NASA-STD-3001 Volume 1, Rev C [V1 4030], mSv. */
  radiationCareerLimit: 600
} as const;

export interface RuleEvaluationResult {
  severity: AlertSeverity;
  statusColor: 'green' | 'yellow' | 'red';
  hazardTitle: string;
  hazardDescription: string;
  recommendedAction: string;
  isTriggerEmergency: boolean;
  /** Short label for the written rule behind this status (shown in the UI). */
  guidanceRef: string;
}

export function evaluateBiometrics(vitals: VitalsData): RuleEvaluationResult {
  const { heartRate, spO2, bodyTemp, gsrStress, radiationDoseRate } = vitals;

  // 1. CRITICAL CONDITIONS (RED)
  // Low blood oxygen. The 88 percent line matches common clinical guidance for
  // a severe desaturation; it is a teaching value, not a flight rule.
  if (spO2 < THRESHOLDS.spO2.critical) {
    return {
      severity: 'critical',
      statusColor: 'red',
      hazardTitle: 'Critical hypoxia detected',
      hazardDescription: `Blood oxygen saturated at ${spO2}%, below the critical line (<${THRESHOLDS.spO2.critical}%). Severe risk of loss of consciousness within 60s.`,
      recommendedAction:
        'Stop the task. Check the primary oxygen regulator, switch to the secondary O2 loop, raise suit pressure by 0.5 psi, and call the crew lead.',
      isTriggerEmergency: true,
      guidanceRef: 'Hypoxia response rule'
    };
  }

  // Radiation dosimeter spike. The alert line is a simulation value; the
  // career limit that the Radiation card tracks (600 mSv) is from
  // NASA-STD-3001 Volume 1, Rev C.
  if (radiationDoseRate >= THRESHOLDS.radiationDoseRate.critical) {
    return {
      severity: 'critical',
      statusColor: 'red',
      hazardTitle: 'Ionizing radiation dosimeter spike',
      hazardDescription: `Ambient radiation dosimeter reached ${radiationDoseRate.toFixed(2)} mSv/hr (above the ${THRESHOLDS.radiationDoseRate.critical.toFixed(2)} mSv/hr simulation alert line). A solar particle event is likely.`,
      recommendedAction:
        'Move immediately to the shielded storm shelter. Take the radioprotective countermeasure kit and log the dosimeter reading.',
      isTriggerEmergency: true,
      guidanceRef: 'Radiation storm rule'
    };
  }

  // Severe tachycardia. A teaching line for heavy exertion plus cardiac strain.
  if (heartRate > THRESHOLDS.heartRate.high) {
    return {
      severity: 'critical',
      statusColor: 'red',
      hazardTitle: 'Acute cardiac strain / tachycardia',
      hazardDescription: `Heart rate reached ${heartRate} BPM with high autonomic stress (GSR: ${gsrStress.toFixed(1)} uS).`,
      recommendedAction:
        'Stop all exertion and anchor the tether. Increase liquid cooling to maximum, rest for 180 seconds and keep watching the rhythm.',
      isTriggerEmergency: true,
      guidanceRef: 'Cardiac strain rule'
    };
  }

  // Extreme bradycardia.
  if (heartRate < THRESHOLDS.heartRate.low) {
    return {
      severity: 'critical',
      statusColor: 'red',
      hazardTitle: 'Acute severe bradycardia',
      hazardDescription: `Heart rate fell to ${heartRate} BPM. Autonomic collapse or vagal syncope is possible.`,
      recommendedAction:
        'Sit and anchor at once. Elevate the legs if in the habitat, take electrolytes, and prepare the atropine injector if consciousness drops.',
      isTriggerEmergency: true,
      guidanceRef: 'Bradycardia rule'
    };
  }

  // Severe hyperthermia.
  if (bodyTemp >= THRESHOLDS.bodyTemp.critical) {
    return {
      severity: 'critical',
      statusColor: 'red',
      hazardTitle: 'Critical hyperthermia (heat stroke risk)',
      hazardDescription: `Core temperature at ${bodyTemp.toFixed(1)}°C. Metabolic heat is building faster than the suit can reject it.`,
      recommendedAction:
        'Switch the suit sublimator to maximum, minimise movement, and drink from the cold electrolyte reservoir.',
      isTriggerEmergency: true,
      guidanceRef: 'Hyperthermia rule'
    };
  }

  // 2. CAUTION CONDITIONS (YELLOW)
  if (spO2 < THRESHOLDS.spO2.caution) {
    return {
      severity: 'caution',
      statusColor: 'yellow',
      hazardTitle: 'Reduced oxygen margin',
      hazardDescription: `Blood oxygen at ${spO2}% (usual range 95-100%). Rising metabolic demand.`,
      recommendedAction: 'Slow the work rate. Take 10 slow deep breaths. Check the suit O2 bleed valve rate.',
      isTriggerEmergency: false,
      guidanceRef: 'Reduced-oxygen rule'
    };
  }

  if (heartRate > THRESHOLDS.heartRate.cautionHigh) {
    return {
      severity: 'caution',
      statusColor: 'yellow',
      hazardTitle: 'High physical exertion / stress',
      hazardDescription: `Heart rate elevated at ${heartRate} BPM with sympathetic activation (GSR ${gsrStress.toFixed(1)} uS).`,
      recommendedAction: 'Pause heavy work. Sip water from the in-suit straw. Settle the breathing rhythm.',
      isTriggerEmergency: false,
      guidanceRef: 'Exertion rule'
    };
  }

  if (radiationDoseRate >= THRESHOLDS.radiationDoseRate.caution) {
    return {
      severity: 'caution',
      statusColor: 'yellow',
      hazardTitle: 'Elevated radiation flux',
      hazardDescription: `Dose rate reached ${radiationDoseRate.toFixed(2)} mSv/hr, above the ${THRESHOLDS.radiationDoseRate.caution.toFixed(2)} mSv/hr simulation caution line.`,
      recommendedAction: 'Log the current habitat sector and keep any spacewalk short until the flux falls.',
      isTriggerEmergency: false,
      guidanceRef: 'Elevated-radiation rule'
    };
  }

  if (bodyTemp >= THRESHOLDS.bodyTemp.caution) {
    return {
      severity: 'caution',
      statusColor: 'yellow',
      hazardTitle: 'Thermal load warning',
      hazardDescription: `Core temperature at ${bodyTemp.toFixed(1)}°C. Elevated metabolic heat index.`,
      recommendedAction: 'Open the liquid cooling and ventilation garment coolant valve by one notch.',
      isTriggerEmergency: false,
      guidanceRef: 'Thermal-load rule'
    };
  }

  // 3. NOMINAL (GREEN)
  return {
    severity: 'nominal',
    statusColor: 'green',
    hazardTitle: 'All biometrics nominal',
    hazardDescription: `Heart rate ${heartRate} BPM, SpO2 ${spO2}%, core temp ${bodyTemp.toFixed(1)}°C, radiation rate ${radiationDoseRate.toFixed(2)} mSv/hr.`,
    recommendedAction: 'Continue scheduled tasks. Keep hydrated and check suit umbilical connections every 30 minutes.',
    isTriggerEmergency: false,
    guidanceRef: 'Nominal range check'
  };
}

/**
 * Pre-written action cards, used when no language model is loaded. The steps
 * are general aerospace-medicine practice for a training simulation and do not
 * come from a specific published NASA flight rule.
 */
export interface SymptomRuleCard {
  id: string;
  name: string;
  icon: string;
  description: string;
  evaluate: (vitals: VitalsData) => {
    status: 'Nominal' | 'Caution' | 'Urgent Alert';
    color: 'emerald' | 'amber' | 'crimson';
    diagnosis: string;
    steps: string[];
    guidanceCode: string;
  };
}

export const SYMPTOM_PROTOCOLS: SymptomRuleCard[] = [
  {
    id: 'chest_pain',
    name: 'Chest pain / pressure',
    icon: 'HeartPulse',
    description: 'Pain, tightness, or burning across the sternum, or pain radiating to the left arm.',
    evaluate: (vitals) => {
      const isDangerous =
        vitals.heartRate > 120 || vitals.spO2 < 92;
      return {
        status: isDangerous ? 'Urgent Alert' : 'Caution',
        color: isDangerous ? 'crimson' : 'amber',
        diagnosis: isDangerous
          ? `Possible acute cardiac strain under low-oxygen conditions (HR: ${vitals.heartRate} BPM, SpO2: ${vitals.spO2}%).`
          : `Likely chest-wall strain or a microgravity fluid shift (vitals stable: HR ${vitals.heartRate} BPM, SpO2 ${vitals.spO2}%).`,
        steps: [
          'Stop all physical activity and anchor in place.',
          'Prepare aspirin 325 mg to chew and nitroglycerin spray, if blood pressure allows.',
          'Check the suit cooling flow (LCVG) to reduce cardiac workload.',
          'Tell mission medical support and ask a second crew member to watch the person.'
        ],
        guidanceCode: 'Action card · cardiac'
      };
    }
  },
  {
    id: 'dizziness_hypoxia',
    name: 'Dizziness / hypoxia',
    icon: 'Wind',
    description: 'Lightheadedness, tunnel vision, confusion, or trouble focusing.',
    evaluate: (vitals) => {
      const isHypoxic = vitals.spO2 < 90;
      return {
        status: isHypoxic ? 'Urgent Alert' : 'Caution',
        color: isHypoxic ? 'crimson' : 'amber',
        diagnosis: isHypoxic
          ? `Critical low-oxygen event (SpO2 ${vitals.spO2}%). Too little oxygen in the helmet or suit.`
          : `Orthostatic intolerance or a vestibular reaction to microgravity.`,
        steps: [
          'Check the suit oxygen supply gauge and the primary regulator.',
          'Switch to the emergency 100% oxygen loop immediately.',
          'Tense the legs or do a Valsalva manoeuvre to keep blood flowing to the brain.',
          'Hold a handrail and avoid turning the head quickly.'
        ],
        guidanceCode: 'Action card · hypoxia'
      };
    }
  },
  {
    id: 'fatigue_heat',
    name: 'Exhaustion / overheating',
    icon: 'Flame',
    description: 'Heavy sweating, lethargy, muscle weakness, or a strong feeling of heat.',
    evaluate: (vitals) => {
      const isHot = vitals.bodyTemp >= 37.8 || vitals.heartRate > 130;
      return {
        status: isHot ? 'Urgent Alert' : 'Caution',
        color: isHot ? 'crimson' : 'amber',
        diagnosis: isHot
          ? `Heat building up toward heat exhaustion (temp: ${vitals.bodyTemp.toFixed(1)}°C, HR: ${vitals.heartRate} BPM, GSR: ${vitals.gsrStress.toFixed(1)} uS).`
          : `Normal-temperature physical fatigue after a long task.`,
        steps: [
          'Turn the liquid cooling garment (LCG) control valve to maximum cold.',
          'Rest for 5 minutes without arm or grip work.',
          'Drink 250 ml of electrolyte water from the suit hydration bag.',
          'If the temperature stays above 38.5°C, abort and repressurise the airlock.'
        ],
        guidanceCode: 'Action card · heat'
      };
    }
  },
  {
    id: 'radiation_alert',
    name: 'Radiation flare exposure',
    icon: 'Radiation',
    description: 'Dosimeter alarm, or light flashes seen with the eyes closed.',
    evaluate: (vitals) => {
      const isSpike = vitals.radiationDoseRate > 0.5;
      return {
        status: isSpike ? 'Urgent Alert' : 'Caution',
        color: isSpike ? 'crimson' : 'amber',
        diagnosis: isSpike
          ? `High radiation dose rate (${vitals.radiationDoseRate.toFixed(2)} mSv/hr, total ${vitals.cumulativeRadiation.toFixed(2)} mSv). Above the simulation's elevated-radiation line.`
          : `Slightly raised cosmic background within the simulation's normal band.`,
        steps: [
          'Move to the designated shielded storm shelter right away.',
          'Place water tanks and dense food containers around the torso for extra shielding.',
          'Take anti-nausea medicine (for example ondansetron 8 mg) if nausea starts.',
          'Log the dosimeter time and tell the ground Space Radiation Analysis Group (SRAG).'
        ],
        guidanceCode: 'Action card · radiation'
      };
    }
  },
  {
    id: 'arrhythmia',
    name: 'Arrhythmia / palpitations',
    icon: 'Activity',
    description: 'Skipped beats, a fluttering chest, or a suddenly irregular pulse.',
    evaluate: (vitals) => {
      const isIrregular = vitals.heartRate > 140 || vitals.heartRate < 45;
      return {
        status: isIrregular ? 'Urgent Alert' : 'Caution',
        color: isIrregular ? 'crimson' : 'amber',
        diagnosis: isIrregular
          ? `Possible paroxysmal tachycardia or heart block on the heart trace (HR: ${vitals.heartRate} BPM).`
          : `Premature beats, likely from caffeine, an electrolyte shift in microgravity, or stress.`,
        steps: [
          'Do a modified Valsalva manoeuvre (bear down for 10-15 seconds).',
          'Check the pulse by hand at the wrist to confirm the sensor reading.',
          'Prepare the automated external defibrillator (AED) if dizziness comes with it.',
          'Send a 60-second heart-trace strip to the ground medical team.'
        ],
        guidanceCode: 'Action card · rhythm'
      };
    }
  }
];
