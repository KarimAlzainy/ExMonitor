import React, { useEffect, useRef, useState } from 'react';
import { Activity, Flame, HeartPulse, Loader2, Radiation, Send, Wind } from 'lucide-react';
import { ChatMessage } from '../../types/telemetry';
import { NASA_SYMPTOM_PROTOCOLS, SymptomRuleCard } from '../../services/nasaRules';
import { checkOllamaAvailability, streamMedicalTriage } from '../../services/ollamaClient';
import { useTelemetry } from '../../context/TelemetryContext';

type ActionCard = ReturnType<SymptomRuleCard['evaluate']> & { name: string; description?: string };

type UiMessage = ChatMessage & { actionCard?: ActionCard };

const QUICK_SYMPTOMS: { id: string; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'chest_pain', label: 'Chest Pain', icon: HeartPulse },
  { id: 'dizziness_hypoxia', label: 'Dizziness / Hypoxia', icon: Wind },
  { id: 'fatigue_heat', label: 'Exhaustion / Overheating', icon: Flame },
  { id: 'radiation_alert', label: 'Radiation Flare', icon: Radiation },
  { id: 'arrhythmia', label: 'Arrhythmia', icon: Activity }
];

// Rules mode still has to understand free text. These tags let a typed
// symptom resolve to the matching pre-approved NASA action card.
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

function RichLine({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={index} className="font-semibold text-slate-50">
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
    <div className="space-y-1 text-sm leading-relaxed text-slate-200">
      {text.split('\n').map((line, index) => {
        if (!line.trim()) return <div key={index} className="h-2" />;
        if (line.startsWith('### ')) {
          return (
            <h4 key={index} className="pt-1 font-mono text-sm font-semibold text-nasa-cyan">
              {line.replace(/^###\s*/, '').replace(/[#*]/g, '')}
            </h4>
          );
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <p key={index} className="pl-1">
              • <RichLine text={line.slice(2)} />
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
  const { vitals, astronaut, aiModelTier } = useTelemetry();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [ollamaLive, setOllamaLive] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([
    {
      id: 'welcome',
      sender: 'system',
      text: 'Onboard flight surgeon is standing by. Every question is sent with the live telemetry snapshot shown above. Earth is up to 22 minutes away.',
      timestamp: Date.now()
    }
  ]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const rulesMode = aiModelTier === 'hardcoded_rules';

  useEffect(() => {
    let cancelled = false;
    checkOllamaAvailability().then((result) => {
      if (!cancelled) setOllamaLive(result.available);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const pushUser = (text: string) => {
    const message: UiMessage = {
      id: `user-${Date.now()}`,
      sender: 'astronaut',
      text,
      timestamp: Date.now(),
      vitalsSnapshot: { ...vitals }
    };
    setMessages((prev) => [...prev, message]);
  };

  const askSurgeon = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || busy) return;
    pushUser(trimmed);
    setDraft('');

    if (rulesMode) {
      const protocol = matchProtocol(trimmed);
      if (protocol) {
        const evaluation = protocol.evaluate(vitals);
        setMessages((prev) => [
          ...prev,
          {
            id: `card-${Date.now()}`,
            sender: 'system',
            text: evaluation.diagnosis,
            timestamp: Date.now(),
            protocolBadge: evaluation.nasaCode,
            vitalsSnapshot: { ...vitals },
            actionCard: { ...evaluation, name: protocol.name, description: protocol.description }
          }
        ]);
        return;
      }
    }

    const replyId = `ai-${Date.now()}`;
    setBusy(true);
    setMessages((prev) => [
      ...prev,
      {
        id: replyId,
        sender: 'ai',
        text: '',
        timestamp: Date.now(),
        isStreaming: true,
        vitalsSnapshot: { ...vitals },
        protocolBadge: rulesMode ? 'NASA RULES MODE' : 'FLIGHT SURGEON'
      }
    ]);

    try {
      await streamMedicalTriage(
        { userQuery: trimmed, vitals: { ...vitals }, astronaut, modelTier: aiModelTier },
        (token) => {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === replyId ? { ...message, text: message.text + token } : message
            )
          );
        }
      );
    } catch {
      setMessages((prev) =>
        prev.map((message) =>
          message.id === replyId
            ? { ...message, text: 'Flight surgeon link failed. Use a symptom card or switch to No-AI rules in Setup.' }
            : message
        )
      );
    } finally {
      setMessages((prev) =>
        prev.map((message) => (message.id === replyId ? { ...message, isStreaming: false } : message))
      );
      setBusy(false);
    }
  };

  const onQuickSymptom = (id: string) => {
    const protocol = NASA_SYMPTOM_PROTOCOLS.find((card) => card.id === id);
    if (!protocol) return;

    if (rulesMode) {
      const evaluation = protocol.evaluate(vitals);
      setMessages((prev) => [
        ...prev,
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

  return (
    <div className="flex min-h-[70vh] flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-mono text-sm font-semibold text-slate-100">Autonomous onboard flight surgeon</h2>
          <p className="text-xs text-slate-400">
            {rulesMode
              ? 'Low-end mode: NASA pre-approved action cards, no language model.'
              : ollamaLive
                ? 'Ollama is reachable. Phi-3 answers with the telemetry block injected.'
                : ollamaLive === false
                  ? 'Ollama is offline. Answers fall back to the on-device simulation.'
                  : 'Checking local Ollama…'}
          </p>
        </div>
        <div
          className="flex max-w-full items-center gap-2 rounded-full border border-space-700 bg-space-900 px-3 py-1.5 font-mono text-[11px] text-slate-300"
          title="This live telemetry snapshot is automatically attached to every question sent to the flight surgeon."
        >
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          <span className="text-[9px] uppercase tracking-wider text-emerald-300/80">Live snapshot</span>
          <span className="truncate">
            HR {vitals.heartRate} · SpO2 {vitals.spO2}% · {vitals.bodyTemp.toFixed(1)}°C · GSR{' '}
            {vitals.gsrStress.toFixed(1)} · Rad {vitals.radiationDoseRate.toFixed(2)} mSv/hr
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_SYMPTOMS.map((symptom) => {
          const Icon = symptom.icon;
          return (
            <button
              key={symptom.id}
              type="button"
              disabled={busy}
              onClick={() => onQuickSymptom(symptom.id)}
              className="flex items-center gap-1.5 rounded-full border border-space-700 bg-space-900 px-3 py-1.5 font-mono text-xs text-slate-200 hover:border-nasa-cyan/40 disabled:opacity-50"
            >
              <Icon className="h-3.5 w-3.5 text-nasa-cyan" />
              {symptom.label}
            </button>
          );
        })}
      </div>

      <div
        ref={scrollRef}
        className="scrollbar-thin flex-1 space-y-3 overflow-y-auto rounded-2xl border border-space-700/60 bg-space-900 p-4"
      >
        {messages.map((message) => (
          <article
            key={message.id}
            className={`max-w-[95%] rounded-2xl border px-3 py-2.5 ${
              message.sender === 'astronaut'
                ? 'ml-auto border-nasa-cyan/30 bg-nasa-blue/30'
                : message.sender === 'system'
                  ? 'border-amber-500/30 bg-space-950'
                  : 'border-space-700 bg-space-950'
            }`}
          >
            <div className="mb-1 flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-wide text-slate-400">
              <span>
                {message.sender === 'astronaut'
                  ? astronaut.name
                  : message.sender === 'ai'
                    ? 'Flight surgeon'
                    : message.actionCard
                      ? 'NASA action card'
                      : 'Flight console'}
              </span>
              {message.protocolBadge && <span className="text-nasa-cyan">{message.protocolBadge}</span>}
            </div>
            {message.actionCard ? (
              <div>
                <p className="font-mono text-sm font-semibold text-slate-100">{message.actionCard.name}</p>
                {message.actionCard.description && (
                  <p className="mt-1 text-xs text-slate-400">{message.actionCard.description}</p>
                )}
                <p
                  className={`mt-2 inline-block rounded-md border px-2 py-0.5 font-mono text-[10px] uppercase ${
                    message.actionCard.color === 'crimson'
                      ? 'border-red-500/40 text-red-300'
                      : 'border-amber-500/40 text-amber-200'
                  }`}
                >
                  {message.actionCard.status}
                </p>
                <p className="mt-2 text-sm text-slate-200">{message.actionCard.diagnosis}</p>
                <ol className="mt-2 list-decimal space-y-1 pl-4 text-sm text-slate-200">
                  {message.actionCard.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <p className="mt-2 font-mono text-[10px] text-slate-400">{message.actionCard.nasaCode}</p>
              </div>
            ) : (
              <RichText text={message.text || (message.isStreaming ? '…' : '')} />
            )}
            {message.sender === 'astronaut' && message.vitalsSnapshot && (
              <p className="mt-1.5 font-mono text-[10px] text-cyan-300/70">
                Attached snapshot → HR {message.vitalsSnapshot.heartRate} · SpO2 {message.vitalsSnapshot.spO2}% ·{' '}
                {message.vitalsSnapshot.bodyTemp.toFixed(1)}°C · GSR {message.vitalsSnapshot.gsrStress.toFixed(1)} · Rad{' '}
                {message.vitalsSnapshot.radiationDoseRate.toFixed(2)}
              </p>
            )}
            {message.isStreaming && <Loader2 className="mt-2 h-3.5 w-3.5 animate-spin text-nasa-cyan" />}
          </article>
        ))}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void askSurgeon(draft);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={rulesMode ? 'Describe a symptom, or use a NASA action card above' : 'Report a symptom to the flight surgeon'}
          className="flex-1 rounded-xl border border-space-700 bg-space-950 px-3 py-3 font-mono text-sm text-slate-100 outline-none focus:border-nasa-cyan/50"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="rounded-xl bg-nasa-cyan px-4 text-space-950 disabled:opacity-40"
          aria-label="Send symptom"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
};
