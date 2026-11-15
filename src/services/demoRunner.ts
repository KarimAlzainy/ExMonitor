import { SensorScenario } from '../types/telemetry';

/**
 * The scripted virtual sensor used by the one-tap demo on the console.
 *
 * It drives the real SensorEngine through a body's states, so the ECG, the
 * vitals, the hazard rules and the crew alerts all behave exactly as they do
 * with a paired sensor — no second device, no network.
 */
export const DEMO_SENSOR_ID = 'DEMO-01';

export interface DemoStep {
  /** Engine target profile for this step. */
  scenario: SensorScenario;
  label: string;
  note: string;
  /** How long the step is held, in seconds. */
  seconds: number;
  /** True when this step is expected to breach a critical rule. */
  critical: boolean;
}

/**
 * Holds are the minimum the stock engine needs to cross the real rule
 * thresholds: blood oxygen takes about 12 s to fall below 88%, and the dose
 * rate needs about 18 s to fall back under 0.30 mSv/hr.
 *
 * Settling steps use `rest` (not `recovery`) because the recovery profile
 * holds radiation at 0.35 mSv/hr, which the rules call a caution.
 */
export const DEMO_STEPS: DemoStep[] = [
  {
    scenario: 'rest',
    label: 'Baseline',
    note: 'Crew member at rest. All readings nominal.',
    seconds: 6,
    critical: false
  },
  {
    scenario: 'exercise',
    label: 'Exercise',
    note: 'A workout lifts heart rate, heat and sweat.',
    seconds: 12,
    critical: false
  },
  {
    scenario: 'rest',
    label: 'Cooling down',
    note: 'Readings settle back toward normal.',
    seconds: 8,
    critical: false
  },
  {
    scenario: 'hypoxia',
    label: 'Low oxygen',
    note: 'Blood oxygen falls into the critical range.',
    seconds: 15,
    critical: true
  },
  {
    scenario: 'rest',
    label: 'Recovering',
    note: 'Oxygen recovers to a safe level.',
    seconds: 10,
    critical: false
  },
  {
    scenario: 'radiation',
    label: 'Radiation storm',
    note: 'A solar particle event pushes the dose past the limit.',
    seconds: 12,
    critical: true
  },
  {
    scenario: 'rest',
    label: 'Back to normal',
    note: 'Readings return to nominal, then the demo stops.',
    seconds: 10,
    critical: false
  }
];

export const DEMO_STEP_COUNT = DEMO_STEPS.length;

/** Total run time in seconds, for the brief next to the button. */
export const DEMO_TOTAL_SECONDS = DEMO_STEPS.reduce((total, step) => total + step.seconds, 0);
