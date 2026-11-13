let useWasm = false;

export function initialize(data) {
  useWasm = Boolean(data?.useWasm);
}

export async function resolve(specifier, context, nextResolve) {
  if (useWasm && (specifier === 'rollup' || specifier.startsWith('rollup/'))) {
    const mapped = specifier.replace(/^rollup(?=\/|$)/, '@rollup/wasm-node');
    return nextResolve(mapped, context);
  }
  return nextResolve(specifier, context);
}
