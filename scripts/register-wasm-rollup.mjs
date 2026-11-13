import { createRequire, register, registerHooks } from 'node:module';

const require = createRequire(import.meta.url);
let useWasm = false;

try {
  require('rollup');
} catch (error) {
  const blocked = error && typeof error === 'object' && 'code' in error && error.code === 'ERR_DLOPEN_FAILED';
  if (!blocked) throw error;
  useWasm = true;
}

if (useWasm) {
  const remap = (specifier) =>
    specifier === 'rollup' || specifier.startsWith('rollup/')
      ? specifier.replace(/^rollup(?=\/|$)/, '@rollup/wasm-node')
      : null;

  if (typeof registerHooks === 'function') {
    // Synchronous hooks cover CommonJS require() as well as ESM import, which
    // matters because the PWA service-worker bundler (workbox-build) requires
    // Rollup through CommonJS and would otherwise hit the blocked native addon.
    registerHooks({
      resolve(specifier, context, nextResolve) {
        const mapped = remap(specifier);
        return nextResolve(mapped ?? specifier, context);
      }
    });
  } else {
    await register(new URL('./wasm-rollup-hook.mjs', import.meta.url), {
      data: { useWasm: true }
    });
  }
}
