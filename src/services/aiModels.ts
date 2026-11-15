import {
  AiModelTier,
  BundleModelConfig,
  CrewProfile,
  VitalsData
} from '../types/telemetry';

export interface ModelOption {
  id: AiModelTier;
  name: string;
  shortName: string;
  download: string;
  memory: string;
  note: string;
  webllmId: string | null;
}

/** Where answers come from: a model on this device, or a local Ollama server. */
export type AiProvider = 'ondevice' | 'ollama';

/** Doctor mode attaches the prompt and the live readings; assistant mode is plain chat. */
export type ChatMode = 'doctor' | 'assistant';

export type ChatRoleMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export const MODEL_OPTIONS: ModelOption[] = [
  {
    id: 'phi3',
    name: 'Phi-3.5 mini',
    shortName: 'Phi-3.5',
    download: 'about 2.1 GB',
    memory: 'about 3.7 GB of graphics memory',
    note: 'The strongest answers. Best on a recent laptop with 8 GB of memory or more.',
    webllmId: 'Phi-3.5-mini-instruct-q4f16_1-MLC'
  },
  {
    id: 'llama3',
    name: 'Llama 3.2 3B',
    shortName: 'Llama 3.2',
    download: 'about 1.8 GB',
    memory: 'about 2.3 GB of graphics memory',
    note: 'A good balance of speed and detail. Works on most recent laptops.',
    webllmId: 'Llama-3.2-3B-Instruct-q4f16_1-MLC'
  },
  {
    id: 'gemma2',
    name: 'Gemma 2 2B',
    shortName: 'Gemma 2',
    download: 'about 1.5 GB',
    memory: 'about 1.9 GB of graphics memory',
    note: 'The smallest download. Best when the device has limited memory.',
    webllmId: 'gemma-2-2b-it-q4f16_1-MLC'
  },
  {
    id: 'none',
    name: 'No AI',
    shortName: 'No AI',
    download: 'nothing to download',
    memory: 'no graphics memory needed',
    note: 'Uses the written NASA rules only. Works on every device and never needs the internet.',
    webllmId: null
  }
];

const STORED_TIER_KEY = 'exmonitor.ai.tier';
const STORED_BUNDLE_KEY = 'exmonitor.ai.bundle';
const STORED_CHOICE_KEY = 'exmonitor.ai.user-chosen';
const STORED_PROVIDER_KEY = 'exmonitor.ai.provider';
const STORED_MODE_KEY = 'exmonitor.ai.mode';
let bundleConfigPromise: Promise<BundleModelConfig | null> | null = null;

export function readProvider(): AiProvider {
  try {
    return window.localStorage.getItem(STORED_PROVIDER_KEY) === 'ollama' ? 'ollama' : 'ondevice';
  } catch {
    return 'ondevice';
  }
}

export function storeProvider(provider: AiProvider): void {
  try {
    window.localStorage.setItem(STORED_PROVIDER_KEY, provider);
  } catch {
    // Ignore.
  }
}

export function readChatMode(): ChatMode {
  try {
    return window.localStorage.getItem(STORED_MODE_KEY) === 'assistant' ? 'assistant' : 'doctor';
  } catch {
    return 'doctor';
  }
}

export function storeChatMode(mode: ChatMode): void {
  try {
    window.localStorage.setItem(STORED_MODE_KEY, mode);
  } catch {
    // Ignore.
  }
}

export function modelOption(tier: AiModelTier): ModelOption {
  return MODEL_OPTIONS.find((option) => option.id === tier) ?? MODEL_OPTIONS[3];
}

export function modelName(tier: AiModelTier): string {
  return modelOption(tier).name;
}

function isTier(value: unknown): value is AiModelTier {
  return value === 'phi3' || value === 'llama3' || value === 'gemma2' || value === 'none';
}

export function loadBundleModel(): Promise<BundleModelConfig | null> {
  if (bundleConfigPromise) return bundleConfigPromise;

  bundleConfigPromise = (async () => {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}model-config.json?at=${Date.now()}`, {
        cache: 'no-store'
      });
      if (!response.ok) return null;
      const data: unknown = await response.json();
      if (!data || typeof data !== 'object') return null;
      const value = data as Partial<BundleModelConfig>;
      if (!isTier(value.model)) return null;
      return {
        model: value.model,
        version: typeof value.version === 'string' ? value.version : 'unknown',
        builtAt: typeof value.builtAt === 'string' ? value.builtAt : '',
        source: typeof value.source === 'string' ? value.source : undefined
      };
    } catch {
      return null;
    }
  })();

  return bundleConfigPromise;
}

export function readStoredTier(): AiModelTier | null {
  try {
    const stored = window.localStorage.getItem(STORED_TIER_KEY);
    return isTier(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function storeTier(tier: AiModelTier, userChosen = false): void {
  try {
    window.localStorage.setItem(STORED_TIER_KEY, tier);
    if (userChosen) window.localStorage.setItem(STORED_CHOICE_KEY, '1');
  } catch {
    // Ignore.
  }
}

export function hasStoredTierChoice(): boolean {
  try {
    return window.localStorage.getItem(STORED_CHOICE_KEY) === '1';
  } catch {
    return false;
  }
}

function bundleStamp(bundle: BundleModelConfig): string {
  return `${bundle.model}|${bundle.version}|${bundle.builtAt}`;
}

/**
 * The download page links to the hosted copy as /app/?model=phi3. Apply that
 * choice once, keep it, and remove it from the address so a later choice in
 * Settings is not overridden on every reload.
 */
function takeRequestedTier(): AiModelTier | null {
  try {
    const address = new URL(window.location.href);
    const value = address.searchParams.get('model');
    if (!isTier(value)) return null;
    address.searchParams.delete('model');
    window.history.replaceState(null, '', `${address.pathname}${address.search}${address.hash}`);
    storeTier(value, true);
    return value;
  } catch {
    return null;
  }
}

/**
 * A freshly downloaded ZIP must win over an older choice kept in the browser.
 * The bundle carries a build stamp, so the default changes only when the
 * packaged app changes.
 */
export async function resolveInitialTier(): Promise<AiModelTier> {
  const requested = takeRequestedTier();
  if (requested) return requested;

  const bundle = await loadBundleModel();
  const stored = readStoredTier();
  const userChosen = hasStoredTierChoice();

  if (bundle) {
    let previousStamp: string | null = null;
    try {
      previousStamp = window.localStorage.getItem(STORED_BUNDLE_KEY);
    } catch {
      previousStamp = null;
    }
    const stamp = bundleStamp(bundle);
    if (previousStamp !== stamp) {
      try {
        window.localStorage.setItem(STORED_BUNDLE_KEY, stamp);
      } catch {
        // Ignore.
      }
      // A model the crew member picked in setup or Settings wins over the
      // model that was bundled on the download page.
      if (!userChosen) {
        storeTier(bundle.model);
        return bundle.model;
      }
    }
  }

  if (stored && userChosen) return stored;
  return stored ?? bundle?.model ?? 'none';
}

/**
 * A conservative suggestion based on the memory report and the graphics
 * adapter. Chromium caps deviceMemory at 8, so an integrated laptop with
 * 8 GB should get the smallest model rather than the largest one.
 */
export function recommendedTier(ramGb: number, webGpu: boolean, gpuLabel = ''): AiModelTier {
  if (!webGpu) return 'none';

  const gpu = gpuLabel.toLowerCase();
  const discrete = /nvidia|geforce|rtx|quadro|radeon|amd|arc|discrete/.test(gpu);

  if (ramGb >= 16 && discrete) return 'phi3';
  if (ramGb >= 16) return 'llama3';
  if (ramGb >= 8 && discrete) return 'llama3';
  if (ramGb >= 4) return 'gemma2';
  return 'none';
}

export function recommendationReason(
  ramGb: number,
  webGpu: boolean,
  gpuLabel = '',
  tier: AiModelTier = recommendedTier(ramGb, webGpu, gpuLabel)
): string {
  if (!webGpu) {
    return 'This browser does not expose WebGPU, so the on-device model cannot run here. The written NASA rules still work.';
  }
  if (tier === 'none') {
    return `This device reports ${ramGb} GB of memory, which is below the safe minimum for a local model. Use the written NASA rules.`;
  }
  if (tier === 'gemma2') {
    return `The smallest model is the safest fit for ${ramGb} GB of memory${gpuLabel ? ` and ${gpuLabel}` : ''}.`;
  }
  if (tier === 'llama3') {
    return `This device has enough memory${gpuLabel ? ` and a capable ${gpuLabel}` : ''} for the balanced 3B model.`;
  }
  return 'This device has enough memory and graphics power for the strongest model.';
}

export function buildFlightSurgeonMessages(payload: {
  userQuery: string;
  vitals: VitalsData;
  profile: CrewProfile;
}) {
  const { userQuery, vitals, profile } = payload;
  const system = [
    'You are the on-board medical assistant for a small crew far from Earth, where a message home can take up to 22 minutes.',
    'Answer in plain, calm language. Do not use abbreviations without explaining them. Do not claim to be a doctor.',
    'Use only the readings supplied below. Keep the answer under 160 words with three short sections: "What this may mean", "What to do now", and "When to get help".',
    'Never invent medicine names or doses. If a reading is in the critical range, say clearly that the crew should send an emergency alert.',
    'This is a training simulation, not real medical care.'
  ].join(' ');

  const context = [
    `Crew member: ${profile.name} (${profile.label}).`,
    `Heart rate: ${vitals.heartRate} beats per minute. Usual range 60 to 100.`,
    `Blood oxygen: ${vitals.spO2} percent. Below 93 is a caution, below 88 is critical.`,
    `Body temperature: ${vitals.bodyTemp.toFixed(1)} degrees Celsius. Usual range 36.5 to 37.5.`,
    `Skin response (stress signal): ${vitals.gsrStress.toFixed(1)} microsiemens. Usual range 2 to 8.`,
    `Radiation dose rate: ${vitals.radiationDoseRate.toFixed(2)} millisieverts per hour. Caution from 0.30, critical from 1.00.`,
    `Total mission dose: ${vitals.cumulativeRadiation.toFixed(2)} millisieverts.`,
    `Readings come from: ${vitals.source === 'sensor' ? 'the paired body sensor' : 'the built-in practice generator'}.`
  ].join(' ');

  return [
    { role: 'system' as const, content: system },
    {
      role: 'system' as const,
      content: `Current readings. ${context}`
    },
    { role: 'user' as const, content: userQuery }
  ];
}

/**
 * Doctor mode sends the medical prompt and the current readings. Assistant mode
 * is a plain chat: the question goes straight to the model with no system
 * prompt and no readings attached.
 */
export function buildChatMessages(
  payload: { userQuery: string; vitals: VitalsData; profile: CrewProfile },
  mode: ChatMode
): ChatRoleMessage[] {
  if (mode === 'assistant') {
    return [{ role: 'user', content: payload.userQuery }];
  }
  return buildFlightSurgeonMessages(payload);
}

export function buildRulesAnswer(payload: { userQuery: string; vitals: VitalsData }, protocol?: {
  name: string;
  diagnosis: string;
  steps: string[];
  nasaCode: string;
}): string {
  const { userQuery, vitals } = payload;
  const lines: string[] = [];

  if (protocol) {
    lines.push(`### ${protocol.name}`);
    lines.push(protocol.diagnosis);
    lines.push('');
    lines.push('### What to do now');
    for (const step of protocol.steps) lines.push(`- ${step}`);
    lines.push('');
    lines.push(`Reference: ${protocol.nasaCode}`);
    return lines.join('\n');
  }

  const flags: string[] = [];
  if (vitals.spO2 < 93) flags.push(`blood oxygen is ${vitals.spO2}%, below the usual range`);
  if (vitals.heartRate > 125) flags.push(`heart rate is ${vitals.heartRate}, above the usual range`);
  if (vitals.bodyTemp >= 37.8) flags.push(`body temperature is ${vitals.bodyTemp.toFixed(1)} degrees, above the usual range`);
  if (vitals.gsrStress >= 12) flags.push(`the stress signal is ${vitals.gsrStress.toFixed(1)}, above the usual range`);
  if (vitals.radiationDoseRate >= 0.3) flags.push(`radiation is ${vitals.radiationDoseRate.toFixed(2)} millisieverts per hour, above the usual range`);

  lines.push('### What this may mean');
  lines.push(
    flags.length
      ? `Your question was "${userQuery}". These readings are outside the usual range: ${flags.join('; ')}.`
      : `Your question was "${userQuery}". The current readings are inside the usual range.`
  );
  lines.push('');
  lines.push('### What to do now');
  if (flags.length) {
    lines.push('- Stop strenuous work, sit down and check that the sensor is sitting correctly.');
    lines.push('- Recheck the readings once, then send a crew alert if they stay out of range.');
    lines.push('- Use one of the symptom cards above for the written NASA steps.');
  } else {
    lines.push('- Keep working, drink water and recheck the readings later.');
    lines.push('- Tap a symptom card above for written NASA steps about a specific problem.');
  }
  lines.push('');
  lines.push('### When to get help');
  lines.push('Send an emergency alert if blood oxygen falls below 88%, radiation reaches 1.00, or the person cannot stay awake.');
  lines.push('');
  lines.push('Written NASA rules. No language model was used.');
  return lines.join('\n');
}

export async function streamRulesAnswer(text: string, onToken: (token: string) => void): Promise<string> {
  const words = text.split(' ');
  let built = '';
  for (let index = 0; index < words.length; index += 1) {
    const chunk = `${index === 0 ? '' : ' '}${words[index]}`;
    built += chunk;
    onToken(chunk);
    await new Promise((resolve) => window.setTimeout(resolve, 12));
  }
  return built;
}
