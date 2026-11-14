import { AlertSeverity, VitalsData } from '../types/telemetry';

export interface RuleEvaluationResult {
  severity: AlertSeverity;
  statusColor: 'green' | 'yellow' | 'red';
  hazardTitle: string;
  hazardDescription: string;
  recommendedAction: string;
  isTriggerEmergency: boolean;
  nasaRef: string;
}

/**
 * Deterministic Clinical Rules Engine (Layer 1 Safety Net)
 * Aligned with NASA MR092L (Radiation), MEDB 5.2 (Cardiovascular/Metabolic),
 * and NASA Flight Surgeon EVA Contingency Protocols.
 * Executes synchronously in 0 milliseconds.
 */
export function evaluateBiometrics(vitals: VitalsData): RuleEvaluationResult {
  const { heartRate, spO2, bodyTemp, gsrStress, radiationDoseRate } = vitals;

  // 1. CRITICAL EMERGENCY CONDITIONS (RED ALERT)
  // Acute Hypoxia
  if (spO2 < 88) {
    return {
      severity: 'critical',
      statusColor: 'red',
      hazardTitle: 'Critical hypoxia detected',
      hazardDescription: `Blood Oxygen saturated at ${spO2}%, below vital threshold (<88%). Severe risk of loss of consciousness within 60s.`,
      recommendedAction: 'Abort EVA immediately. Check the primary oxygen regulator, switch to the secondary O2 loop, increase suit pressure by 0.5 psi, and signal the crew lead.',
      isTriggerEmergency: true,
      nasaRef: 'NASA EVA Med-Rule 4.1.2 (Anoxia)'
    };
  }

  // Acute Radiation Flare (NASA MR092L)
  if (radiationDoseRate >= 1.0) {
    return {
      severity: 'critical',
      statusColor: 'red',
      hazardTitle: 'Ionizing radiation flux breach (MR092L)',
      hazardDescription: `Ambient radiation dosimeter spiked to ${radiationDoseRate.toFixed(2)} mSv/hr (>1.0 mSv/hr contingency ceiling). Solar Particle Event (SPE) probable.`,
      recommendedAction: 'Retreat immediately to the shielded spacecraft storm shelter (Zvezda / Orion storm bay). Ingest the radioprotective countermeasure kit.',
      isTriggerEmergency: true,
      nasaRef: 'NASA MR092L Radiation Emergency Standard'
    };
  }

  // Severe Cardiac Tachycardia / Arrhythmia
  if (heartRate > 155) {
    return {
      severity: 'critical',
      statusColor: 'red',
      hazardTitle: 'Acute cardiac strain / tachycardia',
      hazardDescription: `Heart rate spiked to ${heartRate} BPM with severe autonomic nervous system stress (GSR: ${gsrStress.toFixed(1)} uS).`,
      recommendedAction: 'Halt all exertion. Lock the tether. Enable active liquid cooling garment (LCG) maximum flow. Rest for 180 seconds and monitor rhythm.',
      isTriggerEmergency: true,
      nasaRef: 'NASA MEDB 5.2 Cardiovascular Limits'
    };
  }

  // Extreme Bradycardia (Cardiac Arrest / Heart Block Risk)
  if (heartRate < 42) {
    return {
      severity: 'critical',
      statusColor: 'red',
      hazardTitle: 'Acute severe bradycardia',
      hazardDescription: `Heart rate collapsed to ${heartRate} BPM. Autonomic collapse or vagal syncope imminent.`,
      recommendedAction: 'Sit and anchor immediately. Elevate legs if in the habitat, ingest electrolytes, and prepare the atropine injector if consciousness decreases.',
      isTriggerEmergency: true,
      nasaRef: 'NASA MEDB 5.2 Cardiac Arrest Protocol'
    };
  }

  // Severe Hyperthermia (Heat Stroke in EVA Suit)
  if (bodyTemp >= 38.8) {
    return {
      severity: 'critical',
      statusColor: 'red',
      hazardTitle: 'Critical hyperthermia (heat stroke risk)',
      hazardDescription: `Core temperature at ${bodyTemp.toFixed(1)}°C. Metabolic heat accumulation exceeding sublimation cooling capacity.`,
      recommendedAction: 'Switch the suit sublimator to max. Minimize movement. Hydrate immediately with the cold electrolyte reservoir.',
      isTriggerEmergency: true,
      nasaRef: 'NASA EVA Thermal Regulation Contingency'
    };
  }

  // 2. CAUTION / WARNING CONDITIONS (YELLOW ALERT)
  // Mild Hypoxia / Heavy Exertion
  if (spO2 < 93) {
    return {
      severity: 'caution',
      statusColor: 'yellow',
      hazardTitle: 'Elevated hypoxia margin',
      hazardDescription: `Blood Oxygen at ${spO2}% (nominal: 95-100%). Elevated metabolic consumption detected.`,
      recommendedAction: 'Reduce work rate. Take 10 deep controlled breaths. Verify the suit O2 bleed valve rate.',
      isTriggerEmergency: false,
      nasaRef: 'NASA Flight Rule EVA-3.8'
    };
  }

  // High Exertion / Moderate Tachycardia
  if (heartRate > 125) {
    return {
      severity: 'caution',
      statusColor: 'yellow',
      hazardTitle: 'High physical exertion / stress',
      hazardDescription: `Heart rate elevated at ${heartRate} BPM, accompanied by sympathetic activation (GSR ${gsrStress.toFixed(1)} uS).`,
      recommendedAction: 'Pause heavy mechanical operations. Sip water from the in-suit straw. Stabilize respiratory rhythm.',
      isTriggerEmergency: false,
      nasaRef: 'NASA MEDB 5.2 Exercise Monitoring'
    };
  }

  // Elevated Radiation Warning (MR092L Level 2)
  if (radiationDoseRate >= 0.3) {
    return {
      severity: 'caution',
      statusColor: 'yellow',
      hazardTitle: 'Elevated radiation flux (MR092L caution)',
      hazardDescription: `Dose rate reached ${radiationDoseRate.toFixed(2)} mSv/hr. Approaching non-nominal orbital flux.`,
      recommendedAction: 'Log the current habitat sector. Limit exterior spacewalk duration to under 45 minutes.',
      isTriggerEmergency: false,
      nasaRef: 'NASA MR092L Phase 2 Tracking'
    };
  }

  // Mild Hyperthermia
  if (bodyTemp >= 37.8) {
    return {
      severity: 'caution',
      statusColor: 'yellow',
      hazardTitle: 'Thermal load warning',
      hazardDescription: `Core temperature at ${bodyTemp.toFixed(1)}°C. Elevated metabolic heat index.`,
      recommendedAction: 'Increase the liquid cooling and ventilation garment (LCVG) coolant valve by one notch.',
      isTriggerEmergency: false,
      nasaRef: 'NASA EMU Suit Ops 2.4'
    };
  }

  // 3. NOMINAL CONDITIONS (GREEN)
  return {
    severity: 'nominal',
    statusColor: 'green',
    hazardTitle: 'All biometrics nominal',
    hazardDescription: `Heart rate ${heartRate} BPM, SpO2 ${spO2}%, Core Temp ${bodyTemp.toFixed(1)}°C, Rad Safe (${radiationDoseRate.toFixed(2)} mSv/hr).`,
    recommendedAction: 'Continue scheduled mission tasks. Maintain hydration and check suit umbilical connections every 30 minutes.',
    isTriggerEmergency: false,
    nasaRef: 'NASA Baseline Human Performance Spec'
  };
}

/**
 * Pre-written NASA Aerospace Medicine Action Cards
 * Used for Low-End / Deterministic Mode without LLM.
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
    nasaCode: string;
  };
}

export const NASA_SYMPTOM_PROTOCOLS: SymptomRuleCard[] = [
  {
    id: 'chest_pain',
    name: 'Chest pain / pressure',
    icon: 'HeartPulse',
    description: 'Pain, tightness, or burning sensation across the sternum or radiating to left arm.',
    evaluate: (vitals) => {
      const isDangerous = vitals.heartRate > 120 || vitals.spO2 < 92;
      return {
        status: isDangerous ? 'Urgent Alert' : 'Caution',
        color: isDangerous ? 'crimson' : 'amber',
        diagnosis: isDangerous 
          ? `Acute Myocardial Ischemia / Cardiac Strain suspected under hypoxic conditions (HR: ${vitals.heartRate} BPM, SpO2: ${vitals.spO2}%).`
          : `Musculoskeletal chest wall strain or microgravity fluid shift tension (Vitals stable: HR ${vitals.heartRate} BPM, SpO2 ${vitals.spO2}%).`,
        steps: [
          'Cease all physical activity immediately and anchor in place.',
          'Open medical pack: Prepare Aspirin 325mg chewable + Nitroglycerin sublingual spray if systolic pressure allows.',
          'Verify suit cooling flow (LCVG) to reduce cardiac workload.',
          'Notify Flight Surgeon & request immediate secondary crew observation.'
        ],
        nasaCode: 'NASA Flight Rule MED-10.4 (Cardiac Emergencies)'
      };
    }
  },
  {
    id: 'dizziness_hypoxia',
    name: 'Dizziness / hypoxia',
    icon: 'Wind',
    description: 'Lightheadedness, tunnel vision, confusion, or difficulty focusing.',
    evaluate: (vitals) => {
      const isHypoxic = vitals.spO2 < 90;
      return {
        status: isHypoxic ? 'Urgent Alert' : 'Caution',
        color: isHypoxic ? 'crimson' : 'amber',
        diagnosis: isHypoxic
          ? `Critical Hypoxic Event (SpO2 ${vitals.spO2}%). Insufficient partial pressure of oxygen in helmet/suit.`
          : `Orthostatic intolerance or vestibular disorientation due to microgravity neuro-vestibular adaptation.`,
        steps: [
          'Immediately verify suit oxygen supply gauge and primary regulator.',
          'Switch to Emergency 100% Oxygen Supply Loop immediately.',
          'Perform Valsalva or leg tension contractions to maintain cerebral perfusion.',
          'Hold handrail and do not rotate head rapidly.'
        ],
        nasaCode: 'NASA EVA Contingency Med-3.2 (Atmospheric Depletion)'
      };
    }
  },
  {
    id: 'fatigue_heat',
    name: 'Exhaustion / overheating',
    icon: 'Flame',
    description: 'Excessive sweating, heavy lethargy, muscle weakness, or sensation of heat.',
    evaluate: (vitals) => {
      const isHot = vitals.bodyTemp >= 37.8 || vitals.heartRate > 130;
      return {
        status: isHot ? 'Urgent Alert' : 'Caution',
        color: isHot ? 'crimson' : 'amber',
        diagnosis: isHot
          ? `Thermal Accumulation / Impending Heat Exhaustion (Temp: ${vitals.bodyTemp.toFixed(1)}°C, HR: ${vitals.heartRate} BPM, GSR: ${vitals.gsrStress.toFixed(1)} uS).`
          : `Normothermic physical fatigue from prolonged EVA tasking.`,
        steps: [
          'Turn Liquid Cooling Garment (LCG) control valve to MAX COLD.',
          'Rest for 5 continuous minutes without arm or grip actuation.',
          'Drink 250ml electrolyte water via suit hydration bag.',
          'If body temp stays >38.5°C, abort EVA and initiate airlock repressurization.'
        ],
        nasaCode: 'NASA Flight Rule MED-8.1 (Thermal Homeostasis)'
      };
    }
  },
  {
    id: 'radiation_alert',
    name: 'Radiation flare exposure',
    icon: 'Radiation',
    description: 'Dosimeter alarm or visible visual phosphenes (light flashes) in closed eyes.',
    evaluate: (vitals) => {
      const isSpike = vitals.radiationDoseRate > 0.5;
      return {
        status: isSpike ? 'Urgent Alert' : 'Caution',
        color: isSpike ? 'crimson' : 'amber',
        diagnosis: isSpike
          ? `Severe Space Radiation Exposure (Dose Rate: ${vitals.radiationDoseRate.toFixed(2)} mSv/hr, Total: ${vitals.cumulativeRadiation.toFixed(2)} mSv). Exceeds MR092L 30-day ALARA index.`
          : `Elevated cosmic background flux within acceptable operational variance.`,
        steps: [
          'Immediate retreat to designated shielded storm shelter compartment.',
          'Position water tanks and polyethene food rations around torso for supplementary shielding.',
          'Administer prophylactic anti-nausea medication (Ondansetron 8mg) if nausea starts.',
          'Log exact dosimeter timestamp with Mission Control Space Radiation Analysis Group (SRAG).'
        ],
        nasaCode: 'NASA MR092L In-Flight Radiation Monitoring Protocol'
      };
    }
  },
  {
    id: 'arrhythmia',
    name: 'Arrhythmia / palpitations',
    icon: 'Activity',
    description: 'Skipped beats, racing flutter in chest, or sudden irregular pulse.',
    evaluate: (vitals) => {
      const isIrregular = vitals.heartRate > 140 || vitals.heartRate < 45;
      return {
        status: isIrregular ? 'Urgent Alert' : 'Caution',
        color: isIrregular ? 'crimson' : 'amber',
        diagnosis: isIrregular
          ? `Acute Paroxysmal Tachycardia or Heart Block seen in the ECG trace (Current HR: ${vitals.heartRate} BPM).`
          : `Premature Ventricular Contractions (PVCs) likely induced by caffeine, microgravity electrolyte shifts, or stress.`,
        steps: [
          'Perform modified Valsalva maneuver (bearing down for 10-15 seconds).',
          'Check the pulse manually on the radial artery to confirm the sensor reading.',
          'Prepare automated external defibrillator (AED) in habitat if dizziness accompanies.',
          'Transmit 60-second 3-lead ECG strip to ground medical team.'
        ],
        nasaCode: 'NASA MEDB 5.2 Arrhythmia Contingency'
      };
    }
  }
];
