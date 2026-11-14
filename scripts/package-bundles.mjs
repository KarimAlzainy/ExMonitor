import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ZipArchive } from 'archiver';

/**
 * Builds one ZIP per assistant choice. Every ZIP contains the latest built app
 * plus a model-config.json that selects the assistant chosen on the download
 * page. The model itself is fetched once by the browser on first use.
 *
 *   node scripts/package-bundles.mjs
 *   node scripts/package-bundles.mjs --out bundles --manifest site/downloads.json
 *   node scripts/package-bundles.mjs --models phi3,none
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] ?? fallback;
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const version = argValue('--version', process.env.GITHUB_SHA?.slice(0, 7) || packageJson.version);
const outDir = path.resolve(root, argValue('--out', 'bundles'));
const distDir = path.join(root, 'dist');
const manifestPath = path.resolve(root, argValue('--manifest', path.join(outDir, 'downloads.json')));
const selection = argValue('--models', 'phi3,llama3,gemma2,none')
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

const MODELS = [
  {
    id: 'phi3',
    title: 'Phi-3.5 mini',
    folder: 'Ex-Monitor-Phi-3.5',
    zip: 'ex-monitor-phi3.zip',
    download: 'about 2.1 GB'
  },
  {
    id: 'llama3',
    title: 'Llama 3.2 3B',
    folder: 'Ex-Monitor-Llama-3.2',
    zip: 'ex-monitor-llama3.zip',
    download: 'about 1.8 GB'
  },
  {
    id: 'gemma2',
    title: 'Gemma 2 2B',
    folder: 'Ex-Monitor-Gemma-2',
    zip: 'ex-monitor-gemma2.zip',
    download: 'about 1.5 GB'
  },
  {
    id: 'none',
    title: 'No AI',
    folder: 'Ex-Monitor-No-AI',
    zip: 'ex-monitor-no-ai.zip',
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

fs.mkdirSync(outDir, { recursive: true });

const serverSource = fs.readFileSync(path.join(root, 'server.js'), 'utf8');
const builtAt = new Date().toISOString();

const startCmd = `@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto missing

node server.js
if errorlevel 1 pause
exit /b 0

:missing
echo.
echo Node.js 18 or newer is needed to run Ex-Monitor.
echo Install it from https://nodejs.org and run this file again.
echo.
pause
exit /b 1
`;

const startSh = `#!/bin/sh
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' "Node.js 18 or newer is needed to run Ex-Monitor." "Install it from https://nodejs.org and run this file again."
  read -r _
  exit 1
fi

node server.js
`;

const startCommand = `#!/bin/sh
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' "Node.js 18 or newer is needed to run Ex-Monitor." "Install it from https://nodejs.org and run this file again."
  read -r _
  exit 1
fi

node server.js
`;

function readmeFor(model) {
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
    'Ex-Monitor - crew health console',
    '================================',
    '',
    ...assistant,
    '',
    'How to start',
    '------------',
    '1. Install Node.js 18 or newer from https://nodejs.org if it is not installed.',
    '2. Windows: double-click "Start Ex-Monitor.cmd".',
    '   macOS: double-click "Start Ex-Monitor.command".',
    '   Linux: run ./start-ex-monitor.sh in a terminal.',
    '3. A browser opens at http://localhost:8080.',
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
    'Other consoles on the same network show a full-screen alert until each one',
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

function createZip(model) {
  const zipPath = path.join(outDir, model.zip);
  const rootName = model.folder;

  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 9 } });

    output.on('close', () => resolve(zipPath));
    output.on('error', reject);
    archive.on('error', reject);
    archive.on('warning', (error) => {
      if (error.code === 'ENOENT') console.warn(error.message);
      else reject(error);
    });

    archive.pipe(output);
    archive.append(readmeFor(model), { name: `${rootName}/README.txt` });
    archive.append(serverSource, { name: `${rootName}/server.js` });
    archive.append(startCmd, { name: `${rootName}/Start Ex-Monitor.cmd` });
    archive.append(startCommand, { name: `${rootName}/Start Ex-Monitor.command`, mode: 0o755 });
    archive.append(startSh, { name: `${rootName}/start-ex-monitor.sh`, mode: 0o755 });

    archive.directory(distDir, `${rootName}/app`, (entry) =>
      entry.name === 'model-config.json' ? false : entry
    );

    archive.append(
      JSON.stringify(
        {
          model: model.id,
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

function sha256(file) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(file);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

const models = MODELS.filter((model) => selection.includes(model.id));
const files = {};

for (const model of models) {
  process.stdout.write(`Packaging ${model.title} ... `);
  const zipPath = await createZip(model);
  const stats = fs.statSync(zipPath);
  const digest = await sha256(zipPath);
  files[model.id] = {
    file: model.zip,
    title: model.title,
    bytes: stats.size,
    sha256: digest,
    download: model.download
  };
  console.log(`${(stats.size / (1024 * 1024)).toFixed(1)} MB`);
}

const manifest = {
  version,
  builtAt,
  files
};

fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log('');
console.log(`Wrote ${models.length} ZIP file(s) to ${path.relative(root, outDir) || '.'}`);
console.log(`Manifest: ${path.relative(root, manifestPath)}`);
