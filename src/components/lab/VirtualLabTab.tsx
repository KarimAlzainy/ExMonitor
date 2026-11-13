import React from 'react';
import { useTelemetry } from '../../context/TelemetryContext';

const STEPS = [
  'Open Demo controls and start in Normal Mode so the ECG sits near 72 BPM and 98% SpO2.',
  'On Setup & Pairing, simulate the strap QR (NASA-STRAP-EVA-409), bind a crew role, then run the Bluetooth handshake.',
  'Ask the AI Flight Surgeon about dizziness. The live numbers on the telemetry pill travel with the question.',
  'Switch the demo panel to Emergency Danger Mode. SpO2 falls to 84% and radiation jumps to 2.45 mSv/hr, which trips the Klaxon and the mesh SOS.',
  'Acknowledge the alert to silence the alarm. A second browser on the same hotspot, with the port 8080 relay running, receives the same overlay.'
];

export const VirtualLabTab: React.FC = () => {
  const { vitals, ruleResult, nodeId, aiModelTier } = useTelemetry();

  const hazards = [
    {
      name: 'Space radiation',
      detail: `${vitals.radiationDoseRate.toFixed(2)} mSv/hr against the MR092L 1.00 mSv/hr ceiling. Cumulative ${vitals.cumulativeRadiation.toFixed(2)} mSv.`
    },
    {
      name: 'Isolation',
      detail: `Flight surgeon tier is ${aiModelTier}. Symptom cards stay available when the language model cannot run.`
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

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-space-700/60 bg-space-900 p-4 sm:p-5">
        <h2 className="font-mono text-sm font-semibold text-slate-100">Virtual lab · five hazards of human spaceflight</h2>
        <p className="mt-2 text-sm text-slate-300">
          Current rules status: {ruleResult.hazardTitle}. {ruleResult.nasaRef}.
        </p>
        <div className="mt-4 grid gap-2">
          {hazards.map((hazard, index) => (
            <article key={hazard.name} className="rounded-xl border border-space-800 bg-space-950 px-3 py-3">
              <p className="font-mono text-xs text-nasa-cyan">
                {index + 1}. {hazard.name}
              </p>
              <p className="mt-1 text-sm text-slate-200">{hazard.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-space-700/60 bg-space-900 p-4 sm:p-5">
        <h2 className="font-mono text-sm font-semibold text-slate-100">Judge walkthrough</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-200">
          {STEPS.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
    </div>
  );
};
