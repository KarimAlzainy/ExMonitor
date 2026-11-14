import { SystemDiagnostic } from '../types/telemetry';
import { recommendedTier } from './aiModels';
import { hasWebGpu } from './flightSurgeon';

/**
 * Reads the browser-visible device limits and turns them into a model
 * suggestion. It is shared by the setup wizard and the live console so both
 * places give the crew the same answer.
 */
export async function assessDevice(): Promise<SystemDiagnostic> {
  if (typeof navigator === 'undefined') {
    return {
      estimatedRamGb: 8,
      cpuCores: 4,
      availableStorageGb: 32,
      gpuTier: 'This browser cannot be checked here',
      webGpu: false,
      recommendedModel: 'none'
    };
  }

  const nav = navigator as unknown as {
    deviceMemory?: number;
    hardwareConcurrency?: number;
    gpu?: {
      requestAdapter: () => Promise<{
        info?: { vendor?: string; architecture?: string; device?: string; description?: string };
      } | null>;
    };
  };

  const ram = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 4;
  let storageGb = 32;
  if (navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      if (estimate.quota) storageGb = Math.round(estimate.quota / (1024 * 1024 * 1024));
    } catch {
      // Keep the default.
    }
  }

  const webGpu = await hasWebGpu();
  let gpuTier = webGpu ? 'WebGPU ready' : 'WebGPU not available';

  if (webGpu && nav.gpu) {
    try {
      const adapter = await nav.gpu.requestAdapter();
      const info = adapter?.info;
      const parts = [info?.vendor, info?.architecture, info?.device, info?.description].filter(Boolean);
      if (parts.length) gpuTier = `WebGPU · ${parts.join(' ')}`;
    } catch {
      // The simple label is enough.
    }
  }

  return {
    estimatedRamGb: ram,
    cpuCores: cores,
    availableStorageGb: storageGb,
    gpuTier,
    webGpu,
    recommendedModel: recommendedTier(ram, webGpu, gpuTier)
  };
}
