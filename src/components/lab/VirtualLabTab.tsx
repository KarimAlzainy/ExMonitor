import React from 'react';
import { useTelemetry } from '../../context/TelemetryContext';

const STEPS = [
  'Open Demo controls and start in Normal mode so the ECG sits near 72 BPM and 98% SpO2.',
  'Under Pairing, scan the simulated strap label (NASA-STRAP-EVA-409), bind a crew role, then run the Bluetooth handshake.',
  'Ask the flight surgeon about dizziness. The live snapshot travels with the question.',
  'Switch the demo panel to Emergency danger mode. SpO2 falls to 84% and radiation jumps to 2.45 mSv/hr, which trips the Klaxon and the mesh SOS.',
  'Acknowledge the alert to silence the alarm. A second browser on the same hotspot, with the port 8080 relay running, receives the same overlay.'
];

const TIER_NAMES: Record<string, string> = {
  phi3: 'Phi-3',
  llama3: 'Llama-3.2',
  gemma2: 'Gemma-2',
  hardcoded_rules: 'No-AI rules'
};

export const VirtualLabTab: React.FC = () => {
  const { vitals, ruleResult, nodeId, aiModelTier } = useTelemetry();

  const hazards = [
    {
      name: 'Space radiation',
      detail: `${vitals.radiationDoseRate.toFixed(2)} mSv/hr against the MR092L 1.00 mSv/hr ceiling. Cumulative ${vitals.cumulativeRadiation.toFixed(2)} mSv.`
    },
    {
      name: 'Isolation',
      detail: `Flight surgeon tier is ${TIER_NAMES[aiModelTier] ?? aiModelTier}. Symptom cards stay available when the language model cannot run.`
    },
    {
      name: 'Distance from Earth',
      detail: `This node is ${nodeId}. EXTEM-Mesh shares an SOS on the local relay without waiting for a ground pass.`
    },
    {
      name: 'Gravity fields',
      detail: `Lead II ECG is tracking ${vitals.heartRate} BPM. The strip is the stand-in for fluid-shift and arrhythmia watch.`
    },
    {
      name: 'Hostile closed environment',
      detail: `Core temperature ${vitals.bodyTemp.toFixed(1)}°C and SpO2 ${vitals.spO2}%. Suit cooling and oxygen checks are the contingency actions.`
    }
  ];

  const statusTone =
    ruleResult.statusColor === 'red'
      ? { dot: 'bg-critical', text: 'text-critical' }
      : ruleResult.statusColor === 'yellow'
        ? { dot: 'bg-caution', text: 'text-caution' }
        : { dot: 'bg-positive', text: 'text-ink-200' };

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-white/[0.08] bg-space-900 p-5">
        <h2 className="text-[15px] font-medium text-ink-100">Five hazards of human spaceflight</h2>
        <p className="mt-1 max-w-2xl text-[12px] leading-5 text-ink-400">
          How this console answers each hazard while Earth is up to 22 minutes away.
        </p>

        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
          <span className={`h-1.5 w-1.5 rounded-full ${statusTone.dot}`} />
          <span className={statusTone.text}>{ruleResult.hazardTitle}</span>
          <span className="font-mono text-[10.5px] text-ink-500">{ruleResult.nasaRef}</span>
        </p>

        <ul className="mt-4 divide-y divide-white/[0.06] border-t border-white/[0.06]">
          {hazards.map((hazard, index) => (
            <li
              key={hazard.name}
              className="grid gap-1 py-3 sm:grid-cols-[28px_170px_minmax(0,1fr)] sm:items-baseline sm:gap-4"
            >
              <span className="font-mono text-[10.5px] tabular-nums text-ink-500">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="text-[13px] font-medium text-ink-100">{hazard.name}</span>
              <span className="text-[13px] leading-5 text-ink-300">{hazard.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-xl border border-white/[0.08] bg-space-900 p-5">
        <h2 className="text-[15px] font-medium text-ink-100">Judge walkthrough</h2>
        <p className="mt-1 text-[12px] text-ink-400">A short path through the demo.</p>
        <ol className="mt-4 space-y-3">
          {STEPS.map((step, index) => (
            <li key={step} className="flex gap-3">
              <span className="w-5 shrink-0 font-mono text-[10.5px] leading-5 tabular-nums text-ink-500">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="text-[13px] leading-5 text-ink-300">{step}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
};
