import type { MLCEngineInterface } from '@mlc-ai/web-llm';
import { AiModelTier, CrewProfile, VitalsData } from '../types/telemetry';
import { ChatMode, buildChatMessages, modelOption } from './aiModels';

export interface EngineProgress {
  progress: number;
  text: string;
}

export interface AskPayload {
  userQuery: string;
  vitals: VitalsData;
  profile: CrewProfile;
}

export class ModelLoadCancelledError extends Error {
  constructor(message = 'Model download cancelled.') {
    super(message);
    this.name = 'ModelLoadCancelledError';
  }
}

export function isModelLoadCancelled(error: unknown): boolean {
  return (
    error instanceof ModelLoadCancelledError ||
    (error instanceof Error && error.name === 'ModelLoadCancelledError')
  );
}

let engine: MLCEngineInterface | null = null;
let engineTier: AiModelTier | null = null;
let engineWorker: Worker | null = null;
let loadingPromise: Promise<MLCEngineInterface> | null = null;
let loadingTier: AiModelTier | null = null;
let cancelReject: ((error: Error) => void) | null = null;
let loadGeneration = 0;

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

function rejectActiveLoad(reason = 'Model download cancelled.'): void {
  const reject = cancelReject;
  cancelReject = null;
  if (reject) reject(new ModelLoadCancelledError(reason));
}

export async function unloadModel(): Promise<void> {
  loadGeneration += 1;
  rejectActiveLoad('Model unloaded.');

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
 * Stops an in-progress download/prepare. Terminating the worker also aborts
 * its network requests. A model that is already loaded is left alone.
 */
export function cancelModelLoad(): void {
  if (!loadingPromise && !cancelReject && !engineWorker) return;
  if (engine) return;

  loadGeneration += 1;
  rejectActiveLoad();
  loadingPromise = null;
  loadingTier = null;

  if (engineWorker) {
    engineWorker.terminate();
    engineWorker = null;
  }
}

export async function modelFilesCached(tier: AiModelTier): Promise<boolean> {
  if (tier === 'none') return false;
  const option = modelOption(tier);
  if (!option.webllmId) return false;
  try {
    const { hasModelInCache } = await import('@mlc-ai/web-llm');
    return await hasModelInCache(option.webllmId);
  } catch {
    return false;
  }
}

export async function deleteModelFiles(tier: AiModelTier): Promise<void> {
  if (tier === 'none') return;
  await unloadModel();
  const option = modelOption(tier);
  if (!option.webllmId) return;
  const { deleteModelAllInfoInCache } = await import('@mlc-ai/web-llm');
  await deleteModelAllInfoInCache(option.webllmId);
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

  const previousLoad = loadingPromise;
  if (previousLoad) {
    cancelModelLoad();
    try {
      await previousLoad;
    } catch {
      // Expected when switching models.
    }
  }

  if (engine) {
    await unloadModel();
  }

  const option = modelOption(tier);
  if (!option.webllmId) throw new Error('This model is not available.');

  const generation = ++loadGeneration;
  loadingTier = tier;

  const cancelled = new Promise<never>((_, reject) => {
    cancelReject = reject;
  });

  const work = (async () => {
    const { CreateMLCEngine, CreateWebWorkerMLCEngine } = await import('@mlc-ai/web-llm');
    const initProgressCallback = (report: { progress: number; text: string }) => {
      if (generation !== loadGeneration) return;
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

      if (generation !== loadGeneration) {
        try {
          await next.unload();
        } catch {
          // The worker was already stopped.
        }
        throw new ModelLoadCancelledError();
      }

      engine = next;
      engineTier = tier;
      return next;
    } catch (workerError) {
      if (generation !== loadGeneration || isModelLoadCancelled(workerError)) {
        throw new ModelLoadCancelledError();
      }

      if (engineWorker) {
        engineWorker.terminate();
        engineWorker = null;
      }
      console.warn('The model worker could not start; trying the page thread instead.', workerError);
      const next = await CreateMLCEngine(option.webllmId as string, {
        initProgressCallback,
        logLevel: 'WARN'
      });

      if (generation !== loadGeneration) {
        try {
          await next.unload();
        } catch {
          // The engine was already stopped.
        }
        throw new ModelLoadCancelledError();
      }

      engine = next;
      engineTier = tier;
      return next;
    }
  })();

  const nextLoad = Promise.race([work, cancelled]).finally(() => {
    if (generation === loadGeneration) {
      loadingPromise = null;
      loadingTier = null;
      cancelReject = null;
    }
  });

  loadingPromise = nextLoad;
  return nextLoad;
}

export async function askFlightSurgeon(
  payload: AskPayload,
  onToken: (token: string) => void,
  mode: ChatMode = 'doctor'
): Promise<string> {
  if (!engine) throw new Error('The model is not ready yet.');

  try {
    await engine.resetChat();
  } catch {
    // Older engine builds may not expose resetChat.
  }

  const messages = buildChatMessages(payload, mode);
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
