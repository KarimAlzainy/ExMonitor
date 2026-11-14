import React from 'react';
import { BookOpen, Cpu, LucideIcon, Radio, Smartphone } from 'lucide-react';
import { useTelemetry } from '../../context/TelemetryContext';
import { modelName } from '../../services/aiModels';
import { InfoTip } from '../ui/InfoTip';

const STEPS = [
  'Open the sensor page on a phone or a second screen. The console shows its code; scan it in Settings, or type the code by hand. You can skip this and use practice readings.',
  'On the sensor page, choose a situation: rest, exercise, low oxygen, radiation storm or recovery. The page sends realistic heart, oxygen, temperature, stress and radiation readings.',
  'In Live readings, watch the heart trace and the five vital cards change. The rules engine marks readings as normal, watch or critical.',
  'Ask the flight surgeon about a symptom. The current readings travel with the question. With AI selected, the model downloads once and then answers on this device.',
  'Press Send alert. Other consoles show a full-screen emergency until each one acknowledges it. The sender only sees a small panel with a cancel button.',
  'Cancel from the sender panel to clear the alert on every screen. Otherwise it stays until each crew member acknowledges it.'
];

export const GuideTab: React.FC = () => {
  const { vitals, ruleResult, nodeId, aiModelTier, crewLinkMode, peerCount, sensorStatus } = useTelemetry();

  const hazards = [
    {
      name: 'Space radiation',
      detail: `Dose rate is ${vitals.radiationDoseRate.toFixed(2)} mSv per hour. Caution starts at 0.30 and critical at 1.00. Total mission dose is ${vitals.cumulativeRadiation.toFixed(2)} mSv.`
    },
    {
      name: 'Isolation',
      detail:
        aiModelTier === 'none'
          ? 'The on-board assistant is off, so the written NASA action cards do all the work. They stay available on every copy.'
          : `The on-board assistant is ${modelName(aiModelTier)} and runs on this device. The written NASA action cards stay available even when no model is loaded.`
    },
    {
      name: 'Distance from Earth',
      detail: `This console is ${nodeId}. Alerts and readings travel over the local crew link instead of waiting for a message to reach Earth.`
    },
    {
      name: 'Gravity fields',
      detail: `The heart trace is following ${vitals.heartRate} beats per minute. The shape and spacing of the beats help the crew spot strain or an irregular rhythm.`
    },
    {
      name: 'A closed environment',
      detail: `Body temperature is ${vitals.bodyTemp.toFixed(1)}°C and blood oxygen is ${vitals.spO2}%. Suit cooling and oxygen checks are the first answers to a change.`
    }
  ];

  const statusTone =
    ruleResult.statusColor === 'red'
      ? { dot: 'bg-critical', text: 'text-critical' }
      : ruleResult.statusColor === 'yellow'
        ? { dot: 'bg-caution', text: 'text-caution' }
        : { dot: 'bg-positive', text: 'text-ink-200' };

  const linkText =
    crewLinkMode === 'relay'
      ? `Relay connected · ${peerCount} other ${peerCount === 1 ? 'console' : 'consoles'}`
      : crewLinkMode === 'local'
        ? 'This browser only'
        : 'Crew link offline';

  const sensorText =
    sensorStatus === 'connected'
      ? 'Sensor sending'
      : sensorStatus === 'waiting'
        ? 'Sensor waiting'
        : sensorStatus === 'stale'
          ? 'Sensor silent'
          : 'Practice readings';

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-white/[0.08] bg-space-900 p-5">
        <h1 className="flex items-center gap-2 text-[15px] font-medium text-ink-100">
          <BookOpen className="h-4 w-4 text-ink-400" strokeWidth={1.5} />
          How it works
        </h1>
        <p className="mt-1 max-w-2xl text-[12px] leading-5 text-ink-400">
          A short guide to the console, the sensor page and the crew link.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-y border-white/[0.06] py-3 text-[11px] text-ink-400">
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${statusTone.dot}`} />
            <span className={statusTone.text}>{ruleResult.hazardTitle}</span>
            <span className="font-mono text-[10px] text-ink-500">{ruleResult.nasaRef}</span>
          </span>
          <span>{sensorText}</span>
          <span>{linkText}</span>
        </div>

        <ul className="mt-2 divide-y divide-white/[0.06]">
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
        <h2 className="flex items-center gap-2 text-[15px] font-medium text-ink-100">
          A walkthrough
          <InfoTip
            text="The sensor page is a separate page in the same download. It does not need special hardware; it creates realistic readings so the console can be shown anywhere."
            label="Walkthrough"
          />
        </h2>
        <p className="mt-1 text-[12px] text-ink-400">From an empty screen to a crew alert in six steps.</p>
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

      <section className="rounded-xl border border-white/[0.08] bg-space-900 p-5">
        <h2 className="text-[15px] font-medium text-ink-100">What runs where</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Piece
            icon={Cpu}
            title="Console"
            text="Shows the readings, runs the rules and the on-device assistant, and sends or receives alerts."
          />
          <Piece
            icon={Smartphone}
            title="Sensor page"
            text="Creates heart, oxygen, temperature, stress and radiation readings and sends eight frames a second."
          />
          <Piece
            icon={Radio}
            title="Crew link"
            text="Passes alerts and sensor frames between devices on the same network. Start the relay or the packaged launcher."
          />
        </div>
        <p className="mt-4 text-[11px] leading-5 text-ink-500">
          No account is needed. Your name, label and settings stay in this browser. Sensor codes are just names,
          not passwords, so keep the console on a network you trust.
        </p>
      </section>
    </div>
  );
};

function Piece({
  icon: Icon,
  title,
  text
}: {
  icon: LucideIcon;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-space-950 p-3">
      <p className="flex items-center gap-2 text-[12px] font-medium text-ink-200">
        <Icon className="h-4 w-4 text-ink-400" strokeWidth={1.5} />
        {title}
      </p>
      <p className="mt-1.5 text-[11px] leading-5 text-ink-500">{text}</p>
    </div>
  );
}
