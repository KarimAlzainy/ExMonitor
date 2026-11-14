import type { MLCEngineInterface } from '@mlc-ai/web-llm';
import { AiModelTier, CrewProfile, VitalsData } from '../types/telemetry';
import { buildFlightSurgeonMessages, modelOption } from './aiModels';

export interface EngineProgress {
  progress: number;
  text: string;
}

export interface AskPayload {
  userQuery: string;
  vitals: VitalsData;
  profile: CrewProfile;
}

let engine: MLCEngineInterface | null = null;
let engineTier: AiModelTier | null = null;
let engineWorker: Worker | null = null;
let loadingPromise: Promise<MLCEngineInterface> | null = null;
let loadingTier: AiModelTier | null = null;

export async function hasWebGpu(): Promise<boolean> {
  if (typeof navigator === 'undefined') return false;
  const gpu = (navigator as unknown as {
    gpu?: { requestAdapter: () => Promise<unknown | null> };
  }).gpu;
  if (!gpu) return false;
  try {
    const adapter = await gpu.requestAdapter();
    return Boolean(adapter);
  } catch {
    return false;
  }
}

export function isModelReady(tier: AiModelTier): boolean {
  return tier !== 'none' && engine !== null && engineTier === tier;
}

export function loadedModelTier(): AiModelTier | null {
  return engineTier;
}

export async function unloadModel(): Promise<void> {
  const current = engine;
  engine = null;
  engineTier = null;
  loadingPromise = null;
  loadingTier = null;
  if (engineWorker) {
    engineWorker.terminate();
    engineWorker = null;
  }
  if (current) {
    try {
      await current.unload();
    } catch {
      // The worker may already be gone.
    }
  }
}

/**
 * Downloads the model on first use and then runs it entirely on this device.
 * The chosen files stay in the browser cache, so later launches work offline.
 */
export async function prepareModel(
  tier: AiModelTier,
  onProgress: (progress: EngineProgress) => void
): Promise<MLCEngineInterface> {
  if (tier === 'none') throw new Error('No language model is selected.');
  if (engine && engineTier === tier) return engine;
  if (loadingPromise && loadingTier === tier) return loadingPromise;

  if (loadingPromise) {
    try {
      await loadingPromise;
    } catch {
      // Continue and try this model.
    }
  }

  if (engine) {
    await unloadModel();
  }

  const option = modelOption(tier);
  if (!option.webllmId) throw new Error('This model is not available.');

  loadingTier = tier;
  loadingPromise = (async () => {
    const { CreateMLCEngine, CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm');
    const initProgressCallback = (report: { progress: number; text: string }) => {
      onProgress({
        progress: Math.max(0, Math.min(1, Number.isFinite(report.progress) ? report.progress : 0)),
        text: report.text || 'Preparing the model'
      });
    };

    try {
      const worker = new Worker(new URL('./webllm.worker.ts', import.meta.url), { type: 'module' });
      engineWorker = worker;
      const next = await CreateWebWorkerMLCEngine(worker, option.webllmId as string, {
        initProgressCallback,
        logLevel: 'WARN'
      });
      engine = next;
      engineTier = tier;
      return next;
    } catch (workerError) {
      if (engineWorker) {
        engineWorker.terminate();
        engineWorker = null;
      }
      console.warn('The model worker could not start; trying the page thread instead.', workerError);
      const next = await CreateMLCEngine(option.webllmId as string, {
        initProgressCallback,
        logLevel: 'WARN'
      });
      engine = next;
      engineTier = tier;
      return next;
    } finally {
      loadingPromise = null;
      loadingTier = null;
    }
  })();

  return loadingPromise;
}

export async function askFlightSurgeon(
  payload: AskPayload,
  onToken: (token: string) => void
): Promise<string> {
  if (!engine) throw new Error('The model is not ready yet.');

  try {
    await engine.resetChat();
  } catch {
    // Older engine builds may not expose resetChat.
  }

  const messages = buildFlightSurgeonMessages(payload);
  const completion = await engine.chat.completions.create({
    messages,
    stream: true,
    temperature: 0.2,
    top_p: 0.9,
    max_tokens: 420
  });

  let text = '';
  for await (const chunk of completion) {
    const delta = chunk.choices[0]?.delta?.content ?? '';
    if (delta) {
      text += delta;
      onToken(delta);
    }
  }

  return text;
}
