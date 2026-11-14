# ExMonitor

An offline-first astronaut health console for deep-space missions. Built for the NASA Space Apps Challenge.

When Earth is up to **22 minutes away**, a crew cannot wait for a ground surgeon to answer. ExMonitor keeps the medical loop on board: it watches live vitals and radiation, runs NASA-derived safety rules, answers symptom questions with a local language model, and shares an SOS across the crew's own network.

The app is a single-page console that installs as a PWA and keeps working without an internet connection. A small local relay extends the SOS to other crew devices on the same Wi-Fi or hotspot.

---

## What it does

### Live telemetry
- Lead II ECG strip drawn on a phosphor grid, with PR, QRS, QTc and ST readings.
- Heart rate, blood oxygen, core temperature and GSR stress, each with a target range and a nominal, caution or critical label.
- Radiation dose rate and cumulative mission dose on scales marked with NASA's caution and ceiling limits (MR092L).
- One-second simulation with smooth, realistic drift; demo presets for normal, workout and emergency conditions.

### NASA safety rules
- A deterministic rules engine evaluates every reading against hypoxia, cardiac, thermal and radiation thresholds.
- A critical reading raises an SOS automatically.
- Five pre-approved symptom protocols with NASA references:
  - Chest pain / pressure — Flight Rule MED-10.4
  - Dizziness / hypoxia — EVA Contingency Med-3.2
  - Exhaustion / overheating — Flight Rule MED-8.1
  - Radiation flare exposure — MR092L
  - Arrhythmia / palpitations — MEDB 5.2

### On-device flight surgeon
- Streams triage answers from a local [Ollama](https://ollama.com) model with the live vitals snapshot attached to every question.
- Four modes: Phi-3 3.8B mini (recommended at 8 GB RAM), Llama-3.2, Gemma-2, and No-AI rules.
- When the model is offline, written fallback advice streams instead; the No-AI mode answers straight from the NASA protocol cards.
- Hardware scan estimates RAM, cores and storage, then recommends a model tier.

### Chest-strap pairing
- Camera QR scanner for `NASA-STRAP-*` labels, with a simulated label when the camera or decoder is unavailable.
- Web Bluetooth pairing to a standard heart-rate service (0x180D / characteristic 0x2A37).
- Graceful simulated handshake so the demo works without physical hardware.

### EXTEM-Mesh SOS
- SOS, acknowledgement and presence messages over a local WebSocket relay on port 8080.
- BroadcastChannel fallback between open tabs when the relay is not running.
- Automatic node discovery: every node announces itself every 7 seconds.
- Every connected device shows the same full-screen takeover and sounds the Klaxon.
- A second browser or phone on the same hotspot is enough to demonstrate it.

### Demo and emergency
- Slide-out demo controls with presets, manual sliders for every vital, and a test SOS.
- Synthesized pulse, confirmation ping and repeating two-tone Klaxon, generated in the browser with no audio files.
- A sound toggle and a calm, single-action emergency takeover.

---

## Tech stack

| Layer | Choice |
|---|---|
| UI | React 18, TypeScript, Tailwind CSS, lucide-react |
| Build | Vite 6, vite-plugin-pwa (Workbox service worker) |
| Local AI | Ollama over HTTP, proxied through Vite |
| Mesh | Node `ws` WebSocket relay, BroadcastChannel fallback |
| Browser APIs | Web Bluetooth, Web Audio, IndexedDB, Canvas, Service Worker, BarcodeDetector |

There is no cloud backend. Everything except the optional local model and the optional relay runs in the browser.

---

## Architecture

```text
Browser
├── Mission console (React PWA)
│   ├── Live telemetry ....... ECG, vitals, radiation scales
│   ├── Flight surgeon ....... chat, symptom cards, live snapshot
│   ├── Pairing .............. QR scan, Bluetooth handshake, model tiers
│   ├── Virtual lab .......... hazards, judge walkthrough
│   └── Demo and SOS ......... simulator drawer, emergency takeover
│
├── Mission state ............ one provider for vitals, rules, SOS, pairing, sound
├── NASA rules ............... thresholds + five protocol cards
├── Flight surgeon client .... Ollama streaming + written fallbacks
├── EXTEM-Mesh ............... WebSocket + BroadcastChannel transport
└── Strap and alarms ......... Web Bluetooth + Web Audio

External
├── Ollama ................... localhost:11434 (optional)
│   └── Vite proxy ........... /api/ollama → localhost:11434
└── Mesh relay ............... localhost:8080 (optional, for multi-device SOS)
```

A generated, interactive architecture map lives in `floorplan/` and is kept out of git.

---

## Getting started

### Prerequisites

- Node.js 20.6 or newer (tested on Node 24) and npm.
- Optional: [Ollama](https://ollama.com) for real model answers.
- Optional: a Bluetooth heart-rate strap.
- Optional: a second device or browser tab for the mesh demo.
- Chrome or Edge for Web Bluetooth and live QR decoding; other browsers fall back to simulation.

### Install

```bash
npm install
```

### Run the console

```bash
npm run dev
```

Open <http://localhost:5173>. The dev server listens on all local addresses, so phones on the same network can open the printed LAN URL.

### Start the mesh relay (optional)

In a second terminal:

```bash
npm run server
```

The relay listens on port 8080 and prints the hotspot URLs to use. Without it, the console still shares SOS between tabs in the same browser.

### Add a local flight surgeon (optional)

```bash
ollama pull phi3:3.8b-mini-4k-instruct-q8_0
ollama pull llama3.2
ollama pull gemma2
ollama serve
```

The console checks `/api/ollama` first (the Vite proxy) and then `http://localhost:11434` directly. If neither answers, answers fall back to the written guidance.

### Production build

```bash
npm run build
npm run preview
```

The production preview runs on <http://localhost:4173>. The build also generates the offline service worker and web manifest.

---

## Using the console

| Section | What you can do |
|---|---|
| **Live telemetry** | Watch the ECG, vitals and radiation, acknowledge the status strip, and send a crew SOS. |
| **Flight surgeon** | Ask a question or tap a symptom card. Every question carries the current vitals snapshot. |
| **Pairing** | Scan a strap label, bind a crew profile, run the Bluetooth handshake, choose a model tier, cache a pack, and see mesh peers. |
| **Virtual lab** | Read how the console answers the five hazards of spaceflight and follow the judge walkthrough. |

The header holds the mission clock, one-way Earth delay, mesh state, crew name, sound toggle and demo controls.

## Demo walkthrough

1. Open **Demo controls** and start in **Normal mode** so the ECG sits near 72 BPM and 98% SpO2.
2. On **Pairing**, scan the simulated strap label (`NASA-STRAP-EVA-409`), bind a crew role, then run the Bluetooth handshake.
3. Ask the **Flight surgeon** about dizziness. The live numbers travel with the question.
4. Switch the demo panel to **Emergency danger mode**. SpO2 falls to 84% and radiation jumps to 2.45 mSv/hr, which trips the Klaxon and the mesh SOS.
5. Acknowledge the alert to silence the alarm. A second browser on the same hotspot, with the relay running, receives the same overlay.

---

## NASA rules at a glance

| Signal | Caution | Critical |
|---|---|---|
| Blood oxygen (SpO2) | below 93% | below 88% |
| Heart rate | above 125 BPM | above 155 or below 42 BPM |
| Core temperature | 37.8 °C or higher | 38.8 °C or higher |
| Radiation dose rate | 0.30 mSv/hr or higher | 1.00 mSv/hr or higher |

These thresholds and the five symptom cards are adapted from public NASA aerospace medicine references for a hackathon demo. They are decision support, not flight-certified medical software.

---

## Ports and configuration

| Port | Service | Where |
|---|---|---|
| 5173 | Dev server | `vite.config.ts` |
| 4173 | Production preview | `vite.config.ts` |
| 8080 | Mesh relay | `server.js` (`WS_PORT`) |
| 11434 | Ollama | its own default; proxied by Vite |

Useful files:

- `vite.config.ts` — dev port, Ollama proxy, PWA manifest and caching.
- `tailwind.config.js` — the console's graphite, ink, signal, phosphor and status palette.
- `server.js` — relay port, LAN addresses and packet forwarding.
- `src/services/nasaRules.ts` — thresholds and symptom protocols.
- `src/context/TelemetryContext.tsx` — the single source of live state.

---

## Project structure

```text
ExMonitor/
├── index.html                  Page shell, title, icons, theme colour
├── server.js                   EXTEM-Mesh relay (port 8080)
├── vite.config.ts              Dev server, Ollama proxy, PWA build
├── tailwind.config.js          Colour and type tokens
├── public/                     App icons and favicons
├── scripts/                    Rollup WebAssembly fallback for builds
└── src/
    ├── main.tsx                App start-up and offline registration
    ├── App.tsx                 Frame, tabs, error boundary
    ├── index.css               Base surfaces, focus ring, sliders
    ├── components/
    │   ├── layout/             Header and section menu
    │   ├── dashboard/          ECG, vital cards, radiation scales
    │   ├── ai/                 Flight surgeon chat
    │   ├── setup/              Pairing screen and QR scanner
    │   ├── simulator/          Demo controls drawer
    │   ├── emergency/          Full-screen SOS takeover
    │   └── lab/                Virtual lab and walkthrough
    ├── context/                Live mission state
    ├── services/               Rules, AI client, mesh, Bluetooth, audio
    └── types/                  Shared data shapes
```

---

## What is simulated

The console is a hackathon demo. These parts are simulated today:

- Vitals are generated by a one-second simulator. Demo presets force normal, workout and emergency values.
- The ECG trace is drawn from the current heart rate, not measured from electrodes; a connected strap only changes the pulse driving it.
- Pairing falls back to a simulated handshake when Web Bluetooth or a strap is unavailable.
- The model pack cached on the Pairing screen is a stand-in written to IndexedDB; it does not contain real model weights.
- When Ollama is offline, the flight surgeon streams pre-written fallback advice.
- The camera scanner accepts the simulated label `NASA-STRAP-EVA-409` when live decoding is unavailable.

---

## Scripts

| Command | Does |
|---|---|
| `npm run dev` | Starts the Vite dev server on port 5173 for the local network. |
| `npm run build` | Type-checks and builds the production app, service worker and manifest. |
| `npm run preview` | Serves the production build on port 4173. |
| `npm run server` | Starts the EXTEM-Mesh relay on port 8080. |
| `npm run start` | Alias for the relay. |

---

## Browser support

- **Chrome / Edge** — full path, including Web Bluetooth and live QR decoding.
- **Safari / Firefox** — the console runs, but strap pairing and live camera decode fall back to simulation.
- Camera access needs HTTPS or `localhost`.
- Install the PWA from the browser menu to run it full-screen and offline.

---

## Credits

Built for the **NASA Space Apps Challenge**.

References used in the rules and protocols: NASA MR092L radiation monitoring, NASA MEDB 5.2 cardiovascular limits, NASA Flight Rules MED-10.4 and MED-8.1, and the EVA atmospheric-depletion contingency.

The five hazards of human spaceflight — space radiation, isolation, distance from Earth, gravity fields and the hostile closed environment — frame the Virtual lab section.
