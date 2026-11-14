const MODELS = [
  {
    id: 'phi3',
    name: 'Phi-3.5 mini',
    file: 'ex-monitor-phi3.zip',
    download: 'about 2.1 GB',
    note: 'The strongest answers. Best on a recent laptop with 8 GB of memory or more.'
  },
  {
    id: 'llama3',
    name: 'Llama 3.2 3B',
    file: 'ex-monitor-llama3.zip',
    download: 'about 1.8 GB',
    note: 'A balance of speed and detail. Works on most recent laptops.'
  },
  {
    id: 'gemma2',
    name: 'Gemma 2 2B',
    file: 'ex-monitor-gemma2.zip',
    download: 'about 1.5 GB',
    note: 'The smallest AI download. Best when the device has limited memory.'
  },
  {
    id: 'none',
    name: 'No AI',
    file: 'ex-monitor-no-ai.zip',
    download: 'nothing',
    note: 'Written NASA action cards only. Works on every device and never needs the internet.'
  }
];

const state = {
  tier: 'none',
  memory: null,
  cores: null,
  webgpu: null,
  gpu: '',
  manifest: null,
  scanned: false
};

const byId = (id) => document.getElementById(id);

function modelById(id) {
  return MODELS.find((model) => model.id === id) ?? MODELS[MODELS.length - 1];
}

function recommendedTier() {
  if (state.webgpu === false) return 'none';
  if (state.memory == null) {
    if ((state.cores ?? 0) >= 8) return 'phi3';
    if ((state.cores ?? 0) >= 4) return 'llama3';
    return 'gemma2';
  }
  if (state.memory >= 8) return 'phi3';
  if (state.memory >= 4) return 'llama3';
  if (state.memory >= 2) return 'gemma2';
  return 'none';
}

function renderModels() {
  const wrap = byId('models');
  if (!wrap) return;
  const suggested = recommendedTier();
  wrap.innerHTML = '';

  for (const model of MODELS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'model';
    button.dataset.model = model.id;
    button.setAttribute('role', 'radio');
    button.setAttribute('aria-checked', String(model.id === state.tier));
    button.tabIndex = model.id === state.tier ? 0 : -1;

    const head = document.createElement('span');
    head.className = 'model-head';

    const name = document.createElement('span');
    name.className = 'model-name';
    name.textContent = model.name;
    head.append(name);

    if (model.id === suggested) {
      const badge = document.createElement('span');
      badge.className = 'model-badge';
      badge.textContent = 'Suggested';
      head.append(badge);
    }

    const note = document.createElement('span');
    note.className = 'model-note';
    note.textContent = model.note;

    const size = document.createElement('span');
    size.className = 'model-size';
    size.textContent = model.id === 'none' ? 'no model download' : `first use: ${model.download}`;

    button.append(head, note, size);
    button.addEventListener('click', () => selectTier(model.id));
    wrap.append(button);
  }
}

function selectTier(tier) {
  state.tier = tier;
  for (const button of document.querySelectorAll('.model')) {
    const active = button.dataset.model === tier;
    button.setAttribute('aria-checked', String(active));
    button.tabIndex = active ? 0 : -1;
  }
  updateDownload();
}

function updateDownload() {
  const model = modelById(state.tier);
  const file = state.manifest?.files?.[model.id];
  const zip = file?.file ?? model.file;
  const button = byId('download-button');
  const meta = byId('download-meta');

  if (button) {
    button.href = `/downloads/${zip}`;
    button.setAttribute('download', zip);
    button.textContent = `Download for ${model.name}`;
  }

  if (!meta) return;
  const size =
    typeof file?.bytes === 'number'
      ? ` The ZIP is ${(file.bytes / (1024 * 1024)).toFixed(1)} MB.`
      : '';
  const assistant =
    model.id === 'none'
      ? 'No model download. The written NASA action cards do all the work.'
      : `The first use downloads ${model.download} once; after that the assistant works offline.`;
  meta.textContent = `${assistant}${size}`;
}

function updateDevice() {
  const summary = byId('device-summary');
  const facts = byId('device-facts');
  if (!summary || !facts) return;

  const suggested = modelById(recommendedTier());
  const memoryText =
    state.memory == null ? 'Not reported by this browser' : `${state.memory} GB reported`;
  const coreText = state.cores == null ? 'Not reported' : `${state.cores} cores`;
  const gpuText =
    state.webgpu == null
      ? 'Checking'
      : state.webgpu
        ? state.gpu
          ? `WebGPU · ${state.gpu}`
          : 'WebGPU ready'
        : 'WebGPU not available';

  if (state.webgpu === false) {
    summary.textContent =
      'This browser cannot run the on-device models. No AI is the safe choice, and the written NASA rules still work. You can pick an AI copy for a different computer.';
  } else if (state.webgpu == null) {
    summary.textContent = 'Checking what this browser can do…';
  } else if (state.memory == null) {
    summary.textContent = `${suggested.name} is a cautious suggestion for this computer because memory was not reported. You can choose another.`;
  } else {
    summary.textContent = `${suggested.name} fits this computer best. You can choose another copy.`;
  }

  const rows = [
    ['WebGPU', gpuText],
    ['Memory', memoryText],
    ['Processor', coreText],
    ['Suggested', suggested.name]
  ];

  facts.innerHTML = '';
  for (const [label, value] of rows) {
    const item = document.createElement('li');
    const key = document.createElement('span');
    key.textContent = label;
    const strong = document.createElement('strong');
    strong.textContent = value;
    item.append(key, strong);
    facts.append(item);
  }
}

async function scanDevice() {
  const summary = byId('device-summary');
  if (summary) summary.textContent = 'Checking this browser…';

  state.memory = typeof navigator.deviceMemory === 'number' ? navigator.deviceMemory : null;
  state.cores = typeof navigator.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : null;
  state.webgpu = false;
  state.gpu = '';

  if (navigator.gpu && typeof navigator.gpu.requestAdapter === 'function') {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      state.webgpu = Boolean(adapter);
      const info = adapter?.info;
      if (info) {
        const parts = [info.vendor, info.architecture].filter(Boolean);
        state.gpu = parts.join(' ');
      }
    } catch {
      state.webgpu = false;
    }
  }

  const firstScan = !state.scanned;
  state.scanned = true;
  renderModels();
  if (firstScan) selectTier(recommendedTier());
  updateDevice();
}

async function loadManifest() {
  const label = byId('build-label');
  try {
    const response = await fetch('./downloads.json', { cache: 'no-store' });
    if (!response.ok) return;
    const data = await response.json();
    if (!data || typeof data !== 'object' || !data.files) return;
    state.manifest = data;
    updateDownload();

    if (label && data.version) {
      const date = data.builtAt ? new Date(data.builtAt) : null;
      const when =
        date && !Number.isNaN(date.getTime())
          ? date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
          : '';
      label.textContent = when
        ? `Build ${data.version} · ${when} · built from the latest commit`
        : `Build ${data.version} · built from the latest commit`;
    }
  } catch {
    // The page still works without the manifest; sizes appear after download.
  }
}

function bindKeyboard() {
  const wrap = byId('models');
  if (!wrap) return;
  wrap.addEventListener('keydown', (event) => {
    const keys = ['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1;
    const index = MODELS.findIndex((model) => model.id === state.tier);
    const next = MODELS[(index + direction + MODELS.length) % MODELS.length];
    selectTier(next.id);
    const button = wrap.querySelector(`[data-model="${next.id}"]`);
    if (button instanceof HTMLElement) button.focus();
  });
}

byId('rescan')?.addEventListener('click', () => {
  void scanDevice();
});

renderModels();
updateDownload();
updateDevice();
bindKeyboard();
void scanDevice();
void loadManifest();
