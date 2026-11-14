import React, { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Flame,
  HeartPulse,
  Loader2,
  LucideIcon,
  Radiation,
  Send,
  Wind
} from 'lucide-react';
import { ChatMessage } from '../../types/telemetry';
import { NASA_SYMPTOM_PROTOCOLS, SymptomRuleCard } from '../../services/nasaRules';
import { buildRulesAnswer, modelName, streamRulesAnswer } from '../../services/aiModels';
import { askFlightSurgeon, isModelReady, prepareModel } from '../../services/flightSurgeon';
import { useTelemetry } from '../../context/TelemetryContext';
import { InfoTip } from '../ui/InfoTip';

type ActionCard = ReturnType<SymptomRuleCard['evaluate']> & { name: string; description?: string };

type UiMessage = ChatMessage & { actionCard?: ActionCard };

const QUICK_SYMPTOMS: { id: string; label: string; icon: LucideIcon }[] = [
  { id: 'chest_pain', label: 'Chest pain', icon: HeartPulse },
  { id: 'dizziness_hypoxia', label: 'Dizziness', icon: Wind },
  { id: 'fatigue_heat', label: 'Heat and fatigue', icon: Flame },
  { id: 'radiation_alert', label: 'Radiation', icon: Radiation },
  { id: 'arrhythmia', label: 'Irregular pulse', icon: Activity }
];

// The rules mode still has to understand free text. These tags let a typed
// symptom resolve to the matching written NASA action card.
const SYMPTOM_KEYWORDS: Record<string, string[]> = {
  chest_pain: ['chest', 'heart', 'cardiac', 'pressure', 'pain'],
  dizziness_hypoxia: ['dizzy', 'dizziness', 'hypoxia', 'oxygen', 'breath', 'faint', 'lightheaded', 'vision'],
  fatigue_heat: ['exhaust', 'fatigue', 'heat', 'hot', 'sweat', 'overheat', 'weak', 'tired'],
  radiation_alert: ['radiation', 'flare', 'sop', 'spe', 'dosimeter', 'phosphene', 'nausea', 'sun'],
  arrhythmia: ['arrhythmia', 'palpitation', 'skip', 'flutter', 'irregular', 'racing', 'pulse']
};

function matchProtocol(query: string): SymptomRuleCard | undefined {
  const normalized = query.toLowerCase();
  const scores = NASA_SYMPTOM_PROTOCOLS.map((card) => ({
    card,
    score: (SYMPTOM_KEYWORDS[card.id] ?? []).filter((keyword) => normalized.includes(keyword)).length
  })).filter((entry) => entry.score > 0);
  scores.sort((a, b) => b.score - a.score);
  return scores[0]?.card;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
}

function formatStatus(status: string): string {
  const lower = status.toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function RichLine({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={index} className="font-medium text-ink-100">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={index}>{part}</span>
        )
      )}
    </>
  );
}

function RichText({ text }: { text: string }) {
  return (
    <div className="space-y-1.5 text-[13px] leading-5 text-ink-300">
      {text.split('\n').map((line, index) => {
        if (!line.trim()) return <div key={index} className="h-2" />;
        if (line.startsWith('### ')) {
          return (
            <h4 key={index} className="pt-2 text-[13px] font-medium text-ink-100 first:pt-0">
              {line.replace(/^###\s*/, '').replace(/[#*]/g, '')}
            </h4>
          );
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <p key={index} className="flex gap-2">
              <span className="select-none text-ink-500">–</span>
              <span>
                <RichLine text={line.slice(2)} />
              </span>
            </p>
          );
        }
        return (
          <p key={index}>
            <RichLine text={line} />
          </p>
        );
      })}
    </div>
  );
}

export const AiCopilotTab: React.FC = () => {
  const { vitals, profile, aiModelTier } = useTelemetry();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepareProgress, setPrepareProgress] = useState(0);
  const [prepareText, setPrepareText] = useState('');
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(() => isModelReady(aiModelTier));
  const [messages, setMessages] = useState<UiMessage[]>([
    {
      id: 'welcome',
      sender: 'system',
      text: 'The on-board assistant is standing by. Every question carries the current readings. Earth is up to 22 minutes away, so the answer is prepared on this device.',
      timestamp: Date.now()
    }
  ]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const rulesMode = aiModelTier === 'none';
  const tierName = modelName(aiModelTier);

  useEffect(() => {
    setModelReady(isModelReady(aiModelTier));
    setPrepareError(null);
    setPrepareText('');
    setPrepareProgress(0);
  }, [aiModelTier]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const subtitle = rulesMode
    ? 'Written NASA action cards and the rules engine. No language model is used.'
    : preparing
      ? `Downloading and preparing ${tierName}. This happens once.`
      : modelReady
        ? `${tierName} is loaded on this device and answers with the live readings attached.`
        : `${tierName} is selected. The first question downloads it once, then it works offline.`;

  const modelState = rulesMode
    ? { dot: 'bg-ink-400', label: 'Rules only' }
    : preparing
      ? { dot: 'bg-caution', label: 'Preparing model' }
      : modelReady
        ? { dot: 'bg-positive', label: 'Model on device' }
        : { dot: 'bg-ink-500', label: 'Not loaded' };

  const pushUser = (text: string) => {
    const message: UiMessage = {
      id: `user-${Date.now()}`,
      sender: 'astronaut',
      text,
      timestamp: Date.now(),
      vitalsSnapshot: { ...vitals }
    };
    setMessages((previous) => [...previous, message]);
  };

  const ensureModel = async (): Promise<boolean> => {
    if (isModelReady(aiModelTier)) {
      setModelReady(true);
      return true;
    }
    setPreparing(true);
    setPrepareError(null);
    setPrepareProgress(0);
    setPrepareText('Starting');
    try {
      await prepareModel(aiModelTier, (progress) => {
        setPrepareProgress(progress.progress);
        setPrepareText(progress.text);
      });
      setModelReady(true);
      setPrepareProgress(1);
      setPrepareText('Ready');
      return true;
    } catch (error) {
      console.warn('The on-device model could not start.', error);
      setPrepareError(
        'The model could not start on this device. The written NASA rules are being used instead.'
      );
      setModelReady(false);
      return false;
    } finally {
      setPreparing(false);
    }
  };

  const streamRules = async (replyId: string, query: string, protocol?: SymptomRuleCard) => {
    const evaluation = protocol?.evaluate(vitals);
    const text = buildRulesAnswer(
      { userQuery: query, vitals: { ...vitals } },
      evaluation && protocol
        ? {
            name: protocol.name,
            diagnosis: evaluation.diagnosis,
            steps: evaluation.steps,
            nasaCode: evaluation.nasaCode
          }
        : undefined
    );
    await streamRulesAnswer(text, (token) => {
      setMessages((previous) =>
        previous.map((message) =>
          message.id === replyId ? { ...message, text: message.text + token } : message
        )
      );
    });
  };

  const askSurgeon = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || busy || preparing) return;

    pushUser(trimmed);
    setDraft('');
    setBusy(true);

    const replyId = `reply-${Date.now()}`;
    setMessages((previous) => [
      ...previous,
      {
        id: replyId,
        sender: rulesMode ? 'system' : 'ai',
        text: '',
        timestamp: Date.now(),
        isStreaming: true,
        vitalsSnapshot: { ...vitals, },
        protocolBadge: rulesMode ? 'NASA rules' : 'Flight surgeon'
      }
    ]);

    try {
      if (rulesMode) {
        await streamRules(replyId, trimmed, matchProtocol(trimmed));
        return;
      }

      const ready = await ensureModel();
      if (!ready) {
        await streamRules(replyId, trimmed, matchProtocol(trimmed));
        return;
      }

      await askFlightSurgeon(
        { userQuery: trimmed, vitals: { ...vitals }, profile },
        (token) => {
          setMessages((previous) =>
            previous.map((message) =>
              message.id === replyId ? { ...message, text: message.text + token } : message
            )
          );
        }
      );
    } catch (error) {
      console.warn('The flight surgeon reply failed.', error);
      setMessages((previous) =>
        previous.map((message) =>
          message.id === replyId && !message.text
            ? {
                ...message,
                text: 'The assistant could not answer. Open one of the symptom cards above for the written NASA steps, or switch to No AI in Settings.'
              }
            : message
        )
      );
    } finally {
      setMessages((previous) =>
        previous.map((message) => (message.id === replyId ? { ...message, isStreaming: false } : message))
      );
      setBusy(false);
    }
  };

  const onQuickSymptom = (id: string) => {
    const protocol = NASA_SYMPTOM_PROTOCOLS.find((card) => card.id === id);
    if (!protocol) return;

    if (rulesMode) {
      const evaluation = protocol.evaluate(vitals);
      setMessages((previous) => [
        ...previous,
        {
          id: `user-${Date.now()}`,
          sender: 'astronaut',
          text: protocol.name,
          timestamp: Date.now(),
          vitalsSnapshot: { ...vitals }
        },
        {
          id: `card-${Date.now()}`,
          sender: 'system',
          text: protocol.description,
          timestamp: Date.now(),
          protocolBadge: evaluation.nasaCode,
          vitalsSnapshot: { ...vitals },
          actionCard: { ...evaluation, name: protocol.name, description: protocol.description }
        }
      ]);
      return;
    }

    void askSurgeon(`${protocol.name}. ${protocol.description}`);
  };

  const roleLabel = (message: UiMessage) =>
    message.sender === 'astronaut'
      ? profile.name || 'Crew member'
      : message.sender === 'ai'
        ? 'Flight surgeon'
        : message.actionCard
          ? 'NASA action card'
          : 'Flight console';

  return (
    <div className="flex min-h-[70vh] flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-medium text-ink-100">
            Flight surgeon
            <InfoTip
              text="The assistant runs entirely in this browser. With AI selected, the model downloads once on first use and is then cached for offline use. The written NASA rules always work without it."
              label="Flight surgeon"
            />
          </h2>
          <p className="mt-1 max-w-xl text-[12px] leading-5 text-ink-400">{subtitle}</p>
        </div>
        <p className="flex items-center gap-1.5 text-[11px] text-ink-400">
          <span className={`h-1.5 w-1.5 rounded-full ${modelState.dot}`} />
          {modelState.label}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-white/[0.06] bg-space-900 px-3 py-2 text-[11px] text-ink-400">
        <span className="flex items-center gap-1.5 text-ink-300">
          <span className="h-1.5 w-1.5 rounded-full bg-positive" />
          Live readings
        </span>
        <span className="font-mono tabular-nums">HR {vitals.heartRate} BPM</span>
        <span className="font-mono tabular-nums">SpO2 {vitals.spO2}%</span>
        <span className="font-mono tabular-nums">{vitals.bodyTemp.toFixed(1)}°C</span>
        <span className="font-mono tabular-nums">GSR {vitals.gsrStress.toFixed(1)} µS</span>
        <span className="font-mono tabular-nums">Rad {vitals.radiationDoseRate.toFixed(2)} mSv/hr</span>
        <span className="text-ink-500">{vitals.source === 'sensor' ? 'From the sensor' : 'Practice readings'}</span>
      </div>

      {preparing && (
        <div className="rounded-lg border border-caution/25 bg-caution/[0.04] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-medium text-caution">Downloading {tierName} for the first time</p>
            <p className="font-mono text-[10.5px] text-ink-500">{Math.round(prepareProgress * 100)}%</p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-space-800">
            <div
              className="h-full rounded-full bg-caution transition-[width] duration-300"
              style={{ width: `${Math.max(3, Math.round(prepareProgress * 100))}%` }}
            />
          </div>
          <p className="mt-1.5 truncate text-[10.5px] text-ink-500">{prepareText}</p>
        </div>
      )}

      {prepareError && !preparing && (
        <p className="rounded-lg border border-caution/25 bg-caution/[0.04] px-4 py-2.5 text-[11px] leading-5 text-caution">
          {prepareError}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {QUICK_SYMPTOMS.map((symptom) => {
          const Icon = symptom.icon;
          return (
            <button
              key={symptom.id}
              type="button"
              disabled={busy || preparing}
              onClick={() => onQuickSymptom(symptom.id)}
              className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-space-900 px-3 text-[12px] text-ink-300 transition-colors hover:border-white/15 hover:bg-space-850 hover:text-ink-100 disabled:opacity-40"
            >
              <Icon className="h-4 w-4 text-ink-500" strokeWidth={1.5} />
              {symptom.label}
            </button>
          );
        })}
      </div>

      <div
        ref={scrollRef}
        className="scrollbar-thin flex-1 overflow-y-auto rounded-xl border border-white/[0.08] bg-space-900"
      >
        {messages.map((message) => {
          const crimson = message.actionCard?.color === 'crimson';
          return (
            <article
              key={message.id}
              className={`border-b border-white/[0.06] px-4 py-4 last:border-b-0 ${
                message.sender === 'astronaut' ? 'bg-white/[0.015]' : ''
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[11px] font-medium text-ink-300">{roleLabel(message)}</span>
                <span className="text-[10.5px] tabular-nums text-ink-500">{formatTime(message.timestamp)}</span>
                {message.protocolBadge && (
                  <span className="ml-auto font-mono text-[10px] text-ink-500">{message.protocolBadge}</span>
                )}
              </div>

              <div className="mt-2">
                {message.actionCard ? (
                  <div>
                    <p className="text-[13px] font-medium text-ink-100">{message.actionCard.name}</p>
                    {message.actionCard.description && (
                      <p className="mt-0.5 text-[12px] leading-5 text-ink-500">{message.actionCard.description}</p>
                    )}
                    <div
                      className={`mt-3 border-l-2 pl-3 ${
                        crimson ? 'border-critical/50' : 'border-caution/50'
                      }`}
                    >
                      <p className={`text-[10.5px] ${crimson ? 'text-critical' : 'text-caution'}`}>
                        {formatStatus(message.actionCard.status)}
                      </p>
                      <p className="mt-1 text-[13px] leading-5 text-ink-200">{message.actionCard.diagnosis}</p>
                      <ol className="mt-2 space-y-1 text-[13px] leading-5 text-ink-300">
                        {message.actionCard.steps.map((step) => (
                          <li key={step} className="flex gap-2">
                            <span className="select-none text-ink-500">–</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                    <p className="mt-2 font-mono text-[10px] text-ink-500">{message.actionCard.nasaCode}</p>
                  </div>
                ) : message.sender === 'astronaut' ? (
                  <p className="whitespace-pre-wrap text-[13px] leading-5 text-ink-100">{message.text}</p>
                ) : (
                  <RichText text={message.text || (message.isStreaming ? '…' : '')} />
                )}
              </div>

              {message.sender === 'astronaut' && message.vitalsSnapshot && (
                <p className="mt-2 font-mono text-[10px] text-ink-500">
                  Snapshot HR {message.vitalsSnapshot.heartRate} · SpO2 {message.vitalsSnapshot.spO2}% ·{' '}
                  {message.vitalsSnapshot.bodyTemp.toFixed(1)}°C · GSR {message.vitalsSnapshot.gsrStress.toFixed(1)} ·
                  Rad {message.vitalsSnapshot.radiationDoseRate.toFixed(2)}
                </p>
              )}
              {message.isStreaming && <Loader2 className="mt-2 h-3.5 w-3.5 animate-spin text-ink-500" />}
            </article>
          );
        })}
      </div>

      <form
        className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-space-900 p-2 pl-3"
        onSubmit={(event) => {
          event.preventDefault();
          void askSurgeon(draft);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={
            rulesMode
              ? 'Describe a symptom, or use a card above'
              : `Ask ${tierName}, or use a card above`
          }
          aria-label="Symptom report"
          className="h-9 min-w-0 flex-1 bg-transparent text-[13px] text-ink-100 outline-none placeholder:text-ink-500"
        />
        <button
          type="submit"
          disabled={busy || preparing || !draft.trim()}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-space-950 transition-colors hover:bg-white disabled:opacity-40"
          aria-label="Send to the flight surgeon"
        >
          <Send className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </form>

      <p className="text-[10.5px] leading-5 text-ink-500">
        Training simulation only. It does not replace a real flight surgeon or mission medical rules.
      </p>
    </div>
  );
};
