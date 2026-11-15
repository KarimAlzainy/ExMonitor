// Package the downloadable ZIPs. Written with AI assistance; reviewed by the author.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ZipArchive } from 'archiver';

/**
 * Builds one ZIP per assistant choice and operating system. Every ZIP contains
 * the latest built app, exactly one start file for that system, and a
 * model-config.json that selects the assistant chosen on the download page.
 * The model itself is fetched once by the browser on first use.
 *
 *   node scripts/package-bundles.mjs
 *   node scripts/package-bundles.mjs --out bundles --manifest site/downloads.json
 *   node scripts/package-bundles.mjs --models phi3:3.8b-mini-4k-instruct-q8_0,none
 *   node scripts/package-bundles.mjs --platforms windows
 *   node scripts/package-bundles.mjs --site-copy
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
// The label on the page stays the project version plus the build date. Each ZIP
// still records the commit it came from in app/model-config.json.
const version = argValue('--version', process.env.GITHUB_SHA?.slice(0, 7) || packageJson.version);
const outDir = path.resolve(root, argValue('--out', 'bundles'));
const distDir = path.join(root, 'dist');
const manifestPath = path.resolve(root, argValue('--manifest', path.join('site', 'downloads.json')));
const siteOut = path.resolve(root, argValue('--site-out', path.join('site', 'downloads')));
// The published site points at the GitHub release, so the ZIPs stay out of the
// Worker upload by default. Pass --site-copy to keep a local copy in site/.
const copyToSite = process.argv.includes('--site-copy');
const selection = argValue('--models', 'phi3:3.8b-mini-4k-instruct-q8_0,llama3,gemma2,none')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);
const platformSelection = argValue('--platforms', 'windows,macos,linux')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const MODELS = [
  {
    id: 'phi3:3.8b-mini-4k-instruct-q8_0',
    title: 'Phi-3.5 mini',
    folder: 'ExMonitor-Phi-3.5',
    zip: 'exmonitor-phi3:3.8b-mini-4k-instruct-q8_0',
    download: 'about 2.1 GB'
  },
  {
    id: 'llama3',
    title: 'Llama 3.2 3B',
    folder: 'ExMonitor-Llama-3.2',
    zip: 'exmonitor-llama3',
    download: 'about 1.8 GB'
  },
  {
    id: 'gemma2',
    title: 'Gemma 2 2B',
    folder: 'ExMonitor-Gemma-2',
    zip: 'exmonitor-gemma2',
    download: 'about 1.5 GB'
  },
  {
    id: 'none',
    title: 'No AI',
    folder: 'ExMonitor-No-AI',
    zip: 'exmonitor-no-ai',
    download: 'nothing'
  }
];

if (!fs.existsSync(path.join(distDir, 'index.html'))) {
  console.error('No built app found in dist/. Run "npm run build" before packaging.');
  process.exit(1);
}

const unknown = selection.filter((id) => !MODELS.some((model) => model.id === id));
if (unknown.length) {
  console.error(`Unknown model id(s): ${unknown.join(', ')}`);
  process.exit(1);
}

const startWindows = `@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto missing

node server.js
if errorlevel 1 pause
exit /b 0

:missing
echo.
echo Node.js 18 or newer is needed to run ExMonitor.
echo Install it from https://nodejs.org and run this file again.
echo.
pause
exit /b 1
`;

const startShell = `#!/bin/sh
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  printf '%s\\n' "Node.js 18 or newer is needed to run ExMonitor." "Install it from https://nodejs.org and run this file again."
  read -r _
  exit 1
fi

node server.js
`;

const PLATFORMS = [
  {
    id: 'windows',
    title: 'Windows',
    folderSuffix: 'Windows',
    launcher: 'Start ExMonitor.cmd',
    content: startWindows,
    mode: undefined,
    howToStart: 'Double-click "Start ExMonitor.cmd".'
  },
  {
    id: 'macos',
    title: 'macOS',
    folderSuffix: 'macOS',
    launcher: 'Start ExMonitor.command',
    content: startShell,
    mode: 0o755,
    howToStart:
      'Double-click "Start ExMonitor.command". If macOS says it cannot be opened, right-click it, choose Open, then Open again.'
  },
  {
    id: 'linux',
    title: 'Linux',
    folderSuffix: 'Linux',
    launcher: 'start-exmonitor.sh',
    content: startShell,
    mode: 0o755,
    howToStart: 'Run ./start-exmonitor.sh in a terminal from this folder.'
  }
];

if (platformSelection.some((id) => !PLATFORMS.some((platform) => platform.id === id))) {
  console.error(`Unknown platform id(s): ${platformSelection.join(', ')}`);
  process.exit(1);
}

fs.mkdirSync(outDir, { recursive: true });

const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const builtAt = new Date().toISOString();

function readmeFor(model, platform) {
  const assistant =
    model.id === 'none'
      ? [
          'Assistant: No AI',
          '',
          'This copy uses the written NASA action cards and the rules engine only.',
          'Nothing is downloaded and no graphics card is needed.'
        ]
      : [
          `Assistant: ${model.title}`,
          '',
          `The first question downloads ${model.download} once. After that the assistant`,
          'works without the internet. The files stay in the browser cache.',
          '',
          'If the browser does not support WebGPU, the console automatically uses the',
          'written NASA rules instead.'
        ];

  return [
    'ExMonitor - crew health console',
    '================================',
    '',
    `This download is made for: ${platform.title}`,
    '',
    ...assistant,
    '',
    'How to start',
    '------------',
    '1. Install Node.js 18 or newer from https://nodejs.org if it is not installed.',
    `2. ${platform.howToStart}`,
    '3. A browser opens at http://localhost:8080.',
    '',
    'Opening it on a phone (no install)',
    '----------------------------------',
    'Open https://exmonitor.extem.net/app/ in the phone browser.',
    'That version works on the phone itself and includes the sensor page.',
    'Tap "Add to Home screen" to get one icon that opens the console full screen.',
    '',
    'Using a phone as the body sensor',
    '--------------------------------',
    'Open the address the launcher prints for this network, followed by /sensors.html,',
    'on the phone. For example: http://192.168.1.20:8080/sensors.html',
    'Then open Settings in the console and scan the code from the sensor page.',
    'Both devices must be on the same Wi-Fi or hotspot.',
    '',
    'Alerts',
    '------',
    'Other consoles on the same crew link show a full-screen alert until each one',
    'acknowledges it. The sender sees a small sent panel and can cancel the alert',
    'for everyone.',
    '',
    'Notes',
    '-----',
    '- System notifications and installing as an app need localhost or HTTPS.',
    '  The full-screen alert always works while the console is open.',
    '- The sensor page sends pretend readings. It is not a medical device.',
    '- This is a training simulation and does not replace real medical care.',
    '',
    `Build ${version} - ${builtAt}`,
    ''
  ].join('\n');
}

function createZip(model, platform) {
  const file = `${model.zip}-${platform.id}.zip`;
  const zipPath = path.join(outDir, file);
  const rootName = `${model.folder}-${platform.folderSuffix}`;

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on('close', () => resolve({ file, zipPath }));
    output.on('error', reject);
    archive.on('error', reject);
    archive.on('warning', (error) => {
      if (error.code === 'ENOENT') console.warn(error.message);
      else reject(error);
    });

    archive.pipe(output);
    archive.append(readmeFor(model, platform), { name: `${rootName}/README.txt` });
    archive.append(serverSource, { name: `${rootName}/server.js` });
    archive.append(platform.content, {
      name: `${rootName}/${platform.launcher}`,
      mode: platform.mode
    });

    archive.directory(distDir, `${rootName}/app`, (entry) =>
      entry.name === 'model-config.json' ? false : entry
    );

    archive.append(
      JSON.stringify(
        {
          model: model.id,
          platform: platform.id,
          version,
          builtAt,
          source: process.env.GITHUB_REPOSITORY ? 'github-actions' : 'local'
        },
        null,
        2
      ),
      { name: `${rootName}/app/model-config.json` }
    );

    archive.finalize();
  });
}

const models = MODELS.filter((model) => selection.includes(model.id));
const platforms = PLATFORMS.filter((platform) => platformSelection.includes(platform.id));
const files = {};

for (const model of models) {
  files[model.id] = {};
  for (const platform of platforms) {
    process.stdout.write(`Packaging ${model.title} for ${platform.title} ... `);
    const { file, zipPath } = await createZip(model, platform);
    const stats = fs.statSync(zipPath);
    files[model.id][platform.id] = {
      file,
      title: model.title,
      platform: platform.title,
      bytes: stats.size,
      download: model.download
    };
    console.log(`${(stats.size / (1024 * 1024)).toFixed(1)} MB`);
  }
}

const manifest = {
  version,
  builtAt,
  files
};

fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

if (copyToSite) {
  if (path.resolve(outDir) !== siteOut) {
    fs.rmSync(siteOut, { recursive: true, force: true });
  }
  fs.mkdirSync(siteOut, { recursive: true });
  for (const model of models) {
    for (const platform of platforms) {
      const file = files[model.id][platform.id].file;
      fs.copyFileSync(path.join(outDir, file), path.join(siteOut, file));
    }
  }
  console.log(`Site copies: ${path.relative(root, siteOut)}`);
}

console.log('');
console.log(`Wrote ${models.length * platforms.length} ZIP file(s) to ${path.relative(root, outDir) || '.'}`);
console.log(`Manifest: ${path.relative(root, manifestPath)}`);