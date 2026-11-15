import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Bot,
  Cpu,
  Flame,
  HeartPulse,
  Loader2,
  LucideIcon,
  Radiation,
  RefreshCw,
  Send,
  Server,
  Wind,
  X
} from 'lucide-react';
import { ChatMessage } from '../../types/telemetry';
import { NASA_SYMPTOM_PROTOCOLS, SymptomRuleCard } from '../../services/nasaRules';
import {
  AiProvider,
  ChatMode,
  buildChatMessages,
  buildRulesAnswer,
  modelName,
  readChatMode,
  readProvider,
  recommendationReason,
  storeChatMode,
  storeProvider,
  streamRulesAnswer
} from '../../services/aiModels';
import {
  askFlightSurgeon,
  cancelModelLoad,
  isModelLoadCancelled,
  isModelReady,
  prepareModel
} from '../../services/flightSurgeon';
import {
  OllamaConfig,
  askOllama,
  listOllamaModels,
  readOllamaConfig,
  storeOllamaConfig
} from '../../services/ollama';
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
    <div className="space-y-1.5 text-[14px] leading-5 text-ink-200">
      {text.split('\n').map((line, index) => {
        if (!line.trim()) return <div key={index} className="h-1.5" />;
        if (line.startsWith('### ')) {
          return (
            <h4 key={index} className="pt-1.5 text-[13.5px] font-medium text-ink-100 first:pt-0">
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

const Segmented: React.FC<{
  value: string;
  options: { id: string; label: string; icon?: LucideIcon }[];
  onChange: (id: string) => void;
  label: string;
}> = ({ value, options, onChange, label }) => (
  <div
    role="group"
    aria-label={label}
    className="flex items-center gap-0.5 rounded-lg border border-white/[0.08] bg-space-950 p-0.5"
  >
    {options.map((option) => {
      const Icon = option.icon;
      const selected = option.id === value;
      return (
        <button
          key={option.id}
          type="button"
          aria-pressed={selected}
          onClick={() => onChange(option.id)}
          className={`flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium transition-colors ${
            selected ? 'bg-chalk text-space-950' : 'text-ink-400 hover:text-ink-100'
          }`}
        >
          {Icon && <Icon className="h-3.5 w-3.5" strokeWidth={1.7} />}
          {option.label}
        </button>
      );
    })}
  </div>
);

export const AiCopilotTab: React.FC = () => {
  const { vitals, profile, aiModelTier, setAiModelTier, diagnostic, runHardwareDiagnostic } = useTelemetry();

  const [provider, setProvider] = useState<AiProvider>(() => readProvider());
  const [chatMode, setChatMode] = useState<ChatMode>(() => readChatMode());
  const [ollama, setOllama] = useState<OllamaConfig>(() => readOllamaConfig());
  const [ollamaStatus, setOllamaStatus] = useState<'idle' | 'checking' | 'ok' | 'error'>('idle');
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaMessage, setOllamaMessage] = useState('');
  const [showServer, setShowServer] = useState(false);

  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [prepareProgress, setPrepareProgress] = useState(0);
  const [prepareText, setPrepareText] = useState('');
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const [prepareNotice, setPrepareNotice] = useState('');
  const [suggestionDismissed, setSuggestionDismissed] = useState(false);
  const [modelReady, setModelReady] = useState(() => isModelReady(aiModelTier));
  const [messages, setMessages] = useState<UiMessage[]>([
    {
      id: 'welcome',
      sender: 'system',
      text:
        'The AI assistant is standing by. Doctor mode attaches the prompt and the live readings to each question. ' +
        'Assistant mode is plain chat. Ask about a symptom, or just talk.',
      timestamp: Date.now()
    }
  ]);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const rulesMode = provider === 'ondevice' && aiModelTier === 'none';
  const doctorMode = chatMode === 'doctor';
  const tierName = modelName(aiModelTier);

  useEffect(() => {
    storeProvider(provider);
  }, [provider]);

  useEffect(() => {
    storeChatMode(chatMode);
  }, [chatMode]);

  useEffect(() => {
    storeOllamaConfig(ollama);
  }, [ollama]);

  useEffect(() => {
    setModelReady(isModelReady(aiModelTier));
    setPrepareError(null);
    setPrepareText('');
    setPrepareProgress(0);
    setPrepareNotice('');
  }, [aiModelTier]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    element.scrollTop = element.scrollHeight;
  }, [messages]);

  const checkOllama = useCallback(async () => {
    setOllamaStatus('checking');
    setOllamaMessage('');
    try {
      const models = await listOllamaModels(ollama.url);
      setOllamaModels(models);
      setOllamaStatus('ok');
      setOllamaMessage(
        models.length
          ? `Connected. ${models.length} model(s) available.`
          : 'Connected, but no model is installed yet. Run: ollama pull phi3'
      );
    } catch (error) {
      setOllamaModels([]);
      setOllamaStatus('error');
      setOllamaMessage(error instanceof Error ? error.message : 'The Ollama check failed.');
    }
  }, [ollama.url]);

  useEffect(() => {
    if (provider === 'ollama') void checkOllama();
  }, [provider, checkOllama]);

  const modelState =
    provider === 'ollama'
      ? ollamaStatus === 'checking'
        ? { dot: 'bg-caution', label: 'Checking the Ollama server' }
        : ollamaStatus === 'ok'
          ? { dot: 'bg-positive', label: `Ollama · ${ollama.model}` }
          : ollamaStatus === 'error'
            ? { dot: 'bg-critical', label: 'Ollama server unreachable' }
            : { dot: 'bg-ink-500', label: 'Ollama not checked' }
      : rulesMode
        ? { dot: 'bg-ink-400', label: 'Rules only' }
        : preparing
          ? { dot: 'bg-caution', label: 'Preparing model' }
          : modelReady
            ? { dot: 'bg-positive', label: `On-device · ${tierName}` }
            : { dot: 'bg-ink-500', label: `On-device · ${tierName} not loaded` };

  const pushUser = (text: string) => {
    const message: UiMessage = {
      id: `user-${Date.now()}`,
      sender: 'astronaut',
      text,
      timestamp: Date.now(),
      ...(doctorMode ? { vitalsSnapshot: { ...vitals } } : {})
    };
    setMessages((previous) => [...previous, message]);
  };

  const appendToken = (id: string, token: string) => {
    setMessages((previous) =>
      previous.map((message) => (message.id === id ? { ...message, text: message.text + token } : message))
    );
  };

  const setReplyText = (id: string, text: string) => {
    setMessages((previous) => previous.map((message) => (message.id === id ? { ...message, text } : message)));
  };

  const ensureModel = async (): Promise<boolean> => {
    if (isModelReady(aiModelTier)) {
      setModelReady(true);
      return true;
    }
    setPreparing(true);
    setPrepareError(null);
    setPrepareNotice('');
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
      if (isModelLoadCancelled(error)) {
        setPrepareError(null);
        setPrepareNotice('Download cancelled. The written NASA rules are available.');
        setModelReady(false);
        return false;
      }
      console.warn('The on-device model could not start.', error);
      setPrepareError('The model could not start on this device.');
      setModelReady(false);
      return false;
    } finally {
      setPreparing(false);
    }
  };

  const cancelPreparation = () => {
    cancelModelLoad();
    setPreparing(false);
    setPrepareError(null);
    setPrepareText('');
    setPrepareNotice('Download cancelled. The written NASA rules are available.');
  };

  const downloadNow = async () => {
    if (rulesMode || preparing) return;
    const ready = await ensureModel();
    if (ready) setPrepareNotice('Model ready on this device.');
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
    await streamRulesAnswer(text, (token) => appendToken(replyId, token));
  };

  const ask = async (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || busy || preparing) return;

    pushUser(trimmed);
    setDraft('');
    setBusy(true);

    const replyId = `reply-${Date.now()}`;
    const usingRules = provider === 'ondevice' && rulesMode;
    setMessages((previous) => [
      ...previous,
      {
        id: replyId,
        sender: usingRules ? 'system' : 'ai',
        text: '',
        timestamp: Date.now(),
        isStreaming: true,
        protocolBadge: usingRules ? 'NASA rules' : doctorMode ? 'Doctor mode' : 'Assistant'
      }
    ]);

    const fallbackToRules = async () => {
      await streamRules(replyId, trimmed, doctorMode ? matchProtocol(trimmed) : undefined);
    };

    try {
      if (usingRules) {
        if (doctorMode) {
          await fallbackToRules();
        } else {
          setReplyText(
            replyId,
            'Assistant mode needs a model. Choose one in Settings, or switch to Doctor mode for the written NASA rules.'
          );
        }
        return;
      }

      if (provider === 'ollama') {
        try {
          await askOllama(
            ollama,
            buildChatMessages({ userQuery: trimmed, vitals: { ...vitals }, profile }, chatMode),
            (token) => appendToken(replyId, token)
          );
        } catch (error) {
          if (doctorMode) {
            await fallbackToRules();
          } else {
            throw error;
          }
        }
        return;
      }

      const ready = await ensureModel();
      if (!ready) {
        if (doctorMode) {
          await fallbackToRules();
        } else {
          setReplyText(
            replyId,
            'The model could not start. Choose No AI and Doctor mode for the written rules, or point the assistant at a local Ollama server.'
          );
        }
        return;
      }

      await askFlightSurgeon(
        { userQuery: trimmed, vitals: { ...vitals }, profile },
        (token) => appendToken(replyId, token),
        chatMode
      );
    } catch (error) {
      console.warn('The assistant reply failed.', error);
      const message =
        error instanceof Error && error.message
          ? error.message
          : 'The assistant could not answer. Open a symptom card above for the written NASA steps.';
      setMessages((previous) =>
        previous.map((entry) => (entry.id === replyId && !entry.text ? { ...entry, text: message } : entry))
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

    const plainRules = provider === 'ondevice' && rulesMode;
    if (plainRules) {
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
          actionCard: { ...evaluation, name: protocol.name, description: protocol.description }
        }
      ]);
      return;
    }

    void ask(`${protocol.name}. ${protocol.description}`);
  };

  const roleLabel = (message: UiMessage) =>
    message.sender === 'astronaut'
      ? profile.name || 'Crew member'
      : message.sender === 'ai'
        ? 'AI assistant'
        : message.actionCard
          ? 'NASA action card'
          : 'Console';

  const suggested = diagnostic.recommendedModel;
  const checkingDevice = diagnostic.gpuTier === 'Checking this device';
  const showSuggestion =
    provider === 'ondevice' &&
    !suggestionDismissed &&
    !checkingDevice &&
    suggested !== 'none' &&
    (rulesMode || (!modelReady && !preparing && aiModelTier !== suggested));

  const modelMissingModel = provider === 'ondevice' && !checkingDevice && diagnostic.recommendedModel === 'none';

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h2 className="flex items-center gap-2 text-[17px] font-medium text-ink-100">
          AI assistant
          <InfoTip
            text="Two ways to answer. On-device downloads a model once into this browser and then runs offline. Ollama uses a model already installed on this computer. Doctor mode attaches the medical prompt and the live readings; Assistant mode is plain chat."
            label="AI assistant"
          />
        </h2>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="flex items-center gap-1.5 text-[12px] text-ink-400">
            <span className={`h-1.5 w-1.5 rounded-full ${modelState.dot}`} />
            {modelState.label}
          </span>
          <Segmented
            label="Chat mode"
            value={chatMode}
            onChange={(id) => setChatMode(id as ChatMode)}
            options={[
              { id: 'doctor', label: 'Doctor mode', icon: HeartPulse },
              { id: 'assistant', label: 'Assistant', icon: Bot }
            ]}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[11px] font-medium uppercase tracking-wide text-ink-500">Answers from</span>
        <Segmented
          label="Answer source"
          value={provider}
          onChange={(id) => setProvider(id as AiProvider)}
          options={[
            { id: 'ondevice', label: 'On-device', icon: Cpu },
            { id: 'ollama', label: 'Ollama', icon: Server }
          ]}
        />
        {provider === 'ondevice' && !rulesMode && !modelReady && !preparing && (
          <button
            type="button"
            onClick={() => void downloadNow()}
            className="ml-auto flex h-9 items-center rounded-lg bg-chalk px-3.5 text-[12.5px] font-medium text-space-950 transition-colors hover:brightness-105"
          >
            Download now
          </button>
        )}
        {provider === 'ollama' && (
          <button
            type="button"
            onClick={() => setShowServer((value) => !value)}
            className="ml-auto flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-space-950 px-3 text-[12px] font-medium text-ink-300 transition-colors hover:border-white/15 hover:text-ink-100"
          >
            <Server className="h-3.5 w-3.5" strokeWidth={1.6} />
            Server
          </button>
        )}
      </div>

      {provider === 'ollama' && ollamaStatus === 'error' && !showServer && (
        <p className="text-[11.5px] leading-5 text-caution">
          {ollamaMessage || 'The Ollama server could not be reached.'}
        </p>
      )}

      <div
        ref={scrollRef}
        className="scrollbar-thin min-h-0 flex-1 space-y-3 overflow-y-auto glass rounded-2xl p-3 sm:p-4"
      >
        {provider === 'ollama' && showServer && (
          <div className="rounded-lg border border-white/[0.08] bg-space-950 p-3">
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <label className="block">
                <span className="text-[11px] font-medium text-ink-300">Ollama server</span>
                <input
                  value={ollama.url}
                  onChange={(event) => setOllama((current) => ({ ...current, url: event.target.value }))}
                  placeholder="http://localhost:11434"
                  className="mt-1 h-9 w-full rounded-lg border border-white/[0.08] bg-space-950 px-2.5 font-mono text-[12px] text-ink-100 outline-none placeholder:text-ink-500 focus:border-signal/50"
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-ink-300">Model</span>
                <input
                  value={ollama.model}
                  list="ollama-models"
                  onChange={(event) => setOllama((current) => ({ ...current, model: event.target.value }))}
                  placeholder="phi3"
                  className="mt-1 h-9 w-full rounded-lg border border-white/[0.08] bg-space-950 px-2.5 font-mono text-[12px] text-ink-100 outline-none placeholder:text-ink-500 focus:border-signal/50"
                />
                <datalist id="ollama-models">
                  {ollamaModels.map((name) => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </label>
              <button
                type="button"
                onClick={() => void checkOllama()}
                disabled={ollamaStatus === 'checking'}
                className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/[0.08] bg-space-950 px-3 text-[12px] font-medium text-ink-200 transition-colors hover:border-white/15 disabled:opacity-50"
              >
                {ollamaStatus === 'checking' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.6} />
                )}
                Check
              </button>
            </div>
            {ollamaMessage && (
              <p
                className={`mt-2 text-[11.5px] leading-5 ${
                  ollamaStatus === 'error' ? 'text-caution' : 'text-ink-400'
                }`}
              >
                {ollamaMessage}
              </p>
            )}
          </div>
        )}

        {doctorMode && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-white/[0.06] bg-space-900 px-3 py-2 text-[12px] text-ink-400">
            <span className="flex items-center gap-1.5 text-ink-300">
              <span className="h-1.5 w-1.5 rounded-full bg-positive" />
              Live readings
            </span>
            <span className="font-mono tabular-nums">HR {vitals.heartRate} BPM</span>
            <span className="font-mono tabular-nums">SpO2 {vitals.spO2}%</span>
            <span className="font-mono tabular-nums">Temp {vitals.bodyTemp.toFixed(1)}°C</span>
            <span className="font-mono tabular-nums">GSR {vitals.gsrStress.toFixed(1)} μS</span>
            <span className="font-mono tabular-nums">Rad {vitals.radiationDoseRate.toFixed(2)} mSv/hr</span>
            <span className="text-ink-400">
              {vitals.source === 'sensor' ? 'From the sensor' : 'Practice readings'}
            </span>
          </div>
        )}

        {showSuggestion && (
          <div className="rounded-lg border border-signal/25 bg-signal/[0.04] px-4 py-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Cpu className="mt-0.5 h-4 w-4 shrink-0 text-signal-strong" strokeWidth={1.5} />
                <div>
                  <p className="text-[14px] font-medium text-ink-100">
                    {rulesMode
                      ? 'This device can run an on-device assistant'
                      : `Suggested for this device: ${modelName(suggested)}`}
                  </p>
                  <p className="mt-1 max-w-xl text-[13px] leading-5 text-ink-400">
                    {recommendationReason(
                      diagnostic.estimatedRamGb,
                      diagnostic.webGpu,
                      diagnostic.gpuTier,
                      suggested
                    )}
                    {rulesMode ? ' The written NASA rules are active until you switch.' : ''}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAiModelTier(suggested);
                    setPrepareNotice('');
                  }}
                  className="flex h-9 items-center rounded-lg border border-signal/30 bg-signal/[0.08] px-3 text-[12px] font-medium text-signal-strong transition-colors hover:bg-signal/[0.14]"
                >
                  Use {modelName(suggested)}
                </button>
                <button
                  type="button"
                  onClick={() => setSuggestionDismissed(true)}
                  className="flex h-9 items-center rounded-lg border border-white/[0.08] bg-space-900 px-3 text-[12px] font-medium text-ink-400 transition-colors hover:border-white/15 hover:text-ink-200"
                >
                  Not now
                </button>
              </div>
            </div>
          </div>
        )}

        {modelMissingModel && (
          <div className="glass rounded-xl px-4 py-3">
            <p className="text-[12px] leading-5 text-ink-400">
              This browser cannot run the on-device model. Doctor mode still uses the written NASA rules, and you can
              point the assistant at a local Ollama server instead.
            </p>
            <button
              type="button"
              onClick={() => void runHardwareDiagnostic()}
              className="mt-2 flex h-9 items-center rounded-lg border border-white/[0.08] bg-space-950 px-3 text-[12px] font-medium text-ink-300 transition-colors hover:border-white/15 hover:text-ink-100"
            >
              Check again
            </button>
          </div>
        )}

        {preparing && (
          <div className="rounded-lg border border-caution/25 bg-caution/[0.04] px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[12px] font-medium text-caution">Downloading {tierName} for the first time</p>
              <div className="flex items-center gap-2">
                <p className="font-mono text-[11.5px] text-ink-500">{Math.round(prepareProgress * 100)}%</p>
                <button
                  type="button"
                  onClick={cancelPreparation}
                  className="flex items-center gap-1 rounded-md border border-caution/30 px-2 py-1 text-[11.5px] font-medium text-caution transition-colors hover:bg-caution/[0.08]"
                >
                  <X className="h-3 w-3" strokeWidth={1.8} />
                  Cancel
                </button>
              </div>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-space-800">
              <div
                className="h-full rounded-full bg-caution transition-[width] duration-300"
                style={{ width: `${Math.max(3, Math.round(prepareProgress * 100))}%` }}
              />
            </div>
            <p className="mt-1.5 truncate text-[11.5px] text-ink-500">{prepareText}</p>
          </div>
        )}

        {prepareError && !preparing && (
          <p className="rounded-lg border border-caution/25 bg-caution/[0.04] px-4 py-2.5 text-[12px] leading-5 text-caution">
            {prepareError}
          </p>
        )}

        {prepareNotice && !preparing && !prepareError && (
          <p className="glass rounded-xl px-4 py-2.5 text-[12px] leading-5 text-ink-400">
            {prepareNotice}
          </p>
        )}

        {doctorMode && (
          <div className="flex flex-wrap gap-2">
            {QUICK_SYMPTOMS.map((symptom) => {
              const Icon = symptom.icon;
              return (
                <button
                  key={symptom.id}
                  type="button"
                  disabled={busy || preparing}
                  onClick={() => onQuickSymptom(symptom.id)}
                  className="flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-space-900 px-3 text-[12.5px] text-ink-300 transition-colors hover:border-white/15 hover:bg-space-850 hover:text-ink-100 disabled:opacity-40"
                >
                  <Icon className="h-4 w-4 text-ink-500" strokeWidth={1.5} />
                  {symptom.label}
                </button>
              );
            })}
          </div>
        )}

        {messages.map((message) => {
          const crimson = message.actionCard?.color === 'crimson';
          const isUser = message.sender === 'astronaut';

          if (message.actionCard) {
            return (
              <div key={message.id} className="flex justify-start">
                <div className="w-full max-w-[92%]">
                  <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-500">
                    <span className="font-medium text-ink-400">{roleLabel(message)}</span>
                    <span className="tabular-nums">{formatTime(message.timestamp)}</span>
                    {message.protocolBadge && <span className="font-mono">{message.protocolBadge}</span>}
                  </div>
                  <div className="rounded-2xl rounded-bl-md border border-white/[0.08] bg-space-850 px-3.5 py-3">
                    <p className="text-[14px] font-medium text-ink-100">{message.actionCard.name}</p>
                    {message.actionCard.description && (
                      <p className="mt-0.5 text-[13px] leading-5 text-ink-500">
                        {message.actionCard.description}
                      </p>
                    )}
                    <div
                      className={`mt-3 border-l-2 pl-3 ${
                        crimson ? 'border-critical/50' : 'border-caution/50'
                      }`}
                    >
                      <p className={`text-[11.5px] ${crimson ? 'text-critical' : 'text-caution'}`}>
                        {formatStatus(message.actionCard.status)}
                      </p>
                      <p className="mt-1 text-[14px] leading-5 text-ink-200">{message.actionCard.diagnosis}</p>
                      <ol className="mt-2 space-y-1 text-[14px] leading-5 text-ink-300">
                        {message.actionCard.steps.map((step) => (
                          <li key={step} className="flex gap-2">
                            <span className="select-none text-ink-500">–</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                    <p className="mt-2 font-mono text-[11px] text-ink-500">{message.actionCard.nasaCode}</p>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div key={message.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className="flex max-w-[85%] flex-col">
                <div
                  className={`mb-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-500 ${
                    isUser ? 'justify-end' : ''
                  }`}
                >
                  <span className="font-medium text-ink-400">{roleLabel(message)}</span>
                  <span className="tabular-nums">{formatTime(message.timestamp)}</span>
                  {message.protocolBadge && <span className="font-mono">{message.protocolBadge}</span>}
                </div>
                {isUser ? (
                  <div className="rounded-2xl rounded-br-md border border-signal/25 bg-signal/[0.12] px-3.5 py-2.5">
                    <p className="whitespace-pre-wrap text-[14px] leading-5 text-ink-100">{message.text}</p>
                    {message.vitalsSnapshot && (
                      <p className="mt-1.5 font-mono text-[10.5px] text-ink-400">
                        HR {message.vitalsSnapshot.heartRate} · SpO2 {message.vitalsSnapshot.spO2}% ·{' '}
                        {message.vitalsSnapshot.bodyTemp.toFixed(1)}°C
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl rounded-bl-md border border-white/[0.08] bg-space-850 px-3.5 py-2.5">
                    <RichText text={message.text || (message.isStreaming ? '…' : '')} />
                    {message.isStreaming && (
                      <Loader2 className="mt-2 h-3.5 w-3.5 animate-spin text-ink-500" />
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <form
        className="flex shrink-0 items-center gap-2 glass rounded-2xl p-2 pl-3"
        onSubmit={(event) => {
          event.preventDefault();
          void ask(draft);
        }}
      >
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={doctorMode ? 'Describe a symptom, or use a card above' : 'Message the assistant'}
          aria-label="Message the AI assistant"
          className="h-10 min-w-0 flex-1 bg-transparent text-[14px] text-ink-100 outline-none placeholder:text-ink-500"
        />
        <button
          type="submit"
          disabled={busy || preparing || !draft.trim()}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-chalk text-space-950 transition-colors hover:brightness-105 disabled:opacity-40"
          aria-label="Send to the AI assistant"
        >
          <Send className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </form>

      {doctorMode && (
        <p className="shrink-0 text-[11px] leading-5 text-ink-500">
          Training simulation only. It does not replace real medical care or mission medical rules.
        </p>
      )}
    </div>
  );
};
