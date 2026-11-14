import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Builds a second copy of the app for the hosted address (/app/ on the download
 * site) and copies it into site/app. The ZIP keeps the root build in dist/,
 * because the launcher serves the app from the folder root.
 *
 *   node scripts/build-hosted.mjs
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const outDir = path.join(root, 'dist-app');
const siteApp = path.join(root, 'site', 'app');

const result = spawnSync(
  process.execPath,
  ['--import', './scripts/register-wasm-rollup.mjs', vite, 'build', '--outDir', outDir, '--emptyOutDir'],
  {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, APP_BASE: '/app/' }
  }
);

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

fs.rmSync(siteApp, { recursive: true, force: true });
fs.cpSync(outDir, siteApp, { recursive: true });

console.log('');
console.log(`Hosted app copied to ${path.relative(root, siteApp)} (base /app/).`);